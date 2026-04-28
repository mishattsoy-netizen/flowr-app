# Bento Resize Divider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-widget redistribute model for bento divider dragging with a unified `resizeDivider` engine operation that handles spanners, dual-dimension reshaping, multi-neighbor gap-fill, and clean rejection when min/max constraints are violated.

**Architecture:** A single new pure function `resizeDivider(layout, claimerId, victimId, newBoundary)` in `bento-engine.ts` replaces both `adjustDivider` and `adjustVerticalDivider`. It claims cells from the victim, reshapes the victim to the largest valid remaining rectangle, fills any freed cells by growing adjacent neighbors, and returns null on failure. The dashboard drag handlers are updated to call the new function with an absolute grid boundary position instead of pre-computed widths/heights.

**Tech Stack:** TypeScript, React 19, Next.js 16. No new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `src/lib/bento-engine.ts` | Add `resizeDivider`; deprecate (keep but no longer call) `adjustDivider` and `adjustVerticalDivider` |
| `src/hooks/useBentoLayout.ts` | Update `handleDividerDragPreview` and `handleVerticalDividerDragPreview` to call `resizeDivider` |
| `src/components/bento/BentoDashboard.tsx` | Update both drag effects to compute `newBoundary` (absolute col/row) and pass `claimerId`/`victimId` |

No new files created. No test framework is present in this project — verification is done by running the dev server and testing in the browser.

---

## Task 1: Add `resizeDivider` to bento-engine.ts

**Files:**
- Modify: `src/lib/bento-engine.ts` (add after line 440, before `snapVerticalDivider`)

### What this function does

```
resizeDivider(layout, claimerId, victimId, newBoundary, axis)
  axis: 'horizontal' (left/right drag, newBoundary = absolute col 0-6)
      | 'vertical'   (up/down drag,   newBoundary = absolute row 0-4)
```

Steps:
1. Get positions of claimer and victim via `computeGridPositions`
2. Determine the transfer band (overlap in the perpendicular axis)
3. Compute transfer cells (cells between old boundary and newBoundary within the band)
4. Reshape claimer (grow into transfer cells)
5. Reshape victim (largest valid rectangle excluding transfer cells)
6. Find freed cells (victim old rect − transfer cells − victim new rect)
7. Fill freed cells by growing adjacent neighbors
8. Validate — return null if any violation

- [ ] **Step 1: Add the `resizeDivider` function to bento-engine.ts**

Add this entire block to `src/lib/bento-engine.ts` after the `adjustVerticalDivider` function (after line 492) and before `snapVerticalDivider`:

