import type { TerminalFontPreset } from "./storage-keys";
import { loadComfortTheme } from "./storage-keys";

/** Dispatched after terminal font or comfort theme prefs change (same-tab). */
export const APPEARANCE_CHANGE_EVENT = "dino-terminal-appearance";

export function dispatchAppearanceChanged(): void {
  globalThis.dispatchEvent(new CustomEvent(APPEARANCE_CHANGE_EVENT));
}

/** Syncs `html.dino-comfort` from localStorage (call on boot and after palette toggles). */
export function syncComfortThemeClass(): void {
  const on = loadComfortTheme();
  globalThis.document.documentElement.classList.toggle("dino-comfort", on);
}

export function terminalFontFamilyForPreset(preset: TerminalFontPreset): string {
  switch (preset) {
    case "system-mono":
      return 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    case "jetbrains":
      return '"JetBrains Mono", ui-monospace, Menlo, Monaco, Consolas, monospace';
    case "fira":
      return '"Fira Code", "Fira Mono", ui-monospace, Menlo, Monaco, monospace';
    default: {
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
}
