import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useRef, useState } from "react";
import type { Persona } from "../lib/personas";
import { isSafeHttpUrl } from "../lib/safe-http-url";
import {
  DEFAULT_FONT,
  MAX_FONT,
  MIN_FONT,
  loadFontSize,
  saveFontSize,
  shouldUseWebGl,
} from "../lib/storage-keys";
import {
  killSession,
  resizePty,
  spawnClaudeVersionSmoke,
  spawnSession,
  writeToPty,
} from "../lib/tauri-bridge";

import "@xterm/xterm/css/xterm.css";

const baseTheme = {
  background: "#1E1E2E",
  foreground: "#CDD6F4",
  cursor: "#FF6B35",
  cursorAccent: "#1E1E2E",
  selectionBackground: "rgba(205, 214, 244, 0.15)",
  black: "#45475A",
  red: "#F38BA8",
  green: "#A6E3A1",
  yellow: "#F9E2AF",
  blue: "#89B4FA",
  magenta: "#F5C2E7",
  cyan: "#94E2D5",
  white: "#BAC2DE",
  brightBlack: "#585B70",
  brightRed: "#F38BA8",
  brightGreen: "#A6E3A1",
  brightYellow: "#F9E2AF",
  brightBlue: "#89B4FA",
  brightMagenta: "#F5C2E7",
  brightCyan: "#94E2D5",
  brightWhite: "#A6ADC8",
};

interface PtyDataEvt {
  sessionId: string;
  dataB64: string;
}

interface PtyExitEvt {
  sessionId: string;
  code: number | null;
}

function bytesFromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function emitSpawnError(message: string): void {
  globalThis.dispatchEvent(
    new CustomEvent("dino-terminal-spawn-error", { detail: message }),
  );
}

export interface TerminalFindControl {
  findNext: (query: string) => boolean;
  findPrevious: (query: string) => boolean;
  clearDecorations: () => void;
}

export interface UseTerminalOptions {
  findControlRef: React.MutableRefObject<TerminalFindControl | null>;
  onToggleFindBar?: () => void;
}

