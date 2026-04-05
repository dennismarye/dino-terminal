import { invoke } from "@tauri-apps/api/core";
import type { Persona } from "./personas";

export interface NpxStatus {
  ok: boolean;
  path: string | null;
}

/** Matches Rust StatusUpdate JSON (serde camelCase). */
export interface StatusLine {
  contextPct?: number | null;
  rate5hPct?: number | null;
  rate7dPct?: number | null;
  model?: string | null;
  branch?: string | null;
}

export async function getNpxStatus(): Promise<NpxStatus> {
  return invoke<NpxStatus>("get_npx_status");
}

export interface SpawnClaudeStreamParams {
  cwd: string;
  cmd: string;
  cmdArgs: string[];
  args: string[];
  prompt: string;
  useContinue: boolean;
  resumeSessionId: string | null;
  streamBare: boolean;
  streamExtraArgs: string[];
  permissionMode: string | null;
  allowedTools: string | null;
}

export async function spawnClaudeStreamSession(
  params: SpawnClaudeStreamParams,
): Promise<string> {
  return invoke<string>("spawn_claude_stream_session", {
    cwd: params.cwd,
    cmd: params.cmd,
    cmdArgs: params.cmdArgs,
    args: params.args,
    prompt: params.prompt,
    useContinue: params.useContinue,
    resumeSessionId: params.resumeSessionId,
    streamBare: params.streamBare,
    streamExtraArgs: params.streamExtraArgs,
    permissionMode: params.permissionMode,
    allowedTools: params.allowedTools,
  });
}

/** Tauri v2 IPC: argument keys are camelCase (Rust `cmd_args` → `cmdArgs`). */
export async function spawnSession(persona: Persona): Promise<string> {
  return invoke<string>("spawn_session", {
    cwd: persona.cwd,
    cmd: persona.cmd,
    cmdArgs: persona.cmdArgs,
    args: persona.args,
  });
}

export async function spawnClaudeVersionSmoke(persona: Persona): Promise<string> {
  return invoke<string>("spawn_session", {
    cwd: persona.cwd,
    cmd: persona.cmd,
    cmdArgs: [...persona.cmdArgs, "--version"],
    args: [],
  });
}

export async function writeToPty(sessionId: string, data: Uint8Array): Promise<void> {
  await invoke("write_to_pty", {
    sessionId,
    data: Array.from(data),
  });
}

export async function resizePty(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  await invoke("resize_pty", {
    sessionId,
    cols,
    rows,
  });
}

export async function killSession(sessionId: string): Promise<void> {
  await invoke("kill_session", { sessionId });
}

export async function getPersonas(): Promise<Persona[]> {
  return invoke<Persona[]>("get_personas");
}

export async function readTaskFile(path: string): Promise<string | null> {
  return invoke<string | null>("read_task_file", { path });
}

export async function getStatusLine(): Promise<StatusLine | null> {
  return invoke<StatusLine | null>("get_status_line");
}

export async function getPersonasConfigPath(): Promise<string> {
  return invoke<string>("get_personas_config_path");
}

export async function revealInFinder(path: string): Promise<void> {
  await invoke("reveal_in_finder", { path });
}
