import { describe, expect, it } from "vitest";
import { extractUsageFromResultLine, sumUsageTokens } from "./usage-extract";

describe("extractUsageFromResultLine", () => {
  it("test_extract_reads_nested_usage", () => {
    const obj = {
      type: "result",
      subtype: "success",
      duration_ms: 91_000,
      total_cost_usd: "0.01",
      usage: {
        input_tokens: 120,
        output_tokens: 40,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 50_000,
      },
    } as Record<string, unknown>;
    const u = extractUsageFromResultLine(obj);
    expect(u).not.toBeNull();
    expect(u?.inputTokens).toBe(120);
    expect(u?.outputTokens).toBe(40);
    expect(u?.cacheReadInputTokens).toBe(50_000);
    expect(u?.durationMs).toBe(91_000);
    expect(u?.totalCostUsd).toBe("0.01");
  });

  it("test_sumUsageTokens_sums_present_fields", () => {
    const u = extractUsageFromResultLine({
      type: "result",
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100 },
    } as Record<string, unknown>);
    expect(u).not.toBeNull();
    if (u) {
      expect(sumUsageTokens(u)).toBe(115);
    }
  });
});
