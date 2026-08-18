import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_GENERATION_PARAMS,
  type Draft,
  type DraftStore,
  type GenerationParams,
  type GeneratedVersionPayload,
  type HistoryRecord,
  type OutputVersion,
  type WritingInput,
  type WritingMode,
} from "@shared/types/writing";
import type { StorageIssue } from "@/lib/storage/core";
import { generateWriting, optimizeWriting, WritingApiError } from "@/lib/api-client";
import { DRAFT_STORAGE_KEY, loadDrafts, saveDrafts } from "@/lib/storage/drafts";
import { replaceHistoryVersions, upsertHistoryRecord } from "@/lib/storage/history";
import { loadSettings, saveSettings, SETTINGS_STORAGE_KEY } from "@/lib/storage/settings";
import { WorkspaceContext, type WorkspaceContextValue } from "./workspace-context-value";

type SaveStatus = "saved" | "saving" | "error";
const EMPTY_INPUT: WritingInput = { content: "", fields: {} };

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const initialSettings = useMemo(() => loadSettings(), []);
  const initialDrafts = useMemo(() => loadDrafts(), []);
  const [activeMode, setActiveModeState] = useState<WritingMode>(initialSettings.value.activeMode);
  const [params, setParams] = useState<GenerationParams>(initialSettings.value.params ?? DEFAULT_GENERATION_PARAMS);
  const [draftStore, setDraftStore] = useState<DraftStore>(initialDrafts.value);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initialSettings.issue || initialDrafts.issue ? "error" : "saved");
  const [storageIssue, setStorageIssue] = useState<StorageIssue | undefined>(initialSettings.issue ?? initialDrafts.issue);
  const [versions, setVersions] = useState<OutputVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string>();
  const [generationStatus, setGenerationStatus] = useState<WorkspaceContextValue["generationStatus"]>("idle");
  const [generationError, setGenerationError] = useState<WorkspaceContextValue["generationError"]>();
  const [partialMessage, setPartialMessage] = useState<string>();
  const [currentRecordId, setCurrentRecordId] = useState<string>();
  const requestController = useRef<AbortController | null>(null);
  const versionSaveTimer = useRef<number | null>(null);

  const input = draftStore.drafts[activeMode]?.input ?? EMPTY_INPUT;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const draftsResult = saveDrafts(draftStore);
      const settingsResult = saveSettings({ schemaVersion: 1, activeMode, params });
      const issue = !draftsResult.ok ? draftsResult.issue : !settingsResult.ok ? settingsResult.issue : undefined;
      if (issue) setStorageIssue(issue);
      setSaveStatus(issue ? "error" : "saved");
    }, 300);
    return () => window.clearTimeout(timer);
  }, [activeMode, draftStore, params]);

  useEffect(() => {
    const synchronizeStorage = (event: StorageEvent) => {
      if (event.key === DRAFT_STORAGE_KEY) {
        const result = loadDrafts();
        setDraftStore(result.value);
        setStorageIssue(result.issue);
        setSaveStatus(result.issue ? "error" : "saved");
      }
      if (event.key === SETTINGS_STORAGE_KEY) {
        const result = loadSettings();
        setActiveModeState(result.value.activeMode);
        setParams(result.value.params);
        setStorageIssue(result.issue);
        setSaveStatus(result.issue ? "error" : "saved");
      }
    };
    window.addEventListener("storage", synchronizeStorage);
    return () => window.removeEventListener("storage", synchronizeStorage);
  }, []);

  useEffect(() => () => {
    requestController.current?.abort();
    if (versionSaveTimer.current) window.clearTimeout(versionSaveTimer.current);
  }, []);

  const updateDraft = (updater: (current: WritingInput) => WritingInput) => {
    setSaveStatus("saving");
    setDraftStore((currentStore) => {
      const currentInput = currentStore.drafts[activeMode]?.input ?? EMPTY_INPUT;
      const draft: Draft = { input: updater(currentInput), updatedAt: new Date().toISOString() };
      return { schemaVersion: 1, drafts: { ...currentStore.drafts, [activeMode]: draft } };
    });
  };

  const persistRecord = (record: HistoryRecord) => {
    const result = upsertHistoryRecord(record);
    if (!result.ok) {
      setStorageIssue(result.issue);
      setSaveStatus("error");
    }
  };

  const startRequest = (status: "generating" | "optimizing") => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setGenerationStatus(status);
    setGenerationError(undefined);
    setPartialMessage(undefined);
    return controller;
  };

  const finishRequestWithError = (error: unknown) => {
    if (error instanceof WritingApiError && error.message === "已取消生成") {
      setGenerationStatus("idle");
      return;
    }
    setGenerationStatus("error");
    setGenerationError({
      message: error instanceof WritingApiError ? error.message : "生成失败，请稍后重试",
      retryable: error instanceof WritingApiError ? error.retryable : true,
    });
  };

  const toOutputVersions = (
    payloads: GeneratedVersionPayload[],
    source: OutputVersion["source"],
    parentVersionId?: string,
  ): OutputVersion[] => {
    const now = new Date().toISOString();
    return payloads.map((payload) => ({ ...payload, source, parentVersionId, createdAt: now, updatedAt: now }));
  };

  const createRecord = (recordVersions: OutputVersion[], mode: HistoryRecord["mode"]): HistoryRecord => {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      schemaVersion: 1,
      mode,
      input,
      params,
      versions: recordVersions,
      createdAt: now,
      updatedAt: now,
    };
  };

  const generate = async () => {
    if (!input.content.trim()) {
      setGenerationStatus("error");
      setGenerationError({ message: "请输入主要内容", retryable: false });
      return false;
    }
    const controller = startRequest("generating");
    try {
      const response = await generateWriting({ mode: activeMode, input, params }, controller.signal);
      const nextVersions = toOutputVersions(response.versions, "generated");
      const record = createRecord(nextVersions, activeMode);
      setVersions(nextVersions);
      setActiveVersionId(nextVersions[0]?.id);
      setCurrentRecordId(record.id);
      setGenerationStatus("idle");
      if (response.partial) setPartialMessage(`已生成 ${response.completedCount}/${response.requestedCount} 个版本`);
      persistRecord(record);
      return true;
    } catch (error) {
      finishRequestWithError(error);
      return false;
    }
  };

  const optimizeInput = async () => {
    if (!input.content.trim()) {
      setGenerationStatus("error");
      setGenerationError({ message: "请输入需要优化的内容", retryable: false });
      return false;
    }
    const controller = startRequest("optimizing");
    try {
      const response = await optimizeWriting(
        {
          mode: activeMode,
          content: input.content,
          fields: input.fields,
          params: { creativity: params.creativity, targetLength: params.targetLength },
        },
        controller.signal,
      );
      const nextVersions = toOutputVersions(response.versions, "optimized");
      const record = createRecord(nextVersions, "optimize");
      setVersions(nextVersions);
      setActiveVersionId(nextVersions[0]?.id);
      setCurrentRecordId(record.id);
      setGenerationStatus("idle");
      persistRecord(record);
      return true;
    } catch (error) {
      finishRequestWithError(error);
      return false;
    }
  };

  const optimizeVersion = async (versionId: string) => {
    const sourceVersion = versions.find((version) => version.id === versionId);
    if (!sourceVersion?.structuredInput) return false;
    const controller = startRequest("optimizing");
    try {
      const response = await optimizeWriting(
        {
          mode: activeMode,
          content: sourceVersion.structuredInput.content,
          fields: sourceVersion.structuredInput.fields,
          parentVersionId: versionId,
          params: { creativity: params.creativity, targetLength: params.targetLength },
        },
        controller.signal,
      );
      const optimized = toOutputVersions(response.versions, "optimized", versionId);
      const nextVersions = [...versions, ...optimized];
      setVersions(nextVersions);
      setActiveVersionId(optimized[0]?.id);
      setGenerationStatus("idle");
      if (currentRecordId) replaceHistoryVersions(currentRecordId, nextVersions);
      return true;
    } catch (error) {
      finishRequestWithError(error);
      return false;
    }
  };

  const updateVersion = (versionId: string, content: string) => {
    const now = new Date().toISOString();
    const nextVersions = versions.map((version) => version.id === versionId
      ? { ...version, content, structuredInput: version.source === "optimized" ? undefined : version.structuredInput, updatedAt: now }
      : version);
    setVersions(nextVersions);
    if (currentRecordId) {
      if (versionSaveTimer.current) window.clearTimeout(versionSaveTimer.current);
      versionSaveTimer.current = window.setTimeout(() => {
        const result = replaceHistoryVersions(currentRecordId, nextVersions);
        if (!result.ok) {
          setStorageIssue(result.issue);
          setSaveStatus("error");
        }
      }, 300);
    }
  };

  const value: WorkspaceContextValue = {
    activeMode,
    input,
    params,
    saveStatus,
    storageIssue,
    versions,
    activeVersionId,
    generationStatus,
    generationError,
    partialMessage,
    setActiveMode: (mode) => {
      requestController.current?.abort();
      setSaveStatus("saving");
      setActiveModeState(mode);
      setVersions([]);
      setActiveVersionId(undefined);
      setCurrentRecordId(undefined);
      setGenerationStatus("idle");
      setGenerationError(undefined);
      setPartialMessage(undefined);
    },
    updateContent: (content) => updateDraft((current) => ({ ...current, content })),
    updateField: (key, fieldValue) =>
      updateDraft((current) => ({ ...current, fields: { ...current.fields, [key]: fieldValue } })),
    clearInput: () => updateDraft(() => EMPTY_INPUT),
    updateParams: (partial) => {
      setSaveStatus("saving");
      setParams((current) => ({ ...current, ...partial }));
    },
    setActiveVersionId,
    generate,
    optimizeInput,
    optimizeVersion,
    fillVersionIntoInput: (versionId) => {
      const structuredInput = versions.find((version) => version.id === versionId)?.structuredInput;
      if (!structuredInput) return false;
      updateDraft(() => ({ content: structuredInput.content, fields: { ...structuredInput.fields } }));
      return true;
    },
    updateVersion,
    cancelGeneration: () => requestController.current?.abort(),
    loadHistoryRecord: (record) => {
      requestController.current?.abort();
      const targetMode = record.mode === "optimize" ? activeMode : record.mode;
      setActiveModeState(targetMode);
      setDraftStore((current) => ({
        schemaVersion: 1,
        drafts: {
          ...current.drafts,
          [targetMode]: { input: record.input, updatedAt: new Date().toISOString() },
        },
      }));
      setParams(record.params);
      setVersions(record.versions);
      setActiveVersionId(record.versions[0]?.id);
      setCurrentRecordId(record.id);
      setGenerationStatus("idle");
      setGenerationError(undefined);
      setPartialMessage(undefined);
      setSaveStatus("saving");
    },
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
