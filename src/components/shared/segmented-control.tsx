interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  segments: Segment<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  label,
  value,
  segments,
  onChange,
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex min-h-9 items-center gap-1 overflow-x-auto rounded-xl border border-[rgb(33_74_94/8%)] bg-[rgb(235_242_245/78%)] p-1 ${className}`}
    >
      {segments.map((segment) => (
        <button
          key={segment.value}
          type="button"
          role="tab"
          aria-selected={segment.value === value}
          onClick={() => onChange(segment.value)}
          className={`min-h-7 min-w-20 shrink-0 rounded-lg px-3 text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-200 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)] ${
            segment.value === value
              ? "bg-white text-[var(--color-accent-strong)] shadow-[0_3px_9px_rgb(38_75_95/13%)]"
              : "text-[var(--color-muted)] hover:bg-white/55 hover:text-[var(--color-text)]"
          }`}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}