```ts
// ─── Unified Resize Divider ───────────────────────────────────────────────────
//
// Replaces adjustDivider + adjustVerticalDivider.
// claimerId: widget growing into new cells.
// victimId:  widget losing cells.
// newBoundary: absolute grid position of the new divider edge.
//   axis='horizontal' → newBoundary is a col (0–6), divider moves left/right.
//   axis='vertical'   → newBoundary is a row (0–4), divider moves up/down.
// Returns null if the resize is invalid (any widget violates min/max, or gaps remain).

export function resizeDivider(
  layout: BentoLayoutItem[],
  claimerId: string,
  victimId: string,
  newBoundary: number,
  axis: 'horizontal' | 'vertical'
): BentoLayoutItem[] | null {
  const { positions } = computeGridPositions(layout);
  const claimer = layout.find(it => it.i === claimerId);
  const victim  = layout.find(it => it.i === victimId);
  if (!claimer || !victim) return null;

  const posC = positions.get(claimerId);
  const posV = positions.get(victimId);
  if (!posC || !posV) return null;

  // ── Step 1: Transfer band & old boundary ─────────────────────────────────
  // For horizontal axis (left/right): band is row overlap, boundary is a col.
  // For vertical axis (up/down):      band is col overlap, boundary is a row.

  let oldBoundary: number;
  let bandStart: number;
  let bandEnd: number;   // exclusive

  if (axis === 'horizontal') {
    // Claimer is to the left or right of victim.
    // Old boundary = the col where they currently meet.
    const claimerIsLeft = posC.x + posC.w === posV.x;
    oldBoundary = claimerIsLeft ? posC.x + posC.w : posV.x + posV.w;
    bandStart = Math.max(posC.y, posV.y);
    bandEnd   = Math.min(posC.y + posC.h, posV.y + posV.h);
  } else {
    // Claimer is above or below victim.
    const claimerIsAbove = posC.y + posC.h === posV.y;
    oldBoundary = claimerIsAbove ? posC.y + posC.h : posV.y + posV.h;
    bandStart = Math.max(posC.x, posV.x);
    bandEnd   = Math.min(posC.x + posC.w, posV.x + posV.w);
  }

  if (newBoundary === oldBoundary) return layout; // no-op
  if (bandStart >= bandEnd) return null;          // no overlap band

  // ── Step 2: Reshape claimer ───────────────────────────────────────────────
  // Claimer grows by |newBoundary - oldBoundary| steps in the drag direction.

  const claimerEntry = widgetRegistry[claimer.type];
  let newClaimer = { ...claimer };

  if (axis === 'horizontal') {
    const claimerIsLeft = posC.x + posC.w === posV.x;
    if (claimerIsLeft) {
      // Claimer grows rightward: w increases
      newClaimer.w = posC.w + (newBoundary - oldBoundary);
    } else {
      // Claimer grows leftward: w increases, row/order shift handled via positions
      // We store the new width; x is derived. We need to track that claimer's
      // left edge moved: reduce order-inferred x by shrinking victim's right side.
      newClaimer.w = posC.w + (oldBoundary - newBoundary);
    }
    // Validate claimer bounds
    if (newClaimer.w < (claimerEntry?.minW ?? 2)) return null;
    if (newClaimer.w > (claimerEntry?.maxW ?? 6)) return null;
  } else {
    const claimerIsAbove = posC.y + posC.h === posV.y;
    if (claimerIsAbove) {
      // Claimer grows downward
      newClaimer.h = posC.h + (newBoundary - oldBoundary);
    } else {
      // Claimer grows upward: h increases, row decreases
      newClaimer.h = posC.h + (oldBoundary - newBoundary);
      newClaimer.row = posC.y - (oldBoundary - newBoundary);
    }
    if (newClaimer.h < (claimerEntry?.minH ?? 1)) return null;
    if (newClaimer.h > (claimerEntry?.maxH ?? 4)) return null;
    if (newClaimer.row < 0 || newClaimer.row + newClaimer.h > MAX_ROWS) return null;
  }

  // ── Step 3: Reshape victim ────────────────────────────────────────────────
  // Victim loses the strip of cells between oldBoundary and newBoundary
  // within the transfer band. Its new rectangle is the largest valid rectangle
  // within its old bounds that excludes the transfer cells.
  // Transfer cells always form a strip along one edge of victim, so the
  // remaining rectangle is deterministic.

  const victimEntry = widgetRegistry[victim.type];
  let newVictim = { ...victim };

  if (axis === 'horizontal') {
    const claimerIsLeft = posC.x + posC.w === posV.x;
    if (claimerIsLeft) {
      // Victim loses its left strip (cols oldBoundary..newBoundary in bandStart..bandEnd)
      // Victim's full column range: posV.x .. posV.x + posV.w
      // Remaining cols: newBoundary .. posV.x + posV.w
      // But the strip only covers bandStart..bandEnd rows.
      // If the strip covers ALL of victim's rows (bandStart==posV.y && bandEnd==posV.y+posV.h):
      //   victim simply shrinks in width from the left.
      // Otherwise victim shrinks in height to exclude the row band (keeps its width).
      const stripCoversAllRows = bandStart === posV.y && bandEnd === posV.y + posV.h;
      if (stripCoversAllRows) {
        const colsLost = newBoundary - oldBoundary;
        newVictim.w = posV.w - colsLost;
        // victim's left edge moves right; order stays, position shifts via width
      } else {
        // Strip only covers part of victim's rows. Victim keeps its width but
        // loses the rows in the band (shrinks height from whichever side the band is on).
        const bandIsAtTop = bandStart === posV.y;
        if (bandIsAtTop) {
          const rowsLost = bandEnd - bandStart;
          newVictim.h = posV.h - rowsLost;
          newVictim.row = posV.y + rowsLost;
        } else {
          const rowsLost = bandEnd - bandStart;
          newVictim.h = posV.h - rowsLost;
        }
      }
    } else {
      // Claimer is to the right — victim loses its right strip
      const stripCoversAllRows = bandStart === posV.y && bandEnd === posV.y + posV.h;
      if (stripCoversAllRows) {
        const colsLost = oldBoundary - newBoundary;
        newVictim.w = posV.w - colsLost;
      } else {
        const bandIsAtTop = bandStart === posV.y;
        if (bandIsAtTop) {
          const rowsLost = bandEnd - bandStart;
          newVictim.h = posV.h - rowsLost;
          newVictim.row = posV.y + rowsLost;
        } else {
          const rowsLost = bandEnd - bandStart;
          newVictim.h = posV.h - rowsLost;
        }
      }
    }

    if (newVictim.w < (victimEntry?.minW ?? 2)) return null;
    if (newVictim.w > (victimEntry?.maxW ?? 6)) return null;
    if (newVictim.h < (victimEntry?.minH ?? 1)) return null;
  } else {
    // axis === 'vertical'
    const claimerIsAbove = posC.y + posC.h === posV.y;
    if (claimerIsAbove) {
      // Victim loses its top strip (rows oldBoundary..newBoundary in bandStart..bandEnd cols)
      const stripCoversAllCols = bandStart === posV.x && bandEnd === posV.x + posV.w;
      if (stripCoversAllCols) {
        const rowsLost = newBoundary - oldBoundary;
        newVictim.h = posV.h - rowsLost;
        newVictim.row = posV.y + rowsLost;
      } else {
        // Strip covers part of victim's cols — victim shrinks in width
        const stripIsAtLeft = bandStart === posV.x;
        if (stripIsAtLeft) {
          const colsLost = bandEnd - bandStart;
          newVictim.w = posV.w - colsLost;
          // left edge shifts right — order stays, but effective x shifts
        } else {
          const colsLost = bandEnd - bandStart;
          newVictim.w = posV.w - colsLost;
        }
      }
    } else {
      // Claimer is below — victim loses its bottom strip
      const stripCoversAllCols = bandStart === posV.x && bandEnd === posV.x + posV.w;
      if (stripCoversAllCols) {
        const rowsLost = oldBoundary - newBoundary;
        newVictim.h = posV.h - rowsLost;
      } else {
        const stripIsAtLeft = bandStart === posV.x;
        if (stripIsAtLeft) {
          const colsLost = bandEnd - bandStart;
          newVictim.w = posV.w - colsLost;
        } else {
          const colsLost = bandEnd - bandStart;
          newVictim.w = posV.w - colsLost;
        }
      }
    }

    if (newVictim.h < (victimEntry?.minH ?? 1)) return null;
    if (newVictim.h > (victimEntry?.maxH ?? 4)) return null;
    if (newVictim.w < (victimEntry?.minW ?? 2)) return null;
    if (newVictim.row < 0 || newVictim.row + newVictim.h > MAX_ROWS) return null;
  }

  // ── Step 4: Build candidate layout with claimer + victim reshaped ─────────
  let candidate = layout.map(it => {
    if (it.i === claimerId) return newClaimer;
    if (it.i === victimId)  return newVictim;
    return it;
  });

  // ── Step 5: Fill freed cells ──────────────────────────────────────────────
  // Freed cells = victim's old rectangle minus transfer cells minus victim's new rectangle.
  // Build a set of freed (col, row) pairs, then grow adjacent neighbors into them.

  const freedCells: { col: number; row: number }[] = [];
  for (let r = posV.y; r < posV.y + posV.h; r++) {
    for (let c = posV.x; c < posV.x + posV.w; c++) {
      // Is this cell in the victim's new rectangle?
      const { positions: newPos } = computeGridPositions(candidate);
      const newPosV = newPos.get(victimId);
      const inNewVictim = newPosV &&
        r >= newPosV.y && r < newPosV.y + newPosV.h &&
        c >= newPosV.x && c < newPosV.x + newPosV.w;
      // Is this cell in the claimer's new rectangle?
      const newPosC = newPos.get(claimerId);
      const inNewClaimer = newPosC &&
        r >= newPosC.y && r < newPosC.y + newPosC.h &&
        c >= newPosC.x && c < newPosC.x + newPosC.w;
      if (!inNewVictim && !inNewClaimer) {
        freedCells.push({ col: c, row: r });
      }
    }
  }

  // For each freed cell, find adjacent neighbor and grow it.
  // Try all 4 directions; grow the neighbor whose edge is directly adjacent.
  let remaining = [...freedCells];
  let maxIter = 24; // prevent infinite loops
  while (remaining.length > 0 && maxIter-- > 0) {
    const { positions: curPos, grid: curGrid } = computeGridPositions(candidate);
    const before = remaining.length;

    remaining = remaining.filter(({ col, row }) => {
      // Check if already filled by a previous expansion
      if (curGrid[row]?.[col] !== null) return false;

      // Look for a neighbor in each direction
      const directions = [
        { dr: -1, dc: 0 }, // up
        { dr:  1, dc: 0 }, // down
        { dr:  0, dc: -1 }, // left
        { dr:  0, dc:  1 }, // right
      ];

      for (const { dr, dc } of directions) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= MAX_ROWS || nc < 0 || nc >= 6) continue;
        const neighborId = curGrid[nr]?.[nc];
        if (!neighborId) continue;

        const neighbor = candidate.find(it => it.i === neighborId);
        const nPos = curPos.get(neighborId);
        if (!neighbor || !nPos) continue;

        const entry = widgetRegistry[neighbor.type];

        // Grow neighbor toward the freed cell
        let grown = { ...neighbor };
        if (dr === -1) {
          // Neighbor is below freed cell → grow up
          grown.h = neighbor.h + 1;
          grown.row = neighbor.row - 1;
          if (grown.row < 0 || grown.h > (entry?.maxH ?? 4)) continue;
        } else if (dr === 1) {
          // Neighbor is above freed cell → grow down
          grown.h = neighbor.h + 1;
          if (grown.row + grown.h > MAX_ROWS || grown.h > (entry?.maxH ?? 4)) continue;
        } else if (dc === -1) {
          // Neighbor is to the right → grow left
          grown.w = neighbor.w + 1;
          if (grown.w > (entry?.maxW ?? 6)) continue;
        } else {
          // Neighbor is to the left → grow right
          grown.w = neighbor.w + 1;
          if (grown.w > (entry?.maxW ?? 6)) continue;
        }

        candidate = candidate.map(it => it.i === neighborId ? grown : it);
        return false; // cell filled
      }

      return true; // still unfilled
    });

    if (remaining.length === before) break; // no progress → reject
  }

  if (remaining.length > 0) return null; // unfilled gaps remain

  // ── Step 6: Validate ──────────────────────────────────────────────────────
  const validation = validateLayout(candidate);
  if (!validation.valid) return null;

  return candidate;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors. If errors appear, they will be in the new function — fix type issues (e.g. `posV.x` access on undefined) by adding null guards.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bento-engine.ts
git commit -m "feat(engine): add resizeDivider — unified cell-claiming resize op"
```

