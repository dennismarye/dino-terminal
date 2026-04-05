export const STORAGE_FONT_SIZE = "dino-terminal-font-size";
export const STORAGE_WEBGL = "dino-terminal-terminal-webgl";
export const STORAGE_SIDEBAR_VISIBLE = "dino-terminal-sidebar-visible";
export const STORAGE_SIDEBAR_SECTIONS = "dino-terminal-sidebar-sections";

export const MIN_FONT = 10;
export const MAX_FONT = 22;
export const DEFAULT_FONT = 13;

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
