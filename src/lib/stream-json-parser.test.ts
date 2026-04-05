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
    if (r?.kind === "assistant_text") {
      expect(r.body).toBe("Hello");
    }
  });

  it("test_classifyStreamJsonLine_text_delta_empty_suppressed", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { type: "content_block_delta", delta: { type: "text_delta", text: "" } },
    });
    expect(classifyStreamJsonLine(line)).toBeNull();
  });

  it("test_classifyStreamJsonLine_message_stop_suppressed", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { type: "message_stop" },
    });
    expect(classifyStreamJsonLine(line)).toBeNull();
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
    if (r?.kind === "system_retry") {
      expect(r.body).toContain("2");
      expect(r.body).toContain("rate_limit");
    }
  });

  it("test_classifyStreamJsonLine_system_init_suppressed", () => {
    const line = JSON.stringify({
      type: "system",
      subtype: "init",
      session_id: "s1",
    });
    expect(classifyStreamJsonLine(line)).toBeNull();
  });

  it("test_classifyStreamJsonLine_assistant_message_content_returns_text", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Hi Dennis." }],
      },
    });
    const r = classifyStreamJsonLine(line);
    expect(r?.kind).toBe("assistant_text");
    if (r?.kind === "assistant_text") {
      expect(r.body).toBe("Hi Dennis.");
    }
  });

  it("test_classifyStreamJsonLine_assistant_metadata_only_suppressed", () => {
    const line = JSON.stringify({
      type: "assistant",
      model: "claude-opus-4-6",
      message: { role: "assistant", content: [] },
    });
    expect(classifyStreamJsonLine(line)).toBeNull();
  });

  it("test_classifyStreamJsonLine_result_success_returns_done", () => {
    const line = JSON.stringify({
      type: "result",
      subtype: "success",
      duration_ms: 3845,
      total_cost_usd: "0.0862415",
    });
    const r = classifyStreamJsonLine(line);
    expect(r?.kind).toBe("system_generic");
    if (r?.kind === "system_generic") {
      expect(r.title).toBe("Done");
      expect(r.body).toContain("Completed successfully");
      expect(r.body).toContain("3.8s");
      expect(r.body).toContain("$0.0862415");
      expect(r.flavor).toBe("done");
      expect(r.durationMs).toBe(3845);
    }
  });

  it("test_classifyStreamJsonLine_rate_limit_allowed_suppressed", () => {
    const line = JSON.stringify({
      type: "rate_limit_event",
      status: "allowed",
    });
    expect(classifyStreamJsonLine(line)).toBeNull();
  });

  it("test_classifyStreamJsonLine_rate_limit_throttled_shows_row", () => {
    const line = JSON.stringify({
      type: "rate_limit_event",
      status: "throttled",
    });
    const r = classifyStreamJsonLine(line);
    expect(r?.kind).toBe("system_generic");
    if (r?.kind === "system_generic") {
      expect(r.title).toBe("Rate limit");
      expect(r.body).toBe("throttled");
      expect(r.flavor).toBe("rate");
    }
  });

  it("test_classifyStreamJsonLine_error_returns_message", () => {
    const line = JSON.stringify({
      type: "error",
      error: "Something went wrong",
    });
    const r = classifyStreamJsonLine(line);
    expect(r?.kind).toBe("system_generic");
    if (r?.kind === "system_generic") {
      expect(r.title).toBe("Error");
      expect(r.body).toContain("Something went wrong");
      expect(r.flavor).toBe("error");
    }
  });

  it("test_classifyStreamJsonLine_unknown_typed_suppressed", () => {
    const line = JSON.stringify({
      type: "custom_internal",
      foo: "bar",
    });
    expect(classifyStreamJsonLine(line)).toBeNull();
  });

  it("test_classifyStreamJsonLine_invalid_json_returns_generic", () => {
    const r = classifyStreamJsonLine("not-json {{{");
    expect(r?.kind).toBe("system_generic");
    if (r?.kind === "system_generic") {
      expect(r.title).toBe("Non-JSON line");
      expect(r.flavor).toBe("non_json");
    }
  });

  it("test_classifyStreamJsonLine_system_permission_notice", () => {
    const line = JSON.stringify({
      type: "system",
      subtype: "permission_auto_approved",
      message: "Bash allowed",
    });
    const r = classifyStreamJsonLine(line);
    expect(r?.kind).toBe("permission_notice");
    if (r?.kind === "permission_notice") {
      expect(r.body).toContain("Bash");
    }
  });

  it("test_classifyStreamJsonLine_user_suppressed", () => {
    const line = JSON.stringify({ type: "user", message: { role: "user" } });
    expect(classifyStreamJsonLine(line)).toBeNull();
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
