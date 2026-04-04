import { useFileTree } from "../hooks/useFileTree";
import type { Persona } from "../lib/personas";
import type { TaskRow } from "../hooks/useTasks";
import { FileTree } from "./FileTree";
import { PersonaTabs } from "./PersonaTabs";
import { TaskPanel } from "./TaskPanel";

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

  return (
    <div className="flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto px-4 py-3">
      {roots.length > 0 ? (
        <>
          <FileTree roots={roots} tree={fileTree} onFileSelect={onFileSelect} />
          <div className="my-3 h-px shrink-0 bg-[var(--border)]" />
        </>
      ) : null}
      <PersonaTabs
        personas={personas}
        activeId={activeId}
        onSelect={onSelectPersona}
      />
      <TaskPanel tasks={tasks} moreCount={taskMoreCount} />
    </div>
  );
}
