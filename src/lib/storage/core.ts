import type { z } from "zod";

export type StorageIssue = "unavailable" | "corrupt" | "quota" | "unknown";

export interface StorageReadResult<T> {
  value: T;
  issue?: StorageIssue;
}

export type StorageWriteResult = { ok: true } | { ok: false; issue: StorageIssue };

export function resolveBrowserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readStorage<T>(
  key: string,
  schema: z.ZodType<T>,
  fallback: T,
  storage: Storage | null = resolveBrowserStorage(),
): StorageReadResult<T> {
  if (!storage) {
    return { value: fallback, issue: "unavailable" };
  }

  try {
    const raw = storage.getItem(key);
    if (raw === null) {
      return { value: fallback };
    }

    const parsedJson: unknown = JSON.parse(raw);
    const parsed = schema.safeParse(parsedJson);
    return parsed.success ? { value: parsed.data } : { value: fallback, issue: "corrupt" };
  } catch {
    return { value: fallback, issue: "corrupt" };
  }
}

export function writeStorage(
  key: string,
  value: unknown,
  storage: Storage | null = resolveBrowserStorage(),
): StorageWriteResult {
  if (!storage) {
    return { ok: false, issue: "unavailable" };
  }

  try {
    storage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (error) {
    if (isQuotaExceeded(error)) {
      return { ok: false, issue: "quota" };
    }
    return { ok: false, issue: "unknown" };
  }
}

function isQuotaExceeded(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

