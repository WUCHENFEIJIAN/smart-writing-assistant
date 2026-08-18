import type { ErrorRequestHandler } from "express";
import { DeepSeekClientError } from "../ai/deepseek-client.js";

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  void next;
  const requestId = response.locals.requestId || crypto.randomUUID();
  if (error instanceof DeepSeekClientError) {
    const timeout = error.kind === "timeout";
    const rateLimited = error.kind === "rate-limit";
    response.status(rateLimited ? 429 : 502).json({
      requestId,
      code: rateLimited ? "RATE_LIMITED" : timeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR",
      message: timeout ? "模型响应超时，请重试" : rateLimited ? "模型服务请求过于频繁，请稍后再试" : "模型服务暂时不可用",
      retryable: error.retryable,
    });
    return;
  }
  if (isBodyParserError(error)) {
    response.status(error.status).json({
      requestId,
      code: "VALIDATION_ERROR",
      message: error.status === 413 ? "请求内容过大" : "请求内容格式无效",
      retryable: false,
    });
    return;
  }
  response.status(500).json({
    requestId,
    code: "INTERNAL_ERROR",
    message: "服务暂时不可用，请稍后重试",
    retryable: true,
  });
};

function isBodyParserError(error: unknown): error is { status: number } {
  return typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" && (error.status === 400 || error.status === 413);
}
