import type { ReactNode } from "react";
import { openExternalHttpUrl } from "../lib/open-external-url";
import { isSafeHttpUrl } from "../lib/safe-http-url";

/** http(s) URLs; trailing `)`, `]`, `.,` trimmed from match end. */
const URL_RE = /\bhttps?:\/\/[^\s<>"'[\]()]+/gi;

function trimUrlTail(raw: string): string {
  return raw.replace(/[)\].,;:!?]+$/u, "");
}

interface LinkifiedTextProps {
  readonly text: string;
  readonly className?: string;
}

/**
 * Renders plain text with clickable http(s) links that use Tauri shell `open`.
 */
export function LinkifiedText({ text, className }: LinkifiedTextProps): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  const matches = text.matchAll(URL_RE);
  for (const m of matches) {
    const start = m.index ?? 0;
    const raw = m[0];
    const href = trimUrlTail(raw);
    if (start > last) {
      parts.push(text.slice(last, start));
    }
    if (isSafeHttpUrl(href)) {
      parts.push(
        <a
          key={`u-${key}`}
          href={href}
          className="text-[var(--accent-blue)] underline decoration-[var(--accent-blue)]/60 hover:opacity-90"
          onClick={(e) => {
            e.preventDefault();
            openExternalHttpUrl(href);
          }}
        >
          {raw}
        </a>,
      );
      key += 1;
    } else {
      parts.push(raw);
    }
    last = start + raw.length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return <span className={className}>{parts}</span>;
}
