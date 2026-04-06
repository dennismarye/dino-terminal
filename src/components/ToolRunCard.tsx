import type { StreamUiRow } from "../lib/stream-json-parser";

interface ToolRunCardProps {
  readonly row: Extract<StreamUiRow, { kind: "tool_run" }>;
}

export function ToolRunCard({ row }: Readonly<ToolRunCardProps>) {
  const statusIcon =
    row.status === "done" ? "✓" : row.status === "error" ? "✗" : "…";
  const meta =
    row.durationMs !== undefined && Number.isFinite(row.durationMs)
      ? `~${(row.durationMs / 1000).toFixed(1)}s`
      : null;

  return (
    <div
      className="cursor-text select-text overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--bg-secondary)] [&_code]:cursor-text [&_code]:select-text"
      data-tool-run-card
    >
      <div className="flex items-center gap-2.5 border-b border-[var(--border)] bg-[var(--bg-primary)] px-3.5 py-2.5">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--border)] text-[12px] text-[var(--accent-green)]"
          aria-hidden
        >
          {statusIcon}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text-primary)]">
          {row.name}
        </span>
        {meta ? (
          <span className="shrink-0 text-[11px] text-[var(--text-dim)]">{meta}</span>
        ) : null}
      </div>
      <div className="px-3.5 py-2.5">
        <code className="block cursor-text select-text whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {row.command}
        </code>
      </div>
    </div>
  );
}
