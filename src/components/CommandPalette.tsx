import { useEffect, useMemo, useRef, useState } from "react";

export interface PaletteCommand {
  id: string;
  label: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
}

export function CommandPalette({
  open,
  onClose,
  commands,
}: CommandPaletteProps) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) {
      return commands;
    }
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(s) || c.id.toLowerCase().includes(s),
    );
  }, [commands, q]);

  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    if (open) {
      setQ("");
      setHighlight(0);
      queueMicrotask(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [q]);

  useEffect(() => {
    setHighlight((h) => {
      if (filtered.length === 0) {
        return 0;
      }
      return Math.min(h, filtered.length - 1);
    });
  }, [filtered]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const runIndex = (i: number) => {
    const c = filtered[i];
    if (c) {
      c.run();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-transparent"
        aria-label="Close palette"
        onClick={onClose}
      />
      <div className="relative z-[201] w-[min(480px,90vw)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] shadow-lg">
        <div className="border-b border-[var(--border)] px-3 py-2">
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                if (filtered.length === 0) {
                  return;
                }
                setHighlight((h) => Math.min(filtered.length - 1, h + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                if (filtered.length === 0) {
                  return;
                }
                setHighlight((h) => Math.max(0, h - 1));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                runIndex(highlight);
              }
            }}
            placeholder="Type a command…"
            className="w-full border-0 bg-transparent text-[14px] text-[var(--text-primary)] outline-none"
          />
        </div>
        <ul className="max-h-[min(320px,50vh)] list-none overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-[var(--text-dim)]">
              No matches
            </li>
          ) : (
            filtered.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`w-full rounded px-3 py-2 text-left text-[13px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)] ${
                    i === highlight
                      ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                  onMouseEnter={() => {
                    setHighlight(i);
                  }}
                  onClick={() => {
                    runIndex(i);
                  }}
                >
                  {c.label}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
