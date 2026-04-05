# Dino Terminal

## What this app is

**Dino Terminal** is a **native macOS desktop shell** for running **Claude Code** (Anthropic’s agentic CLI, installed via `npx` and the `@anthropic-ai/claude-code` package) inside a **real terminal (PTY)**—not a web chat mock-up. You get the same CLI behavior as in Terminal.app, in a dedicated window meant for daily use next to your repos.

### What you get in one window

| Area | Purpose |
|------|--------|
| **Terminal** | Full **xterm.js** session backed by a **pseudo-terminal** on your machine. Claude Code runs here with your normal shell environment (after `npx` resolution). |
| **Sessions (personas)** | Switch between **named profiles** (for example one profile per repo or role). Each profile has its own **working directory**, **CLI arguments** (extra `--add-dir` roots, flags), **file-tree roots**, and **task file**—so one app can represent different projects without retyping paths. |
| **Files** | Browse allowed directories (by default under **`$HOME`**) and **open files** in a **preview** pane (markdown and text). Useful for skimming specs or handovers next to the agent. |
| **Tasks** | Watches the **tasks JSON** (`taskFile`); shows up to **10** rows plus **`+N more`** if the list is longer. Statuses **`blocked`** and **`parked`** (exact strings) and common **in-progress / completed / pending** values get distinct markers (see **How to use** → Tasks panel). |
| **Status bar** | Periodically runs your **`~/.claude/status_line_command.sh`** and shows **context / rate-limit style** fields when the script output can be parsed (see limitations below). |

### What it is not

- It is **not** a general-purpose terminal replacement for every shell task; it is optimized around **Claude Code sessions** and the workflows above.
- It does **not** embed Anthropic’s servers or bypass the CLI: **network access, API keys, and subscription** follow **Claude Code’s** normal requirements.

### Stack (for contributors)

**Tauri v2** (Rust) + **React** + **Vite**, **xterm.js**, **`portable-pty`** on the host. Frontend talks to Rust over **Tauri IPC**; the file browser uses **`@tauri-apps/plugin-fs`** with an explicit **read-only scope** (see Configuration).

## Prerequisites

