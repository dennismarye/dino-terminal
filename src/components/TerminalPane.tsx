import { useCallback, useEffect, useRef, useState } from "react";
import {
  type TerminalFindControl,
  useTerminal,
} from "../hooks/useTerminal";
import type { Persona } from "../lib/personas";
import {
  loadViewMode,
  saveViewMode,
  type AgentViewMode,
} from "../lib/storage-keys";
import { RichAgentPane } from "./RichAgentPane";

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
  const [viewMode, setViewMode] = useState<AgentViewMode>(() =>
    loadViewMode(persona.id),
  );

  useEffect(() => {
    setViewMode(loadViewMode(persona.id));
  }, [persona.id]);

  const setMode = useCallback((m: AgentViewMode) => {
    setViewMode(m);
    saveViewMode(persona.id, m);
  }, [persona.id]);

  if (viewMode === "rich") {
    return (
      <RichAgentPane
        persona={persona}
        isActive={isActive}
        npxOk={npxOk}
        bootKey={bootKey}
        onSwitchToClassic={() => {
          setMode("classic");
        }}
      />
    );
  }

  return (
    <ClassicTerminalPaneInner
      persona={persona}
      isActive={isActive}
      npxOk={npxOk}
      bootKey={bootKey}
      onSwitchToRich={() => {
        setMode("rich");
      }}
    />
  );
}

/** xterm and WebLinksAddon are set up in `useTerminal.ts` (shell `open` for http(s) links). */
function ClassicTerminalPaneInner({
  persona,
  isActive,
  npxOk,
  bootKey,
  onSwitchToRich,
}: {
  persona: Persona;
  isActive: boolean;
  npxOk: boolean;
  bootKey: number;
  onSwitchToRich: () => void;
}) {
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
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-[var(--text-dim)]">
            Terminal — {persona.name}
          </span>
          <span className="text-[10px] text-[var(--text-dim)]">
            Cmd+F find · Cmd± font · click http(s) links to open in browser
          </span>
        </div>
        <button
          type="button"
          className="shrink-0 rounded border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]"
          onClick={() => {
            onSwitchToRich();
          }}
        >
          Rich agent
        </button>
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
