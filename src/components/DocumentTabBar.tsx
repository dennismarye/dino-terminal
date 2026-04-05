import { useCallback, type MouseEvent } from "react";

function basename(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.length > 0 ? (parts.at(-1) ?? path) : path;
}

interface DocumentTabBarProps {
  readonly tabs: string[];
  readonly activePath: string | null;
  readonly onSelect: (path: string) => void;
  readonly onClose: (path: string) => void;
  readonly onCloseOthers: (path: string) => void;
}

export function DocumentTabBar({
  tabs,
  activePath,
  onSelect,
  onClose,
  onCloseOthers,
}: Readonly<DocumentTabBarProps>) {
  const onContextMenu = useCallback(
    (e: MouseEvent, path: string) => {
      e.preventDefault();
      const choice = globalThis.confirm(
        "Close all other document tabs?",
      );
      if (choice) {
        onCloseOthers(path);
      }
    },
    [onCloseOthers],
  );

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      role="tablist"
      aria-label="Open documents"
      className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-[var(--border)] bg-[var(--bg-secondary)] px-1 py-0.5"
    >
      {tabs.map((path) => {
        const active = path === activePath;
        return (
          <div
            key={path}
            onContextMenu={(e) => {
              onContextMenu(e, path);
            }}
            className={`flex max-w-[200px] shrink-0 items-center gap-0.5 rounded-t border border-b-0 px-1 py-0.5 text-[11px] ${
              active
                ? "border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
                : "border-transparent bg-transparent text-[var(--text-dim)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className="min-w-0 max-w-[160px] flex-1 truncate rounded px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]"
              onClick={() => {
                onSelect(path);
              }}
              title={path}
            >
              {basename(path)}
            </button>
            <button
              type="button"
              className="shrink-0 rounded px-0.5 text-[12px] leading-none text-[var(--text-dim)] hover:text-[var(--text-primary)] focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]"
              aria-label={`Close ${basename(path)}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(path);
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
