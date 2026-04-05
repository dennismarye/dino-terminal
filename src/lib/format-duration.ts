/**
 * Human-readable duration for UI (e.g. feed footer).
 */
export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return "";
  }
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m <= 0) {
    return `${s}s`;
  }
  if (s === 0) {
    return `${m}m`;
  }
  return `${m}m ${s}s`;
}
