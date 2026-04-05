/**
 * Best-effort usage snapshot from a parsed `result` line (shape varies by CLI).
 */

export interface TurnUsageSnapshot {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
  durationMs: number | null;
  totalCostUsd: string | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  return null;
}

/**
 * Reads nested `usage` on the result object or top-level usage fields.
 */
export function extractUsageFromResultLine(obj: Record<string, unknown>): TurnUsageSnapshot | null {
  if (obj.type !== "result") {
    return null;
  }
  const usageRoot = isRecord(obj.usage) ? obj.usage : obj;
  const inputTokens = num(usageRoot.input_tokens);
  const outputTokens = num(usageRoot.output_tokens);
  const cacheCreationInputTokens = num(usageRoot.cache_creation_input_tokens);
  const cacheReadInputTokens = num(usageRoot.cache_read_input_tokens);
  const durationMs = num(obj.duration_ms);
  let totalCostUsd: string | null = null;
  const c = obj.total_cost_usd;
  if (typeof c === "string" && c.length > 0) {
    totalCostUsd = c;
  } else if (typeof c === "number" && Number.isFinite(c)) {
    totalCostUsd = String(c);
  }

  const hasAny =
    inputTokens !== null ||
    outputTokens !== null ||
    cacheCreationInputTokens !== null ||
    cacheReadInputTokens !== null ||
    durationMs !== null ||
    totalCostUsd !== null;

  if (!hasAny) {
    return null;
  }

  return {
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
    durationMs,
    totalCostUsd,
  };
}

/**
 * Total “context-ish” tokens for a simple meter (input + cache reads + cache creation + output).
 */
export function sumUsageTokens(u: TurnUsageSnapshot): number | null {
  const parts = [
    u.inputTokens,
    u.outputTokens,
    u.cacheCreationInputTokens,
    u.cacheReadInputTokens,
  ].filter((x): x is number => x !== null);
  if (parts.length === 0) {
    return null;
  }
  return parts.reduce((a, b) => a + b, 0);
}
