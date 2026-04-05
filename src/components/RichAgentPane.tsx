import { useCallback, useEffect, useState } from "react";
import { useClaudeStreamSession } from "../hooks/useClaudeStreamSession";
import type { Persona } from "../lib/personas";
import { AgentFeed } from "./AgentFeed";

interface RichAgentPaneProps {
  readonly persona: Persona;
  readonly isActive: boolean;
  readonly npxOk: boolean;
  readonly bootKey: number;
  readonly onSwitchToClassic: () => void;
}

export function RichAgentPane({
  persona,
  isActive,
  npxOk,
  bootKey,
  onSwitchToClassic,
}: Readonly<RichAgentPaneProps>) {
  const {
    entries,
    busy,
    error,
    stderrLines,
    footerModel,
    sendPrompt,
    stop,
  } = useClaudeStreamSession(persona, isActive, npxOk, bootKey);

  const [draft, setDraft] = useState("");

  const onSend = useCallback(async () => {
    const t = draft;
    setDraft("");
    await sendPrompt(t);
  }, [draft, sendPrompt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isActive) {
        return;
      }
      if (e.metaKey && (e.key === "w" || e.key === "W")) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) {
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        void stop();
      }
    };
    globalThis.addEventListener("keydown", onKey, true);
    return () => globalThis.removeEventListener("keydown", onKey, true);
  }, [isActive, stop]);

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-primary)]"
      data-rich-agent-pane
      style={{ display: isActive ? "flex" : "none" }}
      aria-hidden={!isActive}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-[var(--text-dim)]">
            Agent — {persona.name}
          </span>
          <span className="text-[10px] text-[var(--text-dim)]">
            Rich · npx + stream-json (same as Classic)
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="rounded border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]"
            onClick={() => {
              onSwitchToClassic();
            }}
          >
            Classic terminal
          </button>
          <button
            type="button"
            disabled={!busy}
            className="rounded border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40 focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]"
            onClick={() => {
              void stop();
            }}
          >
            Stop
          </button>
        </div>
      </div>
      {error ? (
        <div
          className="shrink-0 border-b border-[var(--accent-red)]/50 bg-[var(--accent-red)]/10 px-3 py-2 text-[12px] text-[var(--accent-red)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {stderrLines.length > 0 ? (
        <div className="max-h-20 shrink-0 overflow-y-auto border-b border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1 font-mono text-[10px] text-[var(--text-dim)]">
          {stderrLines.map((line, i) => (
            // eslint-disable-next-line react/no-array-index-key -- stderr order is stable enough for log lines
            <div key={`${i}-${line.slice(0, 24)}`}>{line}</div>
          ))}
        </div>
      ) : null}
      <AgentFeed entries={entries} />
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-2">
        <label className="sr-only" htmlFor={`composer-${persona.id}`}>
          Message to Claude
        </label>
        <textarea
          id={`composer-${persona.id}`}
          value={draft}
          disabled={busy || !npxOk}
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
          placeholder={
            npxOk
              ? "Message… (Enter to send, Shift+Enter newline)"
              : "npx not found — install Node.js 22+"
          }
          rows={3}
          className="mb-2 w-full resize-y rounded border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1.5 text-[13px] text-[var(--text-primary)] outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)] disabled:opacity-50"
        />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={busy || !npxOk || draft.trim().length === 0}
            className="rounded bg-[var(--accent-blue)] px-3 py-1 text-[12px] font-medium text-[var(--bg-primary)] hover:opacity-90 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
            onClick={() => {
              void onSend();
            }}
          >
            Send
          </button>
          <div className="text-[10px] text-[var(--text-dim)]">
            {footerModel ? `Model: ${footerModel}` : " "}
          </div>
        </div>
        {persona.permissionMode || persona.allowedTools ? (
          <p className="mt-2 text-[10px] text-[var(--text-dim)]">
            Permissions:{" "}
            {persona.permissionMode
              ? `mode=${persona.permissionMode}`
              : "default"}
            {persona.allowedTools
              ? ` · allowedTools=${persona.allowedTools}`
              : ""}
            . For interactive approval flows, switch to Classic.
          </p>
        ) : null}
      </div>
    </div>
  );
}
