import { useRef } from "react";
import { useTerminal } from "../hooks/useTerminal";
import type { Persona } from "../lib/personas";

interface TerminalPaneProps {
  persona: Persona;
  isActive: boolean;
  npxOk: boolean;
  bootKey: number;
}

export function TerminalPane({
  persona,
  isActive,
  npxOk,
  bootKey,
}: TerminalPaneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useTerminal(ref, persona, isActive, npxOk, bootKey);

  return (
    <div
      ref={ref}
      className="h-full min-h-0 w-full min-w-0 overflow-hidden"
      style={{ display: isActive ? "block" : "none" }}
      aria-hidden={!isActive}
    />
  );
}
