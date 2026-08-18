import { beforeEach, describe, expect, it } from "vitest";
import type { HistoryRecord } from "@shared/types/writing";
import { readStorage, writeStorage } from "@/lib/storage/core";
import { loadDrafts, saveDraft } from "@/lib/storage/drafts";
import { clearHistory, deleteHistoryRecord, loadHistory, upsertHistoryRecord } from "@/lib/storage/history";
import { loadSettings, saveSettings } from "@/lib/storage/settings";
import { historyRecordsSchema } from "@shared/validation";

const createRecord = (id = crypto.randomUUID()): HistoryRecord => {
  const now = new Date().toISOString();
  return {
    id,
    schemaVersion: 1,
    mode: "continue",
    input: { content: "测试原文", fields: {} },
    params: { creativity: 0.5, targetLength: 500, versionCount: 1 },
    versions: [
      { id: crypto.randomUUID(), content: "测试结果", source: "generated", createdAt: now, updatedAt: now },
    ],
    createdAt: now,
    updatedAt: now,
  };
};

describe("versioned local storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds, updates, deletes and clears history records", () => {
    const record = createRecord();
    expect(upsertHistoryRecord(record, localStorage)).toEqual({ ok: true });
    expect(loadHistory(localStorage).value).toHaveLength(1);

    const updated = { ...record, updatedAt: new Date(Date.now() + 1_000).toISOString() };
    expect(upsertHistoryRecord(updated, localStorage)).toEqual({ ok: true });
    expect(loadHistory(localStorage).value).toEqual([updated]);

    expect(deleteHistoryRecord(record.id, localStorage)).toEqual({ ok: true });
    expect(loadHistory(localStorage).value).toEqual([]);

    upsertHistoryRecord(createRecord(), localStorage);
    expect(clearHistory(localStorage)).toEqual({ ok: true });
    expect(loadHistory(localStorage).value).toEqual([]);
  });

  it("returns a recoverable issue for malformed or invalid data without deleting it", () => {
    localStorage.setItem("broken", "{not-json");
    const malformed = readStorage("broken", historyRecordsSchema, [], localStorage);
    expect(malformed).toEqual({ value: [], issue: "corrupt" });
    expect(localStorage.getItem("broken")).toBe("{not-json");

    localStorage.setItem("broken", JSON.stringify([{ schemaVersion: 99 }]));
    expect(readStorage("broken", historyRecordsSchema, [], localStorage)).toEqual({ value: [], issue: "corrupt" });
  });

  it("reports quota errors instead of discarding data", () => {
    const quotaStorage = {
      ...localStorage,
      setItem: () => {
        throw new DOMException("Storage full", "QuotaExceededError");
      },
    } as Storage;

    expect(writeStorage("key", { value: true }, quotaStorage)).toEqual({ ok: false, issue: "quota" });
  });

  it("reports unavailable storage", () => {
    expect(readStorage("key", historyRecordsSchema, [], null)).toEqual({ value: [], issue: "unavailable" });
    expect(writeStorage("key", [], null)).toEqual({ ok: false, issue: "unavailable" });
  });

  it("keeps drafts isolated by writing mode", () => {
    const updatedAt = new Date().toISOString();
    saveDraft("continue", { input: { content: "续写草稿", fields: { direction: "向下展开" } }, updatedAt }, localStorage);
    saveDraft("email", { input: { content: "邮件草稿", fields: { recipient: "客户" } }, updatedAt }, localStorage);

    const drafts = loadDrafts(localStorage).value.drafts;
    expect(drafts.continue?.input.content).toBe("续写草稿");
    expect(drafts.email?.input.fields.recipient).toBe("客户");
  });

  it("persists the active mode and confirmed generation parameters", () => {
    const settings = {
      schemaVersion: 1 as const,
      activeMode: "copywriting" as const,
      params: { creativity: 0.8, targetLength: 1_200, versionCount: 4 },
    };

    expect(saveSettings(settings, localStorage)).toEqual({ ok: true });
    expect(loadSettings(localStorage).value).toEqual(settings);
  });
});
