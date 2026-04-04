import type { StatusLine } from "../lib/tauri-bridge";

function gaugeClass(pct: number | null | undefined): string {
  if (pct == null) {
    return "text-[var(--text-dim)]";
  }
  if (pct >= 80) {
    return "text-[var(--accent-red)]";
  }
  if (pct >= 50) {
    return "text-[var(--accent-yellow)]";
  }
  return "text-[var(--accent-green)]";
}

function ctxClass(pct: number | null | undefined): string {
  if (pct == null) {
    return "text-[var(--text-dim)]";
  }
  if (pct >= 70) {
    return "text-[var(--accent-red)]";
  }
  if (pct >= 50) {
    return "text-[var(--accent-yellow)]";
  }
  return "text-[var(--accent-green)]";
}

function fmt(pct: number | null | undefined): string {
  if (pct == null) {
    return "—";
  }
  return `${pct}%`;
}

interface StatusBarProps {
  status: StatusLine | null;
}

export function StatusBar({ status }: StatusBarProps) {
  const ctx = status?.contextPct ?? null;
  const r5 = status?.rate5hPct ?? null;
  const r7 = status?.rate7dPct ?? null;
  const model = status?.model ?? "—";
  const branch = status?.branch ?? "—";

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t border-[var(--border)] px-4 font-mono text-[11px] text-[var(--text-secondary)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={ctxClass(ctx)}>Ctx: {fmt(ctx)}</span>
        <span className="text-[var(--text-dim)]">│</span>
        <span className={gaugeClass(r5)}>5h: {fmt(r5)}</span>
        <span className="text-[var(--text-dim)]">│</span>
        <span className={gaugeClass(r7)}>7d: {fmt(r7)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{model}</span>
        <span className="text-[var(--text-dim)]">│</span>
        <span>{branch}</span>
      </div>
    </footer>
  );
}
