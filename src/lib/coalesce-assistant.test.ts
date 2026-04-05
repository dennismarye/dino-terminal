import { describe, expect, it } from "vitest";
import { appendCoalesced } from "./coalesce-assistant";
import type { StreamUiRow } from "./stream-json-parser";

describe("appendCoalesced", () => {
  it("test_appendCoalesced_merges_consecutive_assistant_text", () => {
    let id = 0;
    const mkId = () => `id-${(id += 1)}`;
    const a1: StreamUiRow = { kind: "assistant_text", title: "Assistant", body: "Hello " };
    const a2: StreamUiRow = { kind: "assistant_text", title: "Assistant", body: "world" };
    let entries = appendCoalesced([], a1, mkId);
    entries = appendCoalesced(entries, a2, mkId);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.row.kind).toBe("assistant_text");
    if (entries[0]?.row.kind === "assistant_text") {
      expect(entries[0].row.body).toBe("Hello world");
    }
  });

  it("test_appendCoalesced_does_not_merge_across_user_prompt", () => {
    let id = 0;
    const mkId = () => `id-${(id += 1)}`;
    const u: StreamUiRow = { kind: "user_prompt", title: "You", body: "Hi" };
    const a: StreamUiRow = { kind: "assistant_text", title: "Assistant", body: "A" };
    const b: StreamUiRow = { kind: "assistant_text", title: "Assistant", body: "B" };
    let entries = appendCoalesced([], u, mkId);
    entries = appendCoalesced(entries, a, mkId);
    entries = appendCoalesced(entries, b, mkId);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.row.kind).toBe("user_prompt");
    expect(entries[1]?.row.kind).toBe("assistant_text");
    if (entries[1]?.row.kind === "assistant_text") {
      expect(entries[1].row.body).toBe("AB");
    }
  });
});
