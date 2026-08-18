export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionInput {
  messages: AiMessage[];
  temperature: number;
  maxTokens: number;
  signal: AbortSignal;
}

export interface AiTextClient {
  complete(input: CompletionInput): Promise<string>;
}

export type DeepSeekFailureKind = "timeout" | "rate-limit" | "upstream" | "invalid-response";

export class DeepSeekClientError extends Error {
  constructor(
    public readonly kind: DeepSeekFailureKind,
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "DeepSeekClientError";
  }
}

interface DeepSeekClientConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetchImpl?: typeof fetch;
}

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  error?: { message?: string };
}

const MAX_LENGTH_CONTINUATIONS = 2;
const CONTINUATION_PROMPT = "上次输出因长度限制中断。请从最后一个字符后继续，只返回尚未完成的部分，不要重复已有内容，不要解释。";

export function createDeepSeekClient(config: DeepSeekClientConfig): AiTextClient {
  const fetchImpl = config.fetchImpl ?? fetch;
  const endpoint = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;

  return {
    async complete(input) {
      const parts: string[] = [];
      let messages = input.messages;

      for (let continuation = 0; continuation <= MAX_LENGTH_CONTINUATIONS; continuation += 1) {
        let response: Response;
        try {
          response = await fetchImpl(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
              model: config.model,
              messages,
              temperature: input.temperature,
              max_tokens: input.maxTokens,
              stream: false,
            }),
            signal: input.signal,
          });
        } catch (error) {
          if (isAbortError(error) || input.signal.aborted) {
            throw new DeepSeekClientError("timeout", "模型请求超时", true);
          }
          throw new DeepSeekClientError("upstream", "无法连接到模型服务", true);
        }

        let payload: DeepSeekResponse;
        try {
          payload = (await response.json()) as DeepSeekResponse;
        } catch {
          throw new DeepSeekClientError("invalid-response", "模型返回了无法解析的响应", false, response.status);
        }

        if (!response.ok) {
          const rateLimited = response.status === 429;
          const retryable = rateLimited || response.status >= 500;
          throw new DeepSeekClientError(
            rateLimited ? "rate-limit" : "upstream",
            rateLimited ? "模型服务请求过于频繁" : payload.error?.message || "模型服务暂时不可用",
            retryable,
            response.status,
          );
        }

        const choice = payload.choices?.[0];
        const content = choice?.message?.content?.trim();
        if (!content) {
          throw new DeepSeekClientError("invalid-response", "模型没有返回有效内容", true, response.status);
        }
        parts.push(content);

        if (choice?.finish_reason !== "length") return parts.join("").trim();
        if (continuation === MAX_LENGTH_CONTINUATIONS) {
          throw new DeepSeekClientError("invalid-response", "模型输出多次达到长度上限", false, response.status);
        }

        messages = [
          ...input.messages,
          { role: "assistant", content: parts.join("") },
          { role: "user", content: CONTINUATION_PROMPT },
        ];
      }

      throw new DeepSeekClientError("invalid-response", "模型输出不完整", false);
    },
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}
