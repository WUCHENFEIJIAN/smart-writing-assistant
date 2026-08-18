import { z } from "zod";
import { WRITING_MODES } from "./types/writing.js";

export const MAX_INPUT_LENGTH = 20_000;
export const MAX_AUXILIARY_FIELD_LENGTH = 2_000;

export const writingModeSchema = z.enum(WRITING_MODES);

export const generationParamsSchema = z.object({
  creativity: z.number().min(0).max(1),
  targetLength: z.number().int().min(100).max(5_000),
  versionCount: z.number().int().min(1).max(10),
});

export const writingInputSchema = z.object({
  content: z.string().trim().min(1, "请输入主要内容").max(MAX_INPUT_LENGTH, "主要内容过长"),
  fields: z.record(z.string(), z.string().max(MAX_AUXILIARY_FIELD_LENGTH)).default({}),
});

export const generateRequestSchema = z.object({
  mode: writingModeSchema,
  input: writingInputSchema,
  params: generationParamsSchema,
});

export const optimizeRequestSchema = z.object({
  mode: z.union([writingModeSchema, z.literal("optimize")]),
  content: z.string().trim().min(1, "请输入需要优化的内容").max(MAX_INPUT_LENGTH),
  fields: z.record(z.string(), z.string().max(MAX_AUXILIARY_FIELD_LENGTH)).default({}),
  parentVersionId: z.string().uuid().optional(),
  params: generationParamsSchema.pick({ creativity: true, targetLength: true }),
});

export const outputVersionSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  structuredInput: writingInputSchema.optional(),
  source: z.enum(["generated", "optimized"]),
  parentVersionId: z.string().uuid().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const historyRecordSchema = z.object({
  id: z.string().uuid(),
  schemaVersion: z.literal(1),
  mode: z.union([writingModeSchema, z.literal("optimize")]),
  input: writingInputSchema,
  params: generationParamsSchema,
  versions: z.array(outputVersionSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const historyRecordsSchema = z.array(historyRecordSchema);

export const draftSchema = z.object({
  input: z.object({
    content: z.string().max(MAX_INPUT_LENGTH),
    fields: z.record(z.string(), z.string().max(MAX_AUXILIARY_FIELD_LENGTH)),
  }),
  updatedAt: z.string(),
});

export const draftStoreSchema = z.object({
  schemaVersion: z.literal(1),
  drafts: z.partialRecord(writingModeSchema, draftSchema),
});

export const settingsStoreSchema = z.object({
  schemaVersion: z.literal(1),
  activeMode: writingModeSchema,
  params: generationParamsSchema,
});

export const generatedVersionPayloadSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1),
  structuredInput: writingInputSchema.optional(),
});

export const generationResponseSchema = z.object({
  requestId: z.string().uuid(),
  versions: z.array(generatedVersionPayloadSchema).min(1),
  requestedCount: z.number().int().min(1).max(10),
  completedCount: z.number().int().min(1).max(10),
  partial: z.boolean(),
});

export const apiErrorResponseSchema = z.object({
  requestId: z.string(),
  code: z.enum(["VALIDATION_ERROR", "RATE_LIMITED", "UPSTREAM_TIMEOUT", "UPSTREAM_ERROR", "PARTIAL_GENERATION", "INTERNAL_ERROR"]),
  message: z.string(),
  retryable: z.boolean(),
});
