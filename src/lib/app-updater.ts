import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";

export function isTauriApp(): boolean {
  try {
    return "__TAURI_INTERNALS__" in globalThis;
  } catch {
    return false;
  }
}

/**
 * Returns a pending update from the configured updater endpoints, or `null`.
 * Failures are logged and coerced to `null` (no false “up to date” UI from thrown errors).
 */
export async function checkForUpdate(): Promise<Update | null> {
  if (!isTauriApp()) {
    return null;
  }
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    return await check();
  } catch (e) {
    console.warn("[dino-terminal] updater check failed:", e);
    return null;
  }
}

export async function closeUpdateQuietly(update: Update): Promise<void> {
  try {
    await update.close();
  } catch {
    /* ignore */
  }
}

/**
 * Download, install, and relaunch. Call only after user confirmation.
 */
export async function downloadInstallAndRelaunch(
  update: Update,
  onProgress?: (event: DownloadEvent) => void,
): Promise<void> {
  try {
    await update.downloadAndInstall(onProgress);
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } finally {
    await closeUpdateQuietly(update);
  }
}
