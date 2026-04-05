import type { StreamUiRow } from "./stream-json-parser";

/** Avoid unbounded DOM when the model streams huge replies. */
export const MAX_ASSISTANT_MERGE_LEN = 32_000;

export interface CoalescableEntry {
  id: string;
  row: StreamUiRow;
  at: number;
}

/**
 * Append a row, merging consecutive `assistant_text` bodies into one entry.
 */
export function appendCoalesced(
  entries: CoalescableEntry[],
  row: StreamUiRow,
  makeId: () => string,
): CoalescableEntry[] {
  if (row.kind !== "assistant_text") {
    return [...entries, { id: makeId(), row, at: Date.now() }];
  }
  const last = entries.at(-1);
  if (last?.row.kind === "assistant_text") {
    const mergedBody = last.row.body + row.body;
    if (mergedBody.length <= MAX_ASSISTANT_MERGE_LEN) {
      const mergedRow: StreamUiRow = {
        kind: "assistant_text",
        title: "Assistant",
        body: mergedBody,
      };
      return [...entries.slice(0, -1), { ...last, row: mergedRow, at: Date.now() }];
    }
  }
  return [...entries, { id: makeId(), row, at: Date.now() }];
}
