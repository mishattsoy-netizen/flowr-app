# Arrow System Implementation — Handoff & Step-by-Step Plan

> **For the next agent:** Read this entire document before touching code. The previous attempt failed because of architectural mistakes and lack of verification. Follow the steps sequentially. Verify each step before moving to the next. Do NOT dispatch parallel subagents.

---

## What Went Wrong Last Time

### Bad architectural decision: `keyPoints` field

A separate `keyPoints` field was invented to distinguish "intermediate waypoints" from "resolved endpoints." This broke everything because every existing system (drag, multi-select, bounding box, duplicate, snap, persist) already worked with `points`.

**Result:** ~50 lines of patches added to 6+ files to handle `keyPoints`. Each patch introduced new bugs. None of the systems worked consistently.

### Key decision now: `points` is the single source of truth
- `points` stores the full resolved path for standalone arrows
- `points` stores intermediate waypoints for bound arrows (bindings handle endpoints)
- `resolvePoints()` combines bindings + points to produce the full display path
- No `keyPoints` field exists anywhere

### What was fixed already

| Fix | Status |
|-----|--------|
| Removed `keyPoints` field entirely | Done |
| v17 migration copies old `keyPoints` → `points` | Done |
| `VectorPath` component reads `points` | Done |
| `useDrag` translates `points` on drag | Done |
| `useCanvasMultiSelect` checks `points` for bounds | Done |
| `selectionBoundingBox` reads `points` for arrow bounds | Done |
| Selection frame + handles render in VectorPath | Done (visual only, not functional) |
| Draggable waypoints in edit mode | Partially implemented |
| Arrowhead markers (6 styles) | Done |
| FlowPreview drawing preview | Should work (untested) |
| CanvasBlock no longer renders empty divs for arrows | Done |

### Known remaining issues

1. **Selection handles are visual-only** — they have `pointerEvents: 'none'`, can't be clicked
2. **Edit mode double-click may not be wired** — `onDoubleClick` prop chain may have gaps
3. **Old blocks in localStorage without `points`** — v17 migration should fix, but verify
4. **Next.js cache** — was cleared (`.next` deleted), restart dev server

---

## Architecture Note

The canvas has this DOM structure:

```
canvasContainerRef (outer div, `overflow: hidden`)
  ├── canvas-bg (pointer events, background pattern)
  │   ├── canvas-viewport-export (transform: translate(vx,vy) scale(s))
  │   │   ├── CanvasConnections SVG (z-[5]) — bound arrows only
  │   │   ├── CanvasShapeLayer SVG (z-[1]) — rect/ellipse/diamond shapes only
  │   │   ├── FlowPreview SVG (z-[100]) — drawing preview
  │   │   └── multiSelect SVG (z-[4999])
  │   │
  │   ├── Standalone Arrows SVG (zIndex: 10, own viewport transform)
  │   │   └── VectorPath for arrows with NO bindings
  │   │
  │   └── CanvasBlock divs (z-[10]) — text/image/section/comment blocks
```

**Important:** `canvas-viewport-export` has `transform` which creates a new stacking context. SVG layers inside it (z-[1], z-[5]) don't compete with CanvasBlock divs outside (z-[10]). That's why standalone arrows have their OWN SVG layer outside viewport-export at `zIndex: 10`.

**Block types for arrows:**
- `type: 'shape'` + `shapeKind: 'arrow'|'line'|'freedraw'`
- If it has `startBinding` or `endBinding` → bound (renders in CanvasConnections SVG, endpoints follow blocks)
- If no bindings → standalone (renders in standalone arrows SVG, can be dragged)

---

## Pre-Flight Checklist

Before starting Step 1, verify the environment is clean:

```powershell
# 1. No keyPoints references remain
rg "keyPoints" src/
# Expected: 0 results

# 2. SmartArrowEdge is deleted
rg "SmartArrowEdge" src/
# Expected: 0 results

# 3. TypeScript compiles
npx tsc --noEmit
# Expected: clean output

# 4. Clear Next.js cache
rm -rf .next

# 5. Check current git state
git log --oneline -3
# Latest commits should be:
# - de8fdfd docs: add Step 7.5 per-point corner radius editing
# - 5695fe2 docs: detailed step-by-step handoff plan
# - b862f27 fix: v17 migration copies legacy keyPoints into points
```

