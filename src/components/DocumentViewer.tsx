import { readFile } from "@tauri-apps/plugin-fs";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { revealInFinder } from "../lib/tauri-bridge";
import type { BrowseRoot } from "../lib/personas";

import "highlight.js/styles/github-dark.css";

interface DocumentViewerProps {
  filePath: string | null;
  browseRoots: BrowseRoot[];
}

function breadcrumb(filePath: string, roots: BrowseRoot[]): string {
  for (const r of roots) {
    const prefix = r.path.endsWith("/") ? r.path.slice(0, -1) : r.path;
    if (filePath === prefix || filePath.startsWith(`${prefix}/`)) {
      const rel = filePath.slice(prefix.length).replace(/^\//, "");
      const parts = [r.label, ...rel.split("/").filter(Boolean)];
      return parts.join(" / ");
    }
  }
  const segments = filePath.split("/").filter(Boolean);
  return segments.slice(-3).join(" / ");
}

function isMarkdown(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}

export function DocumentViewer({ filePath, browseRoots }: DocumentViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filePath) {
      setContent(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);

    void (async () => {
      try {
        const bytes = await readFile(filePath);
        if (cancelled) {
          return;
        }
        const sample = bytes.slice(0, Math.min(8192, bytes.length));
        if (sample.includes(0)) {
          setError("binary");
          setLoading(false);
          return;
        }
        const dec = new TextDecoder("utf-8", { fatal: true });
        try {
          const text = dec.decode(bytes);
          if (cancelled) {
            return;
          }
          setContent(text);
        } catch {
          if (cancelled) {
            return;
          }
          setError("binary");
        }
      } catch {
        if (!cancelled) {
          setError("read");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  const header = useMemo(() => {
    if (!filePath) {
      return "";
    }
    return breadcrumb(filePath, browseRoots);
  }, [filePath, browseRoots]);

  if (!filePath) {
    return (
      <div className="flex min-h-0 min-w-[200px] flex-1 flex-col bg-[var(--bg-primary)]">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <p className="text-[15px] font-medium text-[var(--text-secondary)]">
            Select a file to preview
          </p>
          <p className="max-w-sm text-[13px] leading-relaxed text-[var(--text-dim)]">
            Pick a persona, then open a file from the Files section in the
            sidebar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-[200px] flex-1 flex-col overflow-hidden bg-[var(--bg-primary)]">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <span
          className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-secondary)]"
          title={filePath}
        >
          {header}
        </span>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]"
            onClick={() => {
              void navigator.clipboard.writeText(filePath);
            }}
          >
            Copy path
          </button>
          <button
            type="button"
            className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]"
            onClick={() => {
              void revealInFinder(filePath).catch(() => {
                /* non-mac or scope */
              });
            }}
          >
            Reveal
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[var(--text-primary)]">
        {loading ? (
          <p className="text-sm text-[var(--text-dim)]">Loading…</p>
        ) : null}
        {error === "binary" || error === "read" ? (
          <p className="text-sm text-[var(--accent-red)]">
            Cannot preview this file
          </p>
        ) : null}
        {!loading && !error && content !== null ? (
          isMarkdown(filePath) ? (
            <article className="prose-markdown max-w-none text-[13px] leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  pre: ({ children }) => (
                    <pre className="mb-3 overflow-x-auto rounded-md bg-[var(--bg-surface)] p-3 font-mono text-[12px]">
                      {children}
                    </pre>
                  ),
                  code: ({ className, children, ...props }) => {
                    const isBlock = className?.includes("language-");
                    if (isBlock) {
                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code
                        className="rounded bg-[var(--bg-surface)] px-1 font-mono text-[12px]"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  table: ({ children }) => (
                    <table className="mb-3 w-full border-collapse border border-[var(--border)] text-[12px]">
                      {children}
                    </table>
                  ),
                  th: ({ children }) => (
                    <th className="border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-left">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-[var(--border)] px-2 py-1">
                      {children}
                    </td>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </article>
          ) : (
            <pre className="hljs whitespace-pre-wrap font-mono text-[12px] text-[var(--text-primary)]">
              {content}
            </pre>
          )
        ) : null}
      </div>
    </div>
  );
}
