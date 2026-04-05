import { useCallback, useRef, useState } from "react";
import {
  type TerminalFindControl,
  useTerminal,
} from "../hooks/useTerminal";
import type { Persona } from "../lib/personas";

interface TerminalPaneProps {
  persona: Persona;
  isActive: boolean;
  npxOk: boolean;
  bootKey: number;
}

export function TerminalPane({
  persona,
  isActive,
  npxOk,
  bootKey,
}: TerminalPaneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const findControlRef = useRef<TerminalFindControl | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");

  const onToggleFindBar = useCallback(() => {
    setFindOpen((o) => !o);
  }, []);

  useTerminal(ref, persona, isActive, npxOk, bootKey, {
    findControlRef,
    onToggleFindBar,
  });

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-primary)]"
      style={{ display: isActive ? "flex" : "none" }}
      aria-hidden={!isActive}
    >
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5">
        <span className="text-[11px] font-medium text-[var(--text-dim)]">
          Terminal — {persona.name}
        </span>
        <span className="ml-2 text-[10px] text-[var(--text-dim)]">
          Cmd+F find · Cmd± font · Cmd+click opens links
        </span>
      </div>
      {findOpen ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1">
          <label className="sr-only" htmlFor={`find-${persona.id}`}>
            Find in terminal
          </label>
          <input
            id={`find-${persona.id}`}
            type="search"
            value={findQuery}
            onChange={(e) => {
              setFindQuery(e.target.value);
            }}
            onKeyDown={(e) => {
              const ctl = findControlRef.current;
              if (!ctl) {
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey) {
                  ctl.findPrevious(findQuery);
                } else {
                  ctl.findNext(findQuery);
                }
              }
              if (e.key === "Escape") {
                e.preventDefault();
                ctl.clearDecorations();
                setFindOpen(false);
              }
            }}
            placeholder="Find…"
            className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1 text-[12px] text-[var(--text-primary)] outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]"
          />
          <button
            type="button"
            className="shrink-0 rounded px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]"
            onClick={() => {
              findControlRef.current?.findPrevious(findQuery);
            }}
          >
            Prev
          </button>
          <button
            type="button"
            className="shrink-0 rounded px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]"
            onClick={() => {
              findControlRef.current?.findNext(findQuery);
            }}
          >
            Next
          </button>
        </div>
      ) : null}
      <div
        ref={ref}
        className="min-h-0 min-w-0 flex-1 overflow-hidden p-1"
        data-terminal-host
      />
    </div>
  );
}
