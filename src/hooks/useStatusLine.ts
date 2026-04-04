import { useEffect, useState } from "react";
import { getStatusLine, type StatusLine } from "../lib/tauri-bridge";

export function useStatusLine(): StatusLine | null {
  const [status, setStatus] = useState<StatusLine | null>(null);

  useEffect(() => {
    const tick = () => {
      void getStatusLine().then(setStatus);
    };
    tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, []);

  return status;
}
