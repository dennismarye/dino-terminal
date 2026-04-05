import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_FONT,
  MAX_FONT,
  MIN_FONT,
  loadFontSize,
  loadSidebarVisible,
  loadViewMode,
  saveFontSize,
  saveViewMode,
} from "./storage-keys";

function mockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem(k: string) {
      return store[k] ?? null;
    },
    setItem(k: string, v: string) {
      store[k] = v;
    },
    removeItem(k: string) {
      delete store[k];
    },
    clear() {
      for (const k of Object.keys(store)) {
        delete store[k];
      }
    },
  };
}

describe("storage-keys", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", mockLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("test_loadFontSize_roundtrip", () => {
    saveFontSize(15);
    expect(loadFontSize()).toBe(15);
  });

  it("test_loadFontSize_clamps_invalid_to_default", () => {
    globalThis.localStorage.setItem("dino-terminal-font-size", "999");
    expect(loadFontSize()).toBe(DEFAULT_FONT);
  });

  it("test_loadFontSize_respects_bounds", () => {
    saveFontSize(MIN_FONT - 1);
    expect(loadFontSize()).toBe(DEFAULT_FONT);
    saveFontSize(MAX_FONT + 1);
    expect(loadFontSize()).toBe(DEFAULT_FONT);
  });

  it("test_loadSidebarVisible_defaults_true", () => {
    expect(loadSidebarVisible()).toBe(true);
  });

  it("test_loadViewMode_defaults_classic", () => {
    expect(loadViewMode("p1")).toBe("classic");
  });

  it("test_saveViewMode_rich_roundtrip", () => {
    saveViewMode("p2", "rich");
    expect(loadViewMode("p2")).toBe("rich");
  });
});