---

## Step-by-Step Implementation Plan

**CRITICAL RULES:**
- Execute one step at a time
- Verify the step works BEFORE moving to the next
- Do NOT create new fields on EditorBlock — use `points` for all path data
- Do NOT dispatch parallel subagents — one focused agent per step
- After each step, verify with: `npx tsc --noEmit` (clean compile) + manual browser test
- Commit after each successful step

---

### Step 1: Verify Arrow Renders from Store Data

**Goal:** An arrow block stored in Zustand renders correctly. No empty boxes, right position, visible path, arrowheads.

**Files to check:**
- `src/components/canvas/edges/VectorPath.tsx` — the main rendering component
- `src/components/canvas/CanvasConnections.tsx` — bound arrows layer (z-[5] inside viewport)
- `src/components/canvas/CanvasPage.tsx` (line ~866) — standalone arrows SVG (z-[10] outside viewport)
- `src/lib/geometry/resolvePoints.ts` — combines bindings + points
- `src/lib/geometry/binding.ts` — binding position math

**What to do:**

1. **Create a test arrow block** by adding one to the default state in `store.ts`:
```ts
blocks: [
  { id: 'b1', type: 'text', content: 'Explore unified navigation.', x: 100, y: 100, canvasId: 'cv1' },
  // Standalone arrow
  { id: 'test-arrow', type: 'shape', shapeKind: 'arrow', canvasId: 'cv1',
    points: [[200, 200], [350, 250], [500, 200]],
    editMode: 'simple',
    startArrowhead: { type: 'filled-triangle', size: 1 },
    endArrowhead: { type: 'filled-triangle', size: 1 },
    canvasStyleExt: { stroke: '#d38f36', strokeWidth: 2, strokeStyle: 'solid', fill: 'transparent', fillOpacity: 0 },
  },
  // Bound arrow (connects b1 to a second text block)
  { id: 'test-text-2', type: 'text', content: 'Second block', x: 600, y: 100, canvasId: 'cv1' },
  { id: 'test-bound-arrow', type: 'shape', shapeKind: 'arrow', canvasId: 'cv1',
    points: [[100, 180]],  // intermediate points only (endpoints from bindings)
    startBinding: { blockId: 'b1' },
    endBinding: { blockId: 'test-text-2' },
    editMode: 'simple',
    startArrowhead: { type: 'filled-triangle', size: 1 },
    endArrowhead: { type: 'filled-triangle', size: 1 },
    canvasStyleExt: { stroke: '#5b9cf6', strokeWidth: 2, strokeStyle: 'solid' },
  },
]
```

2. **Verify the test arrows render:**
   - Standalone arrow: path visible at (200,200) → (350,250) → (500,200), arrowhead at end
   - Bound arrow: path from b1 (100,100 area) to test-text-2 (600,100 area), endpoints attached to blocks
   - No empty HTML boxes next to arrows (CanvasBlock filter excludes shape arrows)
   - Can click hitbox (22px invisible stroke) — selected state changes
   - Bound arrow endpoints compute from bindings even though blocks have default positions

3. **Check z-index:**
   - Standalone arrow (no bindings) → standalone SVG layer at zIndex: 10 (outside viewport)
   - Bound arrow (has bindings) → CanvasConnections SVG at z-[5] (inside viewport)
   - Neither hidden under text blocks

4. **Check `resolvePoints` works for both cases:**
   - Standalone: `resolvePoints(block, allBlocks)` → returns `block.points` directly (no bindings)
   - Bound: `resolvePoints(block, allBlocks)` → returns `[resolvedStart, ...points, resolvedEnd]` (bindings resolved)
   - Legacy: old connection blocks with `fromId`/`toId` but no bindings → `legacyEndpoint` handles them

5. **Remove ALL test blocks** after verification (restore original default state).

**Verify:** Open canvas page → colorful arrow visible → no empty box → can click → arrow highlights blue

**Then delete test data and commit.**

---

### Step 2: Arrow Drawing Flow

**Goal:** Click-canvas-to-draw works end-to-end: waypoints place correctly, live preview follows mouse, Enter/right-click commits, arrow appears.

