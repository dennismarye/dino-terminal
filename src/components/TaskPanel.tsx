import type { TaskRow, TaskStatus } from "../hooks/useTasks";

function dotForStatus(s: TaskStatus): string {
  switch (s) {
    case "in_progress":
      return "◐";
    case "completed":
      return "●";
    case "blocked":
      return "✕";
    case "parked":
      return "◔";
    default:
      return "○";
  }
}

function colorForStatus(s: TaskStatus): string {
  switch (s) {
    case "in_progress":
      return "var(--accent-yellow)";
    case "completed":
      return "var(--accent-green)";
    case "blocked":
      return "var(--accent-red)";
    case "parked":
      return "var(--accent-blue)";
    default:
      return "var(--text-dim)";
  }
}

interface TaskPanelProps {
  tasks: TaskRow[];
  moreCount: number;
}

export function TaskPanel({ tasks, moreCount }: TaskPanelProps) {
  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col">
      <div className="my-3 h-px bg-[var(--border)]" />
      <h2 className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-dim)]">
        Tasks
      </h2>
      <ul className="max-h-[280px] list-none space-y-2 overflow-y-auto p-0 text-[12px]">
        {tasks.length === 0 ? (
          <li className="text-[var(--text-dim)]">No tasks</li>
        ) : (
          tasks.map((t) => (
            <li
              key={t.id}
              className={`flex items-start gap-2 leading-snug ${
                t.status === "completed"
                  ? "text-[var(--text-secondary)] opacity-50 line-through"
                  : "text-[var(--text-primary)]"
              }`}
            >
              <span
                className="shrink-0 font-mono text-[14px]"
                style={{ color: colorForStatus(t.status) }}
                aria-hidden
              >
                {dotForStatus(t.status)}
              </span>
              <span>{t.label}</span>
            </li>
          ))
        )}
        {moreCount > 0 ? (
          <li className="text-[var(--text-dim)]">+{moreCount} more</li>
        ) : null}
      </ul>
    </div>
  );
}
