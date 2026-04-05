#!/usr/bin/env bash
# Build a static updater manifest (latest.json) for one macOS arch after `npm run tauri build`.
# Requires: GITHUB_REF_NAME (e.g. v0.2.0), GITHUB_REPOSITORY (owner/repo), jq, node.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${GITHUB_REF_NAME:?GITHUB_REF_NAME must be set (e.g. v0.2.0)}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY must be set (owner/repo)}"

VER="$(node -e "console.log(JSON.parse(require('node:fs').readFileSync('src-tauri/tauri.conf.json','utf8')).version)")"

MACOS_DIR="src-tauri/target/release/bundle/macos"
TGZ="$(ls "$MACOS_DIR"/*.app.tar.gz 2>/dev/null | head -1 || true)"
if [[ -z "$TGZ" || ! -f "$TGZ" ]]; then
  echo "No updater bundle at $MACOS_DIR/*.app.tar.gz — run a release tauri build first." >&2
  exit 1
fi

SIG="${TGZ}.sig"
if [[ ! -f "$SIG" ]]; then
  echo "Missing signature file: $SIG" >&2
  exit 1
fi

UNAME="$(uname -m)"
if [[ "$UNAME" == "arm64" ]]; then
  PLAT="darwin-aarch64"
else
  PLAT="darwin-x86_64"
fi

NAME="$(basename "$TGZ")"
BASE="https://github.com/${GITHUB_REPOSITORY}/releases/download/${GITHUB_REF_NAME}"
URL="${BASE}/${NAME}"

# shellcheck disable=SC2002
SIG_CONTENT="$(cat "$SIG")"

jq -n \
  --arg ver "$VER" \
  --arg url "$URL" \
  --arg sig "$SIG_CONTENT" \
  --arg plat "$PLAT" \
  '{version: $ver, platforms: {($plat): {url: $url, signature: $sig}}}' \
  > latest.json

echo "Wrote latest.json for $PLAT version $VER"
