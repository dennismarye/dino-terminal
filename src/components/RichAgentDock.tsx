import type { TurnUsageSnapshot } from "../lib/usage-extract";
import { sumUsageTokens } from "../lib/usage-extract";

interface RichAgentDockProps {
  readonly model: string | null;
  readonly usage: TurnUsageSnapshot | null;
}

const CONTEXT_CAP = 1_000_000;

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${Math.round(n / 1000)}k`;
  }
  return String(n);
}

function contextLabel(total: number): string {
  if (total < 80_000) {
    return "Low";
  }
  if (total < 400_000) {
    return "Medium";
  }
  return "High";
}

export function RichAgentDock({ model, usage }: Readonly<RichAgentDockProps>) {
  const total = usage !== null ? sumUsageTokens(usage) : null;
  const pct =
    total !== null ? Math.min(100, Math.round((total / CONTEXT_CAP) * 100)) : null;

  return (
    <div
      className="shrink-0 space-y-2 border-t border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2"
      data-rich-agent-dock
    >
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-dim)]">
        <div className="flex min-w-0 max-w-[55%] items-center gap-1 truncate rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1">
          <span className="truncate font-medium text-[var(--text-primary)]">Claude</span>
          {model ? (
            <span className="truncate text-[var(--text-dim)]">({model})</span>
          ) : (
            <span className="text-[var(--text-dim)]">(model unknown)</span>
          )}
        </div>
        {total !== null && pct !== null ? (
          <>
            <span className="rounded border border-[var(--border)] px-2 py-1">
              Context: <b className="text-[var(--text-primary)]">{contextLabel(total)}</b>
            </span>
            <div className="flex min-w-[120px] flex-1 items-center gap-2">
              <div className="h-1.5 min-w-[60px] flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full bg-[var(--accent-blue)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="shrink-0 tabular-nums">
                {formatTokens(total)} / {formatTokens(CONTEXT_CAP)} ({pct}%)
              </span>
            </div>
          </>
        ) : (
          <span className="text-[var(--text-dim)]">Usage appears after each turn (result line).</span>
        )}
      </div>
    </div>
  );
}
