# Rich mode: Claude Code `stream-json` protocol

Dino Terminal’s **Rich** view consumes **newline-delimited JSON** from **Claude Code** launched the same way as **Classic** mode: **resolved `npx`** plus persona **`cmdArgs`** (e.g. `@anthropic-ai/claude-code@latest`), then **`-p`**, **`--output-format stream-json`**, **`--verbose`**, **`--include-partial-messages`**, then persona **`args`** (e.g. `--add-dir`). This avoids relying on a bare `claude` binary on `PATH` (shell aliases and stale shims do not apply to Rust-spawned children).

Equivalent shell shape:

```bash
npx @anthropic-ai/claude-code@latest -p "<prompt>" --output-format stream-json --verbose --include-partial-messages [persona args…]
```

**Transport:** subprocess only (no Anthropic SDK / Messages API in-app). The CLI owns auth, tools, and retries.

## Compatibility

| Item | Notes |
|------|--------|
| **CLI** | **`npx`** must resolve (same as PTY sessions). Package / version comes from persona **`cmdArgs`**. |
| **Docs** | [Run Claude Code programmatically](https://code.claude.com/docs/en/headless), [CLI reference](https://code.claude.com/en/cli-reference). |
| **Shape drift** | Unknown `type` / fields → UI shows a generic system row; never crash the parser. |

## Line format

- **One JSON object per line** (UTF-8). Partial lines are buffered in Rust until `\n`.
- **Non-JSON lines** (warnings, stray prints): emit `claude-stream:parse-warning` / log; session continues if the process is still running.

## Event buckets (UI mapping)

| Bucket | Typical signals | UI |
|--------|-----------------|-----|
| **Assistant text** | `stream_event` with `event.delta.type == "text_delta"` (and similar) | Timeline text / markdown |
| **Tool use** | Tool start / result events (shape varies by CLI version) | Collapsible “tool” cards |
| **System / retry** | `type: "system"`, `subtype: "api_retry"` | “Retrying…” banner |
| **Errors** | stderr lines, `error` fields, non-zero exit | Error row + status |
| **Usage / metadata** | Optional usage or summary lines | Footer when grounded in real fields |

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

Use this as a **filter hint**; the app keeps **full lines** for debugging and unknown types.

## Multi-turn (Dino behavior)

Official pattern is **separate CLI invocations**, not a long-lived REPL:

1. First message: `claude -p "…" --output-format stream-json --verbose --include-partial-messages`
2. Follow-ups: same with **`--continue`** (recent conversation) or **`--resume <session_id>`** when the UI has captured a session id (e.g. from `--output-format json` or stream metadata).

**Dino Rich v1:** after the first completed run in a Rich “conversation”, subsequent sends use **`--continue`** with the new prompt. If we later capture `session_id` from events, we can prefer `--resume`.

## Flags alignment with personas

Optional persona fields (see `personas.json` / Rust `Persona`):

- **`streamBare`** → `--bare` (faster, less context; document tradeoffs).
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
