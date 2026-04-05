# Rich mode: Claude Code `stream-json` protocol

Dino Terminal’s **Rich** view consumes **newline-delimited JSON** from **Claude Code** launched the same way as **Classic** mode: **resolved `npx`** plus persona **`cmdArgs`** (e.g. `@anthropic-ai/claude-code@latest`), then **`-p`**, **`--output-format stream-json`**, **`--include-partial-messages`**, then persona **`args`** (e.g. `--add-dir`). **`--verbose`** is **off by default** so the timeline stays readable; set persona **`streamVerbose`: true** to pass **`--verbose`** (noisy protocol lines).

This avoids relying on a bare `claude` binary on `PATH` (shell aliases and stale shims do not apply to Rust-spawned children).

Equivalent shell shape (default):

```bash
npx @anthropic-ai/claude-code@latest -p "<prompt>" --output-format stream-json --include-partial-messages [persona args…]
```

With verbose (optional, persona `streamVerbose`):

```bash
npx @anthropic-ai/claude-code@latest -p "<prompt>" --output-format stream-json --verbose --include-partial-messages [persona args…]
```

**Transport:** subprocess only (no Anthropic SDK / Messages API in-app). The CLI owns auth, tools, and retries.

## Compatibility

| Item | Notes |
|------|--------|
| **CLI** | **`npx`** must resolve (same as PTY sessions). Package / version comes from persona **`cmdArgs`**. |
| **Docs** | [Run Claude Code programmatically](https://code.claude.com/docs/en/headless), [CLI reference](https://code.claude.com/en/cli-reference). |
| **Shape drift** | Parser stays non-throwing. Most unknown `type` lines are **hidden** from the timeline; **`type: "error"`** and **non-JSON stdout lines** still surface. |

## Line format

- **One JSON object per line** (UTF-8). Partial lines are buffered in Rust until `\n`.
- **Non-JSON lines** (warnings, stray prints): shown as a **Non-JSON line** row; session continues if the process is still running.

## Event buckets (UI mapping)

| Bucket | Typical signals | UI |
|--------|-----------------|-----|
| **Assistant text** | `stream_event` with `event.delta.type == "text_delta"` | Timeline **Assistant** row |
| **Assistant (final)** | `type: "assistant"` with `message.content` text blocks | Same **Assistant** row (when text is present) |
| **System / retry** | `type: "system"`, `subtype: "api_retry"` | “Retrying…” row |
| **Other system** | Hooks, init, etc. | **Hidden** (no row) |
| **Stream scaffolding** | `message_stop`, `message_delta`, etc. | **Hidden** (no row) |
| **Tool use** | `stream_event` → `content_block_start` (`tool_use`) + `input_json_delta` + `content_block_stop` | **Tool card** when the block completes (needs **`streamVerbose`** so those lines appear) |
| **Turn summary** | `type: "result"` (success + duration + cost when present) | **Done** row + **Finished in …** feed footer |
| **Rate limit** | `rate_limit` / `rate_limit_event` | **Hidden** when `status: "allowed"`; otherwise **Rate limit** row |
| **Errors** | `type: "error"`, stderr lines, non-zero exit | **Error** row + banner / exit code |
| **Model / usage** | `model` on lines; `result.usage` token fields | **Rich dock** (model pill + token meter when usage exists) |
| **Permissions (stream)** | `system` + `subtype` containing `permission`, or `tool_allowed` / `tool_denied` | **Permission** row (narrow patterns only) |
| **Permissions (persona)** | `permissionMode`, `allowedTools` in `personas.json` | **Policy** bar above the feed |

Consecutive **assistant** `text_delta` rows are **coalesced** in the UI for readability.

See [stream-json-tool-events.md](./stream-json-tool-events.md) and [`src/lib/fixtures/stream-json-sample.ndjson`](../src/lib/fixtures/stream-json-sample.ndjson) for reference shapes.

### Documented `system` / `api_retry` fields (from official docs)

When present, objects may include:

| Field | Meaning |
|-------|---------|
| `type` | `"system"` |
| `subtype` | `"api_retry"` |
| `attempt` | Current attempt (starts at 1) |
| `max_retries` | Max attempts |
| `retry_delay_ms` | Delay before next attempt |
| `error_status` | HTTP status or null |
| `error` | Category string |
| `uuid` | Event id |
| `session_id` | Session scope |

### Streaming text (jq example from docs)

```bash
jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'
```

Use this as a **filter hint**; the in-app parser mirrors that for visible assistant text.

## Multi-turn (Dino behavior)

Official pattern is **separate CLI invocations**, not a long-lived REPL:

1. First message: `claude -p "…" --output-format stream-json --include-partial-messages` (plus optional `--verbose` via `streamVerbose`).
2. Follow-ups: same with **`--continue`** (recent conversation) or **`--resume <session_id>`** when the UI has captured a session id (e.g. from stream metadata).

**Dino Rich v1:** after the first completed run in a Rich “conversation”, subsequent sends use **`--continue`** with the new prompt. If we later capture `session_id` from events, we can prefer **`--resume`**.

## Flags alignment with personas

Optional persona fields (see `personas.json` / Rust `Persona`):

- **`streamBare`** → `--bare` (faster, less context; document tradeoffs).
- **`streamVerbose`** → `--verbose` (raw protocol noise; default **false**).
- **`permissionMode`** → `--permission-mode`
- **`allowedTools`** → `--allowedTools` (comma-separated tool list string)
- **`streamExtraArgs`** → appended verbatim (e.g. `--model`, `--add-dir`)

Default Rich profile should **not** use bare mode unless the user opts in (parity with interactive context).

## Known gaps vs Classic (TUI)

- **Slash commands / user-invoked skills** are **interactive-only** in `-p`; users type natural-language tasks instead.
- **OAuth / keychain** paths may differ in `--bare` (API key / settings).

## Samples (illustrative)

Exact shapes change with CLI versions; treat these as **examples** for parser tests, not a guarantee.

**api_retry (illustrative):**

```json
{"type":"system","subtype":"api_retry","attempt":1,"max_retries":3,"retry_delay_ms":2000,"error_status":429,"error":"rate_limit","uuid":"…","session_id":"…"}
```

**stream_event / text_delta (illustrative):**

```json
{"type":"stream_event","event":{"delta":{"type":"text_delta","text":"Hello"}}}
```
