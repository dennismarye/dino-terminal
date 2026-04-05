/**
 * Stateful NDJSON reducer for tool_use streaming blocks (content_block_*).
 * Emits one {@link StreamUiRow} per completed tool when `content_block_stop` arrives.
 */

import type { StreamUiRow } from "./stream-json-parser";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

type BlockEntry =
  | { kind: "text" }
  | { kind: "tool"; toolId: string; name: string; jsonParts: string[] };

export interface ToolStreamState {
  blocks: Map<number, BlockEntry>;
}

export function createToolStreamState(): ToolStreamState {
  return { blocks: new Map() };
}

function cloneBlocks(m: Map<number, BlockEntry>): Map<number, BlockEntry> {
  const next = new Map<number, BlockEntry>();
  for (const [k, v] of m) {
    if (v.kind === "tool") {
      next.set(k, {
        kind: "tool",
        toolId: v.toolId,
        name: v.name,
        jsonParts: [...v.jsonParts],
      });
    } else {
      next.set(k, { kind: "text" });
    }
  }
  return next;
}

function commandFromToolInput(input: Record<string, unknown>): string {
  const cmd = input.command;
  if (typeof cmd === "string" && cmd.length > 0) {
    return cmd.length > 2000 ? `${cmd.slice(0, 2000)}…` : cmd;
  }
  const alt = input.cmd ?? input.shell_command;
  if (typeof alt === "string" && alt.length > 0) {
    return alt.length > 2000 ? `${alt.slice(0, 2000)}…` : alt;
  }
  try {
    const s = JSON.stringify(input);
    return s.length > 800 ? `${s.slice(0, 800)}…` : s;
  } catch {
    return "(tool input)";
  }
}

/**
 * Apply one parsed stream-json object. Returns updated state and optional tool row to append.
 */
export function reduceToolStreamLine(
  state: ToolStreamState,
  obj: Record<string, unknown>,
): { state: ToolStreamState; row: StreamUiRow | null } {
  if (obj.type !== "stream_event") {
    return { state, row: null };
  }
  const ev = obj.event;
  if (!isRecord(ev)) {
    return { state, row: null };
  }
  const et = ev.type;
  const index = typeof ev.index === "number" ? ev.index : 0;

  if (et === "content_block_start") {
    const cb = ev.content_block;
    if (!isRecord(cb)) {
      return { state, row: null };
    }
    const blocks = cloneBlocks(state.blocks);
    if (cb.type === "tool_use") {
      const toolId = typeof cb.id === "string" ? cb.id : `idx-${index}`;
      const name = typeof cb.name === "string" ? cb.name : "tool";
      blocks.set(index, { kind: "tool", toolId, name, jsonParts: [] });
      return { state: { blocks }, row: null };
    }
    blocks.set(index, { kind: "text" });
    return { state: { blocks }, row: null };
  }

  if (et === "content_block_delta") {
    const delta = ev.delta;
    if (!isRecord(delta)) {
      return { state, row: null };
    }
    if (delta.type === "text_delta") {
      return { state, row: null };
    }
    if (delta.type !== "input_json_delta") {
      return { state, row: null };
    }
    const pj = delta.partial_json;
    if (typeof pj !== "string" || pj.length === 0) {
      return { state, row: null };
    }
    const blocks = cloneBlocks(state.blocks);
    const cur = blocks.get(index);
    if (!cur || cur.kind !== "tool") {
      return { state, row: null };
    }
    cur.jsonParts.push(pj);
    blocks.set(index, cur);
    return { state: { blocks }, row: null };
  }

  if (et === "content_block_stop") {
    const blocks = cloneBlocks(state.blocks);
    const cur = blocks.get(index);
    blocks.delete(index);
    if (!cur || cur.kind !== "tool") {
      return { state: { blocks }, row: null };
    }
    const joined = cur.jsonParts.join("");
    let command = joined;
    try {
      const parsed = JSON.parse(joined) as unknown;
      if (isRecord(parsed)) {
        command = commandFromToolInput(parsed);
      }
    } catch {
      command = joined.length > 800 ? `${joined.slice(0, 800)}…` : joined;
    }
    const row: StreamUiRow = {
      kind: "tool_run",
      toolId: cur.toolId,
      name: cur.name,
      command,
      status: "done",
    };
    return { state: { blocks }, row };
  }

  return { state, row: null };
}
