/**
 * Returns true only for http: and https: URLs with a host (blocks javascript:, file:, etc.).
 */
export function isSafeHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
