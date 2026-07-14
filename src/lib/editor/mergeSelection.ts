import type { EditorBlock } from '@/data/store.types';

export interface BlockSelection {
  startBlockId: string;
  startOffset: number;  // plain-text offset within the start block
  endBlockId: string;
  endOffset: number;    // plain-text offset within the end block
}

export interface MergeResult {
  blocks: EditorBlock[];      // the new full block list
  cursorBlockId: string;      // block the cursor lands in
  cursorOffset: number;       // plain-text offset within it (the seam)
}

/**
 * The unselected HTML that must survive the merge, already sliced by the caller.
 * The caller owns the slicing because it has the DOM (sliceHtmlByTextOffset);
 * this module stays DOM-free so it runs under vitest's node environment.
 */
export interface SurvivingHtml {
  headHtml: string;   // first block's content BEFORE the selection starts
  tailHtml: string;   // last block's content AFTER the selection ends
}

/** Plain-text length of an HTML string — used to place the cursor at the seam. */
export function htmlTextLength(html: string): number {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .length;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Merge a selection that spans two or more top-level blocks.
 *
 * First block wins: the surviving block keeps the FIRST block's id, type and
 * every other property. Its content becomes
 *     headHtml + insertText + tailHtml
 * and blocks fully covered by the selection are removed.
 *
 * headHtml/tailHtml arrive as HTML, so bold, links and other inline formatting
 * inside text the user NEVER SELECTED survive the merge. Rebuilding from plain
 * text here would silently destroy them — that is data loss, not a rough edge.
 *
 * Returns the input unchanged if the selection does not span multiple
 * top-level blocks, so the caller can fall back to native browser behavior.
 */
export function mergeAcrossBlocks(
  blocks: EditorBlock[],
  selection: BlockSelection,
  insertText: string,
  surviving: SurvivingHtml,
): MergeResult {
  const noChange = (): MergeResult => ({
    blocks,
    cursorBlockId: selection.startBlockId,
    cursorOffset: selection.startOffset,
  });

  if (selection.startBlockId === selection.endBlockId) return noChange();

  const aIdx = blocks.findIndex(b => b.id === selection.startBlockId);
  const bIdx = blocks.findIndex(b => b.id === selection.endBlockId);
  if (aIdx === -1 || bIdx === -1) return noChange();

  // Normalize to document order — the result must not depend on drag direction.
  const forward = aIdx < bIdx;
  const firstIdx = forward ? aIdx : bIdx;
  const lastIdx = forward ? bIdx : aIdx;

  const first = blocks[firstIdx];
  const { headHtml, tailHtml } = surviving;

  const merged: EditorBlock = {
    ...first,                                    // first block wins: id, type, colors, align…
    content: headHtml + escapeHtml(insertText) + tailHtml,
  };

  const next = [
    ...blocks.slice(0, firstIdx),
    merged,
    ...blocks.slice(lastIdx + 1),
  ];

  return {
    blocks: next,
    cursorBlockId: merged.id,
    cursorOffset: htmlTextLength(headHtml) + insertText.length,
  };
}
