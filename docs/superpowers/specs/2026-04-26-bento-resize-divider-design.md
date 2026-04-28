# Bento Resize Divider — Design Spec

**Date:** 2026-04-26  
**Status:** Approved  
**Scope:** Replace the two-widget redistribute model for bento divider resizing with a unified cell-claiming engine operation that handles spanners, multi-neighbor gap-fill, and min/max rejection.

---

## Problem

The current `adjustDivider` and `adjustVerticalDivider` engine functions only redistribute a shared dimension between exactly two widgets. This fails in three cases:

1. **Partial overlap (spanner case):** The two widgets don't share the full column/row band, so the current functions move the wrong widgets or move them by the wrong amount.
2. **Dual reshape:** Growing one widget may require the victim to lose cells in both width AND height simultaneously (Diagram 4: D loses its lower 2 rows to B, shrinking from h=4 to h=2).
3. **Gap fill:** Freed cells (cells victim vacated that claimer didn't claim) must be filled by other neighbors growing into them. Current code has no gap-fill pass after a divider drag.

---

## Terminology

| Term | Definition |
|------|-----------|
| **Claimer** | The widget growing into new cells |
| **Victim** | The widget losing cells |
| **Divider** | The shared edge between claimer and victim |
| **Transfer band** | The overlap region on the shared edge: col range [cL, cR) for horizontal dividers, row range [rT, rB) for vertical dividers |
| **Transfer cells** | The specific grid cells moving from victim to claimer (transfer band × N steps) |
| **Freed cells** | Cells victim vacates that are NOT claimed by claimer |
| **newBoundary** | The absolute grid position (col or row index) of the divider after the drag |

---

## New Engine Function

```ts
resizeDivider(
  layout: BentoLayoutItem[],
  claimerId: string,
  victimId: string,
  newBoundary: number   // absolute col (vertical divider) or row (horizontal divider)
): BentoLayoutItem[] | null  // null = rejected, caller snaps back
```

This single function replaces both `adjustDivider` and `adjustVerticalDivider`.

---

## Algorithm

### Step 1 — Compute transfer cells

From `computeGridPositions`, get the current positions of claimer and victim.

- **Vertical divider** (left/right drag): transfer band = row overlap of claimer and victim. Transfer cells = transfer band rows × cols between old boundary and `newBoundary`.
- **Horizontal divider** (up/down drag): transfer band = col overlap of claimer and victim. Transfer cells = transfer band cols × rows between old boundary and `newBoundary`.

### Step 2 — Reshape claimer

Extend claimer's rectangle to include transfer cells. Claimer is always rectangular, so this is a simple arithmetic change to its `w`, `h`, `row`, or grid `x` (derived from `order`/`positions`).

- Growing right: `w += steps`
- Growing left: `w += steps`, `x -= steps` (x is derived from order via computeGridPositions; implementation must update `order` and `row` fields, not a raw x field — x is computed, not stored)
- Growing down: `h += steps`
- Growing up: `h += steps`, `row -= steps`

### Step 3 — Reshape victim

Victim loses the transfer cells. Its new shape is the **largest axis-aligned rectangle** contained within its old bounds that does not overlap any transfer cells and satisfies `w ≥ minW`, `h ≥ minH`.

For all cases in the diagrams, this rectangle is deterministic (only one candidate). The transfer cells always form a strip along one of victim's edges within the transfer band, so victim simply shrinks in one or two dimensions.

Concrete examples:
- Diagram 1: A loses cols 5-6 rows 1-2 → A shrinks from w=4 to w=2 (cols 3-4), h unchanged.
- Diagram 4: D loses cols 1-2 rows 3-4 → D shrinks from h=4 to h=2 (rows 1-2), w unchanged.
- Diagrams 2&3: C loses its top rows in cols 5-6 → C shrinks in height.

### Step 4 — Fill freed cells

Freed cells = victim's old rectangle minus transfer cells minus victim's new rectangle.

Algorithm:
1. Build a set of all freed cells.
2. For each freed cell, find the widget whose existing rectangle is directly adjacent to that cell on the side facing the freed region (its edge touches the freed cell, its col/row band covers that cell).
3. Grow that neighbor by 1 step toward the freed cell (`h++`, `h--` with `row--`, `w++`, or `w--` with `x--`).
4. Mark those cells as filled. Repeat until no freed cells remain.
5. If any freed cells remain unfilled after exhausting all eligible neighbors → **reject** (return null).

Neighbor growth must not violate min/max bounds or overlap other widgets.

### Step 5 — Validate

Run `validateLayout(result)`. If invalid → return `null`.

---

## Divider Rendering (BentoDashboard)

Already fixed in this session: one handle rendered per neighbor pair (not just the first neighbor). Each handle is positioned over the overlap region of the two widgets.

**No changes needed to divider rendering.**

---

## Dashboard Integration

### Snap behavior

- **Vertical dividers** (left/right drag): snap to whole half-col increments. `newBoundary` = snapped col index.
- **Horizontal dividers** (up/down drag): snap to whole row increments. `newBoundary` = snapped row index.

Claimer = the widget on the side the boundary moves toward. Victim = the other widget.

### Handler changes

**[useBentoLayout.ts](src/hooks/useBentoLayout.ts):**
- `handleDividerDragPreview(claimerId, victimId, newBoundary)` — calls `resizeDivider`, sets preview layout if non-null
- `handleVerticalDividerDragPreview(claimerId, victimId, newBoundary)` — same
- On null result: preview stays at last valid position (handle visually snaps back)

**[BentoDashboard.tsx](src/components/bento/BentoDashboard.tsx):**
- Horizontal drag effect: compute `newBoundary` from pointer X, snap to half-col, determine claimer/victim from which side boundary moved toward, call `handleDividerDragPreview`
- Vertical drag effect: same for pointer Y, snap to row

### Files touched

| File | Change |
|------|--------|
| `src/lib/bento-engine.ts` | Add `resizeDivider`; deprecate `adjustDivider` and `adjustVerticalDivider` (remove after verified) |
| `src/hooks/useBentoLayout.ts` | Update `handleDividerDragPreview` and `handleVerticalDividerDragPreview` signatures and bodies |
| `src/components/bento/BentoDashboard.tsx` | Update snap math and handler calls in both drag effects |

---

## Rejection Conditions

A drag is rejected (returns null, handle snaps back) if:

- Any widget would have `w < minW` or `h < minH` after the operation
- Any widget would have `w > maxW` or `h > maxH`
- Any freed cells cannot be filled by an adjacent neighbor
- `validateLayout` fails for any other reason (out-of-bounds, gaps, overlaps)

---

## Test Cases (from diagrams)

| Diagram | Setup | Action | Expected |
|---------|-------|--------|----------|
| 1 | D(1-2,r1-4), A(3-6,r1-2), B(3-4,r3-4), C(5-6,r3-4) | Drag A/C divider up (C claims r1-2 in cols 5-6) | C→(5-6,r1-4), A→(3-4,r1-2) |
| 2 | D(1-2,r1-4), A(3-4,r1-2), C(5-6,r1-4), B(3-4,r3-4) | Drag A/C divider right (A claims cols 5-6 r1-2) | A→(3-6,r1-2), C→(5-6,r3-4) |
| 3 | E(1-2,r1), D(1-2,r2-4), A(3-4,r1-2), B(3-4,r3-4), C(5-6,r1-3) | Drag A/C divider right (A claims cols 5-6 r1-2) | A→(3-6,r1-2), C→(5-6,r3) |
| 4 | D(1-2,r1-4), A(3-6,r1-2), B(3-4,r3-4), C(5-6,r3-4) | Drag D/B divider left (B claims cols 1-2 r3-4) | B→(1-4,r3-4), D→(1-2,r1-2) |
| Possible | D(1-2,r1-4), A(3-6,r1-2), B(3-4,r3-4), C(5-6,r3-4) | Drag A/B+C divider up (A shrinks h, B claims cols 3-4 r freed, C claims cols 5-6 r freed) | A→(3-6,r1-1), B→(3-4,r2-4), C→(5-6,r2-4) — gap fill grows B and C upward |
| Not possible #1 | D(1-2,r1-4), A(3-6,r1-2), B(3-4,r3-4), C(5-6,r3-4) | Drag D right (D claims col 3 r1-4, A must lose col 3) | Rejected (A below minW or gap) |
| Not possible #2 | E(1-2,r1), D(1-2,r2-4), A(3-6,r1-2), B(3-4,r3-4), C(5-6,r3-4) | Drag E/D/A divider right | Rejected (multiple min violations) |

---

## Out of Scope

- Widget deletion via divider drag
- Pushing widgets to new rows via divider drag
- Pixel-smooth (non-snapped) resize
- Undo history changes (existing undo/redo handles this already via `commitLayout`)
