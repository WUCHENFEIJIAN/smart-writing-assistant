import { apiErrorResponseSchema, generationResponseSchema } from "@shared/validation";
import type { ApiErrorCode, GenerateRequest, GenerationResponse, OptimizeRequest } from "@shared/types/writing";

export class WritingApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "WritingApiError";
  }
}

export function generateWriting(request: GenerateRequest, signal: AbortSignal): Promise<GenerationResponse> {
  return postWritingRequest("/api/generate", request, signal);
}

export function optimizeWriting(request: OptimizeRequest, signal: AbortSignal): Promise<GenerationResponse> {
  return postWritingRequest("/api/optimize", request, signal);
}

async function postWritingRequest(endpoint: string, body: unknown, signal: AbortSignal): Promise<GenerationResponse> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new WritingApiError("UPSTREAM_ERROR", "已取消生成", false);
    }
    throw new WritingApiError("UPSTREAM_ERROR", "网络连接失败，请检查网络后重试", true);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new WritingApiError("UPSTREAM_ERROR", "服务返回了无法解析的响应", response.status >= 500, response.status);
  }

  if (!response.ok) {
    const parsedError = apiErrorResponseSchema.safeParse(payload);
    if (parsedError.success) {
      throw new WritingApiError(parsedError.data.code, parsedError.data.message, parsedError.data.retryable, response.status);
    }
    throw new WritingApiError("UPSTREAM_ERROR", "生成服务暂时不可用", response.status >= 500, response.status);
  }

  const parsed = generationResponseSchema.safeParse(payload);
  if (!parsed.success || parsed.data.completedCount !== parsed.data.versions.length) {
    throw new WritingApiError("UPSTREAM_ERROR", "服务返回的数据不完整", true, response.status);
  }
  return parsed.data;
}
