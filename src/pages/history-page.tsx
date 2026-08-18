import { AlertCircle, ArrowLeft, Clock3, Copy, History, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { HistoryRecord, OutputVersion } from "@shared/types/writing";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { ModalDialog } from "@/components/shared/modal-dialog";
import { useWorkspace } from "@/hooks/use-workspace";
import { WRITING_MODE_CONFIGS } from "@/lib/modes";
import { clearHistory, deleteHistoryRecord as removeHistoryRecord, HISTORY_STORAGE_KEY, loadHistory } from "@/lib/storage/history";
import type { StorageIssue } from "@/lib/storage/core";

const FIELD_LABELS: Record<string, string> = {
  direction: "续写方向",
  tone: "语气或要求",
  focus: "重点方向",
  recipient: "收件对象",
  audience: "目标受众",
  platform: "发布平台",
  sellingPoints: "核心卖点",
};

export function HistoryPage() {
  const initialHistory = useMemo(() => loadHistory(), []);
  const [records, setRecords] = useState(initialHistory.value);
  const [selectedId, setSelectedId] = useState<string | undefined>(initialHistory.value[0]?.id);
  const [activeVersionId, setActiveVersionId] = useState<string | undefined>(initialHistory.value[0]?.versions[0]?.id);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<HistoryRecord>();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearAcknowledged, setClearAcknowledged] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string>();
  const [storageIssue, setStorageIssue] = useState<StorageIssue | undefined>(initialHistory.issue);
  const navigate = useNavigate();
  const { loadHistoryRecord } = useWorkspace();
  const selectedRecord = records.find((record) => record.id === selectedId) ?? records[0];
  const activeVersion = selectedRecord?.versions.find((version) => version.id === activeVersionId) ?? selectedRecord?.versions[0];

  useEffect(() => {
    const synchronizeHistory = (event: StorageEvent) => {
      if (event.key !== HISTORY_STORAGE_KEY) return;
      const result = loadHistory();
      setRecords(result.value);
      setStorageIssue(result.issue);
      setSelectedId((current) => result.value.some((record) => record.id === current) ? current : result.value[0]?.id);
      setActiveVersionId((current) => result.value.some((record) => record.versions.some((version) => version.id === current)) ? current : result.value[0]?.versions[0]?.id);
      if (result.value.length === 0) setMobileDetail(false);
    };
    window.addEventListener("storage", synchronizeHistory);
    return () => window.removeEventListener("storage", synchronizeHistory);
  }, []);

  const selectRecord = (record: HistoryRecord) => {
    setSelectedId(record.id);
    setActiveVersionId(record.versions[0]?.id);
    setMobileDetail(true);
    setCopyMessage(undefined);
  };

  const deleteSelectedRecord = () => {
    if (!recordToDelete) return;
    const result = removeHistoryRecord(recordToDelete.id);
    if (!result.ok) return;
    const next = records.filter((record) => record.id !== recordToDelete.id);
    setRecords(next);
    setSelectedId(next[0]?.id);
    setActiveVersionId(next[0]?.versions[0]?.id);
    setRecordToDelete(undefined);
    setMobileDetail(false);
  };

  const clearAllRecords = () => {
    const result = clearHistory();
    if (!result.ok) return;
    setRecords([]);
    setSelectedId(undefined);
    setActiveVersionId(undefined);
    setClearDialogOpen(false);
    setClearAcknowledged(false);
    setMobileDetail(false);
  };

  const copyVersion = async (version?: OutputVersion) => {
    if (!version) return;
    try {
      await navigator.clipboard.writeText(version.content);
      setCopyMessage("已复制到剪贴板");
    } catch {
      setCopyMessage("复制失败，请手动选择文本");
    }
  };

  if (records.length === 0) {
    return (
      <section className="page-enter grid h-full place-items-center p-4" aria-labelledby="history-title">
        <div className="surface-card w-full max-w-md p-10 text-center text-[var(--color-muted)]">
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-[linear-gradient(135deg,rgb(74_144_226/13%),rgb(80_200_120/13%))] text-[var(--color-accent-strong)]"><History aria-hidden="true" size={20} /></span>
          <h1 id="history-title" className="text-sm font-semibold text-[var(--color-text)]">暂无历史记录</h1>
          {storageIssue && <p className="mt-3 flex max-w-md items-center gap-2 rounded-lg bg-[var(--color-warning-soft)] px-3 py-2 text-left text-xs text-[var(--color-warning-text)]" role="alert"><AlertCircle aria-hidden="true" size={14} />{storageIssue === "corrupt" ? "部分本地历史数据已损坏，暂时无法显示。" : "浏览器当前无法读取本地历史记录。"}</p>}
        </div>
      </section>
    );
  }

  return (
    <div className="page-enter grid h-full min-h-0 grid-cols-1 gap-4 p-2 lg:grid-cols-[340px_minmax(0,1fr)] lg:p-4">
      <section className={`${mobileDetail ? "hidden" : "flex"} surface-card min-h-0 flex-col overflow-hidden lg:flex`} aria-label="历史记录列表">
        <div className="card-header flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-separator)] px-4">
          <div><h1 className="text-sm font-semibold">历史记录</h1><p className="text-xs text-[var(--color-muted)]">共 {records.length} 条</p></div>
          <button type="button" onClick={() => setClearDialogOpen(true)} className="text-xs font-medium text-[var(--color-danger)] hover:opacity-75">清空全部</button>
        </div>
        {storageIssue && <p className="flex items-center gap-2 border-b border-[var(--color-separator)] bg-[var(--color-warning-soft)] px-4 py-2 text-xs text-[var(--color-warning-text)]" role="alert"><AlertCircle aria-hidden="true" size={14} />部分本地记录无法读取</p>}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
          {records.map((record) => {
            const selected = selectedRecord?.id === record.id;
            const summary = getSummary(record);
            return (
              <button key={record.id} type="button" aria-label={`打开历史记录：${summary}`} aria-current={selected ? "true" : undefined} onClick={() => selectRecord(record)} className={`w-full rounded-xl border px-3 py-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)] ${selected ? "border-[rgb(74_144_226/18%)] bg-[linear-gradient(105deg,rgb(74_144_226/12%),rgb(80_200_120/7%))] shadow-[0_4px_12px_rgb(38_75_95/7%)]" : "border-transparent hover:border-[rgb(74_144_226/10%)] hover:bg-[rgb(246_250_252/90%)] hover:shadow-[0_4px_12px_rgb(38_75_95/6%)]"}`}>
                <div className="mb-1.5 flex items-center justify-between gap-3"><span className="text-xs font-semibold text-[var(--color-accent-strong)]">{getModeLabel(record)}</span><span className="shrink-0 text-[11px] text-[var(--color-muted)]">{formatDate(record.updatedAt)}</span></div>
                <p className="line-clamp-2 text-sm leading-6 text-[var(--color-text)]">{summary}</p><p className="mt-1.5 text-[11px] text-[var(--color-muted)]">{record.versions.length} 个版本</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className={`${mobileDetail ? "flex" : "hidden"} surface-card min-h-0 flex-col overflow-hidden lg:flex`} aria-label="历史记录详情">
        {selectedRecord && activeVersion ? (
          <>
            <div className="card-header flex min-h-14 shrink-0 items-center gap-2 border-b border-[var(--color-separator)] px-3 lg:px-5">
              <button type="button" onClick={() => setMobileDetail(false)} aria-label="返回历史记录列表" className="mobile-icon-link lg:hidden"><ArrowLeft aria-hidden="true" size={18} /></button>
              <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{getModeLabel(selectedRecord)}</h2><p className="flex items-center gap-1 text-[11px] text-[var(--color-muted)]"><Clock3 aria-hidden="true" size={11} />{formatFullDate(selectedRecord.updatedAt)}</p></div>
              <button type="button" onClick={() => { loadHistoryRecord(selectedRecord); navigate("/"); }} className="secondary-button"><RotateCcw aria-hidden="true" size={15} />重新使用</button>
              <button type="button" onClick={() => setRecordToDelete(selectedRecord)} aria-label="删除这条记录" title="删除这条记录" className="mobile-icon-link text-[var(--color-danger)]"><Trash2 aria-hidden="true" size={17} /></button>
            </div>

            <div className="flex h-14 shrink-0 items-center border-b border-[var(--color-separator)] px-4 lg:px-5">
              <SegmentedControl label="历史版本" value={activeVersion.id} onChange={setActiveVersionId} segments={selectedRecord.versions.map((version, index) => ({ value: version.id, label: version.source === "optimized" ? `优化 ${index + 1}` : `版本 ${index + 1}` }))} className="max-w-full flex-1 lg:max-w-xl" />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-7">
              <div className="mx-auto max-w-3xl space-y-7">
                <section className="rounded-xl bg-[rgb(246_249_250/72%)] p-4"><h3 className="mb-2 text-xs font-semibold text-[var(--color-muted)]">输入内容</h3><p className="whitespace-pre-wrap text-sm leading-7">{selectedRecord.input.content}</p></section>
                {Object.entries(selectedRecord.input.fields).some(([, value]) => value) && <section className="grid gap-3 border-t border-[var(--color-separator)] pt-5 sm:grid-cols-2">{Object.entries(selectedRecord.input.fields).filter(([, value]) => value).map(([key, value]) => <div key={key}><h3 className="mb-1 text-xs font-semibold text-[var(--color-muted)]">{FIELD_LABELS[key] ?? key}</h3><p className="whitespace-pre-wrap text-sm leading-6">{value}</p></div>)}</section>}
                <section className="rounded-xl border border-[rgb(74_144_226/10%)] bg-white p-4 shadow-[0_5px_18px_rgb(38_75_95/6%)]"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-semibold text-[var(--color-muted)]">生成结果</h3><span className="text-xs text-[var(--color-muted)]">{activeVersion.content.length.toLocaleString("zh-CN")} 字</span></div><p className="whitespace-pre-wrap text-[15px] leading-8">{activeVersion.content}</p></section>
                <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--color-separator)] pt-5 text-xs text-[var(--color-muted)]"><div><dt className="inline">创意度：</dt><dd className="inline">{selectedRecord.params.creativity.toFixed(1)}</dd></div><div><dt className="inline">目标长度：</dt><dd className="inline">{selectedRecord.params.targetLength} 字</dd></div><div><dt className="inline">生成数量：</dt><dd className="inline">{selectedRecord.params.versionCount} 个</dd></div></dl>
              </div>
            </div>

            <div className="card-action-bar flex min-h-16 shrink-0 items-center justify-end gap-2 border-t border-[var(--color-separator)] px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <span className="mr-auto text-xs text-[var(--color-muted)]" aria-live="polite">{copyMessage}</span><button type="button" onClick={() => void copyVersion(activeVersion)} className="secondary-button"><Copy aria-hidden="true" size={15} />复制</button>
            </div>
          </>
        ) : null}
      </section>

      {recordToDelete && <ConfirmationDialog title="删除这条历史记录？" description="该记录及其所有版本将从当前浏览器中删除，无法恢复。" confirmLabel="删除" onCancel={() => setRecordToDelete(undefined)} onConfirm={deleteSelectedRecord} danger />}

      {clearDialogOpen && (
        <ModalDialog labelledBy="clear-title" onClose={() => { setClearDialogOpen(false); setClearAcknowledged(false); }}>
            <div className="mb-3 flex items-start justify-between gap-4"><div><h2 id="clear-title" className="text-sm font-semibold">清空全部历史记录？</h2><p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">将永久删除当前浏览器中的 {records.length} 条记录。</p></div><button type="button" onClick={() => setClearDialogOpen(false)} aria-label="关闭清空确认" className="mobile-icon-link"><X aria-hidden="true" size={17} /></button></div>
            <label className="my-4 flex items-start gap-2 rounded-lg bg-black/[0.025] p-3 text-sm"><input type="checkbox" checked={clearAcknowledged} onChange={(event) => setClearAcknowledged(event.target.checked)} className="mt-0.5 accent-[var(--color-accent)]" />我确认这些记录无需保留</label>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setClearDialogOpen(false)} className="secondary-button">取消</button><button type="button" onClick={clearAllRecords} disabled={!clearAcknowledged} className="danger-button">永久清空</button></div>
        </ModalDialog>
      )}
    </div>
  );
}

function ConfirmationDialog({ title, description, confirmLabel, onCancel, onConfirm, danger = false }: { title: string; description: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void; danger?: boolean }) {
  return <ModalDialog labelledBy="confirm-title" onClose={onCancel}><h2 id="confirm-title" className="text-sm font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{description}</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} className="secondary-button">取消</button><button type="button" onClick={onConfirm} className={danger ? "danger-button" : "primary-button"}>{confirmLabel}</button></div></ModalDialog>;
}

function getSummary(record: HistoryRecord): string {
  return record.input.content.trim().slice(0, 70) || record.versions[0]?.content.slice(0, 70) || "无内容";
}

function getModeLabel(record: HistoryRecord): string {
  return record.mode === "optimize" ? "表达优化" : WRITING_MODE_CONFIGS[record.mode].label;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(value));
}

function formatFullDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
