import type { TimelineEntry } from "../hooks/useClaudeStreamSession";
import { LinkifiedText } from "./LinkifiedText";

interface AgentFeedProps {
  entries: TimelineEntry[];
}

function rowClass(kind: TimelineEntry["row"]["kind"]): string {
  switch (kind) {
    case "assistant_text":
      return "border-[var(--border)] bg-[var(--bg-primary)]";
    case "system_retry":
      return "border-[var(--accent-yellow)]/40 bg-[var(--bg-secondary)]";
    case "system_generic":
      return "border-[var(--border)] bg-[var(--bg-secondary)]";
    default:
      return "border-[var(--border)] bg-[var(--bg-secondary)] opacity-90";
  }
}

export function AgentFeed({ entries }: AgentFeedProps) {
  const lastId = entries.length > 0 ? entries.at(-1)?.id : undefined;

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <ul className="flex flex-col gap-2">
        {entries.map((e) => (
          <li
            key={e.id}
            className={`rounded-md border px-3 py-2 text-[13px] leading-relaxed ${rowClass(e.row.kind)}`}
            aria-current={e.id === lastId ? "true" : undefined}
          >
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
              {e.row.title}
            </div>
            <div className="whitespace-pre-wrap text-[var(--text-primary)]">
              <LinkifiedText text={e.row.body} />
            </div>
          </li>
        ))}
      </ul>
      {entries.length === 0 ? (
        <p className="px-2 py-6 text-center text-[12px] text-[var(--text-dim)]">
          Send a message to run Claude Code in stream-json mode. Slash commands
          are not available here — use Classic for the full TUI.
        </p>
      ) : null}
    </div>
  );
}
