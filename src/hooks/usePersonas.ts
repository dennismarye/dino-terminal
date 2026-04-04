import { useEffect, useRef, useState } from "react";
import { getPersonas } from "../lib/tauri-bridge";
import type { Persona } from "../lib/personas";

const POLL_MS = 12_000;

function personasSignature(personas: Persona[]): string {
  return JSON.stringify(
    personas.map((p) => ({
      id: p.id,
      name: p.name,
      cwd: p.cwd,
      taskFile: p.taskFile,
      cmd: p.cmd,
      cmdArgs: p.cmdArgs,
      args: p.args,
      color: p.color,
      browseRoots: p.browseRoots ?? [],
    })),
  );
}

export function usePersonas(): Persona[] {
  const [list, setList] = useState<Persona[]>([]);
  const sigRef = useRef<string>("");

  useEffect(() => {
    const apply = (next: Persona[]) => {
      const sig = personasSignature(next);
      if (sig !== sigRef.current) {
        sigRef.current = sig;
        setList(next);
      }
    };

    const load = () => {
      void getPersonas()
        .then(apply)
        .catch(() => apply([]));
    };

    load();
    const interval = globalThis.setInterval(load, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      globalThis.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return list;
}
