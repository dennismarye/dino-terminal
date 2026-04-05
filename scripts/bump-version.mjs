#!/usr/bin/env node
/**
 * Bump semver in package.json, src-tauri/Cargo.toml ([package] version), and
 * src-tauri/tauri.conf.json. Usage: node scripts/bump-version.mjs patch|minor|major [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const bumpKind = args.find((a) => !a.startsWith("-"));

const KINDS = new Set(["patch", "minor", "major"]);

/**
 * @param {string} raw
 * @returns {{ major: number; minor: number; patch: number }}
 */
function parseSemver(raw) {
  const trimmed = raw.trim();
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(trimmed);
  if (!m) {
    throw new Error(
      `Expected plain semver X.Y.Z (no prerelease), got: ${JSON.stringify(raw)}`,
    );
  }
  return {
    major: Number.parseInt(m[1], 10),
    minor: Number.parseInt(m[2], 10),
    patch: Number.parseInt(m[3], 10),
  };
}

/**
 * @param {{ major: number; minor: number; patch: number }} v
 * @param {"patch" | "minor" | "major"} kind
 */
function nextVersion(v, kind) {
  if (kind === "major") {
    return { major: v.major + 1, minor: 0, patch: 0 };
  }
  if (kind === "minor") {
    return { major: v.major, minor: v.minor + 1, patch: 0 };
  }
  return { major: v.major, minor: v.minor, patch: v.patch + 1 };
}

function formatVersion(v) {
  return `${v.major}.${v.minor}.${v.patch}`;
}

/**
 * @param {string} filePath
 * @param {string} next
 */
/**
 * @param {string} filePath
 * @returns {string}
 */
function readCargoPackageVersion(filePath) {
  const block = fs.readFileSync(filePath, "utf8");
  const lines = block.split("\n");
  let inPackage = false;
  for (const line of lines) {
    if (line.trim() === "[package]") {
      inPackage = true;
      continue;
    }
    if (
      inPackage &&
      /^\[/.test(line.trim()) &&
      line.trim() !== "[package]"
    ) {
      inPackage = false;
    }
    if (inPackage) {
      const vm = /^version\s*=\s*"([^"]+)"\s*$/.exec(line);
      if (vm) {
        return vm[1];
      }
    }
  }
  throw new Error(`Could not read [package] version in ${filePath}`);
}

function updateCargoPackageVersion(filePath, next) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split("\n");
  let inPackage = false;
  let replaced = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "[package]") {
      inPackage = true;
      continue;
    }
    if (inPackage && /^\[/.test(line.trim()) && line.trim() !== "[package]") {
      inPackage = false;
    }
    if (inPackage && /^version\s*=\s*"[^"]+"\s*$/.test(line)) {
      lines[i] = `version = "${next}"`;
      replaced = true;
      break;
    }
  }
  if (!replaced) {
    throw new Error(`Could not find [package] version in ${filePath}`);
  }
  return lines.join("\n");
}

function main() {
  if (!bumpKind || !KINDS.has(bumpKind)) {
    console.error(
      "Usage: node scripts/bump-version.mjs patch|minor|major [--dry-run]",
    );
    process.exit(1);
  }

  const pkgPath = path.join(root, "package.json");
  const cargoPath = path.join(root, "src-tauri", "Cargo.toml");
  const tauriConfPath = path.join(root, "src-tauri", "tauri.conf.json");

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const current = parseSemver(pkg.version);
  const nv = nextVersion(current, bumpKind);
  const next = formatVersion(nv);

  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
  const cargoVer = parseSemver(readCargoPackageVersion(cargoPath));
  const tauriVer = parseSemver(tauriConf.version);

  if (
    formatVersion(current) !== formatVersion(cargoVer) ||
    formatVersion(current) !== formatVersion(tauriVer)
  ) {
    throw new Error(
      `Version mismatch: package.json ${formatVersion(current)}, Cargo.toml ${formatVersion(cargoVer)}, tauri.conf.json ${formatVersion(tauriVer)} — align manually, then re-run.`,
    );
  }

  if (dryRun) {
    console.log(
      `[dry-run] Would bump ${formatVersion(current)} -> ${next} (${bumpKind})`,
    );
    return;
  }

  pkg.version = next;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

  const cargoOut = updateCargoPackageVersion(cargoPath, next);
  fs.writeFileSync(cargoPath, cargoOut, "utf8");

  tauriConf.version = next;
  fs.writeFileSync(
    tauriConfPath,
    `${JSON.stringify(tauriConf, null, 2)}\n`,
    "utf8",
  );

  console.log(`Bumped ${formatVersion(current)} -> ${next} (${bumpKind})`);
}

main();
