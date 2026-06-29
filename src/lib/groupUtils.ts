import type { EditorBlock } from '@/data/store.types';
import { computeGroupBounds } from './frameLayout';

// ─── Group ID generation ─────────────────────────────────────────────────────

let _groupIdCounter = 1;

/**
 * Generate a unique group ID string.
 */
export function generateGroupId(): string {
  return `g_${Date.now()}_${_groupIdCounter++}`;
}

// ─── Group / Ungroup ─────────────────────────────────────────────────────────

/**
 * Assign a `groupId` to each block in the list.
 */
export function groupBlocks(
  blocks: EditorBlock[],
  groupId: string,
): EditorBlock[] {
  return blocks.map((b) => ({ ...b, groupId }));
}

/**
 * Remove `groupId` from each block in the list.
 */
export function ungroupBlocks(blocks: EditorBlock[]): EditorBlock[] {
  return blocks.map((b) => {
    const { groupId: _removed, ...rest } = b;
    return rest;
  });
}

// ─── Query ───────────────────────────────────────────────────────────────────

/**
 * Return all blocks that belong to a given group.
 */
export function getGroupMembers(
  allBlocks: EditorBlock[],
  groupId: string,
): EditorBlock[] {
  return allBlocks.filter((b) => b.groupId === groupId);
}

/**
 * Compute the bounding box of a group's members.
 * Delegates to `computeGroupBounds` from the layout engine.
 */
export function getGroupBounds(
  members: EditorBlock[],
): { x: number; y: number; width: number; height: number } {
  return computeGroupBounds(members);
}

// ─── Transform ───────────────────────────────────────────────────────────────

/**
 * Move all group members by the same delta.
 */
export function moveGroupMembers(
  members: EditorBlock[],
  dx: number,
  dy: number,
): EditorBlock[] {
  return members.map((b) => ({
    ...b,
    x: (b.x ?? 0) + dx,
    y: (b.y ?? 0) + dy,
  }));
}
