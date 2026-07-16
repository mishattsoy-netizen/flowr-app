/**
 * Pure structural operations on a flattened list-row array, mirroring
 * ListBlock.tsx's internal ListRow model and its Enter/Tab/Backspace logic
 * exactly, so NoteEditor's container-level keydown handler can perform the
 * same structural edits without duplicating ListBlock's component-local
 * state (rowsRef, commitRows) or re-deriving the tree logic from scratch.
 *
 * IMPORTANT: ListBlock.tsx's flattenRows() includes the list BLOCK itself as
 * row 0 (id === block.id), with actual list items as rows[1..]. These
 * operations follow that same convention — the caller is responsible for
 * building the flat array with flattenRows() (imported from ListBlock.tsx)
 * and rebuilding the block with nestRows() (also imported) afterward.
 */

export interface ListRow {
  id: string;
  content: string;
  checked?: boolean;
  depth: number;
}

/**
 * Enter on a non-empty row: insert a new empty row immediately after it, at
 * the same depth. Mirrors ListBlock.tsx handleKeyDown's Enter branch,
 * non-empty-content case (search for "Non-empty row: insert new row after").
 */
export function insertRowAfter(rows: ListRow[], afterId: string, newRow: ListRow): ListRow[] {
  const idx = rows.findIndex(r => r.id === afterId);
  if (idx === -1) return rows;
  return [...rows.slice(0, idx + 1), newRow, ...rows.slice(idx + 1)];
}

/**
 * Enter on an empty NESTED row (depth > 0): unindent it by one level.
 * Mirrors ListBlock.tsx's "Empty nested row: unindent" branch.
 */
export function unindentRow(rows: ListRow[], rowId: string): ListRow[] {
  const idx = rows.findIndex(r => r.id === rowId);
  if (idx === -1 || rows[idx].depth === 0) return rows;
  const next = [...rows];
  next[idx] = { ...next[idx], depth: next[idx].depth - 1 };
  return next;
}

/**
 * Tab on a row: indent by one level, capped at (previous row's depth + 1) —
 * a row cannot be indented deeper than one level below its immediate
 * predecessor. Mirrors ListBlock.tsx's Tab branch (non-shift case) exactly,
 * including the max-depth formula.
 */
export function indentRow(rows: ListRow[], rowId: string): ListRow[] {
  const idx = rows.findIndex(r => r.id === rowId);
  if (idx <= 0) return rows; // first row (idx 0, the block itself) can't indent; idx -1 means not found
  const maxDepth = rows[idx - 1].depth + 1;
  const next = [...rows];
  next[idx] = { ...next[idx], depth: Math.min(next[idx].depth + 1, maxDepth) };
  return next;
}

/**
 * Backspace at the start of a non-empty row: merge its content into the
 * previous row, remove this row. Mirrors ListBlock.tsx's Backspace branch,
 * "cursor at start position" case, rowIndex > 0 sub-case.
 */
export function mergeRowIntoPrevious(rows: ListRow[], rowId: string): ListRow[] {
  const idx = rows.findIndex(r => r.id === rowId);
  if (idx <= 0) return rows;
  const prevRow = rows[idx - 1];
  const merged: ListRow = { ...prevRow, content: (prevRow.content || '') + (rows[idx].content || '') };
  return [...rows.slice(0, idx - 1), merged, ...rows.slice(idx + 1)];
}

/**
 * Backspace on an EMPTY row: mirrors ListBlock.tsx's Backspace branch,
 * "!text.trim()" case. Three outcomes depending on position:
 *   - depth > 0: unindent (same as unindentRow)
 *   - depth === 0, this is the only row: signal "exit the list entirely"
 *     (caller must call onExitTop-equivalent; this function cannot do that,
 *     it only returns null to signal it)
 *   - depth === 0, first row (idx 0 among ACTUAL items, i.e. rows[1]):
 *     remove this row, focus becomes the new first row
 *   - depth === 0, elsewhere: remove this row, merge focus goes to previous
 *
 * Returns `null` if the caller must exit the list entirely (only row, empty,
 * at depth 0) rather than perform a row-array edit.
 */
export function removeEmptyRow(rows: ListRow[], rowId: string): ListRow[] | null {
  const idx = rows.findIndex(r => r.id === rowId);
  if (idx === -1) return rows;
  const row = rows[idx];

  if (row.depth > 0) return unindentRow(rows, rowId);

  // rows[0] is always the list BLOCK itself (see file header comment), so
  // "only row" for the purposes of list items means rows.length === 2
  // (block + one item).
  if (idx === 1 && rows.length === 2) return null; // signal: exit list entirely

  if (idx === 1) {
    // First actual item, more rows exist after it: just remove it.
    return [...rows.slice(0, idx), ...rows.slice(idx + 1)];
  }

  // Elsewhere: remove this row (its content is empty, nothing to preserve).
  return [...rows.slice(0, idx), ...rows.slice(idx + 1)];
}

/**
 * Enter on an empty row that is the LAST row and at depth 0: remove it and
 * signal the caller should exit the list (insert a plain block after).
 * Mirrors ListBlock.tsx's "Last empty top-level row: remove it and exit
 * list" branch. Returns null if there would be nothing left (caller must
 * exit list entirely instead), otherwise the row array with the empty
 * trailing row removed.
 */
export function removeEmptyTrailingRow(rows: ListRow[], rowId: string): ListRow[] | null {
  const idx = rows.findIndex(r => r.id === rowId);
  if (idx === -1) return rows;
  const withoutRow = [...rows.slice(0, idx), ...rows.slice(idx + 1)];
  if (withoutRow.length <= 1) return null; // only the block itself would remain
  return withoutRow;
}
