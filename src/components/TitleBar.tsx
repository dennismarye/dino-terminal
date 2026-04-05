import type { CSSProperties } from "react";

const dragStyle = { WebkitAppRegion: "drag" } as CSSProperties;

export function TitleBar() {
  return (
    <header
      className="flex h-11 shrink-0 items-center justify-center border-b border-[var(--border)] bg-[var(--bg-secondary)] pl-[72px] pr-3"
      data-tauri-drag-region
      style={dragStyle}
    >
      <span className="pointer-events-none text-[12px] text-[var(--text-dim)]">
        Dino Terminal
      </span>
    </header>
  );
}
