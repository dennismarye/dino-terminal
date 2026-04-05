import type { Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkForUpdate,
  closeUpdateQuietly,
  downloadInstallAndRelaunch,
  isTauriApp,
} from "../lib/app-updater";
import {
  isVersionPermanentlyDismissed,
  loadDismissedUpdateVersion,
  loadLastUpdateCheckMs,
  saveDismissedUpdateVersion,
  saveLastUpdateCheckMs,
  shouldThrottlePeriodicCheck,
  UPDATE_CHECK_INTERVAL_MS,
} from "../lib/updater-storage";

const STARTUP_CHECK_DELAY_MS = 4000;

export type PaletteUpdateCheckResult =
  | "no-tauri"
  | "up-to-date"
  | "cancelled"
  | "install-started"
  | "install-failed";

export function useUpdateAvailability(): {
  bannerVisible: boolean;
  bannerVersion: string | null;
  bannerDownloading: boolean;
  onBannerUpdate: () => void;
  onBannerLater: () => void;
  onBannerDismiss: () => void;
  runPaletteUpdateCheck: () => Promise<PaletteUpdateCheckResult>;
} {
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerVersion, setBannerVersion] = useState<string | null>(null);
  const [bannerDownloading, setBannerDownloading] = useState(false);
  const pendingRef = useRef<Update | null>(null);
  const laterBlockedUntilRef = useRef<number>(0);

  const clearPending = useCallback(async () => {
    const u = pendingRef.current;
    pendingRef.current = null;
    setBannerVisible(false);
    setBannerVersion(null);
    if (u) {
      await closeUpdateQuietly(u);
    }
  }, []);

  const showBannerForUpdate = useCallback(
    async (update: Update, nowMs: number) => {
      if (isVersionPermanentlyDismissed(loadDismissedUpdateVersion(), update.version)) {
        await closeUpdateQuietly(update);
        return;
      }
      if (nowMs < laterBlockedUntilRef.current) {
        await closeUpdateQuietly(update);
        return;
      }
      if (pendingRef.current) {
        await closeUpdateQuietly(pendingRef.current);
      }
      pendingRef.current = update;
      setBannerVersion(update.version);
      setBannerVisible(true);
    },
    [],
  );

  const runBackgroundCheck = useCallback(
    async (force: boolean) => {
      if (!isTauriApp()) {
        return;
      }
      const now = Date.now();
      if (!force && shouldThrottlePeriodicCheck(loadLastUpdateCheckMs(), now)) {
        return;
      }
      saveLastUpdateCheckMs(now);
      const update = await checkForUpdate();
      if (!update) {
        await clearPending();
        return;
      }
      await showBannerForUpdate(update, now);
    },
    [clearPending, showBannerForUpdate],
  );

  useEffect(() => {
    if (!isTauriApp()) {
      return;
    }
    const t = globalThis.setTimeout(() => {
      void runBackgroundCheck(false);
    }, STARTUP_CHECK_DELAY_MS);
    return () => {
      globalThis.clearTimeout(t);
    };
  }, [runBackgroundCheck]);

  useEffect(() => {
    if (!isTauriApp()) {
      return;
    }
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void runBackgroundCheck(false);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [runBackgroundCheck]);

  const onBannerUpdate = useCallback(() => {
    void (async () => {
      const u = pendingRef.current;
      if (!u) {
        return;
      }
      setBannerDownloading(true);
      try {
        await downloadInstallAndRelaunch(u);
      } catch (e) {
        console.warn("[dino-terminal] update install failed:", e);
        globalThis.alert(
          "The update could not be installed. Check the log and try again from the command palette.",
        );
        setBannerDownloading(false);
        pendingRef.current = null;
        setBannerVisible(false);
        setBannerVersion(null);
        await closeUpdateQuietly(u);
      }
    })();
  }, []);

  const onBannerLater = useCallback(() => {
    laterBlockedUntilRef.current = Date.now() + UPDATE_CHECK_INTERVAL_MS;
    void clearPending();
  }, [clearPending]);

  const onBannerDismiss = useCallback(() => {
    const v = pendingRef.current?.version ?? bannerVersion;
    if (v) {
      saveDismissedUpdateVersion(v);
    }
    void clearPending();
  }, [bannerVersion, clearPending]);

  const runPaletteUpdateCheck = useCallback(async (): Promise<PaletteUpdateCheckResult> => {
    if (!isTauriApp()) {
      return "no-tauri";
    }
    saveLastUpdateCheckMs(Date.now());
    const u = await checkForUpdate();
    if (!u) {
      return "up-to-date";
    }
    const ok = globalThis.confirm(
      `Install Dino Terminal ${u.version} now? The app will download the update and restart.`,
    );
    if (!ok) {
      await closeUpdateQuietly(u);
      return "cancelled";
    }
    try {
      await downloadInstallAndRelaunch(u);
      return "install-started";
    } catch (e) {
      console.warn("[dino-terminal] palette update install failed:", e);
      await closeUpdateQuietly(u);
      return "install-failed";
    }
  }, []);

  return {
    bannerVisible,
    bannerVersion,
    bannerDownloading,
    onBannerUpdate,
    onBannerLater,
    onBannerDismiss,
    runPaletteUpdateCheck,
  };
}
