import { readDir, type DirEntry } from "@tauri-apps/plugin-fs";
import { useCallback, useState } from "react";

export const EXCLUDED_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".next",
  ".cache",
  "target",
]);

/** macOS / editor noise — not useful in the tree and break text preview if opened. */
export const EXCLUDED_FILE_NAMES = new Set([".DS_Store", ".localized"]);

export function filterDirEntries(entries: DirEntry[]): DirEntry[] {
  return entries.filter(
    (e) =>
      !EXCLUDED_DIR_NAMES.has(e.name) &&
      !(e.isFile && EXCLUDED_FILE_NAMES.has(e.name)),
  );
}

export function sortDirEntries(entries: DirEntry[]): DirEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

type CacheVal = DirEntry[] | "loading" | "error";

export interface UseFileTreeResult {
  cache: Record<string, CacheVal>;
  toggleDir: (dirPath: string) => void;
  isExpanded: (dirPath: string) => boolean;
}

export function useFileTree(): UseFileTreeResult {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cache, setCache] = useState<Record<string, CacheVal>>({});

  const loadDir = useCallback(async (dirPath: string) => {
    setCache((c) => {
      if (Array.isArray(c[dirPath])) {
        return c;
      }
      return { ...c, [dirPath]: "loading" };
    });
    try {
      const raw = await readDir(dirPath);
      const sorted = sortDirEntries(filterDirEntries(raw));
      setCache((c) => ({ ...c, [dirPath]: sorted }));
    } catch {
      setCache((c) => ({ ...c, [dirPath]: "error" }));
    }
  }, []);

  const toggleDir = useCallback(
    (dirPath: string) => {
      let shouldLoad = false;
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(dirPath)) {
          next.delete(dirPath);
        } else {
          next.add(dirPath);
          shouldLoad = true;
        }
        return next;
      });
      if (shouldLoad) {
        void loadDir(dirPath);
      }
    },
    [loadDir],
  );

  return {
    cache,
    toggleDir,
    isExpanded: (p) => expanded.has(p),
  };
}
