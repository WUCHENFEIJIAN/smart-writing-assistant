// @vitest-environment node

import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../server/app.js";
import { DeepSeekClientError, type AiTextClient } from "../../server/ai/deepseek-client.js";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function startApp(client: AiTextClient, rateLimit?: { limit?: number; windowMs?: number }) {
  const app = createApp({ client, rateLimit, runnerOptions: { retryDelayMs: 0, timeoutMs: 1_000 } });
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

function validRequest(versionCount = 1) {
  return {
    mode: "continue",
    input: { content: "这是一段待续写内容", fields: { direction: "继续说明实际价值" } },
    params: { creativity: 0.5, targetLength: 500, versionCount },
  };
}

describe("writing API", () => {
  it("generates the requested number of versions and disables caching", async () => {
    const client: AiTextClient = { complete: vi.fn(async () => "生成结果") };
    const baseUrl = await startApp(client);
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRequest(3)),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({ requestedCount: 3, completedCount: 3, partial: false });
    expect(body.versions).toHaveLength(3);
  });

  it("keeps ordinary generation output free-form and unstructured", async () => {
    const client: AiTextClient = { complete: vi.fn(async () => "可直接使用的自由正文") };
    const baseUrl = await startApp(client);
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRequest()),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.versions[0]).toEqual(expect.objectContaining({ content: "可直接使用的自由正文" }));
    expect(body.versions[0]).not.toHaveProperty("structuredInput");
  });

  it("enforces a maximum of three concurrent model calls", async () => {
    let active = 0;
    let maximumActive = 0;
    const client: AiTextClient = {
      async complete() {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 15));
        active -= 1;
        return "生成结果";
      },
    };
    const baseUrl = await startApp(client);
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRequest(10)),
    });
    expect(response.status).toBe(200);
    expect(maximumActive).toBe(3);
  });

  it("returns successful versions when one version fails after retry", async () => {
    const client: AiTextClient = {
      async complete(input) {
        if (input.messages[1]?.content.includes("候选版本 1")) {
          throw new DeepSeekClientError("upstream", "temporary", true, 500);
        }
        return "可用结果";
      },
    };
    const baseUrl = await startApp(client);
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRequest(3)),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.completedCount).toBeGreaterThan(0);
    expect(body.completedCount).toBeLessThan(3);
    expect(body.partial).toBe(true);
  });

  it("returns all three versions when each candidate has two transient failures", async () => {
    const attempts = new Map<string, number>();
    const client: AiTextClient = {
      async complete(input) {
        const candidate = input.messages[1]?.content.match(/候选版本 (\d+)/)?.[1] ?? "unknown";
        const attempt = (attempts.get(candidate) ?? 0) + 1;
        attempts.set(candidate, attempt);
        if (attempt < 3) {
          throw new DeepSeekClientError("invalid-response", "empty transient response", true, 200);
        }
        return `候选版本 ${candidate}`;
      },
    };
    const baseUrl = await startApp(client);
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRequest(3)),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ requestedCount: 3, completedCount: 3, partial: false });
    expect(body.versions).toHaveLength(3);
    expect([...attempts.values()]).toEqual([3, 3, 3]);
  });

  it("rejects invalid parameters before calling the model", async () => {
    const complete = vi.fn(async () => "不应调用");
    const baseUrl = await startApp({ complete });
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRequest(11)),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("VALIDATION_ERROR");
    expect(complete).not.toHaveBeenCalled();
  });

  it("maps upstream timeouts without exposing raw errors", async () => {
    const client: AiTextClient = { complete: vi.fn(async () => { throw new DeepSeekClientError("timeout", "sensitive upstream detail", true); }) };
    const baseUrl = await startApp(client);
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRequest()),
    });
    const rawBody = await response.text();
    expect(response.status).toBe(502);
    expect(JSON.parse(rawBody).code).toBe("UPSTREAM_TIMEOUT");
    expect(rawBody).not.toContain("sensitive upstream detail");
  });

  it("optimizes content through a separate endpoint", async () => {
    const baseUrl = await startApp({
      complete: vi.fn(async () => JSON.stringify({
        content: "优化后的内容",
        fields: { tone: "更专业" },
      })),
    });
    const response = await fetch(`${baseUrl}/api/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "rewrite", content: "需要优化的内容", fields: { tone: "专业" }, params: { creativity: 0.5, targetLength: 500 } }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.versions[0].content).toBe("原始内容\n优化后的内容\n\n改写要求（可选）\n更专业");
    expect(body.versions[0].structuredInput).toEqual({ content: "优化后的内容", fields: { tone: "更专业" } });
  });

  it("applies the API rate limit", async () => {
    const baseUrl = await startApp({ complete: vi.fn(async () => "结果") }, { limit: 1, windowMs: 60_000 });
    expect((await fetch(`${baseUrl}/api/health`)).status).toBe(200);
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe("RATE_LIMITED");
  });

  it("rejects cross-site mutation requests before calling the model", async () => {
    const complete = vi.fn(async () => "不应调用");
    const baseUrl = await startApp({ complete });
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" },
      body: JSON.stringify(validRequest()),
    });
    expect(response.status).toBe(403);
    expect((await response.json()).message).toBe("不允许跨站请求");
    expect(complete).not.toHaveBeenCalled();
  });

  it("rejects request bodies larger than 64kb", async () => {
    const complete = vi.fn(async () => "不应调用");
    const baseUrl = await startApp({ complete });
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validRequest(), input: { content: "x".repeat(70_000), fields: {} } }),
    });
    expect(response.status).toBe(413);
    expect((await response.json()).message).toBe("请求内容过大");
    expect(complete).not.toHaveBeenCalled();
  });

  it("does not write user content to server logs", async () => {
    const privateContent = "private-user-content-marker";
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const baseUrl = await startApp({ complete: vi.fn(async () => "结果") });
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validRequest(), input: { content: privateContent, fields: {} } }),
    });
    expect(response.status).toBe(200);
    expect(JSON.stringify([...log.mock.calls, ...error.mock.calls])).not.toContain(privateContent);
  });
});