---

## Task 2: Update `useBentoLayout.ts` handlers

**Files:**
- Modify: `src/hooks/useBentoLayout.ts:450-474`

The two preview handlers currently take pre-computed `w0/w1` or `h0/h1`. Replace them to accept `claimerId, victimId, newBoundary, axis` and delegate directly to `resizeDivider`.

- [ ] **Step 1: Update imports in useBentoLayout.ts**

At the top of `src/hooks/useBentoLayout.ts`, the import from `bento-engine` currently includes `adjustDivider` and `adjustVerticalDivider`. Add `resizeDivider`:

```ts
import {
  findFirstFit,
  rebalanceAll,
  fillGaps,
  compactLayout,
  resolveDrop,
  resizeDivider,
  computeGridPositions,
  validateLayout,
  recoverLayout
} from '@/lib/bento-engine';
```

(Remove `adjustDivider` and `adjustVerticalDivider` from the import — they are no longer called from this file.)

- [ ] **Step 2: Replace handleDividerDragPreview**

Replace lines 450-454 in `src/hooks/useBentoLayout.ts`:

```ts
const handleDividerDragPreview = useCallback((
  claimerId: string,
  victimId: string,
  newBoundary: number
) => {
  const result = resizeDivider(layoutRef.current, claimerId, victimId, newBoundary, 'horizontal');
  if (result) setPreviewLayout(result);
}, []);
```

