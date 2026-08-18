// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { createDeepSeekClient, DeepSeekClientError } from "../../server/ai/deepseek-client.js";

const completionInput = {
  messages: [{ role: "user" as const, content: "测试" }],
  temperature: 0.5,
  maxTokens: 512,
  signal: new AbortController().signal,
};

function createClient(fetchImpl: typeof fetch) {
  return createDeepSeekClient({
    apiKey: "test-key",
    baseUrl: "https://example.test",
    model: "deepseek-v4-flash",
    fetchImpl,
  });
}

describe("DeepSeek client", () => {
  it("returns trimmed model content without exposing the key", async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      void input;
      void init;
      return new Response(JSON.stringify({ choices: [{ message: { content: "  结果  " } }] }), { status: 200 });
    });
    const client = createClient(fetchImpl as typeof fetch);
    await expect(client.complete(completionInput)).resolves.toBe("结果");
    const request = fetchImpl.mock.calls[0];
    expect(request[0]).toBe("https://example.test/chat/completions");
  });

  it("continues a response that stopped at the model length limit", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "这是被截断的前半段，" }, finish_reason: "length" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "这是自动补全的后半段。" }, finish_reason: "stop" }],
      }), { status: 200 }));

    const result = await createClient(fetchImpl as typeof fetch).complete(completionInput);

    expect(result).toBe("这是被截断的前半段，这是自动补全的后半段。");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const continuationBody = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body));
    expect(continuationBody.messages).toEqual(expect.arrayContaining([
      { role: "assistant", content: "这是被截断的前半段，" },
      expect.objectContaining({ role: "user", content: expect.stringContaining("不要重复已有内容") }),
    ]));
  });

  it.each([
    { status: 429, kind: "rate-limit", retryable: true },
    { status: 500, kind: "upstream", retryable: true },
    { status: 400, kind: "upstream", retryable: false },
  ] as const)("maps HTTP $status to $kind", async ({ status, kind, retryable }) => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { message: "raw upstream detail" } }), { status }));
    const error = await createClient(fetchImpl as typeof fetch).complete(completionInput).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DeepSeekClientError);
    expect(error).toMatchObject({ kind, retryable, status });
  });

  it("rejects a successful response with empty content", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), { status: 200 }));
    await expect(createClient(fetchImpl as typeof fetch).complete(completionInput)).rejects.toMatchObject({
      kind: "invalid-response",
      retryable: true,
    });
  });
});