- **Node.js 22+** and npm
- **Rust** stable + Cargo ([rustup](https://rustup.rs/))
- **Xcode Command Line Tools** (macOS)

## Install from source

Clone the repo and enter the app directory:

```bash
git clone https://github.com/Dino-HQ/dino-terminal.git
cd dino-terminal
npm install
```

### Run in development

```bash
npm run tauri dev
```

This starts Vite on **port 1420** and opens the native window. If you see `Port 1420 is already in use`, stop the old process:

```bash
lsof -nP -iTCP:1420 -sTCP:LISTEN
kill <PID>
```

### Build a release app (macOS)

```bash
npm run tauri build
```

Installable artifacts (after `npm run tauri build`):

| Output | Typical location |
|--------|------------------|
| `.app` bundle | `src-tauri/target/release/bundle/macos/` |
| `.dmg` installer | `src-tauri/target/release/bundle/dmg/` |
| Updater `.app.tar.gz` + `.sig` | `src-tauri/target/release/bundle/macos/` (when signing env is set; see **Updates for maintainers**) |

Exact names depend on `productName` in `src-tauri/tauri.conf.json` and `bundle.targets`.

Open the `.app` from Finder, or run:

```bash
open "src-tauri/target/release/bundle/macos/Dino Terminal.app"
```

**Gatekeeper:** If macOS blocks an unsigned build, right-click the app → **Open** → confirm once.

### Updates (for maintainers)

The app uses **Tauri’s built-in updater** (signature-verified downloads over **HTTPS**). In the UI, users get **Check for updates…** in the command palette (**Cmd+Shift+P**) and an optional **bottom-right banner** after a background check.

**Signing (required for updater bundles and CI):**

1. Generate a keypair: `npm run tauri signer generate -- -w ~/.tauri/dino-terminal.key` (store the private key in a password manager or GitHub Actions **Secrets** only; never commit it).
2. Put the **public** key string into `src-tauri/tauri.conf.json` under `plugins.updater.pubkey` (must match the private key used to sign). The value is the full minisign public key text (as in the generated `.pub` file), not a filesystem path.
3. When building release artifacts, set **`TAURI_SIGNING_PRIVATE_KEY`** (inline PEM or path) and, if applicable, **`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`**. **`.env` is not read** for these variables—use the shell or CI secrets.
4. Keep **`version`** aligned across `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `package.json` when you cut a release.

**Endpoints:** `plugins.updater.endpoints` includes a stable GitHub URL for `latest.json` on each release. The release workflow (`.github/workflows/release.yml`) builds `latest.json` via `scripts/build-latest-json.sh` and uploads it next to the `.app.tar.gz` and `.sig` for the tagged release.

**Repository secrets for GitHub Actions:** `TAURI_SIGNING_PRIVATE_KEY` (and optional password secret) must match the **`pubkey`** committed in `tauri.conf.json`, or installs will fail signature verification.

**Notarization:** Apple notarization is separate from updater signing; Gatekeeper messaging on first open may still apply.

**CI troubleshooting:** If the Release workflow fails after bundling with `Invalid symbol 37` (or “failed to decode base64 secret key”), the **`TAURI_SIGNING_PRIVATE_KEY`** secret contains invalid characters—often a trailing **`%`** copied from a shell prompt. Update the secret to the raw key only, then re-run the workflow. Until a run completes successfully, **`/releases/latest/download/latest.json`** returns “Not Found” because no release assets are uploaded.

### Install the production app on your Mac (after `tauri build`)

1. **Build** (from `dino-terminal`): `npm install` once, then `npm run tauri build`. Wait until Cargo finishes; the frontend is built automatically via `beforeBuildCommand`.
2. **Pick an installer:**
   - **DMG (recommended):** Open `src-tauri/target/release/bundle/dmg/` and double-click the `.dmg`. Drag **Dino Terminal** into **Applications**.
   - **App bundle only:** Copy **`Dino Terminal.app`** from `src-tauri/target/release/bundle/macos/` into **Applications** (or run it in place with `open` as above).
3. **Launch** from Applications, Launchpad, or Spotlight (`Dino Terminal`).
4. **First launch / Gatekeeper:** If macOS says the app cannot be opened because it is from an unidentified developer, **right-click** the app → **Open** → **Open** again to allow it once (normal for local unsigned builds).
5. **Before the terminal is useful:** Install **Node.js 22+** and confirm `npx` works in Terminal.app (the release build runs **Claude Code** via `npx` with a full login-style environment).
6. **Configure:** Press **Cmd+,** to open **`~/.dino-terminal/personas.json`**. Set **`cwd`**, **`taskFile`**, and **`browseRoots`** to paths that exist on your machine, save, then return to the app (personas reload on a timer) or restart. Select a persona tab; use **Cmd+N** if you changed **`cwd`** after the session already started.

Then follow **How to use Dino Terminal** below for layout, tasks, and troubleshooting.

## How to use Dino Terminal

This section is the **operator’s guide**: how the window is laid out, what to do first, and how to interpret what you see when something is off.

### Window layout (three columns)

| Column | What it is |
|--------|------------|
| **Left (sidebar)** | **Files** (tree from the active persona’s `browseRoots`), **Sessions** (persona tabs), **Tasks** (from that persona’s `taskFile`). Drag the **horizontal bars** between sections to resize; sizes persist. Toggle the whole sidebar with **Cmd+B**. |
| **Center** | **Document preview** for a selected file (markdown renders; plain text and UTF-8; binary files show an error). **Cmd+W** closes the preview when a file is open. |
| **Right** | **Terminal** for the **active** persona only (other personas’ terminals stay mounted but hidden so state is preserved when you switch tabs). |

You pick a **persona** (tab) first; the file tree, tasks, and visible terminal all follow **that** profile’s config.

### First-time checklist

1. **Install prerequisites** (Node 22+, Rust for dev builds, Xcode CLT on macOS).
2. Run **`npm run tauri dev`** or open the built **`.app`**.
3. If you see **`npx not found — install Node.js 22+`**: install Node (e.g. Homebrew), confirm `npx` works in Terminal, then **wait ~45s**, **switch to another app and back**, or restart Dino Terminal—the app **re-checks** `npx` on a timer and when the window becomes visible.
4. Open **Cmd+,** and edit **`~/.dino-terminal/personas.json`** so **`cwd`**, **`taskFile`**, and **`browseRoots`** point at **real paths on your machine** (you can use **`$HOME`** tokens; see Configuration).
5. **Save** `personas.json`. The app **reloads personas** on a poll (~12s) and when you return to the window; or restart for an immediate pick-up.
6. Select a persona tab. The terminal should start **Claude Code** (or your `npx` command) in **`cwd`**.

### Daily workflow

1. **Cmd+1** / **Cmd+2** jump to the **first** / **second** persona in JSON **array order** when you have multiple entries (add more objects to `personas.json`); reorder the array to change which key selects which tab.
2. Use the **file tree** to open specs or notes; they appear in the **center** preview.
3. Interact with **Claude Code** in the **right-hand terminal** like any other terminal.
4. **Cmd+N** starts a **fresh PTY** for the **currently selected** persona only (same tab, new session). Use this after you change `cwd` / CLI args in `personas.json`, or if the session feels stuck.
5. Watch **Tasks** for a coarse view of items in the persona’s task JSON (see next subsection).

### Tasks panel (how it works)

- **Source:** The path in **`taskFile`** for the active persona (must be **absolute** and under **`$HOME`** for the backend reader). Typical: **`.claude/tasks.json`** in a repo.
- **Format:** Either a **JSON array** of task objects, or an object with a **`tasks`** array (same shape Claude Code often uses).
- **Refresh:** The file is re-read about every **5 seconds**.
- **List limit:** The sidebar shows at most **10** tasks. If there are more, a line **`+N more`** appears under the list (`N` = remaining count).
- **Statuses in the UI** (from each task’s `status` string, case-insensitive):

| If `status` is (examples) | Shown as |
|---------------------------|----------|
| `blocked` (exact) | Blocked (red marker) |
| `parked` (exact) | Parked (blue marker) |
| `in_progress`, `in-progress`, contains `progress`, or `active` | In progress (yellow) |
| `completed`, `done`, or contains `complete` | Completed (struck through) |
| `pending`, `todo`, `open`, or contains `pending` | Pending (neutral) |
| Anything else | Unknown (neutral) |

**Title** for each row is taken from the first non-empty field among: `title`, `content`, `description`, `name`, `label`.

### Working directory (`cwd`) errors

Before starting a session, the app checks that **`cwd` exists and is a directory**. If not, **spawn fails** and the **terminal pane** prints a **red error line** from the backend, for example:

- `working directory does not exist or is not accessible (<path>): <reason>`
- `working directory is not a directory: <path>`

**Fix:** Correct **`cwd`** in `personas.json` (expand `$HOME` mentally: it must resolve to a real folder), save, wait for reload or restart, then **Cmd+N** on that tab.

### Figuring out problems (quick diagnostics)

| Symptom | What to check |
|---------|----------------|
| Red **npx not found** overlay | Node 22+ installed; `which npx` in Terminal; wait for auto re-check or refocus the window. |
| Terminal: **`env: node: No such file or directory`** | The `npx` shim runs `node` via `PATH`. **Rebuild** to current sources (the app injects a PTY `PATH` that includes the folder where `npx` lives), or ensure Node is on a standard prefix (`/opt/homebrew/bin`, `/usr/local/bin`). Then **Cmd+N**. |
| Terminal shows **cwd** error (above) | `personas.json` → **`cwd`** path exists and is a folder. |
| Terminal shows other **spawn / IPC** errors | Read the red text; often bad `cmdArgs` / `args` or network/auth for Claude Code. |
| **Files** empty or “unreadable” | `browseRoots` paths exist; for hidden dirs, scope must allow dot segments (default `$HOME` patterns do). Paths **outside** `$HOME` need an extra `fs:scope` entry and rebuild. |
| **Tasks** always “No tasks” | **`taskFile`** absolute, under home, file exists; JSON valid; wait ~5s. |
| **Preview** “Cannot preview” / binary | File is not UTF-8 text (or has null bytes in the sample). Use **Copy path** / **Reveal** in the preview header when a file is open (**Reveal** uses Finder on macOS; path must be under `$HOME`). |
| **Status bar** all dashes | `~/.claude/status_line_command.sh` missing, failing, or only meaningful when Claude pipes JSON on stdin (see Status bar). |
| **Personas** didn’t update after edit | Wait ~12s or switch away and back; or restart. Then **Cmd+N** if `cwd` changed. |
| **Stale terminal** after rare IPC glitch | **Cmd+N** or quit the app (closing the window kills PTYs). |

## Configuration

### Personas (`~/.dino-terminal/personas.json`)

On first launch the app creates `~/.dino-terminal/` and seeds **`personas.json`** from the bundled template (with `$HOME/...` paths).

- Edit **`cwd`**, **`taskFile`**, and **`browseRoots`** to match your machine. **`cwd` must be an existing directory** on disk; otherwise the terminal shows a clear error instead of starting the session (see **How to use** → Working directory errors).
- You may use **`$HOME`** or **`${HOME}`** in path strings; they are expanded when the app loads.
- The **bundled template** ([`personas.json`](personas.json) in this repo) uses **`$HOME`** as `cwd` and a single **Home** browse root so it is safe to share; customize it for your projects (extra personas, `--add-dir`, different `taskFile`, etc.).

Open the config from the app: **Cmd+,** (comma).

### Privacy and open source

- This repo does **not** contain secrets; do not commit API keys or private paths you care about—use **`~/.dino-terminal/personas.json`** locally (see [SECURITY.md](SECURITY.md)).
- The app reads files only within the **Tauri FS scope** (by default under `$HOME`); see **Security & trust** below.

### File tree & document preview

The app may read directories and files **under your home directory** (`$HOME`), including hidden segments like `.claude` (via scoped globs). That powers:

- **Files** sidebar (`readDir`)
- **Preview** pane (`readFile` / markdown)

If you need roots **outside** `$HOME` (e.g. `/Volumes/Projects/...`), add another `allow` entry in `src-tauri/capabilities/default.json` and rebuild:

```json
{ "path": "/Volumes/Projects/**" }
```

### Security & trust

- The webview can use **read-only** filesystem APIs (`readDir`, `readFile`, …) for paths allowed by **`src-tauri/capabilities/default.json`**. Today that scope is broadly **`$HOME`** (plus dot-path patterns). Treat this app as **trusted local software**: anything that could run arbitrary script in the webview could read files under your home directory.
- Do **not** point the webview at untrusted remote URLs or inject untrusted HTML/JS.
- The **`read_task_file`** command used for the task panel is **extra constrained** in Rust: path must be **absolute** and under **`$HOME`** (`src-tauri/src/commands.rs`).
- If delivering PTY output to the UI fails (rare IPC error), the reader thread stops and the in-memory session may be stale until you **Cmd+N** restart that tab or close the window.

### Keyboard shortcuts (built-in)

| Shortcut | Action |
|----------|--------|
| **Cmd+Shift+P** | **Command palette** (toggle). Not opened while focus is inside the terminal, so `P` still types there. |
| **?** | **Keyboard shortcuts** help (when not typing in an input). |
| **Cmd+1** / **Cmd+2** | Switch to the **first** / **second** persona in the **order they appear** in `personas.json` (after load). Reorder the array to change which tab each key selects. |
| **Cmd+N** | **Restart the PTY** for the **currently active** persona (new session in that tab). |
| **Cmd+B** | Toggle sidebar. |
| **Cmd+W** | Close file preview when a file is open; otherwise closes the PTY session. |
| **Cmd+,** | Open `~/.dino-terminal/personas.json` via the system opener. |
| **Cmd+F** | **Find** in terminal (when the terminal is focused). **Cmd+click** an **http(s)** link in the terminal to open it in your default browser. |
| **Cmd+=** / **Cmd+-** / **Cmd+0** | **Larger** / **smaller** / **reset** terminal font size. |

Personas are **re-polled** periodically while the app runs. If you change `cwd` or roots for an active session, use **Cmd+N** on that tab so the terminal matches the updated config.

### Terminal (`npx` / Claude Code)

- **Renderer:** The embedded terminal uses the **canvas** renderer by default to avoid long-session **glyph glitches** sometimes seen with the WebGL addon in desktop webviews. To opt into WebGL (experimental), set `localStorage` key **`dino-terminal-terminal-webgl`** to **`1`** before starting a session, or build with **`VITE_TERMINAL_WEBGL=true`**.
- The native app uses a **minimal PATH** from the GUI shell; resolution prefers Homebrew paths and your **login shell** so `npx` matches Terminal.app.
- Each PTY session gets an explicit **`PATH`** that **starts with the directory containing the resolved `npx`** (and common Node prefixes), so the `npx` script’s `#!/usr/bin/env node` can find **`node`**—without this, macOS builds often showed `env: node: No such file or directory` even when `npx` was found.
- **`npx` availability is re-checked** on a timer and when the window becomes visible, so installing Node while the app is open can clear the “npx not found” overlay without a full restart.
- Install **Node 22+** (e.g. Homebrew) and ensure `npx` works in a **new** Terminal window before relying on the embedded PTY.

### Status bar

Polls `~/.claude/status_line_command.sh` every 5s. Claude’s default script expects **session JSON on stdin**; the poller does not supply that, so **Ctx / 5h / 7d** may stay empty unless your script reads metrics another way or prints parseable JSON / plain gauges. See `src-tauri/src/status.rs` for supported formats.

## Verify locally

```bash
npm run verify
```

Runs TypeScript build, frontend tests, and Rust tests.

## Commands (reference)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite only (web UI; limited without Tauri) |
| `npm run build` | `tsc` + production Vite bundle |
| `npm test` | Vitest |
| `npm run verify` | `build` + `test` + `cargo test` (sanity check) |
| `npm run tauri dev` | Full desktop app, hot reload |
| `npm run tauri build` | Release `.app` / installers |

## Smoke behavior

- **Development:** first PTY spawn per tab runs `npx … --version`, then starts the full CLI after exit.
- **Release:** starts the full CLI session directly.
