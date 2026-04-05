import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Persona } from "../lib/personas";
import {
  classifyStreamJsonLine,
  extractSessionIdFromLine,
  type StreamUiRow,
} from "../lib/stream-json-parser";
import { killSession, spawnClaudeStreamSession } from "../lib/tauri-bridge";

const MAX_ROWS = 500;
const MAX_LINE_LEN = 1_000_000;

interface LineEvt {
  sessionId: string;
  line: string;
}

interface StderrEvt {
  sessionId: string;
  text: string;
}

interface ExitEvt {
  sessionId: string;
  code: number | null;
}

export interface TimelineEntry {
  id: string;
  row: StreamUiRow;
  at: number;
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useClaudeStreamSession(
  persona: Persona | null,
  isActive: boolean,
  npxOk: boolean,
  bootKey: number,
): {
  entries: TimelineEntry[];
  busy: boolean;
  error: string | null;
  stderrLines: string[];
  footerModel: string | null;
  sendPrompt: (text: string) => Promise<void>;
  stop: () => Promise<void>;
  clearTimeline: () => void;
} {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stderrLines, setStderrLines] = useState<string[]>([]);
  const [footerModel, setFooterModel] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const resumeIdRef = useRef<string | null>(null);
  const useContinueRef = useRef(false);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const personaRef = useRef(persona);
  personaRef.current = persona;

  const appendRow = useCallback((row: StreamUiRow) => {
    setEntries((prev) => {
      const id = nextId();
      const next = [...prev, { id, row, at: Date.now() }];
      if (next.length > MAX_ROWS) {
        return next.slice(-MAX_ROWS);
      }
      return next;
    });
  }, []);

  const clearTimeline = useCallback(() => {
    setEntries([]);
    setStderrLines([]);
    setError(null);
    setFooterModel(null);
    useContinueRef.current = false;
    resumeIdRef.current = null;
  }, []);

  useEffect(() => {
    const sid = sessionIdRef.current;
    sessionIdRef.current = null;
    setBusy(false);
    if (sid) {
      void killSession(sid);
    }
    clearTimeline();
  }, [bootKey, clearTimeline]);

  useEffect(() => {
    if (!isActive || !persona || !npxOk) {
      return;
    }
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    void (async () => {
      const uLine = await listen<LineEvt>("claude-stream:line", (ev) => {
        if (ev.payload.sessionId !== sessionIdRef.current) {
          return;
        }
        let line = ev.payload.line;
        if (line.length > MAX_LINE_LEN) {
          line = `${line.slice(0, MAX_LINE_LEN)}…`;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(line) as unknown;
        } catch {
          parsed = undefined;
        }
        if (parsed !== undefined) {
          const sid = extractSessionIdFromLine(parsed);
          if (sid) {
            resumeIdRef.current = sid;
          }
          if (isObj(parsed) && typeof parsed.model === "string" && parsed.model.length > 0) {
            setFooterModel(parsed.model);
          }
        }
        const row = classifyStreamJsonLine(line);
        if (row) {
          appendRow(row);
        }
      });
      const uErr = await listen<StderrEvt>("claude-stream:stderr", (ev) => {
        if (ev.payload.sessionId !== sessionIdRef.current) {
          return;
        }
        setStderrLines((s) => [...s.slice(-50), ev.payload.text]);
      });
      const uExit = await listen<ExitEvt>("claude-stream:exit", (ev) => {
        if (ev.payload.sessionId !== sessionIdRef.current) {
          return;
        }
        sessionIdRef.current = null;
        setBusy(false);
        useContinueRef.current = true;
        if (ev.payload.code !== 0 && ev.payload.code !== null) {
          setError(`Process exited with code ${ev.payload.code}`);
        }
      });
      if (cancelled) {
        uLine();
        uErr();
        uExit();
        return;
      }
      unsubs.push(uLine, uErr, uExit);
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => {
        u();
      });
    };
  }, [isActive, persona?.id, npxOk, appendRow]);

  const stop = useCallback(async () => {
    const sid = sessionIdRef.current;
    sessionIdRef.current = null;
    setBusy(false);
    if (sid) {
      await killSession(sid);
    }
  }, []);

  const sendPrompt = useCallback(
    async (text: string) => {
      const p = personaRef.current;
      if (!p || !npxOk || busyRef.current) {
        return;
      }
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      setError(null);
      await stop();

      const resumeId = resumeIdRef.current;
      const useContinue =
        useContinueRef.current && (resumeId === null || resumeId === "");

      appendRow({
        kind: "system_generic",
        title: "You",
        body: trimmed,
      });

      try {
        setBusy(true);
        const sid = await spawnClaudeStreamSession({
          cwd: p.cwd,
          cmd: p.cmd,
          cmdArgs: p.cmdArgs,
          args: p.args,
          prompt: trimmed,
          useContinue,
          resumeSessionId:
            resumeId !== null && resumeId.length > 0 ? resumeId : null,
          streamBare: p.streamBare === true,
          streamExtraArgs: p.streamExtraArgs ?? [],
          permissionMode: p.permissionMode ?? null,
          allowedTools: p.allowedTools ?? null,
        });
        sessionIdRef.current = sid;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setBusy(false);
      }
    },
    [npxOk, stop, appendRow],
  );

  return {
    entries,
    busy,
    error,
    stderrLines,
    footerModel,
    sendPrompt,
    stop,
    clearTimeline,
  };
}
