import { draftStoreSchema } from "@shared/validation";
import type { Draft, DraftStore, WritingMode } from "@shared/types/writing";
import { readStorage, resolveBrowserStorage, writeStorage, type StorageReadResult, type StorageWriteResult } from "./core";

export const DRAFT_STORAGE_KEY = "smart-writer:drafts:v1";
const EMPTY_DRAFT_STORE: DraftStore = { schemaVersion: 1, drafts: {} };

export function loadDrafts(storage: Storage | null = resolveBrowserStorage()): StorageReadResult<DraftStore> {
  return readStorage(DRAFT_STORAGE_KEY, draftStoreSchema, EMPTY_DRAFT_STORE, storage);
}

export function saveDraft(
  mode: WritingMode,
  draft: Draft,
  storage: Storage | null = resolveBrowserStorage(),
): StorageWriteResult {
  const current = loadDrafts(storage).value;
  return writeStorage(
    DRAFT_STORAGE_KEY,
    { schemaVersion: 1, drafts: { ...current.drafts, [mode]: draft } } satisfies DraftStore,
    storage,
  );
}

export function saveDrafts(
  drafts: DraftStore,
  storage: Storage | null = resolveBrowserStorage(),
): StorageWriteResult {
  return writeStorage(DRAFT_STORAGE_KEY, drafts, storage);
}

