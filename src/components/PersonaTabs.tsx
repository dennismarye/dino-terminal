import type { Persona } from "../lib/personas";

interface PersonaTabsProps {
  personas: Persona[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function PersonaTabs({ personas, activeId, onSelect }: PersonaTabsProps) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Sessions">
      <h2 className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-dim)]">
        Sessions
      </h2>
      {personas.map((p) => {
        const active = p.id === activeId;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              onSelect(p.id);
            }}
            className={`rounded-md px-3 py-2 text-left text-[13px] font-semibold transition-colors ${
              active
                ? "border-l-[3px] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                : "border-l-[3px] border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            }`}
            style={
              active
                ? { borderLeftColor: p.color }
                : { borderLeftColor: "transparent" }
            }
          >
            {p.name}
          </button>
        );
      })}
    </nav>
  );
}
