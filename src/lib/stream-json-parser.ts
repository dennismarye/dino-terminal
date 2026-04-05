/**
 * Maps one NDJSON line from `claude --output-format stream-json` into UI rows.
 * Unknown shapes must never throw — callers rely on this for stability.
 */

export type StreamUiKind =
  | "assistant_text"
  | "system_retry"
  | "system_generic"
  | "unknown";

export interface StreamUiRow {
  kind: StreamUiKind;
  title: string;
  body: string;
  /** Original line when useful for debugging (truncated in hook if huge). */
  rawSnippet?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function textDeltaFromStreamEvent(obj: Record<string, unknown>): string | null {
  const ev = obj.event;
  if (!isRecord(ev)) {
    return null;
  }
  const delta = ev.delta;
  if (!isRecord(delta)) {
    return null;
  }
  if (delta.type !== "text_delta") {
    return null;
  }
  const t = delta.text;
  return typeof t === "string" ? t : null;
}

/**
 * Extract `session_id` when present at top level (e.g. system events).
 */
export function extractSessionIdFromLine(parsed: unknown): string | null {
  if (!isRecord(parsed)) {
    return null;
  }
  const sid = parsed.session_id;
  return typeof sid === "string" && sid.length > 0 ? sid : null;
}

/**
 * Classify a single JSON line into zero or one primary UI row.
 * Some lines are metadata-only (no row) — returns null.
 */
export function classifyStreamJsonLine(line: string): StreamUiRow | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed) as unknown;
  } catch {
    return {
      kind: "system_generic",
      title: "Non-JSON line",
      body: trimmed.length > 240 ? `${trimmed.slice(0, 240)}…` : trimmed,
      rawSnippet: trimmed.slice(0, 400),
    };
  }

  if (!isRecord(obj)) {
    return {
      kind: "unknown",
      title: "Event",
      body: String(obj),
    };
  }

  if (obj.type === "system" && obj.subtype === "api_retry") {
    const attempt = obj.attempt;
    const max = obj.max_retries;
    const delay = obj.retry_delay_ms;
    const err = obj.error;
    const parts: string[] = [];
    if (typeof attempt === "number" && typeof max === "number") {
      parts.push(`Attempt ${attempt} of ${max}`);
    }
    if (typeof delay === "number") {
      parts.push(`next in ${delay} ms`);
    }
    if (typeof err === "string") {
      parts.push(`(${err})`);
    }
    return {
      kind: "system_retry",
      title: "Retrying API request",
      body: parts.join(" ") || "Retry in progress",
      rawSnippet: trimmed.slice(0, 500),
    };
  }

  const text = textDeltaFromStreamEvent(obj);
  if (text !== null && text.length > 0) {
    return {
      kind: "assistant_text",
      title: "Assistant",
      body: text,
    };
  }

  if (obj.type === "stream_event") {
    return {
      kind: "unknown",
      title: "Stream event",
      body: trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed,
      rawSnippet: trimmed.slice(0, 400),
    };
  }

  if (typeof obj.type === "string") {
    return {
      kind: "unknown",
      title: `Event (${obj.type})`,
      body: trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed,
      rawSnippet: trimmed.slice(0, 400),
    };
  }

  return {
    kind: "unknown",
    title: "Event",
    body: trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed,
    rawSnippet: trimmed.slice(0, 400),
  };
}