export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  persona: Persona | null,
  isActive: boolean,
  npxOk: boolean,
  bootKey: number,
  options: UseTerminalOptions,
): void {
  const { findControlRef, onToggleFindBar } = options;
  const onToggleFindRef = useRef(onToggleFindBar);
  onToggleFindRef.current = onToggleFindBar;
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const smokePhaseRef = useRef(false);
  const endedRef = useRef(false);
  const startingRef = useRef(false);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const personaRef = useRef(persona);
  personaRef.current = persona;
  const dataDisposableRef = useRef<{ dispose: () => void } | null>(null);

  const [ipcReady, setIpcReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || termRef.current) {
      return;
    }
    const initialSize = loadFontSize();
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "JetBrains Mono, Menlo, monospace",
      fontSize: initialSize,
      theme: { ...baseTheme, cursor: persona?.color ?? baseTheme.cursor },
      scrollback: 1000,
    });
    const fit = new FitAddon();
    const search = new SearchAddon();
    term.loadAddon(fit);
    term.loadAddon(
      new WebLinksAddon((e, uri) => {
        if (!e.metaKey) {
          return;
        }
        e.preventDefault();
        if (!isSafeHttpUrl(uri)) {
          return;
        }
        void openUrl(uri).catch(() => {
          /* ignore opener failures */
        });
      }),
    );
    term.loadAddon(search);
    term.open(el);
    if (shouldUseWebGl()) {
      try {
        term.loadAddon(new WebglAddon());
      } catch {
        /* canvas fallback */
      }
    }
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;
    searchRef.current = search;
    findControlRef.current = {
      findNext: (query: string) => search.findNext(query, {}),
      findPrevious: (query: string) => search.findPrevious(query, {}),
      clearDecorations: () => search.clearDecorations(),
    };
    return () => {
      findControlRef.current = null;
      searchRef.current = null;
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [containerRef, persona?.color, findControlRef]);

  useEffect(() => {
    const term = termRef.current;
    if (!term || !persona) {
      return;
    }
    term.options.theme = {
      ...baseTheme,
      cursor: persona.color ?? baseTheme.cursor,
    };
  }, [persona?.color, persona]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) {
      return;
    }
    const sid = sessionIdRef.current;
    smokePhaseRef.current = false;
    endedRef.current = false;
    sessionIdRef.current = null;
    if (sid) {
      void killSession(sid);
    }
    term.reset();
    term.clear();
  }, [bootKey]);

  useEffect(() => {
    const term = termRef.current;
    const p = persona;
    if (!term || !p || !npxOk) {
      setIpcReady(false);
      return;
    }

    let cancelled = false;
    const unsubs: Array<() => void> = [];
    let keyHandler: ((e: KeyboardEvent) => void) | null = null;

    const applyFontAndFit = (next: number) => {
      const t = termRef.current;
      const f = fitRef.current;
      if (!t || !f) {
        return;
      }
      const clamped = Math.min(MAX_FONT, Math.max(MIN_FONT, next));
      t.options.fontSize = clamped;
      saveFontSize(clamped);
      f.fit();
      const dims = f.proposeDimensions();
      const sid = sessionIdRef.current;
      if (dims && sid) {
        void resizePty(sid, dims.cols, dims.rows);
      }
    };

    const spawnFull = async () => {
      const cur = personaRef.current;
      if (!cur) {
        return;
      }
      smokePhaseRef.current = false;
      const sid = await spawnSession(cur);
      sessionIdRef.current = sid;
      endedRef.current = false;
    };

    const spawnSmoke = async () => {
      const cur = personaRef.current;
      if (!cur) {
        return;
      }
      smokePhaseRef.current = true;
      const sid = await spawnClaudeVersionSmoke(cur);
      sessionIdRef.current = sid;
    };

    const startPipeline = async () => {
      const cur = personaRef.current;
      if (!cur) {
        return;
      }
      try {
        if (import.meta.env.DEV) {
          await spawnSmoke();
        } else {
          await spawnFull();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        emitSpawnError(msg);
        term.writeln(`\r\n\x1b[31m${msg}\x1b[0m\r\n`);
      }
    };

    void (async () => {
      const uData = await listen<PtyDataEvt>("pty:data", (ev) => {
        const { sessionId, dataB64 } = ev.payload;
        if (sessionId !== sessionIdRef.current) {
          return;
        }
        term.write(bytesFromB64(dataB64));
      });
      if (cancelled) {
        uData();
        return;
      }
      const uExit = await listen<PtyExitEvt>("pty:exit", (ev) => {
        const { sessionId } = ev.payload;
        if (sessionId !== sessionIdRef.current) {
          return;
        }
        sessionIdRef.current = null;
        if (import.meta.env.DEV && smokePhaseRef.current) {
          smokePhaseRef.current = false;
          void spawnFull().catch((e) => {
            const msg = e instanceof Error ? e.message : String(e);
            emitSpawnError(msg);
            term.writeln(`\r\n\x1b[31m${msg}\x1b[0m\r\n`);
          });
          return;
        }
        endedRef.current = true;
        term.writeln(
          "\r\n\x1b[33mSession ended — press Enter to restart\x1b[0m\r\n",
        );
      });
      if (cancelled) {
        uData();
        uExit();
        return;
      }
      unsubs.push(uData, uExit);

      const onData = (data: string) => {
        if (endedRef.current && (data === "\r" || data === "\n")) {
          endedRef.current = false;
          void startPipeline();
          return;
        }
        const sid = sessionIdRef.current;
        if (!sid) {
          return;
        }
        void writeToPty(sid, new TextEncoder().encode(data));
      };
      dataDisposableRef.current?.dispose();
      dataDisposableRef.current = term.onData(onData);

      keyHandler = (e: KeyboardEvent) => {
        if (!isActiveRef.current) {
          return;
        }
        if (!e.metaKey) {
          return;
        }
        if (e.key === "f" || e.key === "F") {
          e.preventDefault();
          onToggleFindRef.current?.();
          return;
        }
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          const cur = term.options.fontSize ?? DEFAULT_FONT;
          applyFontAndFit(cur + 1);
          return;
        }
        if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          const cur = term.options.fontSize ?? DEFAULT_FONT;
          applyFontAndFit(cur - 1);
          return;
        }
        if (e.key === "0") {
          e.preventDefault();
          applyFontAndFit(DEFAULT_FONT);
          return;
        }
        if (e.key === "w" || e.key === "W") {
          e.preventDefault();
          const sid = sessionIdRef.current;
          if (sid) {
            void killSession(sid);
            sessionIdRef.current = null;
            endedRef.current = true;
            term.writeln("\r\n\x1b[33mSession closed (Cmd+W)\x1b[0m\r\n");
          }
        }
      };
      globalThis.addEventListener("keydown", keyHandler, true);

      if (!cancelled) {
        setIpcReady(true);
      }
    })();

    return () => {
      cancelled = true;
      setIpcReady(false);
      dataDisposableRef.current?.dispose();
      dataDisposableRef.current = null;
      unsubs.forEach((u) => {
        u();
      });
      unsubs.length = 0;
      if (keyHandler) {
        globalThis.removeEventListener("keydown", keyHandler, true);
      }
      const sid = sessionIdRef.current;
      if (sid) {
        void killSession(sid);
      }
      sessionIdRef.current = null;
    };
  }, [persona?.id, npxOk, bootKey]);

  useEffect(() => {
    if (!ipcReady || !isActive || !persona || !npxOk) {
      return;
    }
    const term = termRef.current;
    if (!term) {
      return;
    }
    if (sessionIdRef.current || startingRef.current) {
      return;
    }
    startingRef.current = true;
    void (async () => {
      try {
        if (import.meta.env.DEV) {
          const cur = personaRef.current;
          if (cur) {
            smokePhaseRef.current = true;
            const sid = await spawnClaudeVersionSmoke(cur);
            sessionIdRef.current = sid;
          }
        } else {
          const cur = personaRef.current;
          if (cur) {
            smokePhaseRef.current = false;
            const sid = await spawnSession(cur);
            sessionIdRef.current = sid;
            endedRef.current = false;
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        emitSpawnError(msg);
        term.writeln(`\r\n\x1b[31m${msg}\x1b[0m\r\n`);
      } finally {
        startingRef.current = false;
      }
    })();
  }, [ipcReady, isActive, persona?.id, npxOk, bootKey]);

  useEffect(() => {
    const term = termRef.current;
    const fit = fitRef.current;
    const el = containerRef.current;
    if (!term || !fit || !el || !isActive) {
      return;
    }
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let raf = 0;

    const apply = () => {
      fit.fit();
      const dims = fit.proposeDimensions();
      const sid = sessionIdRef.current;
      if (dims && sid) {
        void resizePty(sid, dims.cols, dims.rows);
      }
    };

    const scheduleApply = () => {
      if (debounceTimer !== null) {
        globalThis.clearTimeout(debounceTimer);
      }
      debounceTimer = globalThis.setTimeout(() => {
        debounceTimer = null;
        globalThis.cancelAnimationFrame(raf);
        raf = globalThis.requestAnimationFrame(() => {
          apply();
        });
      }, 90);
    };

    const ro = new ResizeObserver(() => {
      scheduleApply();
    });
    ro.observe(el);
    apply();

    const onWinResize = () => {
      scheduleApply();
    };
    globalThis.addEventListener("resize", onWinResize);

    return () => {
      ro.disconnect();
      globalThis.removeEventListener("resize", onWinResize);
      if (debounceTimer !== null) {
        globalThis.clearTimeout(debounceTimer);
      }
      globalThis.cancelAnimationFrame(raf);
    };
  }, [isActive, persona?.id, containerRef]);
}
