export type AgentViewMode = "classic" | "rich";

export const STORAGE_VIEW_MODE_PREFIX = "dino-terminal-view-mode-";

export function loadViewMode(personaId: string): AgentViewMode {
  try {
    const v = globalThis.localStorage.getItem(
      `${STORAGE_VIEW_MODE_PREFIX}${personaId}`,
    );
    if (v === "rich") {
      return "rich";
    }
  } catch {
    /* ignore */
  }
  return "classic";
}

export function saveViewMode(personaId: string, mode: AgentViewMode): void {
  try {
    globalThis.localStorage.setItem(
      `${STORAGE_VIEW_MODE_PREFIX}${personaId}`,
      mode,
    );
  } catch {
    /* ignore */
  }
}

export const STORAGE_FONT_SIZE = "dino-terminal-font-size";
export const STORAGE_TERMINAL_FONT_PRESET = "dino-terminal-font-preset";
export const STORAGE_COMFORT_THEME = "dino-terminal-comfort-theme";
export const STORAGE_WEBGL = "dino-terminal-terminal-webgl";
export const STORAGE_SIDEBAR_VISIBLE = "dino-terminal-sidebar-visible";
export const STORAGE_SIDEBAR_SECTIONS = "dino-terminal-sidebar-sections";

export const MIN_FONT = 10;
export const MAX_FONT = 22;
export const DEFAULT_FONT = 14;

const TERMINAL_FONT_PRESETS = ["system-mono", "jetbrains", "fira"] as const;

export type TerminalFontPreset = (typeof TERMINAL_FONT_PRESETS)[number];

function isTerminalFontPreset(v: string): v is TerminalFontPreset {
  return (TERMINAL_FONT_PRESETS as readonly string[]).includes(v);
}

export function loadTerminalFontPreset(): TerminalFontPreset {
  try {
    const v = globalThis.localStorage.getItem(STORAGE_TERMINAL_FONT_PRESET);
    if (v && isTerminalFontPreset(v)) {
      return v;
    }
  } catch {
    /* ignore */
  }
  return "system-mono";
}

export function saveTerminalFontPreset(p: TerminalFontPreset): void {
  try {
    globalThis.localStorage.setItem(STORAGE_TERMINAL_FONT_PRESET, p);
  } catch {
    /* ignore */
  }
}

/** Cycles system → JetBrains → Fira → system. Returns the new preset. */
export function cycleTerminalFontPreset(): TerminalFontPreset {
  const cur = loadTerminalFontPreset();
  const idx = TERMINAL_FONT_PRESETS.indexOf(cur);
  const next =
    TERMINAL_FONT_PRESETS[(idx + 1) % TERMINAL_FONT_PRESETS.length] ?? "system-mono";
  saveTerminalFontPreset(next);
  return next;
}

export function loadComfortTheme(): boolean {
  try {
    return globalThis.localStorage.getItem(STORAGE_COMFORT_THEME) === "1";
  } catch {
    return false;
  }
}

export function saveComfortTheme(enabled: boolean): void {
  try {
    globalThis.localStorage.setItem(STORAGE_COMFORT_THEME, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function toggleComfortTheme(): boolean {
  const next = !loadComfortTheme();
  saveComfortTheme(next);
  return next;
}

export function loadFontSize(): number {
  try {
    const n = Number(globalThis.localStorage.getItem(STORAGE_FONT_SIZE));
    if (Number.isFinite(n) && n >= MIN_FONT && n <= MAX_FONT) {
      return n;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_FONT;
}

export function saveFontSize(n: number): void {
  try {
    globalThis.localStorage.setItem(STORAGE_FONT_SIZE, String(n));
  } catch {
    /* ignore */
  }
}

export function loadSidebarVisible(): boolean {
  try {
    const v = globalThis.localStorage.getItem(STORAGE_SIDEBAR_VISIBLE);
    if (v === null) {
      return true;
    }
    return v === "1" || v === "true";
  } catch {
    return true;
  }
}

export function saveSidebarVisible(visible: boolean): void {
  try {
    globalThis.localStorage.setItem(STORAGE_SIDEBAR_VISIBLE, visible ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export interface SidebarSectionHeights {
  filesPx: number;
  sessionsPx: number;
}

const MIN_SECTION = 72;
const DEFAULT_FILES = 168;
const DEFAULT_SESSIONS = 140;

export function loadSidebarSections(): SidebarSectionHeights {
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_SIDEBAR_SECTIONS);
    if (raw) {
      const j = JSON.parse(raw) as Partial<SidebarSectionHeights>;
      return {
        filesPx: clampPx(Number(j.filesPx) || DEFAULT_FILES, MIN_SECTION, 400),
        sessionsPx: clampPx(
          Number(j.sessionsPx) || DEFAULT_SESSIONS,
          MIN_SECTION,
          400,
        ),
      };
    }
  } catch {
    /* ignore */
  }
  return { filesPx: DEFAULT_FILES, sessionsPx: DEFAULT_SESSIONS };
}

export function saveSidebarSections(h: SidebarSectionHeights): void {
  try {
    globalThis.localStorage.setItem(STORAGE_SIDEBAR_SECTIONS, JSON.stringify(h));
  } catch {
    /* ignore */
  }
}

function clampPx(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function shouldUseWebGl(): boolean {
  try {
    if (import.meta.env.VITE_TERMINAL_WEBGL === "true") {
      return true;
    }
  } catch {
    /* ignore */
  }
  try {
    return globalThis.localStorage.getItem(STORAGE_WEBGL) === "1";
  } catch {
    return false;
  }
}
