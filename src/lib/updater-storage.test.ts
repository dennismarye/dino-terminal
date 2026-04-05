import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  UPDATE_CHECK_INTERVAL_MS,
  isVersionPermanentlyDismissed,
  loadDismissedUpdateVersion,
  loadLastUpdateCheckMs,
  saveDismissedUpdateVersion,
  saveLastUpdateCheckMs,
  shouldThrottlePeriodicCheck,
} from "./updater-storage";

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

describe("updater-storage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", mockLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("test_saveDismissedUpdateVersion_roundtrip", () => {
    saveDismissedUpdateVersion("0.2.0");
    expect(loadDismissedUpdateVersion()).toBe("0.2.0");
  });

  it("test_saveLastUpdateCheckMs_roundtrip", () => {
    saveLastUpdateCheckMs(1_700_000_000_000);
    expect(loadLastUpdateCheckMs()).toBe(1_700_000_000_000);
  });

  it("test_shouldThrottlePeriodicCheck_false_when_never_checked", () => {
    expect(shouldThrottlePeriodicCheck(null, 1_000_000, UPDATE_CHECK_INTERVAL_MS)).toBe(
      false,
    );
  });

  it("test_shouldThrottlePeriodicCheck_true_inside_interval", () => {
    const now = 1_000_000_000;
    const last = now - UPDATE_CHECK_INTERVAL_MS + 1000;
    expect(shouldThrottlePeriodicCheck(last, now, UPDATE_CHECK_INTERVAL_MS)).toBe(true);
  });

  it("test_shouldThrottlePeriodicCheck_false_after_interval", () => {
    const now = 1_000_000_000;
    const last = now - UPDATE_CHECK_INTERVAL_MS - 1000;
    expect(shouldThrottlePeriodicCheck(last, now, UPDATE_CHECK_INTERVAL_MS)).toBe(false);
  });

  it("test_isVersionPermanentlyDismissed_matches_exact_version", () => {
    expect(isVersionPermanentlyDismissed("0.2.0", "0.2.0")).toBe(true);
    expect(isVersionPermanentlyDismissed("0.2.0", "0.2.1")).toBe(false);
    expect(isVersionPermanentlyDismissed(null, "0.2.0")).toBe(false);
  });
});