- [ ] **Step 3: Replace handleVerticalDividerDragPreview**

Replace lines 463-467 in `src/hooks/useBentoLayout.ts`:

```ts
const handleVerticalDividerDragPreview = useCallback((
  claimerId: string,
  victimId: string,
  newBoundary: number
) => {
  const result = resizeDivider(layoutRef.current, claimerId, victimId, newBoundary, 'vertical');
  if (result) setPreviewLayout(result);
}, []);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: errors in `BentoDashboard.tsx` (callers still pass old args) — those are fine, they'll be fixed in Task 3. Errors in `useBentoLayout.ts` itself should be zero.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useBentoLayout.ts
git commit -m "feat(layout): update divider preview handlers to use resizeDivider"
```

---

## Task 3: Update BentoDashboard.tsx drag effects

**Files:**
- Modify: `src/components/bento/BentoDashboard.tsx:218-302`

The two drag effects currently compute `w0/w1` or `h0/h1` and pass them to the old handlers. Update them to compute `newBoundary` (absolute col or row) and determine `claimerId`/`victimId` based on drag direction.

- [ ] **Step 1: Update the horizontal divider drag effect (lines 218-262)**

Replace the `onPointerMove` handler inside the `dividerDrag` useEffect with:

```ts
const onPointerMove = (e: PointerEvent) => {
  if (!gridRef.current) return;
  const rect = gridRef.current.getBoundingClientRect();
  const x = e.clientX - rect.left;

  const leftItem = realLayoutRef.current.find(it => it.i === dividerDrag.leftId);
  const rightItem = realLayoutRef.current.find(it => it.i === dividerDrag.rightId);
  if (!leftItem || !rightItem) return;

  const { positions: realPos } = computeGridPositions(realLayoutRef.current);
  const posL = realPos.get(leftItem.i);
  const posR = realPos.get(rightItem.i);
  if (!posL || !posR) return;

  // Map pixel x → absolute col (0–6), snapped to nearest integer
  const colX = (x / rect.width) * 6;
  const oldBoundary = posL.x + posL.w; // current col where they meet
  const rawBoundary = Math.round(colX);
  const newBoundary = Math.max(1, Math.min(5, rawBoundary)); // keep within grid

  if (newBoundary === oldBoundary) return;

  // Claimer = side boundary moves toward
  const claimerId = newBoundary > oldBoundary ? rightItem.i : leftItem.i;
  const victimId  = newBoundary > oldBoundary ? leftItem.i  : rightItem.i;

  handleDividerDragPreview(claimerId, victimId, newBoundary);
};
```

