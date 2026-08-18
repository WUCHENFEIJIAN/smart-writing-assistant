import { AlertCircle, Check, Copy, FileText, LoaderCircle, PencilLine, RefreshCw, Sparkles, TextCursorInput, WandSparkles, X } from "lucide-react";
import { useState } from "react";
import { MAX_INPUT_LENGTH } from "@shared/validation";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { MarkdownResult } from "@/components/workspace/markdown-result";
import { useWorkspace } from "@/hooks/use-workspace";
import { WRITING_MODE_CONFIGS } from "@/lib/modes";

export function WorkspacePage() {
  const [mobilePanel, setMobilePanel] = useState<"input" | "result">("input");
  const [copyMessage, setCopyMessage] = useState<string>();
  const [editingVersionId, setEditingVersionId] = useState<string>();
  const {
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
    updateContent,
    updateField,
    clearInput,
    setActiveVersionId,
    generate,
    optimizeInput,
    optimizeVersion,
    fillVersionIntoInput,
    updateVersion,
    cancelGeneration,
  } = useWorkspace();
  const config = WRITING_MODE_CONFIGS[activeMode];
  const activeVersion = versions.find((version) => version.id === activeVersionId) ?? versions[0];
  const editingActiveVersion = activeVersion?.id === editingVersionId;
  const busy = generationStatus === "generating" || generationStatus === "optimizing";

  const showResultsAfter = async (action: () => Promise<boolean>) => {
    setMobilePanel("result");
    await action();
  };

  const copyActiveVersion = async () => {
    if (!activeVersion) return;
    try {
      await navigator.clipboard.writeText(activeVersion.content);
      setCopyMessage("已复制到剪贴板");
    } catch {
      setCopyMessage("复制失败，请手动选择文本");
    }
  };

  const fillActiveVersion = () => {
    if (!activeVersion || !fillVersionIntoInput(activeVersion.id)) return;
    setMobilePanel("input");
    setCopyMessage("已填入输入区");
  };

  return (
    <div className="page-enter flex h-full min-h-0 flex-col p-2 lg:p-4">
      {storageIssue && (
        <p className="mb-2 flex shrink-0 items-center gap-2 rounded-xl border border-[rgb(233_152_50/15%)] bg-[var(--color-warning-soft)] px-4 py-2 text-xs text-[var(--color-warning-text)]" role="alert">
          <AlertCircle aria-hidden="true" size={14} />
          {storageIssue === "quota"
            ? "本地存储空间不足，当前内容仍会保留在页面中；请清理不需要的历史记录后重试。"
            : storageIssue === "corrupt"
              ? "部分本地数据已损坏，页面已使用可恢复的默认内容。"
              : "浏览器无法使用本地存储，关闭页面后草稿和历史记录可能丢失。"}
        </p>
      )}
      <div className="mb-2 rounded-xl bg-white/70 p-1 shadow-[0_3px_12px_rgb(38_75_95/6%)] lg:hidden">
        <SegmentedControl
          label="工作区域"
          value={mobilePanel}
          onChange={setMobilePanel}
          segments={[{ value: "input", label: "输入" }, { value: "result", label: "结果" }]}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[45%_55%]">
        <section className={`${mobilePanel === "input" ? "flex" : "hidden"} surface-card min-h-0 flex-col overflow-hidden lg:flex`} aria-label="输入内容">
          <div className="card-header flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-separator)] px-5">
            <div className="flex items-baseline gap-2">
              <h1 className="text-sm font-semibold">{config.inputLabel}</h1>
              <span className="text-xs text-[var(--color-muted)]">{input.content.length.toLocaleString("zh-CN")} 字</span>
            </div>
            <button type="button" onClick={clearInput} disabled={!input.content && Object.values(input.fields).every((value) => !value)} className="rounded-lg px-2 py-1 text-xs text-[var(--color-muted)] transition-colors hover:bg-[rgb(74_144_226/8%)] hover:text-[var(--color-accent-strong)]">清空</button>
          </div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            <textarea
              aria-label={config.inputLabel}
              placeholder={config.inputPlaceholder}
              maxLength={MAX_INPUT_LENGTH}
              value={input.content}
              onChange={(event) => updateContent(event.target.value)}
              className="editor-canvas min-h-56 lg:min-h-[45%]"
            />
            {config.fields.length > 0 && (
              <div className="space-y-4 border-t border-[var(--color-separator)] pt-5">
                {config.fields.map((field) => (
                  <label key={field.key} className="block text-sm font-medium">
                    {field.label}
                    {field.multiline ? (
                      <textarea
                        value={input.fields[field.key] ?? ""}
                        onChange={(event) => updateField(field.key, event.target.value)}
                        placeholder={field.placeholder}
                        maxLength={2_000}
                        className="field-control mt-2 min-h-20 resize-y"
                      />
                    ) : (
                      <input
                        value={input.fields[field.key] ?? ""}
                        onChange={(event) => updateField(field.key, event.target.value)}
                        placeholder={field.placeholder}
                        maxLength={2_000}
                        className="field-control mt-2"
                      />
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="card-action-bar flex min-h-16 shrink-0 items-center justify-between gap-3 border-t border-[var(--color-separator)] px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <span className="hidden items-center gap-1.5 whitespace-nowrap text-xs text-[var(--color-muted)] sm:flex lg:hidden xl:flex" aria-live="polite">
              {saveStatus === "error" ? <AlertCircle aria-hidden="true" size={14} className="text-[var(--color-danger)]" /> : <Check aria-hidden="true" size={14} className="text-[var(--color-success)]" />}
              {saveStatus === "error" ? (storageIssue === "quota" ? "本地空间不足" : "草稿保存失败") : saveStatus === "saving" ? "正在保存" : "草稿已保存"}
            </span>
            <div className="ml-auto flex w-full min-w-0 gap-1 sm:w-auto sm:gap-2" data-testid="input-actions">
              <button type="button" onClick={() => void showResultsAfter(optimizeInput)} disabled={!input.content.trim() || busy} className="secondary-button min-w-0 flex-1 px-2 text-xs sm:flex-none sm:px-3.5 sm:text-sm"><WandSparkles aria-hidden="true" size={15} />优化表达</button>
              <button type="button" onClick={() => activeVersion && void showResultsAfter(() => optimizeVersion(activeVersion.id))} className="secondary-button min-w-0 flex-1 px-2 text-xs sm:flex-none sm:px-3.5 sm:text-sm" disabled={!activeVersion?.structuredInput || busy}><Sparkles aria-hidden="true" size={15} />再次优化</button>
              {busy ? (
                <button type="button" onClick={cancelGeneration} className="secondary-button min-w-0 flex-1 px-2 text-xs sm:flex-none sm:px-3.5 sm:text-sm"><X aria-hidden="true" size={15} />取消</button>
              ) : (
                <button type="button" onClick={() => void showResultsAfter(generate)} disabled={!input.content.trim()} className="primary-button min-w-0 flex-1 px-2 text-xs sm:flex-none sm:px-3.5 sm:text-sm"><Sparkles aria-hidden="true" size={15} />生成内容</button>
              )}
            </div>
          </div>
        </section>

        <section className={`${mobilePanel === "result" ? "flex" : "hidden"} surface-card min-h-0 flex-col overflow-hidden lg:flex`} aria-label="生成结果">
          <div className="card-header flex h-14 shrink-0 items-center border-b border-[var(--color-separator)] px-4">
            {versions.length > 0 ? (
              <SegmentedControl
                label="生成版本"
                value={activeVersion?.id ?? versions[0].id}
                onChange={(versionId) => {
                  setEditingVersionId(undefined);
                  setActiveVersionId(versionId);
                }}
                segments={versions.map((version, index) => ({ value: version.id, label: version.source === "optimized" ? `优化 ${index + 1}` : `版本 ${index + 1}` }))}
                className="max-w-full flex-1 lg:max-w-xl"
              />
            ) : (
              <span className="text-sm font-semibold text-[var(--color-muted)]">{config.resultLabel}</span>
            )}
          </div>
          <div className="relative min-h-0 flex-1 overflow-y-auto p-6">
            {busy ? (
              <div className="grid h-full place-items-center text-center text-[var(--color-muted)]" role="status">
                <div><LoaderCircle data-testid="generation-spinner" aria-hidden="true" size={25} className="generation-spinner mx-auto mb-3 text-[var(--color-accent)]" /><p className="text-sm">{generationStatus === "optimizing" ? "正在优化表达…" : `正在生成 ${params.versionCount} 个版本…`}</p></div>
              </div>
            ) : generationError ? (
              <div className="grid h-full place-items-center text-center">
                <div className="max-w-sm"><AlertCircle aria-hidden="true" size={24} className="mx-auto mb-3 text-[var(--color-danger)]" /><p className="text-sm font-medium">{generationError.message}</p>{generationError.retryable && <button type="button" onClick={() => void showResultsAfter(generate)} className="secondary-button mt-4"><RefreshCw aria-hidden="true" size={15} />重试</button>}</div>
              </div>
            ) : activeVersion ? (
              <div className="mx-auto flex h-full max-w-3xl flex-col">
                {partialMessage && <p className="mb-3 rounded-lg bg-[var(--color-warning-soft)] px-3 py-2 text-xs text-[var(--color-warning-text)]">{partialMessage}</p>}
                <div className="mb-3 flex items-center justify-between gap-3 text-xs text-[var(--color-muted)]">
                  <span>{config.resultLabel}</span>
                  <div className="flex items-center gap-2">
                    <span>{activeVersion.content.length.toLocaleString("zh-CN")} 字</span>
                    <button
                      type="button"
                      aria-label={editingActiveVersion ? "完成编辑生成结果" : "编辑生成结果"}
                      title={editingActiveVersion ? "完成编辑" : "编辑生成结果"}
                      onClick={() => setEditingVersionId(editingActiveVersion ? undefined : activeVersion.id)}
                      className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--color-accent-strong)] transition-colors hover:bg-[rgb(74_144_226/9%)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]"
                    >
                      {editingActiveVersion ? <Check aria-hidden="true" size={13} /> : <PencilLine aria-hidden="true" size={13} />}
                      {editingActiveVersion ? "完成" : "编辑"}
                    </button>
                  </div>
                </div>
                {editingActiveVersion ? (
                  <textarea
                    autoFocus
                    aria-label="生成结果内容"
                    value={activeVersion.content}
                    onChange={(event) => updateVersion(activeVersion.id, event.target.value)}
                    className="editor-canvas min-h-72 flex-1"
                  />
                ) : (
                  <MarkdownResult content={activeVersion.content} />
                )}
              </div>
            ) : (
              <div className="grid h-full place-items-center text-center text-[var(--color-muted)]">
                <div><span className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-[linear-gradient(135deg,rgb(74_144_226/12%),rgb(80_200_120/12%))] text-[var(--color-accent-strong)]"><FileText aria-hidden="true" size={19} /></span><p className="text-sm">暂无生成结果</p></div>
              </div>
            )}
          </div>
          <div className="card-action-bar flex min-h-16 shrink-0 items-center justify-end gap-2 border-t border-[var(--color-separator)] px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]" data-testid="result-actions">
            <span className="mr-auto text-xs text-[var(--color-muted)]" aria-live="polite">{copyMessage}</span>
            {activeVersion?.structuredInput && (
              <button type="button" onClick={fillActiveVersion} className="primary-button">
                <TextCursorInput aria-hidden="true" size={15} />一键填入
              </button>
            )}
            <button type="button" onClick={() => void copyActiveVersion()} className="secondary-button" disabled={!activeVersion || busy}><Copy aria-hidden="true" size={15} />复制</button>
          </div>
        </section>
      </div>

    </div>
  );
}
