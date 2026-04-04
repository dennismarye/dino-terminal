import { useEffect, useState } from "react";
import { readTaskFile } from "../lib/tauri-bridge";

const DISPLAY_CAP = 10;

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "parked"
  | "blocked"
  | "unknown";

export interface TaskRow {
  id: string;
  label: string;
  status: TaskStatus;
}

export interface ParsedTasks {
  rows: TaskRow[];
  moreCount: number;
}

function normalizeStatus(s: string): TaskStatus {
  const x = s.toLowerCase().trim();
  // Exact names first so we do not treat e.g. "unblocked" as blocked.
  if (x === "blocked") {
    return "blocked";
  }
  if (x === "parked") {
    return "parked";
  }
  if (x.includes("progress") || x === "active" || x === "in_progress") {
    return "in_progress";
  }
  if (x.includes("complete") || x === "done") {
    return "completed";
  }
  if (x.includes("pending") || x === "todo" || x === "open") {
    return "pending";
  }
  return "unknown";
}

function extractList(j: unknown): unknown[] {
  if (Array.isArray(j)) {
    return j;
  }
  if (typeof j === "object" && j !== null && "tasks" in j) {
    const t = (j as { tasks: unknown }).tasks;
    if (Array.isArray(t)) {
      return t;
    }
  }
  return [];
}

function labelOf(o: Record<string, unknown>): string {
  for (const k of ["title", "content", "description", "name", "label"]) {
    const v = o[k];
    if (typeof v === "string" && v.length > 0) {
      return v;
    }
  }
  return "Task";
}

export function parseTasksFile(json: unknown): ParsedTasks {
  const full = extractList(json);
  const moreCount = Math.max(0, full.length - DISPLAY_CAP);
  const list = full.slice(0, DISPLAY_CAP);
  const rows: TaskRow[] = [];
  let i = 0;
  for (const item of list) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const o = item as Record<string, unknown>;
    const st =
      typeof o.status === "string" ? normalizeStatus(o.status) : "unknown";
    const rawId = o.id;
    const idStr =
      typeof rawId === "string" || typeof rawId === "number"
        ? String(rawId)
        : String(i);
    rows.push({
      id: idStr,
      label: labelOf(o),
      status: st,
    });
    i += 1;
  }
  return { rows, moreCount };
}

export interface UseTasksResult {
  tasks: TaskRow[];
  moreCount: number;
}

export function useTasks(taskFile: string | undefined): UseTasksResult {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [moreCount, setMoreCount] = useState(0);

  useEffect(() => {
    if (!taskFile) {
      setTasks([]);
      setMoreCount(0);
      return;
    }
    const tick = () => {
      void readTaskFile(taskFile).then((raw) => {
        if (!raw) {
          setTasks([]);
          setMoreCount(0);
          return;
        }
        try {
          const j = JSON.parse(raw) as unknown;
          const { rows, moreCount: more } = parseTasksFile(j);
          setTasks(rows);
          setMoreCount(more);
        } catch {
          setTasks([]);
          setMoreCount(0);
        }
      });
    };
    tick();
    const id = globalThis.setInterval(tick, 5000);
    return () => globalThis.clearInterval(id);
  }, [taskFile]);

  return { tasks, moreCount };
}
