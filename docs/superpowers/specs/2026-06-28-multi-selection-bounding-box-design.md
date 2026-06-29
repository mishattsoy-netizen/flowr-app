# Multi-Selection Unified Bounding Box

**Date:** 2026-06-28
**Status:** Approved for implementation

## Problem

When multiple canvas items (blocks, shapes, arrows) are selected and dragged, only the actively-dragged item retains its selection highlight effect. The other selected items lose visual selection feedback. Additionally, there is no unified bounding box around multi-selected items — each item shows its own individual blue border, creating visual noise and lacking the Figma-like group-selection experience.

## Goals

- Show a single unified bounding box with blue border around all selected items when ≥2 items are selected
- Replace per-item individual selection borders with the unified box during multi-selection
- The unified bounding box stays visible during drag, moving with the group
- Show 8 resize handles (corners + edges) on the unified box for group resize
- Group resize scales all selected items proportionally within the bounding box
- Single-item selection behavior unchanged (current per-item border retained)

## Non-Goals

- Changing how individual items are selected (click, shift-click, drag-select remain the same)
- Changing the underlying drag mechanism (useDrag/activeDragOffsets)
- Adding selection visuals for shapes/arrows that currently lack them (the unified box naturally provides this for multi-selection)
- Group operations beyond resize (rotation, flipping, etc. are separate concerns)

## Architecture

### High-Level Design

A new `MultiSelectionBox` component renders inside `canvas-viewport-content` in `CanvasPage.tsx` when 2+ items are selected. During drag, its position is updated via direct DOM manipulation (same technique used by block dragging) by reading from the `activeDragOffsets` zustand store.

### Component Tree Changes

```
CanvasPage (canvas-viewport-content)
  ├── CanvasConnections
  ├── CanvasShapeLayer (SVG shapes)      → no suppression needed (no existing selection visual)
  ├── MultiSelectionBox (NEW)            → unified bounding box + 8 ResizeHandles
  ├── ... existing blocks ...
  ├── CanvasBlock (HTML blocks)          → suppress individual border when multi-selected
  └── VectorPath (arrows as SVG)         → suppress individual portal overlay when multi-selected
```

### Data Flow

```
User selects 2+ items
  → selectedIds Set size > 1
  → selectionBoundingBox computed from selectedBlocks
  → MultiSelectionBox renders at boundingBox position

User drags one selected item
  → useDrag creates activeDragOffsets entries for ALL selected items
  → useDragState subscription fires
  → MultiSelectionBox DOM element gets translate(dx, dy) applied directly
  → No React re-renders during drag

User releases drag
  → useDrag commits final positions to store
  → activeDragOffsets are cleared
  → React re-renders MultiSelectionBox at committed position

User drags a resize handle on MultiSelectionBox
  → CanvasPage's group resize handler captures initial positions
  → During move: scale all blocks proportionally, update DOM directly
  → On pointer up: commit batch update via updateCanvasBlocks
```

## Detailed Component Design

### 1. MultiSelectionBox Component

Rendered inside `canvas-viewport-content` div in CanvasPage.

**Props:**
```typescript
interface MultiSelectionBoxProps {
  boundingBox: { x: number; y: number; w: number; h: number } | null;
  selectedCount: number;
  onResizeStart: (handle: HandlePosition, e: React.PointerEvent) => void;
}
```

**Rendering:**
- Only renders when `selectedCount >= 2` and `boundingBox` is non-null
- Absolutely positioned div at canvas coordinates: `left: box.x, top: box.y, width: box.w, height: box.h`
- Contains:
  - Blue border div: `border-2 border-brand-blue` (inset)
  - 8 `ResizeHandle` components positioned at corners/edges
- The div has `id="multi-selection-box"` for drag-time DOM lookups
- z-index: 2999 (above blocks at 10/1000, below snap guides at 5000)

### 2. Drag Tracking Implementation

In `CanvasPage.tsx`:

```typescript
// Subscribe to activeDragOffsets for live bounding box positioning
useEffect(() => {
  const unsub = useDragState.subscribe((state) => {
    const keys = Object.keys(state.offsets);
    const boxEl = document.getElementById('multi-selection-box');
    if (!boxEl) return;
    
    if (keys.length > 0) {
      const offset = state.offsets[keys[0]];
      const dx = offset.dx || 0;
      const dy = offset.dy || 0;
      boxEl.style.transform = (dx || dy) ? `translate(${dx}px, ${dy}px)` : '';
    } else {
      boxEl.style.transform = '';
    }
  });
  return unsub;
}, []);
```

