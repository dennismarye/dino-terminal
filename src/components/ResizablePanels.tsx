import { useEffect, useLayoutEffect, useRef, useState } from "react";

const STORAGE_KEY = "dino-terminal-panel-layout";

interface StoredLayout {
  left: number;
  rightShare: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function loadStored(): StoredLayout {
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const j = JSON.parse(raw) as Partial<StoredLayout>;
      return {
        left: clamp(Number(j.left) || 220, 180, 300),
        rightShare: clamp(Number(j.rightShare) || 0.45, 0.15, 0.9),
      };
    }
  } catch {
    /* ignore */
  }
  return { left: 220, rightShare: 0.45 };
}

function saveStored(left: number, rightShare: number) {
  try {
    globalThis.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ left, rightShare }),
    );
  } catch {
    /* ignore */
  }
}

interface ResizablePanelsProps {
  leftVisible: boolean;
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
}

export function ResizablePanels({
  leftVisible,
  left,
  center,
  right,
}: ResizablePanelsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const init = loadStored();
  const [leftW, setLeftW] = useState(init.left);
  const [rightShare, setRightShare] = useState(init.rightShare);
  const [containerWidth, setContainerWidth] = useState(1200);

  const leftWRef = useRef(leftW);
  const shareRef = useRef(rightShare);
  leftWRef.current = leftW;
  shareRef.current = rightShare;

  const dragRef = useRef<{
    kind: "left" | "mid";
    startX: number;
    startLeft: number;
    startShare: number;
    pair: number;
  } | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const measure = () => {
      setContainerWidth(el.getBoundingClientRect().width);
    };
    measure();
    const ro = new ResizeObserver(() => {
      measure();
      globalThis.dispatchEvent(new Event("resize"));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pair = Math.max(
    1,
    containerWidth - (leftVisible ? leftW + 8 : 4),
  );

  const minS = 300 / pair;
  const maxS = (pair - 200) / pair;
  const shareEff =
    minS <= maxS ? clamp(rightShare, minS, maxS) : 0.45;
  const rightW =
    minS <= maxS
      ? Math.max(300, Math.min(pair - 200, pair * shareEff))
      : Math.min(300, pair * 0.5);
  const centerW = Math.max(200, pair - rightW);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) {
        return;
      }
      if (d.kind === "left") {
        const dx = e.clientX - d.startX;
        setLeftW(clamp(d.startLeft + dx, 180, 300));
      } else {
        const dx = e.clientX - d.startX;
        const next = d.startShare - dx / d.pair;
        const lo = 300 / d.pair;
        const hi = (d.pair - 200) / d.pair;
        if (lo <= hi) {
          setRightShare(clamp(next, lo, hi));
        }
      }
    };
    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        saveStored(leftWRef.current, shareRef.current);
        globalThis.dispatchEvent(new Event("resize"));
      }
    };
    globalThis.addEventListener("mousemove", onMove);
    globalThis.addEventListener("mouseup", onUp);
    return () => {
      globalThis.removeEventListener("mousemove", onMove);
      globalThis.removeEventListener("mouseup", onUp);
    };
  }, []);

  const onLeftDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      kind: "left",
      startX: e.clientX,
      startLeft: leftW,
      startShare: rightShare,
      pair,
    };
  };

  const onMidDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const pairPx = Math.max(
      1,
      containerWidth - (leftVisible ? leftW + 8 : 4),
    );
    dragRef.current = {
      kind: "mid",
      startX: e.clientX,
      startLeft: leftW,
      startShare: rightShare,
      pair: pairPx,
    };
  };

  const dividerClass =
    "w-1 shrink-0 cursor-col-resize bg-[var(--border)] hover:bg-[var(--text-dim)]";

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 min-w-0 flex-1 flex-row"
    >
      {leftVisible ? (
        <>
          <div
            className="flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--bg-secondary)]"
            style={{
              width: leftW,
              minWidth: 180,
              maxWidth: 300,
            }}
          >
            {left}
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            className={dividerClass}
            onMouseDown={onLeftDown}
          />
        </>
      ) : null}
      <div
        className="flex min-h-0 flex-col overflow-hidden"
        style={{
          width: centerW,
          minWidth: 200,
          flex: "0 0 auto",
        }}
      >
        {center}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        className={dividerClass}
        onMouseDown={onMidDown}
      />
      <div
        className="flex min-h-0 flex-col overflow-hidden"
        style={{
          width: rightW,
          minWidth: 300,
          flex: "0 0 auto",
        }}
      >
        {right}
      </div>
    </div>
  );
}
