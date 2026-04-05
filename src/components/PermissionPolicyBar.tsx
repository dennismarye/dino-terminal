import type { Persona } from "../lib/personas";

interface PermissionPolicyBarProps {
  readonly persona: Persona;
}

/**
 * Read-only summary of Rich-mode permission flags (persona JSON).
 * Does not replace interactive approval in Classic.
 */
export function PermissionPolicyBar({ persona }: Readonly<PermissionPolicyBarProps>) {
  const mode = persona.permissionMode;
  const tools = persona.allowedTools;
  if (!mode && !tools) {
    return null;
  }
  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2"
      data-permission-policy-bar
    >
      <span className="rounded-md border border-[var(--accent-green)]/40 bg-[var(--accent-green)]/10 px-2 py-1 text-[11px] text-[var(--accent-green)]">
        Policy
      </span>
      {mode ? (
        <span className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-dim)]">
          mode={mode}
        </span>
      ) : (
        <span className="text-[10px] text-[var(--text-dim)]">default mode</span>
      )}
      {tools ? (
        <span className="max-w-full truncate rounded border border-[var(--border)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
          allowedTools={tools}
        </span>
      ) : null}
    </div>
  );
}
