/** Persisted: remote version string the user dismissed for the update banner. */
export const STORAGE_UPDATE_DISMISSED = "dino-terminal-update-dismissed";

/** Persisted: last time we ran an automatic updater `check()` (ms since epoch). */
export const STORAGE_UPDATE_LAST_CHECK_MS = "dino-terminal-update-last-check";

/** Minimum interval between automatic background checks (24h). */
export const UPDATE_CHECK_INTERVAL_MS = 86_400_000;

export function loadDismissedUpdateVersion(): string | null {
  try {
    const v = globalThis.localStorage.getItem(STORAGE_UPDATE_DISMISSED);
    if (v && v.length > 0) {
      return v;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveDismissedUpdateVersion(version: string): void {
  try {
    globalThis.localStorage.setItem(STORAGE_UPDATE_DISMISSED, version);
  } catch {
    /* ignore */
  }
}

export function loadLastUpdateCheckMs(): number | null {
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_UPDATE_LAST_CHECK_MS);
    if (raw === null) {
      return null;
    }
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveLastUpdateCheckMs(ms: number): void {
  try {
    globalThis.localStorage.setItem(STORAGE_UPDATE_LAST_CHECK_MS, String(ms));
  } catch {
    /* ignore */
  }
}

export function shouldThrottlePeriodicCheck(
  lastCheckMs: number | null,
  nowMs: number,
  intervalMs: number = UPDATE_CHECK_INTERVAL_MS,
): boolean {
  if (lastCheckMs === null) {
    return false;
  }
  return nowMs - lastCheckMs < intervalMs;
}

export function isVersionPermanentlyDismissed(
  dismissed: string | null,
  remoteVersion: string,
): boolean {
  return dismissed !== null && dismissed === remoteVersion;
}