**Files to check:**
- `src/components/canvas/CanvasPage.tsx` — `handleBgPointerDown`, `commitFlowConnection`, `screenToCanvas`
- `src/hooks/useFlowState.ts` — drawing state (`isDrawing`, `currentPath`, `mousePosition`)
- `src/components/canvas/FlowPreview.tsx` — live preview rendering
- `src/lib/geometry/splines.ts` — Catmull-Rom path calculation

**What to verify/fix:**

1. **Tool selection routes to flow drawing:**
   - Line ~560: `if ((activeTool === 'arrow' || activeTool === 'line') && e.button === 0)` must fire
   - Must NOT be blocked by hitbox passthrough (`isDrawingTool` condition in VectorPath)
   - Verify `screenToCanvas` returns correct coordinates (not 0,0 fallback)

2. **First click starts drawing:**
   - `setDrawing(true)` + `addPoint([x, y])` + `updateMouse({ x, y })` all called
   - `mousePosition` updated immediately so preview doesn't show line from (0,0)

3. **Live preview follows mouse:**
   - `handleGlobalMove` (line ~345) updates `mousePosition` on every mousemove
   - `FlowPreview` subscribes to `useFlowState()` and renders Catmull-Rom path from `[...currentPath, mousePosition]`

4. **Subsequent clicks add waypoints:**
   - Each click calls `addPoint([x, y])` + `updateMouse({ x, y })`
   - Preview path grows to include all waypoints + mouse position

5. **Commit creates visible arrow:**
   - Enter key / right-click calls `commitFlowConnection()`
   - Block created with `type: 'shape'`, `shapeKind: tool`, `points: waypoints`
   - `canvasStyleExt` set to visible colors
   - `startArrowhead`/`endArrowhead` set
   - New block appears in store → re-renders via VectorPath

6. **Debug coordinate issues:**
   - If waypoints appear at wrong position: check `screenToCanvas` uses correct `viewportRef` and `canvasContainerRef`
   - If preview line from top-left: check `mousePosition` is set after first `addPoint`
   - Check browser console for errors (React error boundary, null refs)

7. **Connection dots on blocks also start drawing:**
   - When arrow tool active, CanvasBlock shows 8 dots (corner + edge-mid)
   - Clicking a dot calls `onConnectStart(side, x, y)` → same flow as clicking empty canvas
   - Verify clicking a block dot starts drawing from that exact point on the block edge

**Verify:** Select arrow tool → click 3+ points on canvas → preview line follows mouse between clicks → press Enter → arrow appears at clicked positions → switch to select tool (V) → arrow is selectable

**Commit after verification.**

---

### Step 3: Arrow Drag + Multi-Select

**Goal:** Arrows can be dragged with smooth live feedback. Multi-select rectangle picks up arrows.

**Files to check:**
- `src/hooks/useDrag.ts` — drag logic, `startDrag`, batch updates
- `src/components/canvas/CanvasPage.tsx` — `useDrag` hook for standalone arrows, `handleArrowDrag`

**What to verify/fix:**

1. **Drag on standalone arrows:**
   - `useDrag` hook instantiated in CanvasPage (line ~88) for standalone arrows SVG
   - `handleArrowDrag` calls `startDrag(e, block)` on pointerdown
   - `onDragStart` prop wired from standalone SVG VectorPath → `handleArrowDrag`
   - `snapshot` captures `b.points` (deep clone via JSON)
   - During drag: DOM-level `translate3d` applied to `<g id={block.id}>`
   - After drag: batch update translates `snap.points` by finalDX/finalDY
   - `updateCanvasBlocks` writes new `points` to store → VectorPath re-renders

2. **Check DOM element for live translation:**
   - VectorPath's `<g>` has `id={block.id}`
   - `useDrag` queries `document.querySelectorAll('[id="${id}"]')` — must find the `<g>`
   - `applyTransform()` applies `el.style.transform = translate3d(dx, dy, 0)` during drag
   - After drop: transform cleared, `points` updated in store

3. **Multi-select + group drag:**
   - `useCanvasMultiSelect` computes bounds from `b.points`
   - Selection rectangle over arrow → arrow gets selected
   - Already implemented, just verify it works

