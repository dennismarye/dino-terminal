# Security

This repository is intended to be safe to publish: **no API keys, tokens, or credentials** belong in source control.

- **Local configuration** lives at `~/.dino-terminal/personas.json` (created on first launch from the bundled template). Keep machine-specific paths and any sensitive workflow details there, not in a fork you publish.
- **Claude Code** authentication and network access are handled by Anthropic’s CLI on the user’s machine, not embedded in this app.
- **In-app updates** use Tauri’s updater with **minisign** signatures; the app only installs payloads that verify against the **public key** baked into `src-tauri/tauri.conf.json`. Update metadata and bundles must be served over **HTTPS** (see `plugins.updater.endpoints`). The private signing key must never be committed.

## Reporting issues

Please report security vulnerabilities through [GitHub Security Advisories](https://github.com/Dino-HQ/dino-terminal/security/advisories/new) for this repository (private report), rather than in a public issue.
