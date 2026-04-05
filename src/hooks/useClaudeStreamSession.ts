import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { appendCoalesced } from "../lib/coalesce-assistant";
import { formatDurationMs } from "../lib/format-duration";
import type { Persona } from "../lib/personas";
import {
  classifyStreamJsonLine,
  extractSessionIdFromLine,
  type StreamUiRow,
} from "../lib/stream-json-parser";
import {
  createToolStreamState,
  reduceToolStreamLine,
  type ToolStreamState,
} from "../lib/stream-tool-reducer";
import { killSession, spawnClaudeStreamSession } from "../lib/tauri-bridge";
import type { TurnUsageSnapshot } from "../lib/usage-extract";
import { extractUsageFromResultLine } from "../lib/usage-extract";

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

function processParsedStreamRecord(
  parsed: Record<string, unknown>,
  toolState: ToolStreamState,
): {
  toolState: ToolStreamState;
  toolRow: StreamUiRow | null;
  usage: TurnUsageSnapshot | null;
} {
  const toolOut = reduceToolStreamLine(toolState, parsed);
  return {
    toolState: toolOut.state,
    toolRow: toolOut.row,
    usage: extractUsageFromResultLine(parsed),
  };
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
  turnUsage: TurnUsageSnapshot | null;
  feedFooter: string | null;
  sendPrompt: (text: string) => Promise<void>;
  stop: () => Promise<void>;
  clearTimeline: () => void;
} {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stderrLines, setStderrLines] = useState<string[]>([]);
  const [footerModel, setFooterModel] = useState<string | null>(null);
  const [turnUsage, setTurnUsage] = useState<TurnUsageSnapshot | null>(null);
  const [feedFooter, setFeedFooter] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const resumeIdRef = useRef<string | null>(null);
  const useContinueRef = useRef(false);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const personaRef = useRef(persona);
  personaRef.current = persona;
  const toolStreamRef = useRef<ToolStreamState>(createToolStreamState());

  const pushRow = useCallback((row: StreamUiRow) => {
    setEntries((prev) => {
      const next = appendCoalesced(prev, row, nextId);
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
    setTurnUsage(null);
    setFeedFooter(null);
    useContinueRef.current = false;
    resumeIdRef.current = null;
    toolStreamRef.current = createToolStreamState();
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
    toolStreamRef.current = createToolStreamState();
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
        }
        if (isObj(parsed)) {
          if (typeof parsed.model === "string" && parsed.model.length > 0) {
            setFooterModel(parsed.model);
          }
          const out = processParsedStreamRecord(parsed, toolStreamRef.current);
          toolStreamRef.current = out.toolState;
          if (out.toolRow !== null) {
            pushRow(out.toolRow);
          }
          if (out.usage !== null) {
            setTurnUsage(out.usage);
            if (out.usage.durationMs !== null) {
              setFeedFooter(`Finished in ${formatDurationMs(out.usage.durationMs)}`);
            }
          }
        }
        const classified = classifyStreamJsonLine(line);
        if (classified !== null) {
          pushRow(classified);
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
  }, [isActive, persona?.id, npxOk, pushRow]);

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
      if (!trimmed.length) {
        return;
      }

      setError(null);
      await stop();

      const resumeId = resumeIdRef.current;
      const useContinue =
        useContinueRef.current && (resumeId === null || resumeId === "");

      toolStreamRef.current = createToolStreamState();
      setTurnUsage(null);
      setFeedFooter(null);

      pushRow({
        kind: "user_prompt",
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
          streamVerbose: p.streamVerbose === true,
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
    [npxOk, stop, pushRow],
  );

  return {
    entries,
    busy,
    error,
    stderrLines,
    footerModel,
    turnUsage,
    feedFooter,
    sendPrompt,
    stop,
    clearTimeline,
  };
}

