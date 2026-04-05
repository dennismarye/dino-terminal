interface SpawnErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
}

export function SpawnErrorBanner({ message, onDismiss }: SpawnErrorBannerProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--accent-red)] bg-[var(--bg-secondary)] px-3 py-2"
    >
      <p className="min-w-0 flex-1 text-[12px] text-[var(--accent-red)]">
        {message}
      </p>
      <button
        type="button"
        className="shrink-0 rounded px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  );
}