This works because:
- `useDrag` sets `activeDragOffsets` for every dragged item on every pointermove
- All items in a multi-drag share the same `dx`/`dy`
- DOM writes are cheap and don't trigger React re-renders

### 3. Per-Block Selection Suppression

#### CanvasBlock.tsx (line 617)

Current:
```tsx
{(isSelected || isDraggingLocal || isResizing || showMenu) && (
```
New:
```tsx
{((isSelected && (!selectedIds || selectedIds.size <= 1)) || isDraggingLocal || isResizing || showMenu) && (
```

When multi-selected, individual blocks still keep:
- `isDraggingLocal` for the actively dragged block's opacity/z-index
- The resize handles (they only show when single-selected anyway via existing logic)
- Hover outline (separate condition at line 578, unchanged)

#### VectorPath.tsx (line 366)

Current:
```tsx
{selected && !editing && bounds && viewportContent && createPortal(
```
New:
```tsx
{selected && showIndividualSelection && !editing && bounds && viewportContent && createPortal(
```

A new `showIndividualSelection` prop is added to `VectorPathProps`:
```typescript
showIndividualSelection?: boolean;
```

Passed from both CanvasPage and CanvasConnections:
```tsx
showIndividualSelection={selectedIds.size <= 1}
```

### 4. Group Resize

Located in `CanvasPage.tsx` as a handler similar to CanvasBlock's `handleResizeStart`.

**Capture phase (on pointer down):**
- Store initial bounding box dimensions
- Capture initial positions/sizes/points of ALL selected blocks

**Move phase (every pointermove):**
- Compute new bounding box dimensions from handle delta
- Compute scale factors: `scaleX = newW / initW`, `scaleY = newH / initH`
- For each block:
  - If points-based (arrow): scale each point relative to bounding box origin
  - If position-based (HTML/SVG): compute new x, y, width, height
- Update DOM elements directly via cached element refs

**Commit phase (on pointer up):**
- Call `updateCanvasBlocks` with batch of all final positions
- Call `onCommit()` for history

**Scale formula:**
```
// For a block at (bx, by) with size (bw, bh) within box (box.x, box.y, box.w, box.h):
relX = (bx - box.x) / box.w
relY = (by - box.y) / box.h
relW = bw / box.w
relH = bh / box.h

newBx = newBox.x + relX * newBox.w
newBy = newBox.y + relY * newBox.h
newBw = relW * newBox.w
newBh = relH * newBox.h
```

**Clamping:**
- Minimum block width: 10px
- Minimum block height: 10px
- Minimum bounding box: 60x40

### 5. Changed Files

| File | Type of Change |
|------|---------------|
| `src/components/canvas/CanvasPage.tsx` | Add MultiSelectionBox rendering, drag subscription effect, group resize handler |
| `src/components/canvas/CanvasBlock.tsx` | Modify selection border condition (line 617) |
| `src/components/canvas/edges/VectorPath.tsx` | Add `showIndividualSelection` prop, modify portal condition (line 366) |
| `src/components/canvas/CanvasConnections.tsx` | Pass `showIndividualSelection` to VectorPath |
| (new inline or separate) | MultiSelectionBox component |

No changes to:
- `useDrag.ts` — drag mechanism is unaffected
- `canvasDragState.ts` — shared state used as-is
- `CanvasShapeLayer.tsx` — no individual selection visual to suppress

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| 1 item selected | Current per-item border shows; MultiSelectionBox not rendered |
| 0 items selected | Neither individual borders nor bounding box rendered |
| Mix of types (HTML + SVG + arrows) selected | All suppressed, unified box encompasses all types |
| Drag initiated on non-primary selected item | Box updates during drag via activeDragOffsets subscription |
| Shift+click to deselect mid-drag | Not supported during drag (handled by useDrag lifecycle) |
| Group resize with arrows with points | Points scaled relative to bounding box origin |
| Group resize with minimum size hit | Clamped to minimums; blocks don't go below their mins |

## Verification

1. **Basic multi-selection**: Select 2+ blocks → see unified bounding box, no individual borders
2. **Multi-drag**: Drag selected group → bounding box follows, all items move together
3. **Single selection**: Click one item → individual blue border (current behavior preserved)
4. **Group resize**: Drag corner handle of unified box → all items scale proportionally
5. **Mixed types**: Select HTML block + SVG shape + arrow → unified box encompasses all
6. **Drag-select**: Use rectangle selection to multi-select → unified box appears
7. **Keyboard commands**: Delete/duplicate/align work on multi-selected group
