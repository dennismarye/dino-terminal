export interface BrowseRoot {
  label: string;
  path: string;
}

export interface Persona {
  id: string;
  name: string;
  cwd: string;
  cmd: string;
  cmdArgs: string[];
  args: string[];
  taskFile: string;
  color: string;
  browseRoots?: BrowseRoot[];
  /** Appended to `claude -p` in Rich (stream-json) mode. */
  streamExtraArgs?: string[];
  streamBare?: boolean;
  /** Rich mode: pass `--verbose` to Claude (raw protocol noise; default off). */
  streamVerbose?: boolean;
  permissionMode?: string;
  allowedTools?: string;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function parseBrowseRoots(raw: unknown): BrowseRoot[] | null {
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw)) {
    return null;
  }
  const out: BrowseRoot[] = [];
  for (const row of raw) {
    if (typeof row !== "object" || row === null) {
      return null;
    }
    const o = row as Record<string, unknown>;
    if (!isNonEmptyString(o.label) || !isNonEmptyString(o.path)) {
      return null;
    }
    out.push({ label: o.label, path: o.path });
  }
  return out;
}

/** Validate parsed JSON; returns null if invalid (mirrors Rust bundled fallback intent for tests). */
export function parsePersonasJson(raw: unknown): Persona[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const out: Persona[] = [];
  for (const row of raw) {
    if (typeof row !== "object" || row === null) {
      return null;
    }
    const o = row as Record<string, unknown>;
    const cmdArgs = o.cmdArgs;
    const args = o.args;
    if (
      !isNonEmptyString(o.id) ||
      !isNonEmptyString(o.name) ||
      !isNonEmptyString(o.cwd) ||
      !isNonEmptyString(o.cmd) ||
      !isNonEmptyString(o.taskFile) ||
      !isNonEmptyString(o.color) ||
      !Array.isArray(cmdArgs) ||
      !Array.isArray(args) ||
      !cmdArgs.every((x) => typeof x === "string") ||
      !args.every((x) => typeof x === "string")
    ) {
      return null;
    }
    const roots = parseBrowseRoots(o.browseRoots);
    if (roots === null) {
      return null;
    }
    const sea = o.streamExtraArgs;
    if (sea !== undefined && (!Array.isArray(sea) || !sea.every((x) => typeof x === "string"))) {
      return null;
    }
    const p: Persona = {
      id: o.id,
      name: o.name,
      cwd: o.cwd,
      cmd: o.cmd,
      cmdArgs: cmdArgs as string[],
      args: args as string[],
      taskFile: o.taskFile,
      color: o.color,
    };
    if (roots.length > 0) {
      p.browseRoots = roots;
    }
    if (Array.isArray(sea) && sea.length > 0) {
      p.streamExtraArgs = sea as string[];
    }
    if (o.streamBare === true) {
      p.streamBare = true;
    }
    if (o.streamVerbose === true) {
      p.streamVerbose = true;
    }
    if (isNonEmptyString(o.permissionMode)) {
      p.permissionMode = o.permissionMode;
    }
    if (isNonEmptyString(o.allowedTools)) {
      p.allowedTools = o.allowedTools;
    }
    out.push(p);
  }
  return out;
}
