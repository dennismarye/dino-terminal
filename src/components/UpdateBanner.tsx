interface UpdateBannerProps {
  visible: boolean;
  version: string | null;
  downloading: boolean;
  onUpdate: () => void;
  onLater: () => void;
  onDismiss: () => void;
}

/**
 * Lower-right update prompt; sits above the status bar (h-8), below the command palette (z-200).
 */
export function UpdateBanner({
  visible,
  version,
  downloading,
  onUpdate,
  onLater,
  onDismiss,
}: UpdateBannerProps) {
  if (!visible || !version) {
    return null;
  }

  return (
    <div
      role="status"
      className="fixed right-4 z-[100] max-w-[min(360px,calc(100vw-2rem))] rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 shadow-lg"
      style={{ bottom: "calc(2rem + 12px)" }}
    >
      <p className="mb-2 text-[12px] text-[var(--text-primary)]">
        Update available: <span className="font-semibold">v{version}</span>
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled={downloading}
          className="rounded bg-[var(--accent-blue)] px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50 focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]"
          onClick={() => {
            onUpdate();
          }}
        >
          {downloading ? "Updating…" : "Update"}
        </button>
        <button
          type="button"
          disabled={downloading}
          className="rounded px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)] disabled:opacity-50"
          onClick={() => {
            onLater();
          }}
        >
          Later
        </button>
        <button
          type="button"
          disabled={downloading}
          className="rounded px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)] disabled:opacity-50"
          onClick={() => {
            onDismiss();
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
