import type { AgentViewMode } from "../lib/storage-keys";

interface AgentViewModeSwitchProps {
  readonly mode: AgentViewMode;
  readonly onSelectClassic: () => void;
  readonly onSelectRich: () => void;
}

const btn =
  "rounded px-2.5 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-secondary)]";

/** Segmented control: Classic (PTY + xterm) vs Rich (stream-json feed). */
export function AgentViewModeSwitch({
  mode,
  onSelectClassic,
  onSelectRich,
}: Readonly<AgentViewModeSwitchProps>) {
  return (
    <div
      className="inline-flex shrink-0 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] p-0.5"
      role="group"
      aria-label="Agent view mode"
    >
      <button
        type="button"
        className={`${btn} ${
          mode === "classic"
            ? "cursor-default bg-[var(--bg-hover)] font-medium text-[var(--text-primary)]"
            : "text-[var(--text-dim)] hover:bg-[var(--bg-hover)]/70 hover:text-[var(--text-secondary)]"
        }`}
        aria-pressed={mode === "classic"}
        onClick={() => {
          if (mode !== "classic") {
            onSelectClassic();
          }
        }}
      >
        Classic
      </button>
      <button
        type="button"
        className={`${btn} ${
          mode === "rich"
            ? "cursor-default bg-[var(--bg-hover)] font-medium text-[var(--text-primary)]"
            : "text-[var(--text-dim)] hover:bg-[var(--bg-hover)]/70 hover:text-[var(--text-secondary)]"
        }`}
        aria-pressed={mode === "rich"}
        onClick={() => {
          if (mode !== "rich") {
            onSelectRich();
          }
        }}
      >
        Rich
      </button>
    </div>
  );
}
