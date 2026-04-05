import { useCallback, useEffect, useMemo, useState } from "react";
import { CommandPalette, type PaletteCommand } from "./components/CommandPalette";
import { DocumentViewer } from "./components/DocumentViewer";
import { ResizablePanels } from "./components/ResizablePanels";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import { Sidebar } from "./components/Sidebar";
import { SpawnErrorBanner } from "./components/SpawnErrorBanner";
import { StatusBar } from "./components/StatusBar";
import { UpdateBanner } from "./components/UpdateBanner";
import { TerminalPane } from "./components/TerminalPane";
import { TitleBar } from "./components/TitleBar";
import { usePersonas } from "./hooks/usePersonas";
import { useStatusLine } from "./hooks/useStatusLine";
import { useTasks } from "./hooks/useTasks";
import { useUpdateAvailability } from "./hooks/useUpdateAvailability";
import {
  getNpxStatus,
  getPersonasConfigPath,
} from "./lib/tauri-bridge";
import {
  loadSidebarVisible,
  saveSidebarVisible,
} from "./lib/storage-keys";

function isFocusInsideTerminalHost(): boolean {
  const a = document.activeElement;
  return !!(a && a.closest("[data-terminal-host], .xterm"));
}

function App() {
  const personas = usePersonas();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(() =>
    loadSidebarVisible(),
  );
  const [npxOk, setNpxOk] = useState(true);
  const [bootKeys, setBootKeys] = useState<Record<string, number>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const status = useStatusLine();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [spawnError, setSpawnError] = useState<string | null>(null);

  useEffect(() => {
    const onSpawnErr = (ev: Event) => {
      const d = (ev as CustomEvent<unknown>).detail;
      if (typeof d === "string") {
        setSpawnError(d);
      }
    };
    globalThis.addEventListener("dino-terminal-spawn-error", onSpawnErr);
    return () => {
      globalThis.removeEventListener("dino-terminal-spawn-error", onSpawnErr);
    };
  }, []);

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

  const toggleSidebar = useCallback(() => {
    setSidebarVisible((v) => {
      const n = !v;
      saveSidebarVisible(n);
      return n;
    });
  }, []);

  const activePersona = useMemo(
    () => personas.find((p) => p.id === activeId),
    [personas, activeId],
  );
  const { tasks, moreCount: taskMoreCount } = useTasks(
    activePersona?.taskFile,
  );

  const browseRootsForViewer = activePersona?.browseRoots ?? [];

  const restartSession = useCallback(() => {
    if (!activeId) {
      return;
    }
    setBootKeys((k) => ({
      ...k,
      [activeId]: (k[activeId] ?? 0) + 1,
    }));
  }, [activeId]);

  const openPersonasConfig = useCallback(() => {
    void (async () => {
      try {
        const path = await getPersonasConfigPath();
        const { openPath } = await import("@tauri-apps/plugin-opener");
        await openPath(path);
      } catch {
        /* opener unavailable outside Tauri */
      }
    })();
  }, []);

  const {
    bannerVisible,
    bannerVersion,
    bannerDownloading,
    onBannerUpdate,
    onBannerLater,
    onBannerDismiss,
    runPaletteUpdateCheck,
  } = useUpdateAvailability();

  const paletteCommands: PaletteCommand[] = useMemo(
    () => [
      {
        id: "toggle-sidebar",
        label: "Toggle sidebar",
        run: toggleSidebar,
      },
      {
        id: "restart-session",
        label: "Restart terminal session (active persona)",
        run: restartSession,
      },
      {
        id: "open-personas",
        label: "Open personas.json",
        run: openPersonasConfig,
      },
      {
        id: "shortcuts",
        label: "Show keyboard shortcuts",
        run: () => {
          setHelpOpen(true);
        },
      },
      {
        id: "check-updates",
        label: "Check for updates…",
        run: () => {
          void (async () => {
            const r = await runPaletteUpdateCheck();
            if (r === "no-tauri") {
              globalThis.alert(
                "Updates are only available in the installed desktop app.",
              );
              return;
            }
            if (r === "up-to-date") {
              globalThis.alert("You are on the latest version.");
              return;
            }
            if (r === "install-failed") {
              globalThis.alert("The update could not be installed. Try again later.");
              return;
            }
          })();
        },
      },
    ],
    [openPersonasConfig, restartSession, toggleSidebar, runPaletteUpdateCheck],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.code === "KeyP") {
        if (isFocusInsideTerminalHost()) {
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const t = e.target as HTMLElement | null;
        if (
          t &&
          (t.tagName === "INPUT" ||
            t.tagName === "TEXTAREA" ||
            t.isContentEditable)
        ) {
          return;
        }
        if (paletteOpen || helpOpen) {
          return;
        }
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
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
        toggleSidebar();
        return;
      }
      if (e.key === ",") {
        e.preventDefault();
        openPersonasConfig();
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
  }, [
    personas,
    selectedFile,
    activeId,
    sidebarVisible,
    openPersonasConfig,
    paletteOpen,
    helpOpen,
    toggleSidebar,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TitleBar />
      <SpawnErrorBanner
        message={spawnError}
        onDismiss={() => {
          setSpawnError(null);
        }}
      />
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
          <div className="relative h-full min-h-0 min-w-0 bg-[var(--bg-primary)] p-2">
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
      <UpdateBanner
        visible={bannerVisible}
        version={bannerVersion}
        downloading={bannerDownloading}
        onUpdate={onBannerUpdate}
        onLater={onBannerLater}
        onDismiss={onBannerDismiss}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => {
          setPaletteOpen(false);
        }}
        commands={paletteCommands}
      />
      <ShortcutsHelp
        open={helpOpen}
        onClose={() => {
          setHelpOpen(false);
        }}
      />
    </div>
  );
}

export default App;
