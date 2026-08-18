import type { GenerateRequest, GenerationResponse, OptimizeRequest } from "../../shared/types/writing.js";
import { DeepSeekClientError, type AiTextClient } from "./deepseek-client.js";
import { buildGenerationMessages, buildOptimizeMessages, targetLengthToMaxTokens } from "./prompts.js";
import { formatOptimizedInput, parseOptimizedInput } from "./optimized-input.js";

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS_PER_VERSION = 3;

export interface RunnerOptions {
  concurrency?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
}

export async function generateVersions(
  request: GenerateRequest,
  client: AiTextClient,
  options: RunnerOptions = {},
): Promise<GenerationResponse> {
  const requestId = crypto.randomUUID();
  const tasks = Array.from({ length: request.params.versionCount }, (_, index) => index);
  const results = await mapWithConcurrency(tasks, options.concurrency ?? DEFAULT_CONCURRENCY, async (versionIndex) => {
    try {
      const content = await completeWithRetry(
        client,
        {
          messages: buildGenerationMessages(request, versionIndex),
          temperature: request.params.creativity,
          maxTokens: targetLengthToMaxTokens(request.params.targetLength),
        },
        options,
        (result) => result,
      );
      return { ok: true as const, value: { id: crypto.randomUUID(), content } };
    } catch (error) {
      return { ok: false as const, error };
    }
  });

  const versions = results.filter((result) => result.ok).map((result) => result.value);
  if (versions.length === 0) {
    const firstFailure = results.find((result) => !result.ok);
    throw firstFailure?.error ?? new DeepSeekClientError("upstream", "模型生成失败", true);
  }

  return {
    requestId,
    versions,
    requestedCount: request.params.versionCount,
    completedCount: versions.length,
    partial: versions.length !== request.params.versionCount,
  };
}

export async function optimizeContent(
  request: OptimizeRequest,
  client: AiTextClient,
  options: RunnerOptions = {},
): Promise<GenerationResponse> {
  const original = { content: request.content, fields: request.fields ?? {} };
  const structuredInput = await completeWithRetry(
    client,
    {
      messages: buildOptimizeMessages(request),
      temperature: request.params.creativity,
      maxTokens: targetLengthToMaxTokens(request.params.targetLength),
    },
    options,
    (content) => parseOptimizedInput(request.mode, content, original),
  );
  return {
    requestId: crypto.randomUUID(),
    versions: [{
      id: crypto.randomUUID(),
      content: formatOptimizedInput(request.mode, structuredInput),
      structuredInput,
    }],
    requestedCount: 1,
    completedCount: 1,
    partial: false,
  };
}

async function completeWithRetry<T>(
  client: AiTextClient,
  input: Omit<Parameters<AiTextClient["complete"]>[0], "signal">,
  options: RunnerOptions,
  transform: (content: string) => T,
): Promise<T> {
  let latestError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_VERSION; attempt += 1) {
    try {
      const content = await client.complete({
        ...input,
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
      return transform(content);
    } catch (error) {
      latestError = error;
      const retryable = error instanceof DeepSeekClientError && error.retryable;
      if (!retryable || attempt === MAX_ATTEMPTS_PER_VERSION - 1) throw error;
      await delay((options.retryDelayMs ?? 120) + Math.floor(Math.random() * 80));
    }
  }
  throw latestError;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await task(items[currentIndex]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, Math.floor(limit)), items.length) }, () => worker()));
  return results;
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}