4. **Duplicate arrow:**
   - `handleDuplicateSelection` clones blocks and offsets by +20
   - Must translate `points` by +20 (line ~186 in CanvasPage: `copy.points = b.points.map(p => [p[0] + 20, p[1] + 20])`)
   - Verify duplicate arrow renders correctly offset

5. **Undo/Redo:**
   - `history.push()` stores full block snapshot on each operation
   - Verify: drag arrow → undo → arrow returns to original position
   - Verify: draw arrow → undo → arrow removed

**Verify:** Select arrow → drag it smoothly → arrow moves with mouse → release → arrow stays at new position → multi-select rectangle over arrow → arrow selected → can drag group → duplicate (Ctrl+D) → copy appears offset → undo (Ctrl+Z) → copy removed → redo → copy returns

**Commit after verification.**

---

### Step 4: Selection Feedback

**Goal:** Selected arrows show: blue dashed bounding frame, 8 resize handles, rotation line+dot, waypoint dots.

**Files to check:**
- `src/components/canvas/edges/VectorPath.tsx` — selection frame + handles rendering
- `src/components/canvas/CanvasPage.tsx` — `selectionBoundingBox`, floating toolbar

**What to verify/fix:**

1. **Bounding box for floating toolbar:**
   - `selectionBoundingBox` (line ~174) uses `b.points` for arrow bounds
   - Floating toolbar appears above selection when `showFloatingToolbar && activeTool === 'select'`
   - Buttons: duplicate, delete, bring forward/back, align
   - All buttons should work on arrow blocks

2. **VectorPath selection frame:**
   - Already renders dashed rect + 8 handles + rotation line/dot when `selected`
   - **Note:** Handles have `pointerEvents: 'none'` — they're visual-only in this step
   - Frame should encompass ALL points in `resolvedPts` with 6px padding

3. **Waypoint dots when selected:**
   - Already renders dim white dots for each point in `block.points`
   - Waypoints show when selected but NOT in edit mode (dim black circles)
   - After step 6 (edit mode), they become full-brightness draggable dots

**Verify:** Click arrow → blue dashed frame appears around all points → 8 white square handles at corners/edges → rotation line+circle above → waypoint dots on path → floating toolbar above selection → duplicate/delete work

**Commit after verification.**

---

### Step 5: Block Binding (Excalidraw-Style Connection)

**Goal:** Arrows can connect to blocks during drawing, and stay attached when blocks move.

**Files to check:**
- `src/components/canvas/CanvasPage.tsx` — `findClosestBlockHandle`, `commitFlowConnection`
- `src/lib/geometry/resolvePoints.ts` — `resolvePoints` combines bindings + points
- `src/lib/geometry/binding.ts` — `focusToPerimeter`, `resolveBindingPosition`
- `src/hooks/useDrag.ts` — live connection path recalculation during drag

**What to do:**

