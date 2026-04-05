# Stream-json: tool and usage shapes (reference)

This document describes **NDJSON lines** the Rich agent can map to UI (tool cards, Done footer, context meter). Official [Claude Code headless](https://code.claude.com/docs/en/headless) documents `stream-json` + `--verbose` at a high level but not every inner field; the sample file is **synthetic** and aligned with common **Anthropic Messages streaming** patterns (`content_block_start` / `content_block_delta` / `content_block_stop`) that Claude Code often mirrors.

**Replace or extend** [`stream-json-sample.ndjson`](../src/lib/fixtures/stream-json-sample.ndjson) when you capture a **redacted** real run (`streamVerbose: true`, `allowedTools` set so `-p` does not block on Bash).

## Tool use (streaming)

| Step | `type` | `event.type` | Notes |
|------|--------|--------------|--------|
| Start | `stream_event` | `content_block_start` | `content_block.type === "tool_use"`, `id`, `name`, `index` |
| Input fragments | `stream_event` | `content_block_delta` | `delta.type === "input_json_delta"`, `partial_json`, same `index` |
| End | `stream_event` | `content_block_stop` | Same `index`; app joins `partial_json` and parses JSON for e.g. Bash `command` |

**UI:** Dino emits one **tool card** per tool block when `content_block_stop` arrives (completed card with command snippet).

## Text streaming

| Signal | Path |
|--------|------|
| Partial assistant text | `stream_event` → `event.delta.type === "text_delta"` → `delta.text` |

## Turn result and usage

| Signal | Path |
|--------|------|
| Summary line | top-level `type: "result"`, `subtype`, `duration_ms`, `total_cost_usd` |
| Token usage | Often nested under `result.usage` or top-level `usage` (shape varies by CLI version) |

**Fields the app reads when present (best-effort):**

- `usage.input_tokens` / `usage.output_tokens`
- `usage.cache_creation_input_tokens` / `usage.cache_read_input_tokens`

**Context limit:** not always present; the footer hides the meter when totals are unknown (no fake 1M cap).

## Permission events

Interactive **approve/deny** prompts are limited in `-p` mode. The UI shows **persona-derived** chips (`permissionMode`, `allowedTools`) in the Rich pane. If future verbose lines expose a stable `system` subtype for grants, map them in the parser to `permission_notice` rows.

## Non-goals

- **Edited · N** file counts: no stable field in current fixtures; omitted until sourced.
- Exact parity with every CLI revision: parser stays defensive and non-throwing.
