import type { ReactElement, ReactNode } from "react";
import type { TimelineEntry } from "../hooks/useClaudeStreamSession";
import type { StreamUiRow } from "../lib/stream-json-parser";
import { LinkifiedText } from "./LinkifiedText";
import { ToolRunCard } from "./ToolRunCard";

interface AgentFeedProps {
  entries: TimelineEntry[];
  /** e.g. "Finished in 1m 31s" from last `result` duration */
  feedFooter?: string | null;
}

function cardShell(kind: StreamUiRow["kind"], children: ReactNode): ReactElement {
  const base = "rounded-[10px] border px-3.5 py-2.5 text-[13px] leading-relaxed";
  const cardPrimary = `${base} border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)]`;
  const cardMuted = `${base} border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)]`;
  switch (kind) {
    case "assistant_text":
      return <div className={cardPrimary}>{children}</div>;
    case "user_prompt":
    case "system_generic":
      return <div className={cardMuted}>{children}</div>;
    case "system_retry":
      return (
        <div
          className={`${base} border-[var(--accent-yellow)]/40 bg-[var(--bg-secondary)] text-[var(--text-primary)]`}
        >
          {children}
        </div>
      );
    case "permission_notice":
      return (
        <div
          className={`${base} border-[var(--accent-green)]/35 bg-[var(--accent-green)]/10 text-[var(--text-primary)]`}
        >
          {children}
        </div>
      );
    case "tool_run":
      return <div className="border-0 p-0">{children}</div>;
    case "unknown":
      return (
        <div
          className={`${base} border-[var(--border)] bg-[var(--bg-secondary)] opacity-90 text-[var(--text-primary)]`}
        >
          {children}
        </div>
      );
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function RowHeader({ title }: Readonly<{ title: string }>): ReactElement {
  return (
    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
      {title}
    </div>
  );
}

function renderRow(row: StreamUiRow): ReactElement {
  if (row.kind === "tool_run") {
    return cardShell("tool_run", <ToolRunCard row={row} />);
  }
  if (row.kind === "assistant_text") {
    return cardShell(
      "assistant_text",
      <div className="whitespace-pre-wrap text-[var(--text-primary)]">
        <LinkifiedText text={row.body} />
      </div>,
    );
  }
  return cardShell(
    row.kind,
    <>
      <RowHeader title={row.title} />
      <div className="whitespace-pre-wrap">
        <LinkifiedText text={row.body} />
      </div>
    </>,
  );
}

export function AgentFeed({ entries, feedFooter }: Readonly<AgentFeedProps>) {
  const lastId = entries.length > 0 ? entries.at(-1)?.id : undefined;

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[820px] px-4 py-4">
          <ul className="flex flex-col gap-4">
            {entries.map((e) => (
              <li
                key={e.id}
                aria-current={e.id === lastId ? "true" : undefined}
                className="list-none"
              >
                {renderRow(e.row)}
              </li>
            ))}
          </ul>
          {entries.length === 0 ? (
            <p className="px-2 py-10 text-center text-[12px] text-[var(--text-dim)]">
              Send a message to run Claude Code in stream-json mode. Tool runs need{" "}
              <code className="rounded bg-[var(--bg-secondary)] px-1">streamVerbose</code> in the
              persona so the CLI emits <code className="rounded bg-[var(--bg-secondary)] px-1">content_block_*</code>{" "}
              lines. Slash commands are not available here — use Classic for the full TUI.
            </p>
          ) : null}
          {feedFooter !== null && feedFooter !== undefined && feedFooter.length > 0 ? (
            <p className="mt-6 text-center text-[11px] text-[var(--text-dim)]">{feedFooter}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