- [ ] **Step 2: Update the vertical divider drag effect (lines 264-302)**

Replace the `onPointerMove` handler inside the `verticalDividerDrag` useEffect with:

```ts
const onPointerMove = (e: PointerEvent) => {
  if (!gridRef.current) return;
  const rect = gridRef.current.getBoundingClientRect();
  const y = e.clientY - rect.top;

  const topWidget    = realLayoutRef.current.find(it => it.i === verticalDividerDrag.topId);
  const bottomWidget = realLayoutRef.current.find(it => it.i === verticalDividerDrag.bottomId);
  if (!topWidget || !bottomWidget) return;

  const { positions: realPos } = computeGridPositions(realLayoutRef.current);
  const posT = realPos.get(topWidget.i);
  const posB = realPos.get(bottomWidget.i);
  if (!posT || !posB) return;

  // Map pixel y → absolute row (0–4), snapped to nearest integer
  const rowY = (y / rect.height) * MAX_ROWS;
  const oldBoundary = posT.y + posT.h; // current row where they meet
  const newBoundary = Math.max(1, Math.min(MAX_ROWS - 1, Math.round(rowY)));

  if (newBoundary === oldBoundary) return;

  // Claimer = side boundary moves toward
  const claimerId = newBoundary < oldBoundary ? bottomWidget.i : topWidget.i;
  const victimId  = newBoundary < oldBoundary ? topWidget.i    : bottomWidget.i;

  handleVerticalDividerDragPreview(claimerId, victimId, newBoundary);
};
```

