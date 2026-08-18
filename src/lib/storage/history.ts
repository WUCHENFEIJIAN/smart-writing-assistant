import { historyRecordsSchema } from "@shared/validation";
import type { HistoryRecord } from "@shared/types/writing";
import { readStorage, resolveBrowserStorage, writeStorage, type StorageReadResult, type StorageWriteResult } from "./core";

export const HISTORY_STORAGE_KEY = "smart-writer:history:v1";

export function loadHistory(storage: Storage | null = resolveBrowserStorage()): StorageReadResult<HistoryRecord[]> {
  return readStorage(HISTORY_STORAGE_KEY, historyRecordsSchema, [], storage);
}

export function saveHistory(records: HistoryRecord[], storage: Storage | null = resolveBrowserStorage()): StorageWriteResult {
  return writeStorage(HISTORY_STORAGE_KEY, records, storage);
}

export function upsertHistoryRecord(
  record: HistoryRecord,
  storage: Storage | null = resolveBrowserStorage(),
): StorageWriteResult {
  const current = loadHistory(storage).value;
  const next = [record, ...current.filter((item) => item.id !== record.id)].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  return saveHistory(next, storage);
}

export function deleteHistoryRecord(
  recordId: string,
  storage: Storage | null = resolveBrowserStorage(),
): StorageWriteResult {
  const next = loadHistory(storage).value.filter((record) => record.id !== recordId);
  return saveHistory(next, storage);
}

export function clearHistory(storage: Storage | null = resolveBrowserStorage()): StorageWriteResult {
  return saveHistory([], storage);
}

export function replaceHistoryVersions(
  recordId: string,
  versions: HistoryRecord["versions"],
  storage: Storage | null = resolveBrowserStorage(),
): StorageWriteResult {
  const current = loadHistory(storage).value;
  const record = current.find((item) => item.id === recordId);
  if (!record) return { ok: false, issue: "corrupt" };
  return upsertHistoryRecord({ ...record, versions, updatedAt: new Date().toISOString() }, storage);
}

