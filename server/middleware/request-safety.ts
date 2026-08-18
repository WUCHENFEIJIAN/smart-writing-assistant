import type { NextFunction, Request, Response } from "express";

export function requestSafety(request: Request, response: Response, next: NextFunction) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method === "GET" || request.method === "HEAD") {
    next();
    return;
  }
  if (request.get("sec-fetch-site") === "cross-site") {
    response.status(403).json({
      requestId: response.locals.requestId,
      code: "VALIDATION_ERROR",
      message: "不允许跨站请求",
      retryable: false,
    });
    return;
  }
  next();
}