- [ ] **Step 3: Remove unused snapDivider import if no longer used**

Check top of `BentoDashboard.tsx` — if `snapDivider` and `snapVerticalDivider` are no longer called anywhere in the file, remove them from the import:

```ts
import { computeGridPositions } from '@/lib/bento-engine';
```

(Keep any others still used.)

- [ ] **Step 4: Verify TypeScript compiles with zero errors**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/bento/BentoDashboard.tsx
git commit -m "feat(dashboard): update divider drag effects to use resizeDivider boundary model"
```

---

## Task 4: Manual browser verification

Start the dev server and test all 7 diagram cases in the browser. Use the default `dashboard` layout (clock + smart-tasks + shortcuts + recent + all-files).

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:3000`, navigate to the dashboard, click "Edit Layout".

- [ ] **Step 2: Verify Diagram 1 — vertical divider drag (C grows up by stealing from A's width)**

In a layout where smart-tasks (wide, row 0) is above recent+all-files (row 1+), drag the horizontal divider between smart-tasks and recent/all-files upward.

Expected: smart-tasks shrinks in height, recent/all-files grow upward. No gaps. Snap back if would violate minH.

- [ ] **Step 3: Verify Diagram 4 — vertical-line divider drag (B grows left, D shrinks height)**

In a layout where shortcuts (tall, h=3, col 0-1) is left of recent (col 2-3, row 1+), drag the vertical divider between shortcuts and recent leftward.

Expected: recent grows leftward into shortcuts' column band, shortcuts loses its lower rows. No gaps.

- [ ] **Step 4: Verify "Not Possible" rejection**

Attempt a drag that would require a widget to go below its minW (e.g., drag a divider past a widget that is already at minW=2). Expected: divider snaps back, no layout change committed.

- [ ] **Step 5: Verify regression — existing simple divider drag still works**

Drag a horizontal divider between two same-height widgets (e.g., recent ↔ all-files). Expected: widths redistribute as before, both widgets stay valid.

- [ ] **Step 6: Commit if all checks pass**

```bash
git add -A
git commit -m "verified: resizeDivider browser tests pass"
```

---

## Task 5: Clean up deprecated functions

Only do this after Task 4 passes.

**Files:**
- Modify: `src/lib/bento-engine.ts` (remove `adjustDivider` and `adjustVerticalDivider` if no longer called anywhere)

- [ ] **Step 1: Check for remaining callers**

```bash
grep -r "adjustDivider\|adjustVerticalDivider" src/
```

Expected: zero results (both removed from useBentoLayout.ts in Task 2).

- [ ] **Step 2: Remove the two functions from bento-engine.ts**

Delete the `adjustDivider` function (lines ~425-440) and `adjustVerticalDivider` function (lines ~442-492) from `src/lib/bento-engine.ts`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bento-engine.ts
git commit -m "chore(engine): remove deprecated adjustDivider and adjustVerticalDivider"
```
