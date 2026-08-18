import {
  AlignLeft,
  ArrowLeftRight,
  Expand,
  FileClock,
  FilePenLine,
  FileText,
  History,
  Mail,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { GenerationParams, WritingMode } from "@shared/types/writing";
import { WRITING_MODE_CONFIGS, WRITING_MODE_ORDER } from "@/lib/modes";
import { ParameterControls } from "@/components/workspace/parameter-controls";

const MODE_ICONS = {
  continue: FilePenLine,
  rewrite: ArrowLeftRight,
  expand: Expand,
  summarize: AlignLeft,
  email: Mail,
  copywriting: Sparkles,
} satisfies Record<WritingMode, typeof FileText>;

interface AppShellProps {
  activeMode: WritingMode;
  params: GenerationParams;
  onModeChange: (mode: WritingMode) => void;
  onParamsChange: (params: Partial<GenerationParams>) => void;
  saveStatus: "saved" | "saving" | "error";
  children: ReactNode;
}

export function AppShell({ activeMode, params, onModeChange, onParamsChange, saveStatus, children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeModeLabel = WRITING_MODE_CONFIGS[activeMode].label;

  const selectMode = (mode: WritingMode) => {
    onModeChange(mode);
    if (location.pathname !== "/") navigate("/");
  };

  return (
    <div className={`app-frame grid h-dvh min-h-[560px] grid-cols-1 ${location.pathname === "/" ? "grid-rows-[108px_minmax(0,1fr)]" : "grid-rows-[56px_minmax(0,1fr)]"} overflow-hidden text-[var(--color-text)] lg:grid-cols-[220px_minmax(0,1fr)] lg:grid-rows-[64px_minmax(0,1fr)]`}>
      <aside
        data-testid="desktop-sidebar"
        className="sidebar-glass row-span-2 hidden min-h-0 flex-col border-r border-white/70 lg:flex"
      >
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-[var(--color-separator)] px-4">
          <span className="brand-mark grid size-9 place-items-center rounded-xl text-white">
            <Sparkles aria-hidden="true" size={17} strokeWidth={2.3} />
          </span>
          <span className="text-[15px] font-semibold">智能写作助手</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-2 text-xs font-semibold text-[var(--color-muted)]">写作模式</p>
          <nav aria-label="写作模式" className="space-y-1">
            {WRITING_MODE_ORDER.map((mode) => {
              const Icon = MODE_ICONS[mode];
              const selected = location.pathname === "/" && activeMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  aria-current={selected ? "page" : undefined}
                  onClick={() => selectMode(mode)}
                  className={`nav-item ${selected ? "nav-item-active font-semibold" : "text-[var(--color-text)]"}`}
                >
                  <span className="nav-icon">
                    <Icon aria-hidden="true" size={14} />
                  </span>
                  {WRITING_MODE_CONFIGS[mode].label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="shrink-0 border-t border-[var(--color-separator)] p-3">
          <Link
            to="/history"
            className={`nav-item ${location.pathname === "/history" ? "nav-item-active font-semibold" : "text-[var(--color-text)]"}`}
          >
            <span className="nav-icon">
              <History aria-hidden="true" size={14} />
            </span>
            <span>历史记录</span>
          </Link>
        </div>
      </aside>

      <header
        data-testid="desktop-toolbar"
        className="top-toolbar hidden min-w-0 items-center border-b border-white/70 px-6 lg:flex"
      >
        {location.pathname === "/" ? (
          <div className="flex min-w-0 flex-1 items-center" data-testid="desktop-inline-parameters">
            <span className="shrink-0 text-sm font-semibold" aria-label={`当前模式：${activeModeLabel}`}>{activeModeLabel}</span>
            <ParameterControls params={params} onChange={onParamsChange} className="ml-10" />
          </div>
        ) : (
          <h1 className="flex-1 text-sm font-semibold">历史记录</h1>
        )}
        <span className="ml-4 hidden shrink-0 items-center justify-end gap-2 text-xs text-[var(--color-muted)] 2xl:flex" aria-live="polite">
          <span className={`size-2 rounded-full ${saveStatus === "error" ? "bg-[var(--color-danger)]" : saveStatus === "saving" ? "bg-[var(--color-warning)]" : "bg-[var(--color-success)]"}`} />
          {saveStatus === "error" ? "本地保存失败" : saveStatus === "saving" ? "正在保存草稿" : "草稿已保存到本机"}
        </span>
      </header>

      <header
        data-testid="mobile-toolbar"
        className="top-toolbar flex flex-col border-b border-white/70 lg:hidden"
      >
        <div className="flex h-14 w-full items-center justify-between px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="brand-mark grid size-8 shrink-0 place-items-center rounded-xl text-white">
              <Sparkles aria-hidden="true" size={14} />
            </span>
            <span className="truncate text-sm font-semibold" aria-label={location.pathname === "/" ? `当前模式：${activeModeLabel}` : undefined}>{location.pathname === "/history" ? "历史记录" : activeModeLabel}</span>
          </div>
          {location.pathname === "/" ? (
              <Link to="/history" aria-label="历史记录" title="历史记录" className="mobile-icon-link">
                <FileClock aria-hidden="true" size={18} />
              </Link>
            ) : (
              <Link to="/" aria-label="返回写作" title="返回写作" className="mobile-icon-link">
                <FilePenLine aria-hidden="true" size={18} />
              </Link>
            )}
        </div>
        {location.pathname === "/" && <div className="flex h-[52px] w-full items-center overflow-x-auto border-t border-[var(--color-separator)] px-3" data-testid="mobile-inline-parameters"><ParameterControls params={params} onChange={onParamsChange} /></div>}
      </header>

      <main className="min-h-0 overflow-hidden">{children}</main>
    </div>
  );
}
