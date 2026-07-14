import type { BlockSelection } from './mergeSelection';

/**
 * No jsdom/happy-dom in this repo's devDependencies, and the plan forbids
 * installing one. This module is therefore covered by the Playwright probe
 * (scripts/probe-selection.mjs) in a real browser rather than by vitest.
 */

/** Plain-text offset of (node, offset) measured from the start of `root`. */
function textOffsetWithin(root: Node, node: Node, offset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  let current: Node | null;
  while ((current = walker.nextNode())) {
    if (current === node) return total + offset;
    total += (current.textContent ?? '').length;
  }
  // The node is an element (e.g. an empty block): offset counts child nodes.
  return total;
}

/**
 * Read the current selection and express it in block coordinates.
 * Returns null when there is no range, when it is collapsed, or when it lies
 * inside a single block — in all of those cases the browser handles it natively.
 */
export function getBlockSelection(root: HTMLElement): BlockSelection | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

  const blockOf = (n: Node | null): HTMLElement | null => {
    const el = n?.nodeType === Node.TEXT_NODE ? n.parentElement : (n as HTMLElement | null);
    return el?.closest('[data-block-id]') ?? null;
  };

  const anchorBlock = blockOf(sel.anchorNode);
  const focusBlock = blockOf(sel.focusNode);
  if (!anchorBlock || !focusBlock) return null;
  if (!root.contains(anchorBlock) || !root.contains(focusBlock)) return null;

  const startBlockId = anchorBlock.dataset.blockId!;
  const endBlockId = focusBlock.dataset.blockId!;
  if (startBlockId === endBlockId) return null;   // single block → native

  return {
    startBlockId,
    startOffset: textOffsetWithin(anchorBlock, sel.anchorNode!, sel.anchorOffset),
    endBlockId,
    endOffset: textOffsetWithin(focusBlock, sel.focusNode!, sel.focusOffset),
  };
}

/**
 * Slice an HTML string by PLAIN-TEXT offsets, preserving inline tags that fall
 * inside the range. This is what keeps bold/links alive in the surviving head
 * and tail of a cross-block merge.
 *
 * Pass Number.MAX_SAFE_INTEGER as `end` to slice through to the end.
 */
export function sliceHtmlByTextOffset(html: string, start: number, end: number): string {
  if (start >= end) return '';
  const host = document.createElement('div');
  host.innerHTML = html;

  const range = document.createRange();
  // Default to the whole host, so an `end` past the text length slices to the
  // end instead of leaving the range unset.
  range.selectNodeContents(host);

  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let startSet = false;
  let endSet = false;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const len = (node.textContent ?? '').length;
    if (!startSet && seen + len >= start) {
      range.setStart(node, start - seen);
      startSet = true;
    }
    if (startSet && !endSet && seen + len >= end) {
      range.setEnd(node, end - seen);
      endSet = true;
      break;
    }
    seen += len;
  }
  if (!startSet) return '';   // start is past the end of the text

  const out = document.createElement('div');
  out.appendChild(range.cloneContents());
  return out.innerHTML;
}

/** Place the caret inside `blockId` at a plain-text offset. */
export function restoreCursor(root: HTMLElement, blockId: string, textOffset: number): void {
  const block = root.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
  if (!block) return;

  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let target: Node | null = null;
  let localOffset = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const len = (node.textContent ?? '').length;
    if (seen + len >= textOffset) {
      target = node;
      localOffset = textOffset - seen;
      break;
    }
    seen += len;
  }

  const range = document.createRange();
  if (target) {
    range.setStart(target, Math.min(localOffset, (target.textContent ?? '').length));
  } else {
    range.selectNodeContents(block);   // empty block
    range.collapse(true);
  }
  range.collapse(true);

  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
