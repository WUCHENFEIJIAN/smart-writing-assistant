import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import type { GenerationParams } from "@shared/types/writing";

interface ParameterControlsProps {
  params: GenerationParams;
  onChange: (params: Partial<GenerationParams>) => void;
  className?: string;
}

export function ParameterControls({ params, onChange, className = "" }: ParameterControlsProps) {
  const [lengthDraft, setLengthDraft] = useState<string | null>(null);
  const lengthValue = lengthDraft ?? String(params.targetLength);

  const parsedLength = Number(lengthValue);
  const lengthValid = Number.isInteger(parsedLength) && parsedLength >= 100 && parsedLength <= 5_000;

  return (
    <div className={`flex min-w-max items-center gap-3 lg:gap-5 ${className}`} aria-label="生成参数">
      <label className="flex items-center gap-1 text-xs font-medium lg:gap-2">
        <span>创意度</span>
        <input
          aria-label="创意度"
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={params.creativity}
          onChange={(event) => onChange({ creativity: Number(event.target.value) })}
          className="w-12 accent-[var(--color-accent)] sm:w-14 lg:w-16 xl:w-20"
        />
        <output aria-label="创意度数值" className="w-5 text-right text-xs tabular-nums text-[var(--color-muted)] lg:w-6">{params.creativity.toFixed(1)}</output>
      </label>

      <label className="flex items-center gap-1 text-xs font-medium lg:gap-2">
          <span>输出长度</span>
          <input
            aria-label="输出长度"
            type="number"
            min="100"
            max="5000"
            step="50"
            value={lengthValue}
            aria-invalid={!lengthValid}
            title={lengthValid ? "100–5000 字" : "请输入 100–5000 之间的整数"}
            onChange={(event) => {
              const next = event.target.value;
              setLengthDraft(next);
              const parsed = Number(next);
              if (Number.isInteger(parsed) && parsed >= 100 && parsed <= 5_000) onChange({ targetLength: parsed });
            }}
            onBlur={() => {
              setLengthDraft(null);
            }}
            className="h-7 w-14 rounded-lg border border-[rgb(33_74_94/12%)] bg-white/85 px-1 text-center text-xs font-normal tabular-nums shadow-[0_2px_7px_rgb(38_75_95/5%)] outline-none transition-[border-color,box-shadow,background-color] duration-200 focus:border-[var(--color-accent)] focus:bg-white focus:shadow-[0_0_0_3px_rgb(74_144_226/11%)] lg:h-8 lg:w-[68px] lg:px-2"
          />
          <span className="hidden text-[11px] font-normal text-[var(--color-muted)] lg:inline">字</span>
          {!lengthValid && <span className="sr-only" role="alert">请输入 100–5000 之间的整数</span>}
      </label>

      <div className="flex items-center gap-1.5 text-xs font-medium lg:gap-2">
        <span>生成版本</span>
        <div className="flex h-7 items-center rounded-lg border border-[rgb(33_74_94/12%)] bg-white/85 shadow-[0_2px_7px_rgb(38_75_95/5%)] lg:h-8">
          <button
            type="button"
            aria-label="减少生成版本"
            onClick={() => onChange({ versionCount: Math.max(1, params.versionCount - 1) })}
            disabled={params.versionCount <= 1}
            className="inline-grid size-6 place-items-center rounded-l-lg text-[var(--color-muted)] transition-colors hover:bg-[rgb(74_144_226/9%)] hover:text-[var(--color-accent-strong)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] lg:size-7"
          ><Minus aria-hidden="true" size={14} /></button>
          <output aria-label="生成版本数量" className="w-6 text-center text-xs font-semibold tabular-nums lg:w-7">{params.versionCount}</output>
          <button
            type="button"
            aria-label="增加生成版本"
            onClick={() => onChange({ versionCount: Math.min(10, params.versionCount + 1) })}
            disabled={params.versionCount >= 10}
            className="inline-grid size-6 place-items-center rounded-r-lg text-[var(--color-muted)] transition-colors hover:bg-[rgb(74_144_226/9%)] hover:text-[var(--color-accent-strong)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] lg:size-7"
          ><Plus aria-hidden="true" size={14} /></button>
        </div>
      </div>
    </div>
  );
}
