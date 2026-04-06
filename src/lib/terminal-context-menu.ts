import { LogicalPosition } from "@tauri-apps/api/dpi";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Terminal } from "@xterm/xterm";
import { isTauriApp } from "./app-updater";
import { openExternalHttpUrl } from "./open-external-url";
import { isSafeHttpUrl } from "./safe-http-url";

function trimUrlTail(raw: string): string {
  return raw.replace(/[)\].,;:!?]+$/u, "");
}

function normalizeHoveredUrl(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = trimUrlTail(raw.trim());
  return isSafeHttpUrl(trimmed) ? trimmed : null;
}

async function buildItems(
  selection: string,
  hoveredUrl: string | null,
  term: Terminal,
): Promise<
  Array<
    | Awaited<ReturnType<typeof MenuItem.new>>
    | Awaited<ReturnType<typeof PredefinedMenuItem.new>>
  >
> {
  const items: Array<
    | Awaited<ReturnType<typeof MenuItem.new>>
    | Awaited<ReturnType<typeof PredefinedMenuItem.new>>
  > = [];

  if (hoveredUrl) {
    const url = hoveredUrl;
    items.push(
      await MenuItem.new({
        id: "dino-terminal-open-link",
        text: "Open Link",
        action: () => {
          void openExternalHttpUrl(url);
        },
      }),
    );
    items.push(await PredefinedMenuItem.new({ item: "Separator" }));
  }

  const sel = selection;
  items.push(
    await MenuItem.new({
      id: "dino-terminal-copy",
      text: "Copy",
      enabled: sel.length > 0,
      action: async () => {
        if (sel.length > 0) {
          await navigator.clipboard.writeText(sel);
        }
      },
    }),
  );

  items.push(
    await MenuItem.new({
      id: "dino-terminal-paste",
      text: "Paste",
      action: async () => {
        try {
          const text = await navigator.clipboard.readText();
          term.paste(text);
        } catch {
          /* clipboard denied or empty */
        }
      },
    }),
  );

  items.push(
    await MenuItem.new({
      id: "dino-terminal-select-all",
      text: "Select All",
      action: () => {
        term.selectAll();
      },
    }),
  );

  items.push(await PredefinedMenuItem.new({ item: "Separator" }));
  items.push(await PredefinedMenuItem.new({ item: "Services" }));

  return items;
}

/**
 * Replaces xterm.js default right-click handling with a Tauri native popup menu
 * (Copy / Paste / Select All / Services, plus Open Link when over a WebLinksAddon URL).
 */
export function attachXtermContextMenu(
  term: Terminal,
  getHoveredLinkUrl: () => string | null,
): () => void {
  const el = term.element;
  if (!el) {
    return () => {};
  }

  const onContextMenu = async (e: MouseEvent): Promise<void> => {
    if (!isTauriApp()) {
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();

    const selection = term.getSelection();
    const hoveredUrl = normalizeHoveredUrl(getHoveredLinkUrl());

    try {
      const items = await buildItems(selection, hoveredUrl, term);
      const menu = await Menu.new({ items });
      const win = getCurrentWindow();
      await menu.popup(new LogicalPosition(e.clientX, e.clientY), win);
    } catch (err) {
      console.warn("[dino-terminal] context menu failed:", err);
    }
  };

  el.addEventListener("contextmenu", onContextMenu, true);
  return () => {
    el.removeEventListener("contextmenu", onContextMenu, true);
  };
}
