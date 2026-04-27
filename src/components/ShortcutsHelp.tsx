interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

const ROWS: [string, string][] = [
  [
    "Cmd+Shift+P",
    "Command palette (not from inside terminal) — includes font preset + comfort theme",
  ],
  ["Cmd+B", "Toggle sidebar"],
  ["↑ / ↓", "Move focus in Files tree (when that panel is focused)"],
  ["Cmd+,", "Open personas.json"],
  ["Cmd+N", "Restart terminal (active persona)"],
  ["Cmd+1 / Cmd+2", "Switch to 1st / 2nd persona"],
  [
    "Cmd+W",
    "Close document tab when sidebar/viewer focused; stop Rich or close PTY when that pane focused",
  ],
  ["Cmd+F", "Find in terminal (when terminal focused)"],
  ["Cmd+± / Cmd+0", "Terminal font size / reset"],
  ["Click link", "Open http(s) URL in default browser (terminal or Rich feed)"],
  ["?", "This help"],
];

export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-transparent"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-[201] w-[min(440px,92vw)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4 shadow-lg">
        <h2 className="mb-3 text-[14px] font-semibold text-[var(--text-primary)]">
          Keyboard shortcuts
        </h2>
        <table className="w-full border-collapse text-[12px]">
          <tbody>
            {ROWS.map(([key, desc]) => (
              <tr key={key} className="border-b border-[var(--border)]">
                <td className="py-2 pr-3 font-mono text-[var(--accent-blue)]">
                  {key}
                </td>
                <td className="py-2 text-[var(--text-secondary)]">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="mt-4 rounded border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
