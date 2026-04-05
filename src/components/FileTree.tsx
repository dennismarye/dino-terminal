import type { DirEntry } from "@tauri-apps/plugin-fs";
import { useCallback, useRef } from "react";
import type { UseFileTreeResult } from "../hooks/useFileTree";
import type { BrowseRoot } from "../lib/personas";

/** POSIX join for macOS absolute paths (avoids async Tauri join in render). */
export function posixJoin(parent: string, name: string): string {
  const base = parent.endsWith("/") ? parent.slice(0, -1) : parent;
  return `${base}/${name}`;
}

interface FileTreeProps {
  roots: BrowseRoot[];
  tree: UseFileTreeResult;
  onFileSelect: (path: string) => void;
}

interface TreeNodeProps {
  entry: DirEntry;
  parentPath: string;
  depth: number;
  tree: UseFileTreeResult;
  onFileSelect: (path: string) => void;
}

function TreeNode({
  entry,
  parentPath,
  depth,
  tree,
  onFileSelect,
}: TreeNodeProps) {
  const fullPath = posixJoin(parentPath, entry.name);
  const expanded = tree.isExpanded(fullPath);
  const children = tree.cache[fullPath];

  const pad = { paddingLeft: `${8 + depth * 12}px` };

  const handleClick = useCallback(() => {
    if (entry.isDirectory) {
      tree.toggleDir(fullPath);
    } else {
      onFileSelect(fullPath);
    }
  }, [entry.isDirectory, fullPath, onFileSelect, tree]);

  if (entry.isDirectory) {
    return (
      <div className="select-none text-[12px]">
        <button
          type="button"
          onClick={handleClick}
          className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          style={pad}
        >
          <span className="w-3 shrink-0 text-[var(--text-dim)]" aria-hidden>
            {expanded ? "▾" : "▸"}
          </span>
          <span className="truncate">{entry.name}</span>
        </button>
        {expanded ? (
          <div>
            {children === "loading" ? (
              <div
                className="py-1 text-[var(--text-dim)]"
                style={{ paddingLeft: `${20 + depth * 12}px` }}
              >
                …
              </div>
            ) : null}
            {children === "error" ? (
              <div
                className="py-1 text-[var(--accent-red)]"
                style={{ paddingLeft: `${20 + depth * 12}px` }}
              >
                (unreadable)
              </div>
            ) : null}
            {Array.isArray(children)
              ? children.map((ch) => (
                  <TreeNode
                    key={posixJoin(fullPath, ch.name)}
                    entry={ch}
                    parentPath={fullPath}
                    depth={depth + 1}
                    tree={tree}
                    onFileSelect={onFileSelect}
                  />
                ))
              : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      style={{ paddingLeft: `${20 + depth * 12}px` }}
    >
      <span className="truncate">{entry.name}</span>
    </button>
  );
}

interface RootNodeProps {
  root: BrowseRoot;
  tree: UseFileTreeResult;
  onFileSelect: (path: string) => void;
}

function RootNode({ root, tree, onFileSelect }: RootNodeProps) {
  const expanded = tree.isExpanded(root.path);
  const children = tree.cache[root.path];

  return (
    <div className="select-none text-[12px]">
      <button
        type="button"
        onClick={() => {
          tree.toggleDir(root.path);
        }}
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      >
        <span className="w-3 shrink-0 text-[var(--text-dim)]" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
        <span className="truncate">{root.label}</span>
      </button>
      {expanded ? (
        <div>
          {children === "loading" ? (
            <div className="py-1 pl-5 text-[var(--text-dim)]">…</div>
          ) : null}
          {children === "error" ? (
            <div className="py-1 pl-5 text-[var(--accent-red)]">
              (unreadable)
            </div>
          ) : null}
          {Array.isArray(children)
            ? children.map((ch) => (
                <TreeNode
                  key={posixJoin(root.path, ch.name)}
                  entry={ch}
                  parentPath={root.path}
                  depth={0}
                  tree={tree}
                  onFileSelect={onFileSelect}
                />
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

export function FileTree({ roots, tree, onFileSelect }: FileTreeProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const focusAdjacentButton = useCallback((dir: 1 | -1) => {
    const root = wrapRef.current;
    if (!root) {
      return;
    }
    const buttons = [...root.querySelectorAll("button")];
    if (buttons.length === 0) {
      return;
    }
    const ae = document.activeElement;
    let i = buttons.indexOf(ae as HTMLButtonElement);
    if (i < 0) {
      i = 0;
    } else {
      i = Math.min(buttons.length - 1, Math.max(0, i + dir));
    }
    buttons[i]?.focus();
  }, []);

  if (!roots.length) {
    return null;
  }

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      className="min-h-0 flex-1 overflow-y-auto pr-1 outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)]"
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          focusAdjacentButton(1);
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          focusAdjacentButton(-1);
        }
      }}
    >
      <div className="space-y-0.5" role="tree" aria-label="Files">
        {roots.map((r) => (
          <RootNode
            key={r.path}
            root={r}
            tree={tree}
            onFileSelect={onFileSelect}
          />
        ))}
      </div>
    </div>
  );
}
