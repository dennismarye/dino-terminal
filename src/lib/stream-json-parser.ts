/**
 * Maps one NDJSON line from `claude --output-format stream-json` into UI rows.
 * Protocol noise is suppressed (returns null); user-visible text and summaries stay.
 * Tool cards are driven by {@link reduceToolStreamLine} in the session hook.
 */

export type StreamUiRow =
  | {
      kind: "assistant_text";
      title: "Assistant";
      body: string;
    }
  | {
      kind: "user_prompt";
      title: "You";
      body: string;
    }
  | {
      kind: "system_retry";
      title: string;
      body: string;
      rawSnippet?: string;
    }
  | {
      kind: "system_generic";
      title: string;
      body: string;
      rawSnippet?: string;
      flavor?: "done" | "error" | "rate" | "non_json" | "other";
      durationMs?: number;
    }
  | {
      kind: "tool_run";
      toolId: string;
      name: string;
      command: string;
      status: "running" | "done" | "error";
      durationMs?: number;
    }
  | {
      kind: "permission_notice";
      title: string;
      body: string;
      scope?: string;
    }
  | {
      kind: "unknown";
      title: string;
      body: string;
      rawSnippet?: string;
    };

export type StreamUiKind = StreamUiRow["kind"];

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

function concatTextBlocksFromContent(content: unknown): string | null {
  if (!Array.isArray(content)) {
    return null;
  }
  const parts: string[] = [];
  for (const block of content) {
    if (!isRecord(block)) {
      continue;
    }
    if (block.type === "text" && typeof block.text === "string" && block.text.length > 0) {
      parts.push(block.text);
    }
  }
  return parts.length > 0 ? parts.join("") : null;
}

function extractAssistantVisibleText(obj: Record<string, unknown>): string | null {
  const roots: unknown[] = [obj.message, obj];
  for (const root of roots) {
    if (!isRecord(root)) {
      continue;
    }
    const text = concatTextBlocksFromContent(root.content);
    if (text !== null) {
      return text;
    }
  }
  return null;
}

function formatResultRow(obj: Record<string, unknown>): StreamUiRow | null {
  const subtype = obj.subtype;
  const dur = obj.duration_ms;
  const cost = obj.total_cost_usd;
  const parts: string[] = [];
  if (subtype === "success") {
    parts.push("Completed successfully");
  } else if (typeof subtype === "string" && subtype.length > 0) {
    parts.push(`Finished (${subtype})`);
  }
  if (typeof dur === "number" && Number.isFinite(dur)) {
    parts.push(`${(dur / 1000).toFixed(1)}s`);
  }
  if (typeof cost === "string" && cost.length > 0) {
    parts.push(`$${cost}`);
  } else if (typeof cost === "number" && Number.isFinite(cost)) {
    parts.push(`$${cost.toFixed(4)}`);
  }
  if (parts.length === 0) {
    return null;
  }
  return {
    kind: "system_generic",
    title: "Done",
    body: parts.join(" · "),
    flavor: "done",
    durationMs: typeof dur === "number" && Number.isFinite(dur) ? dur : undefined,
  };
}

function formatErrorRow(obj: Record<string, unknown>): StreamUiRow | null {
  const msg =
    (typeof obj.error === "string" && obj.error) ||
    (typeof obj.message === "string" && obj.message) ||
    null;
  if (!msg) {
    return null;
  }
  return {
    kind: "system_generic",
    title: "Error",
    body: msg.length > 800 ? `${msg.slice(0, 800)}…` : msg,
    flavor: "error",
  };
}

function rateLimitRow(obj: Record<string, unknown>): StreamUiRow | null {
  const status = obj.status;
  if (status === "allowed") {
    return null;
  }
  if (typeof status !== "string" || status.length === 0) {
    return null;
  }
  return {
    kind: "system_generic",
    title: "Rate limit",
    body: status,
    flavor: "rate",
  };
}

function bodyForJsonPrimitive(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function apiRetryRow(
  obj: Record<string, unknown>,
  trimmed: string,
): StreamUiRow {
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

function assistantTextRowFromStream(obj: Record<string, unknown>): StreamUiRow | null {
  const streamed = textDeltaFromStreamEvent(obj);
  if (streamed === null || streamed.length === 0) {
    return null;
  }
  return {
    kind: "assistant_text",
    title: "Assistant",
    body: streamed,
  };
}

function assistantTextRowFromAssistant(obj: Record<string, unknown>): StreamUiRow | null {
  const text = extractAssistantVisibleText(obj);
  if (text === null || text.length === 0) {
    return null;
  }
  return {
    kind: "assistant_text",
    title: "Assistant",
    body: text,
  };
}

/** Stream-driven permission hints (verbose CLI; keep narrow to avoid hook spam). */
function permissionNoticeFromSystem(obj: Record<string, unknown>): StreamUiRow | null {
  if (obj.type !== "system") {
    return null;
  }
  const sub = obj.subtype;
  if (typeof sub !== "string") {
    return null;
  }
  const lower = sub.toLowerCase();
  if (
    !lower.includes("permission") &&
    lower !== "tool_allowed" &&
    lower !== "tool_denied"
  ) {
    return null;
  }
  const detail =
    (typeof obj.message === "string" && obj.message) ||
    (typeof obj.tool_name === "string" && `Tool: ${obj.tool_name}`) ||
    sub;
  return {
    kind: "permission_notice",
    title: "Permission",
    body: detail.length > 400 ? `${detail.slice(0, 400)}…` : detail,
    scope: typeof obj.tool_name === "string" ? obj.tool_name : undefined,
  };
}

function classifyParsedRecord(
  obj: Record<string, unknown>,
  trimmed: string,
): StreamUiRow | null {
  if (obj.type === "system") {
    if (obj.subtype === "api_retry") {
      return apiRetryRow(obj, trimmed);
    }
    const perm = permissionNoticeFromSystem(obj);
    if (perm !== null) {
      return perm;
    }
    return null;
  }

  const fromDelta = assistantTextRowFromStream(obj);
  if (fromDelta !== null) {
    return fromDelta;
  }

  if (obj.type === "stream_event") {
    return null;
  }

  if (obj.type === "assistant") {
    return assistantTextRowFromAssistant(obj);
  }

  if (obj.type === "user") {
    return null;
  }

  if (obj.type === "result") {
    return formatResultRow(obj);
  }

  if (obj.type === "error") {
    return formatErrorRow(obj);
  }

  const t = obj.type;
  if (t === "rate_limit" || t === "rate_limit_event") {
    return rateLimitRow(obj);
  }

  if (typeof t === "string") {
    return null;
  }

  return null;
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
 * Returns null for metadata-only lines (no timeline row).
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
      flavor: "non_json",
    };
  }

  if (!isRecord(obj)) {
    return {
      kind: "unknown",
      title: "Event",
      body: bodyForJsonPrimitive(obj),
    };
  }

  return classifyParsedRecord(obj, trimmed);
}
