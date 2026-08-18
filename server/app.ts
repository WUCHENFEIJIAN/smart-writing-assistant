import express from "express";
import path from "node:path";
import { generateRequestSchema, optimizeRequestSchema } from "../shared/validation.js";
import type { AiTextClient } from "./ai/deepseek-client.js";
import { generateVersions, optimizeContent, type RunnerOptions } from "./ai/version-runner.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createRateLimit } from "./middleware/rate-limit.js";
import { requestSafety } from "./middleware/request-safety.js";

interface AppDependencies {
  client: AiTextClient;
  runnerOptions?: RunnerOptions;
  rateLimit?: { limit?: number; windowMs?: number };
  clientDist?: string;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  app.disable("x-powered-by");
  app.use((request, response, next) => {
    response.locals.requestId = request.get("x-request-id") || crypto.randomUUID();
    response.setHeader("X-Request-Id", response.locals.requestId);
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  app.use("/api", requestSafety);
  app.use("/api", createRateLimit(dependencies.rateLimit));

  app.get("/api/health", (_request, response) => response.json({ ok: true }));

  app.post("/api/generate", async (request, response, next) => {
    const parsed = generateRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ requestId: response.locals.requestId, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "输入内容无效", retryable: false });
      return;
    }
    try {
      response.json(await generateVersions(parsed.data, dependencies.client, dependencies.runnerOptions));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/optimize", async (request, response, next) => {
    const parsed = optimizeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ requestId: response.locals.requestId, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "输入内容无效", retryable: false });
      return;
    }
    try {
      response.json(await optimizeContent(parsed.data, dependencies.client, dependencies.runnerOptions));
    } catch (error) {
      next(error);
    }
  });

  app.use("/api", (_request, response) => response.status(404).json({ requestId: response.locals.requestId, code: "VALIDATION_ERROR", message: "接口不存在", retryable: false }));

  if (dependencies.clientDist) {
    app.use(express.static(dependencies.clientDist));
    app.use((request, response, next) => {
      if (request.method !== "GET") {
        next();
        return;
      }
      response.sendFile(path.join(dependencies.clientDist!, "index.html"));
    });
  }
  app.use(errorHandler);
  return app;
}
