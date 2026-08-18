import { createContext } from "react";
import type { GenerationParams, HistoryRecord, OutputVersion, WritingInput, WritingMode } from "@shared/types/writing";
import type { StorageIssue } from "@/lib/storage/core";

export interface WorkspaceContextValue {
  activeMode: WritingMode;
  input: WritingInput;
  params: GenerationParams;
  saveStatus: "saved" | "saving" | "error";
  storageIssue?: StorageIssue;
  versions: OutputVersion[];
  activeVersionId?: string;
  generationStatus: "idle" | "generating" | "optimizing" | "error";
  generationError?: { message: string; retryable: boolean };
  partialMessage?: string;
  setActiveMode: (mode: WritingMode) => void;
  updateContent: (content: string) => void;
  updateField: (key: string, value: string) => void;
  clearInput: () => void;
  updateParams: (params: Partial<GenerationParams>) => void;
  setActiveVersionId: (versionId: string) => void;
  generate: () => Promise<boolean>;
  optimizeInput: () => Promise<boolean>;
  optimizeVersion: (versionId: string) => Promise<boolean>;
  fillVersionIntoInput: (versionId: string) => boolean;
  updateVersion: (versionId: string, content: string) => void;
  cancelGeneration: () => void;
  loadHistoryRecord: (record: HistoryRecord) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
