export function TitleBar() {
  return (
    <header
      className="flex h-[38px] shrink-0 items-center justify-center border-b border-[var(--border)] bg-[var(--bg-secondary)]"
      data-tauri-drag-region
    >
      <span className="text-[12px] text-[var(--text-dim)]">Dino Terminal</span>
    </header>
  );
}
