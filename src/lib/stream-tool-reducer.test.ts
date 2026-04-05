import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classifyStreamJsonLine } from "./stream-json-parser";
import { createToolStreamState, reduceToolStreamLine } from "./stream-tool-reducer";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("reduceToolStreamLine", () => {
  it("test_reduceToolStreamLine_emits_done_on_content_block_stop", () => {
    let state = createToolStreamState();
    const lines = [
      JSON.stringify({
        type: "stream_event",
        event: {
          type: "content_block_start",
          index: 1,
          content_block: { type: "tool_use", id: "toolu_test", name: "bash", input: {} },
        },
      }),
      JSON.stringify({
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 1,
          delta: { type: "input_json_delta", partial_json: '{"command":"echo hi"}' },
        },
      }),
      JSON.stringify({
        type: "stream_event",
        event: { type: "content_block_stop", index: 1 },
      }),
    ];
    const emitted: unknown[] = [];
    for (const line of lines) {
      const obj = JSON.parse(line) as Record<string, unknown>;
      const out = reduceToolStreamLine(state, obj);
      state = out.state;
      if (out.row !== null) {
        emitted.push(out.row);
      }
    }
    expect(emitted).toHaveLength(1);
    const row = emitted[0] as { kind: string; command: string; name: string };
    expect(row.kind).toBe("tool_run");
    expect(row.name).toBe("bash");
    expect(row.command).toContain("echo hi");
  });
});

describe("fixture stream-json-sample.ndjson pipeline", () => {
  it("test_fixture_sample_produces_tool_and_done_rows", () => {
    const path = join(__dirname, "fixtures", "stream-json-sample.ndjson");
    const raw = readFileSync(path, "utf8");
    let state = createToolStreamState();
    const rows: { kind: string }[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        continue;
      }
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const toolOut = reduceToolStreamLine(state, obj);
      state = toolOut.state;
      if (toolOut.row !== null) {
        rows.push(toolOut.row);
      }
      const classified = classifyStreamJsonLine(trimmed);
      if (classified !== null) {
        rows.push(classified);
      }
    }
    expect(rows.some((r) => r.kind === "tool_run")).toBe(true);
    expect(rows.some((r) => r.kind === "assistant_text")).toBe(true);
    expect(rows.some((r) => r.kind === "system_generic")).toBe(true);
  });
});
