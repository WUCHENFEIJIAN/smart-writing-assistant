import type { NextFunction, Request, Response } from "express";

interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

export function createRateLimit(options: RateLimitOptions = {}) {
  const limit = options.limit ?? 30;
  const windowMs = options.windowMs ?? 60_000;
  const buckets = new Map<string, RateBucket>();
  return (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now();
    const key = request.ip || "unknown";
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    response.setHeader("X-RateLimit-Limit", String(limit));
    response.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
    if (bucket.count > limit) {
      response.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1_000)));
      response.status(429).json({
        requestId: response.locals.requestId,
        code: "RATE_LIMITED",
        message: "请求过于频繁，请稍后再试",
        retryable: true,
      });
      return;
    }
    next();
  };
}

