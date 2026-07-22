import type { EditorBlock } from './markdownBlocks'

/**
 * Carry block IDs from a note's previous blocks over to freshly re-parsed
 * blocks so client editors (which reconcile by block ID) see a patch as an
 * in-place edit, not a full replacement.
 *
 * Two passes: (1) exact type+content matches, nearest index first, claim
 * their old ID; (2) remaining new blocks claim the nearest unclaimed old
 * block of the same type (positional, for content-edited blocks). Anything
 * unmatched keeps its freshly generated ID.
 */
export function reattachBlockIds(oldBlocks: EditorBlock[], newBlocks: EditorBlock[]): EditorBlock[] {
  const claimedOld = new Set<number>()
  const matchedNew = new Set<number>()
  const out = newBlocks.map(nb => ({ ...nb }))

  for (let i = 0; i < out.length; i++) {
    const idx = findMatch(oldBlocks, out[i], i, claimedOld, true)
    if (idx !== -1) { out[i].id = oldBlocks[idx].id; claimedOld.add(idx); matchedNew.add(i) }
  }
  for (let i = 0; i < out.length; i++) {
    if (matchedNew.has(i)) continue
    const idx = findMatch(oldBlocks, out[i], i, claimedOld, false)
    if (idx !== -1) { out[i].id = oldBlocks[idx].id; claimedOld.add(idx); matchedNew.add(i) }
  }
  return out
}

function findMatch(oldBlocks: EditorBlock[], nb: EditorBlock, around: number, claimed: Set<number>, exact: boolean): number {
  for (let d = 0; d < oldBlocks.length; d++) {
    for (const j of d === 0 ? [around] : [around - d, around + d]) {
      if (j < 0 || j >= oldBlocks.length || claimed.has(j)) continue
      const ob = oldBlocks[j]
      if (ob.type !== nb.type) continue
      if (exact && ob.content !== nb.content) continue
      return j
    }
  }
  return -1
}
