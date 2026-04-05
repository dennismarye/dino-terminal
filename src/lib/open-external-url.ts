import { open } from "@tauri-apps/plugin-shell";
import { isSafeHttpUrl } from "./safe-http-url";

/**
 * Opens http(s) URLs in the system default browser via Tauri shell.
 * No-op for non-http(s) schemes (defense in depth with shell plugin regex).
 */
export function openExternalHttpUrl(uri: string): void {
  if (!isSafeHttpUrl(uri)) {
    return;
  }
  void open(uri).catch(() => {
    /* ignore shell open failures */
  });
}
