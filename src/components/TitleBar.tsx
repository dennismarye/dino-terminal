export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      className="titlebar flex h-11 shrink-0 w-full cursor-default select-none items-center justify-center border-b border-[var(--border)] bg-[var(--bg-secondary)] px-3"
      role="banner"
    >
      <span className="pointer-events-none text-[12px] text-[var(--text-dim)]">
        Dino Terminal
      </span>
    </div>
  );
}