1. **Drawing snaps to blocks:**
   - `findClosestBlockHandle` detects nearest block within 120px of click
   - Currently skips `connection` and `arrow/line/freedraw shape` blocks (correct — don't snap to arrows)
   - Returns `{ id, side }` for the nearest block

2. **commitFlowConnection creates bindings:**
   - `startBinding: { blockId: snap.id }` when start point near a block
   - `endBinding: { blockId: snap.id }` when end point near a block
   - `points` = intermediate waypoints (endpoints handled by bindings)
   - If both ends snap → `points` = `currentPath.slice(1, -1)` (middle points only)
   - If only one end snaps → `points` includes the unsnapped endpoint

3. **resolvePoints combines bindings + points:**
   - `start = resolveBindingPosition(block.startBinding, allBlocks)` — computes canvas position from binding
   - `end = resolveBindingPosition(block.endBinding, allBlocks)`
   - Returns `[start, ...points, end]` or just `points` if no bindings
   - Legacy fallback: `legacyEndpoint(block.fromId, block.fromSide, allBlocks)` for old unmigrated connections

4. **Arrow follows block during drag:**
   - `useDrag` caches path elements with `data-start-binding`/`data-end-binding`
   - During `handlePointerMove`: if a bound block is being dragged, recompute endpoint via `focusToPerimeter`
   - This updates the DOM path `d` attribute live during drag
   - Already partially implemented in `useDrag.ts` (Task 13 code)

5. **Connection dots on blocks:**
   - `CanvasBlock.tsx` renders 8 dots (4 edge-mid + 4 corner) when arrow/line tool active
   - Clicking a dot starts flow drawing: `onConnectStart` → `setDrawing(true)` → `addPoint([x, y])`
   - This should already work (was working before)

**Verify:** Arrow tool active → connection dots appear on blocks → click dot → draw to another block → press Enter → arrow connects both blocks → drag either block → arrow endpoints follow → bindings survive

**Commit after verification.**

---

### Step 6: Edit Mode (Double-Click → Draggable Waypoints)

**Goal:** Double-click arrow enters edit mode. Waypoints become draggable. Esc/canvas-click exits.

**Files to check:**
- `src/components/canvas/CanvasPage.tsx` — `editingBlockId`, `handleDoubleClickBlock`, keyboard handler
- `src/components/canvas/edges/VectorPath.tsx` — `handleWaypointDown`, `draggingPt` state
- `src/components/canvas/CanvasConnections.tsx` — passes `onDoubleClick` to VectorPath

**What to verify/fix:**

1. **Double-click enters edit mode:**
   - VectorPath hitbox path has `onDoubleClick` handler
   - `onDoubleClick` prop chains: VectorPath → CanvasShapeLayer/CanvasConnections → CanvasPage
   - CanvasPage `handleDoubleClickBlock` sets `editingBlockId = blockId` for arrow/line/freedraw
   - `activeTool` switches to `'select'` so drawing tools don't interfere

2. **Edit mode visual:**
   - VectorPath receives `editing={true}` when `editingBlockId === block.id`
   - In edit mode: waypoint dots show as bright white circles with `pointerEvents: 'auto'` and `cursor: 'grab'`
   - Binding dots show in accent color (orange)
   - Normal selected dots (dim) are hidden in edit mode (exclusive renders)

3. **Drag waypoint to move it:**
   - `handleWaypointDown` already implemented in VectorPath
   - Attaches `pointermove`/`pointerup` handlers to document
   - On move: computes delta, updates `block.points[index]` via `updateCanvasBlock`
   - `viewportScale` prop ensures correct coordinate conversion
   - Cursor changes to `grabbing` while dragging

4. **Exit edit mode (must also clear `selectedPointIndex`):**
   - Escape key handler: `if (e.key === 'Escape') { setEditingBlockId(null); setSelectedPointIndex(null); }`
   - Canvas background click: `if (e.target === e.currentTarget) { setEditingBlockId(null); setSelectedPointIndex(null); }`
   - Switch to different tool: clear both states
   - Selecting a different arrow: clear `selectedPointIndex` before setting new `editingBlockId`

**Verify:** Double-click arrow → waypoint dots become bright + draggable → binding dots show in orange → drag a waypoint → path updates live → press Esc → edit mode exits → waypoint dots return to dim

**Commit after verification.**

---

### Step 7: Styling Controls (Arrowheads + Modes)

**Goal:** Style panel lets you change arrowhead type/size, stroke weight/color, and toggle simple/advanced edit mode.

**Files to check:**
- `src/components/canvas/CanvasStylePanel.tsx` — arrowhead controls, mode toggle

**What to verify/fix:**

1. **Check `updateBlockFields` function exists in CanvasStylePanel:**
   - Must exist alongside `updateStyle` and `updateGeom`
   - Updates top-level `EditorBlock` fields (`startArrowhead`, `endArrowhead`, `editMode`, `pointRadiuses`) via `updateCanvasBlock`
   - If missing, create it — same pattern as `updateGeom`:
   ```ts
   function updateBlockFields(patch: Partial<EditorBlock>) {
     if (hasSelection) {
       selected.forEach(b => updateCanvasBlock(b.id, patch));
     }
   }
   ```

2. **Arrowhead type/size:**
   - `CanvasStylePanel` shows "Arrowheads" section when `shapeKind === 'arrow' || shapeKind === 'line'`
   - Start/End type dropdowns already built
   - Size slider already built
   - Changes must update `block.startArrowhead`/`block.endArrowhead` via `updateBlockFields`

3. **Simple/Advanced mode toggle:**
   - Toggle in style panel for `editMode: 'simple' | 'advanced'`
   - Switching to advanced: initializes `pointRadiuses` to all 20s via `updateBlockFields`
   - Count = `ref.points?.length || 0`
   - Switching to simple: `updateBlockFields({ editMode: 'simple', pointRadiuses: undefined })`
   - VectorPath uses `isAdvanced && radiuses.length > 0` to choose `calculateAdvancedPath` vs `calculateCatmullRomPath`

4. **Stroke weight/color/style:**
   - Already handled by existing style panel code via `canvasStyleExt`
   - Verify these work on arrow shapes (should already work)

**Verify:** Select arrow → change end arrowhead to "Circle" → arrowhead changes → increase size to 2 → arrowhead grows → switch to Advanced mode → corner radius handles should appear (visual only for now)

**Commit after verification.**

---

### Step 7.5: Per-Point Corner Radius (Figma-Style)

**Goal:** In advanced edit mode, clicking a waypoint selects it. Style panel shows that point's individual corner radius. Changing it affects only that point. When no point is selected, style panel affects all points. When radii differ, show "Mixed."

**Files to check:**
- `src/components/canvas/CanvasPage.tsx` — `selectedPointIndex` state
- `src/components/canvas/edges/VectorPath.tsx` — waypoint selection + visual highlight
- `src/components/canvas/CanvasStylePanel.tsx` — per-point radius display + edit

**What to do:**

0. **Understanding `pointRadiuses` indexing:**
   - `pointRadiuses[i]` = corner radius at waypoint `i` in `block.points`
   - For bound arrows, `points` stores intermediate waypoints (NO endpoints). `pointRadiuses` indices match these.
   - For standalone arrows, `points` stores all waypoints. `pointRadiuses` indices match all.
   - The corner radius applies to the angle AT that waypoint (between incoming and outgoing segments)

1. **Add `selectedPointIndex` state to CanvasPage:**
```ts
const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
```
Clear it when `editingBlockId` changes or edit mode exits.

2. **Pass selectedPointIndex to VectorPath:**
Add `selectedPointIndex` and `onPointSelect` props to VectorPath:
```ts
selectedPointIndex?: number | null;
onPointSelect?: (index: number | null) => void;
```
Pass from CanvasPage through the standalone arrows SVG.

3. **Waypoint click selects it in VectorPath:**
- When a waypoint dot is clicked (not dragged), call `onPointSelect(index)`
- If already selected, clicking it again deselects: `onPointSelect(null)`
- Visual: selected waypoint is larger (8px), has blue border
- Other waypoints are normal (5px, white fill, stroke-color border)

5. **Update CanvasStylePanel — per-point radius logic:**
   - Read `ref.pointRadiuses` (array, same length as `ref.points`)
   - When `ref.editMode === 'advanced'`:
     - If all `pointRadiuses` are the SAME value → show that number in the Corner Radius input
     - If they DIFFER → show "Mixed" text instead of a number (disable scrubbing, only allow typing a new value)
     - Changing the value updates ALL point radiuses via `updateBlockFields({ pointRadiuses: Array(n).fill(newValue) })`
   - When `selectedPointIndex` is NOT null (a specific point is selected AND editing):
     - Show "Corner #N" label where N = selectedPointIndex + 1
     - Show only that point's radius value
     - Changing it updates ONLY `pointRadiuses[selectedPointIndex]`:
       ```ts
       const newRadii = [...(ref.pointRadiuses ?? Array(ref.points?.length ?? 0).fill(20))];
       newRadii[selectedPointIndex!] = newValue;
       updateBlockFields({ pointRadiuses: newRadii });
       ```
   - Use `updateBlockFields` to write `pointRadiuses` directly (top-level field)

6. **Radius change instant feedback:**
- `VectorPath` reads `block.pointRadiuses` for `calculateAdvancedPath`
- Changing radiuses in style panel → store update → VectorPath re-renders → curve updates live

**Verify:** Double-click arrow → toggle Advanced mode → all corners have radius 20 → click a waypoint → it highlights larger/blue → style panel shows that point's radius → change to 50 → only that corner rounds more → click empty → "Mixed" shown in panel → change to 10 → all corners update to 10

**Commit after verification.**

---

### Step 8: Final Cleanup + Integration Test

**Goal:** Remove dead code, verify the full flow end-to-end.

**What to do:**

1. **Search for dead code:**
   ```
   rg "keyPoints" src/        # Should return 0 results
   rg "SmartArrowEdge" src/   # Should return 0 results (deleted)
   ```

2. **Remove unused imports:**
   - `CanvasShapeLayer.tsx` — `VectorPath` import might be unused if removed
   - `VectorPath.tsx` — `gsap` import already removed, verify no stale imports

3. **Full integration test:**
   - Open canvas, draw an arrow with 3 waypoints ✓
   - Drag the arrow ✓
   - Multi-select the arrow ✓
   - Draw an arrow between two blocks ✓
   - Drag a block, verify arrow follows ✓
   - Double-click arrow, drag waypoints ✓
   - Change arrowhead style ✓
   - Switch to advanced mode ✓
   - Refresh page, arrow persists ✓

4. **Clear test data from store.ts if any was added.**

5. **Run `npx tsc --noEmit` — must be clean.**

**Commit final.**

---

## Key Files Reference

| File | Responsibility |
|------|---------------|
| `src/data/store.types.ts` | `EditorBlock`, `ArrowBinding`, `ArrowheadStyle` types |
| `src/data/store.ts` | Zustand store, `migrateBlock`, `addCanvasBlock`, persist config |
| `src/lib/geometry/binding.ts` | `focusToPerimeter`, `pointToFocus`, `resolveBindingPosition` |
| `src/lib/geometry/splines.ts` | `calculateCatmullRomPath`, `calculateAdvancedPath` |
| `src/lib/geometry/resolvePoints.ts` | `resolvePoints` — combines bindings + points into full path |
| `src/components/canvas/edges/VectorPath.tsx` | Core arrow rendering — path, hitbox, arrowheads, selection frame, waypoint dots, drag |
| `src/components/canvas/edges/arrowheadMarkers.tsx` | `ArrowheadMarker`, `getMarkerIds` — SVG marker definitions |
| `src/components/canvas/CanvasConnections.tsx` | Bound arrows layer (z-[5] inside viewport) |
| `src/components/canvas/CanvasShapeLayer.tsx` | Shape layer — rect/ellipse/diamond only (arrows removed) |
| `src/components/canvas/CanvasPage.tsx` | Main canvas — drawing flow, standalone arrows SVG, edit mode, drag, selection |
| `src/components/canvas/CanvasBlock.tsx` | HTML block rendering — connection dots |
| `src/components/canvas/CanvasStylePanel.tsx` | Right panel — arrowhead controls, mode toggle |
| `src/components/canvas/FlowPreview.tsx` | Live preview during arrow drawing |
| `src/hooks/useDrag.ts` | Drag system — snapshot, live DOM translation, batch update, binding recalculation |
| `src/hooks/useFlowState.ts` | Drawing state machine — `isDrawing`, `currentPath`, `mousePosition` |
| `src/hooks/useCanvasMultiSelect.ts` | Multi-select rectangle → block intersection |
| `src/components/canvas/CanvasToolbar.tsx` | Tool definitions — 'arrow' (A), 'line' (L), 'freedraw' (P) |

---

## What NOT To Do

1. **Do NOT create new fields on EditorBlock** — `points` handles all path data
2. **Do NOT dispatch parallel subagents** — tasks must be sequential with verification
3. **Do NOT skip verification** — each step must work before the next
4. **Do NOT add `keyPoints` back** — it's gone, keep it gone
5. **Do NOT change the SVG layer architecture** — standalone arrows outside viewport, bound inside
6. **Do NOT add GSAP or any animation** — removed for reliability
7. **Do NOT modify the migration without bumping version** — current version is 17
8. **Do NOT change `resolvePoints` signature** — callers depend on `(block, allBlocks) => [number,number][]`
9. **Do NOT remove `pointRadiuses` from EditorBlock** — needed for advanced mode corner radius
10. **Do NOT forget to clear `.next` cache** if changes don't appear: `rm -rf .next`
11. **Do NOT skip testing with old localStorage data** — clear it or test in incognito
