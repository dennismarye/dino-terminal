# Document shell (tabs)

## Decisions (Phase 6)

| Topic | Choice |
|-------|--------|
| **Tab identity** | Absolute file path (one tab per path). |
| **Persona switch** | All document tabs close; active document clears (matches prior single-file clear). |
| **Cmd+W** | Close active tab when focus is not inside terminal/composer; if no tabs, unchanged for terminal behavior. |
| **New tab** | Opening a file from the tree focuses an existing tab for that path or appends a tab. |
| **Editor** | Preview-only (read); no dirty state in v1. |
| **Close others** | Available from tab context menu (right-click). |

## Tauri `fs`

Reads use existing scoped paths from the file tree. No writes from the document viewer in this phase.
