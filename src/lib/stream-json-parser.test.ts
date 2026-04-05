import { describe, expect, it } from "vitest";
import {
  classifyStreamJsonLine,
  extractSessionIdFromLine,
} from "./stream-json-parser";

describe("classifyStreamJsonLine", () => {
  it("test_classifyStreamJsonLine_text_delta_returns_assistant", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { delta: { type: "text_delta", text: "Hello" } },
    });
    const r = classifyStreamJsonLine(line);
    expect(r?.kind).toBe("assistant_text");
    expect(r?.body).toBe("Hello");
  });

  it("test_classifyStreamJsonLine_api_retry_returns_system_retry", () => {
    const line = JSON.stringify({
      type: "system",
      subtype: "api_retry",
      attempt: 2,
      max_retries: 5,
      retry_delay_ms: 1000,
      error: "rate_limit",
    });
    const r = classifyStreamJsonLine(line);
    expect(r?.kind).toBe("system_retry");
    expect(r?.body).toContain("2");
    expect(r?.body).toContain("rate_limit");
  });

  it("test_classifyStreamJsonLine_invalid_json_returns_generic", () => {
    const r = classifyStreamJsonLine("not-json {{{");
    expect(r?.kind).toBe("system_generic");
    expect(r?.title).toBe("Non-JSON line");
  });
});

describe("extractSessionIdFromLine", () => {
  it("test_extractSessionIdFromLine_reads_top_level", () => {
    const sid = extractSessionIdFromLine(
      JSON.parse('{"session_id":"sess-abc","type":"system"}') as unknown,
    );
    expect(sid).toBe("sess-abc");
  });

  it("test_extractSessionIdFromLine_missing_returns_null", () => {
    expect(extractSessionIdFromLine({ type: "x" })).toBeNull();
  });
});
