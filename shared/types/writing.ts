export const WRITING_MODES = [
  "continue",
  "rewrite",
  "expand",
  "summarize",
  "email",
  "copywriting",
] as const;

export type WritingMode = (typeof WRITING_MODES)[number];
export type WritingOperation = WritingMode | "optimize";

export interface GenerationParams {
  creativity: number;
  targetLength: number;
  versionCount: number;
}

export const DEFAULT_GENERATION_PARAMS: GenerationParams = {
  creativity: 0.5,
  targetLength: 500,
  versionCount: 1,
};

export interface WritingInput {
  content: string;
  fields: Record<string, string>;
}

export interface OutputVersion {
  id: string;
  content: string;
  structuredInput?: WritingInput;
  source: "generated" | "optimized";
  parentVersionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryRecord {
  id: string;
  schemaVersion: 1;
  mode: WritingOperation;
  input: WritingInput;
  params: GenerationParams;
  versions: OutputVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface Draft {
  input: WritingInput;
  updatedAt: string;
}

export interface DraftStore {
  schemaVersion: 1;
  drafts: Partial<Record<WritingMode, Draft>>;
}

export interface SettingsStore {
  schemaVersion: 1;
  activeMode: WritingMode;
  params: GenerationParams;
}

export interface GenerateRequest {
  mode: WritingMode;
  input: WritingInput;
  params: GenerationParams;
}

export interface OptimizeRequest {
  mode: WritingOperation;
  content: string;
  fields?: Record<string, string>;
  parentVersionId?: string;
  params: Pick<GenerationParams, "creativity" | "targetLength">;
}

export interface GeneratedVersionPayload {
  id: string;
  content: string;
  structuredInput?: WritingInput;
}

export interface GenerationResponse {
  requestId: string;
  versions: GeneratedVersionPayload[];
  requestedCount: number;
  completedCount: number;
  partial: boolean;
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_ERROR"
  | "PARTIAL_GENERATION"
  | "INTERNAL_ERROR";

export interface ApiErrorResponse {
  requestId: string;
  code: ApiErrorCode;
  message: string;
  retryable: boolean;
}
