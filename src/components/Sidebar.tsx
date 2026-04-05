import { useEffect, useRef, useState } from "react";
import { useFileTree } from "../hooks/useFileTree";
import type { Persona } from "../lib/personas";
import type { TaskRow } from "../hooks/useTasks";
import {
  loadSidebarSections,
  saveSidebarSections,
} from "../lib/storage-keys";
import { FileTree } from "./FileTree";
import { PersonaTabs } from "./PersonaTabs";
import { TaskPanel } from "./TaskPanel";

const MIN_SECTION = 72;
const MAX_SECTION = 420;

function clampPx(n: number): number {
  return Math.min(MAX_SECTION, Math.max(MIN_SECTION, n));
}

interface SidebarProps {
  activePersona: Persona | undefined;
  personas: Persona[];
  activeId: string | null;
  onSelectPersona: (id: string) => void;
  tasks: TaskRow[];
  taskMoreCount: number;
  onFileSelect: (path: string) => void;
}

export function Sidebar({
  activePersona,
  personas,
  activeId,
  onSelectPersona,
  tasks,
  taskMoreCount,
  onFileSelect,
}: SidebarProps) {
  const fileTree = useFileTree();
  const roots = activePersona?.browseRoots ?? [];
  const hasFiles = roots.length > 0;

  const stored = loadSidebarSections();
  const [filesPx, setFilesPx] = useState(stored.filesPx);
  const [sessionsPx, setSessionsPx] = useState(stored.sessionsPx);
  const filesPxRef = useRef(filesPx);
  const sessionsPxRef = useRef(sessionsPx);
  filesPxRef.current = filesPx;
  sessionsPxRef.current = sessionsPx;

  const dragRef = useRef<{
    kind: "filesSessions" | "sessionsTasks";
    startY: number;
    startFiles: number;
    startSessions: number;
  } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) {
        return;
      }
      const dy = e.clientY - d.startY;
      if (d.kind === "filesSessions") {
        setFilesPx(clampPx(d.startFiles + dy));
      } else {
        setSessionsPx(clampPx(d.startSessions + dy));
      }
    };
    const onUp = () => {
      if (!dragRef.current) {
        return;
      }
      dragRef.current = null;
      saveSidebarSections({
        filesPx: filesPxRef.current,
        sessionsPx: sessionsPxRef.current,
      });
      globalThis.dispatchEvent(new Event("resize"));
    };
    globalThis.addEventListener("mousemove", onMove);
    globalThis.addEventListener("mouseup", onUp);
    return () => {
      globalThis.removeEventListener("mousemove", onMove);
      globalThis.removeEventListener("mouseup", onUp);
    };
  }, []);

  const hBar =
    "h-1 shrink-0 cursor-row-resize bg-[var(--border)] hover:bg-[var(--text-dim)]";

  const startDrag = (
    kind: "filesSessions" | "sessionsTasks",
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    dragRef.current = {
      kind,
      startY: e.clientY,
      startFiles: filesPxRef.current,
      startSessions: sessionsPxRef.current,
    };
  };

  const sectionTitle = (label: string) => (
    <h2 className="mb-1 shrink-0 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-dim)]">
      {label}
    </h2>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 py-3">
      {hasFiles ? (
        <>
          <div
            className="flex min-h-0 shrink-0 flex-col"
            style={{
              height: filesPx,
              minHeight: MIN_SECTION,
              maxHeight: MAX_SECTION,
            }}
          >
            {sectionTitle("Files")}
            <FileTree roots={roots} tree={fileTree} onFileSelect={onFileSelect} />
          </div>
          <div
            role="separator"
            aria-orientation="horizontal"
            className={hBar}
            onMouseDown={(e) => {
              startDrag("filesSessions", e);
            }}
          />
        </>
      ) : null}

      <div
        className="flex min-h-0 shrink-0 flex-col"
        style={{
          height: sessionsPx,
          minHeight: MIN_SECTION,
          maxHeight: MAX_SECTION,
        }}
      >
        {sectionTitle("Sessions")}
        <PersonaTabs
          personas={personas}
          activeId={activeId}
          onSelect={onSelectPersona}
        />
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        className={hBar}
        onMouseDown={(e) => {
          startDrag("sessionsTasks", e);
        }}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {sectionTitle("Tasks")}
        <TaskPanel tasks={tasks} moreCount={taskMoreCount} />
      </div>
    </div>
  );
}
