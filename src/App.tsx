import { useEffect, useMemo, useState } from "react";
import { DocumentViewer } from "./components/DocumentViewer";
import { ResizablePanels } from "./components/ResizablePanels";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { TerminalPane } from "./components/TerminalPane";
import { TitleBar } from "./components/TitleBar";
import { usePersonas } from "./hooks/usePersonas";
import { useStatusLine } from "./hooks/useStatusLine";
import { useTasks } from "./hooks/useTasks";
import { getNpxStatus, getPersonasConfigPath } from "./lib/tauri-bridge";

function App() {
  const personas = usePersonas();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [npxOk, setNpxOk] = useState(true);
  const [bootKeys, setBootKeys] = useState<Record<string, number>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const status = useStatusLine();

  useEffect(() => {
    if (personas.length > 0 && activeId === null) {
      setActiveId(personas[0].id);
    }
  }, [personas, activeId]);

  useEffect(() => {
    setSelectedFile(null);
  }, [activeId]);

  useEffect(() => {
    const refreshNpx = () => {
      void getNpxStatus().then((s) => {
        setNpxOk(s.ok);
      });
    };
    refreshNpx();
    const interval = globalThis.setInterval(refreshNpx, 45_000);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        refreshNpx();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      globalThis.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const activePersona = useMemo(
    () => personas.find((p) => p.id === activeId),
    [personas, activeId],
  );
  const { tasks, moreCount: taskMoreCount } = useTasks(
    activePersona?.taskFile,
  );

  const browseRootsForViewer = activePersona?.browseRoots ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey) {
        return;
      }
      if (e.key === "w" || e.key === "W") {
        if (selectedFile) {
          e.preventDefault();
          e.stopImmediatePropagation();
          setSelectedFile(null);
          return;
        }
      }
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        setSidebarVisible((v) => !v);
        return;
      }
      if (e.key === ",") {
        e.preventDefault();
        void (async () => {
          try {
            const path = await getPersonasConfigPath();
            const { openPath } = await import("@tauri-apps/plugin-opener");
            await openPath(path);
          } catch {
            /* opener unavailable outside Tauri */
          }
        })();
        return;
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        if (!activeId) {
          return;
        }
        setBootKeys((k) => ({
          ...k,
          [activeId]: (k[activeId] ?? 0) + 1,
        }));
        return;
      }
      if (e.key === "1") {
        e.preventDefault();
        const p = personas[0];
        if (p) {
          setActiveId(p.id);
        }
        return;
      }
      if (e.key === "2") {
        e.preventDefault();
        const p = personas[1];
        if (p) {
          setActiveId(p.id);
        }
      }
    };
    globalThis.addEventListener("keydown", onKey, true);
    return () => globalThis.removeEventListener("keydown", onKey, true);
  }, [personas, selectedFile, activeId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TitleBar />
      <ResizablePanels
        leftVisible={sidebarVisible}
        left={
          <Sidebar
            activePersona={activePersona}
            personas={personas}
            activeId={activeId}
            onSelectPersona={setActiveId}
            tasks={tasks}
            taskMoreCount={taskMoreCount}
            onFileSelect={setSelectedFile}
          />
        }
        center={
          <DocumentViewer
            filePath={selectedFile}
            browseRoots={browseRootsForViewer}
          />
        }
        right={
          <div className="relative h-full min-h-0 min-w-0 bg-[var(--bg-primary)]">
            {personas.map((p) => (
              <TerminalPane
                key={p.id}
                persona={p}
                isActive={p.id === activeId}
                npxOk={npxOk}
                bootKey={bootKeys[p.id] ?? 0}
              />
            ))}
            {npxOk ? null : (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--bg-primary)]/90 p-6 text-center">
                <p className="max-w-md text-sm text-[var(--accent-red)]">
                  npx not found — install Node.js 22+
                </p>
              </div>
            )}
          </div>
        }
      />
      <StatusBar status={status} />
    </div>
  );
}

export default App;
