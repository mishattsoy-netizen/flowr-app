# PLAN: Figma-Like Frame & Group Tools for Flowr Canvas

> Status: READY TO IMPLEMENT  
> Created: 2026-06-29  
> Feature: Frame tool, Group tool, Auto Layout, Style Panel integration  
> Replaces: `section` block type  

---

## Overview

Replace the existing `section` block with two first-class canvas primitives that work together as a unified ecosystem — exactly like Figma.

| Primitive | How it works | Data model |
|-----------|-------------|------------|
| **Frame** | A real container block with background, border, optional auto layout, clip toggle | `type: 'frame'`, full layout properties on `EditorBlock` |
| **Group** | Virtual wrapper — no parent block created; all members share a `groupId` | shared `groupId` on member blocks, bounding box computed on the fly |

---

## Task Checklist

### PHASE 1 — Data Model [`store.types.ts`]
- [ ] Add `'frame'` to `BlockType` union, keep `'section'` as deprecated alias for migration
- [ ] Add new layout types: `FrameLayoutDirection`, `FrameResizeMode`, `ChildResizeMode`
- [ ] Add auto layout fields to `EditorBlock`:
  - `autoLayout?: boolean`
  - `layoutDirection?: 'horizontal' | 'vertical' | 'grid' | 'freeform'`
  - `layoutGap?: number`
  - `layoutPaddingTop?: number`
  - `layoutPaddingRight?: number`
  - `layoutPaddingBottom?: number`
  - `layoutPaddingLeft?: number`
  - `layoutAlign?: 'start' | 'center' | 'end' | 'space-between'`
  - `layoutCrossAlign?: 'start' | 'center' | 'end' | 'stretch'`
  - `clipContent?: boolean`
  - `frameResizingH?: 'fixed' | 'hug' | 'fill'`
  - `frameResizingV?: 'fixed' | 'hug' | 'fill'`
  - `childResizingH?: 'fixed' | 'fill'`
  - `childResizingV?: 'fixed' | 'fill'`
- [ ] Add new store action signatures to `StoreState`:
  - `groupBlocks(ids: string[]): string` (returns groupId)
  - `ungroupBlocks(groupId: string): void`
  - `setFrameAutoLayout(id: string, on: boolean): void`
  - `setFrameLayoutDirection(id: string, dir: FrameLayoutDirection): void`
  - `setFrameLayoutGap(id: string, gap: number): void`
  - `setFramePadding(id: string, top: number, right: number, bottom: number, left: number): void`
  - `setFrameAlignment(id: string, align: string, crossAlign: string): void`
  - `setFrameClipContent(id: string, clip: boolean): void`
  - `setFrameResizing(id: string, h: FrameResizeMode, v: FrameResizeMode): void`
  - `setChildResizing(id: string, h: ChildResizeMode, v: ChildResizeMode): void`

---

### PHASE 2 — Layout Engine [`src/lib/frameLayout.ts`] **[NEW FILE]**
- [ ] Create `src/lib/frameLayout.ts`
- [ ] Implement `computeGroupBounds(members: EditorBlock[]): { x: number; y: number; width: number; height: number }`
  - Finds min x/y and max x+w, y+h across all member blocks
- [ ] Implement `computeAutoLayout(frame: EditorBlock, children: EditorBlock[]): EditorBlock[]`
  - Takes frame's direction, gap, padding, alignment, cross-alignment
  - Returns children with updated x/y/width/height
  - Handles: horizontal, vertical, grid, freeform modes
  - Handles: fill children (distribute remaining space), fixed children (keep size), hug (compute from content)
  - Handles: frame hug mode → returns new frame width/height too
- [ ] Implement `computeGroupSpacing(members: EditorBlock[]): number | null`
  - Returns the gap if all adjacent members have equal spacing, null otherwise
  - Used by style panel to decide whether to show spacing field

---

### PHASE 3 — Group Utilities [`src/lib/groupUtils.ts`] **[NEW FILE]**
- [ ] Create `src/lib/groupUtils.ts`
- [ ] `generateGroupId(): string`
- [ ] `groupBlocks(blocks: EditorBlock[], groupId: string): EditorBlock[]` — sets groupId on each
- [ ] `ungroupBlocks(blocks: EditorBlock[]): EditorBlock[]` — clears groupId
- [ ] `getGroupMembers(allBlocks: EditorBlock[], groupId: string): EditorBlock[]`
- [ ] `getGroupBounds(members: EditorBlock[]) → { x, y, width, height }`
- [ ] `moveGroupMembers(members: EditorBlock[], dx: number, dy: number): EditorBlock[]`

---

### PHASE 4 — Store Actions [`src/data/store.ts`]
- [ ] Add `groupBlocks(ids)` action:
  ```ts
  const groupId = generateId();
  set(s => ({ blocks: s.blocks.map(b => ids.includes(b.id) ? { ...b, groupId } : b) }));
  // persist each updated block
  return groupId;
  ```
- [ ] Add `ungroupBlocks(groupId)` action:
  ```ts
  set(s => ({ blocks: s.blocks.map(b => b.groupId === groupId ? { ...b, groupId: undefined } : b) }));
  // persist
  ```
- [ ] Add `setFrameAutoLayout(id, on)` — updates block, triggers layout recompute
- [ ] Add `setFrameLayoutDirection(id, dir)`
- [ ] Add `setFrameLayoutGap(id, gap)`
- [ ] Add `setFramePadding(id, t, r, b, l)`
- [ ] Add `setFrameAlignment(id, align, crossAlign)`
- [ ] Add `setFrameClipContent(id, clip)`
- [ ] Add `setFrameResizing(id, h, v)`
- [ ] Add `setChildResizing(id, h, v)`
- [ ] Add migration on block load: when `type === 'section'`, rewrite to `type === 'frame'`
- [ ] After any frame's children are modified (add/remove/resize), auto-trigger layout recompute if `autoLayout === true`

---

### PHASE 5 — Canvas Toolbar [`src/components/canvas/CanvasToolbar.tsx`]
- [ ] Add `'frame'` to `CanvasTool` union type (remove `'section'`)
- [ ] In `CONTENT_TOOLS`, rename:
  ```ts
  { id: 'frame', icon: <Frame .../>, shortcut: 'F', label: 'Frame' }
  ```
- [ ] Remove the old `'section'` entry

---

### PHASE 6 — Canvas Page [`src/components/canvas/CanvasPage.tsx`]

#### 6a — Keyboard Shortcuts
- [ ] `Cmd/Ctrl+G` → call `groupBlocks(Array.from(selectedIds))`; select all group members
- [ ] `Cmd/Ctrl+Shift+G` → call `ungroupBlocks(groupId)` for selected group
- [ ] Double-click on grouped block → enter group edit mode (select individual child)

#### 6b — Frame creation
- [ ] Change `activeTool === 'section'` checks to `activeTool === 'frame'`
- [ ] On frame tool drag-release: create frame block with `type: 'frame'`
- [ ] On frame creation over existing blocks: set `parentId` on blocks fully inside drawn rect

#### 6c — Drop into frame
- [ ] On drag end: if block dropped inside a frame's bounds → set `parentId = frameId`
- [ ] If dragged outside parent → clear `parentId`, convert back to canvas-absolute coords

#### 6d — Group selection behavior
- [ ] Clicking a grouped block selects entire group (all members share same `groupId`)
- [ ] Move group: move all members by same delta

#### 6e — Layout recompute trigger
- [ ] After child resize/add/remove inside auto-layout frame: run `computeAutoLayout` and batch-update children
- [ ] On `setFrameAutoLayout(id, true)`: immediately run `computeAutoLayout` to rearrange existing children

---

### PHASE 7 — Canvas Block Rendering [`src/components/canvas/CanvasBlock.tsx`]

#### 7a — Frame rendering (replaces `section`)
- [ ] Change `block.type === 'section'` to `block.type === 'frame'`
- [ ] Frame label: show above the frame on the top-left, outside the block bounds
  ```tsx
  <div className="absolute -top-6 left-0 text-[11px] font-medium text-[var(--bone-50)] select-none truncate max-w-[160px] pointer-events-none">
    {block.content || 'Frame'}
  </div>
  ```
- [ ] Apply `overflow: hidden` when `block.clipContent === true`
- [ ] Frame fill/border configurable via `canvasStyleExt`

---

### PHASE 8 — Style Panel [`src/components/canvas/CanvasStylePanel.tsx`]

#### 8a — Selection analysis helpers (computed at render start)
```ts
const isSingleFrame = selectedBlocks.length === 1 && selectedBlocks[0].type === 'frame';
const isGroupSelection = selectedBlocks.length > 1 && selectedBlocks.every(b => b.groupId && b.groupId === selectedBlocks[0].groupId);
const groupSpacing = isGroupSelection ? computeGroupSpacing(selectedBlocks) : null;
const isChildOfAutoLayoutFrame = selectedBlocks.length === 1 
  && !!selectedBlocks[0].parentId 
  && !!blocks.find(b => b.id === selectedBlocks[0].parentId)?.autoLayout;
```

#### 8b — Frame without auto layout
```
[Layout]                    [⊕ Add auto layout]
  Flow: [H] [V] [Grid] [Free]
  Freeform
  W: [790]    H: [980]
  Spacing: [64]           ← only if uniform gap across children
  [ ] Clip content
```

#### 8c — Frame with auto layout ON
```
[Auto Layout]               [— Remove]
  Flow: [H] [V] [Grid] [Free]
  Resizing
    W: [input] [Hug▾]     H: [input] [Hug▾]    [🔗]
  Alignment: [3×3 dot picker]
  Gap: [≡ input ▾]
  Padding: [□ 0]  [□ 0]   ← uniform; expandable to T/R/B/L
```

#### 8d — Child inside auto-layout frame
```
[Layout]
  W: [input] [Fixed▾]     H: [input] [Fill▾]
  ← dropdown: Fixed | Fill (Hug only for child frames)
```

#### 8e — Group selection
```
[Layout]
  Dimensions: W: [x]  H: [y]   (read-only bounding box)
  Spacing: [input]              ← only if groupSpacing !== null
```

#### 8f — New sub-components to add
- [ ] `FlowDirectionPicker` — 4 icon buttons for H/V/Grid/Freeform
- [ ] `AlignmentPicker` — 3×3 dot grid for main+cross axis alignment
- [ ] `ResizeModeDropdown` — Fixed | Hug | Fill dropdown per axis
- [ ] `PaddingControl` — single value with expand toggle for T/R/B/L

---

### PHASE 9 — Layers Panel [`src/components/canvas/CanvasLayersPanel.tsx`]
- [ ] Replace `section` icon/label with `frame`
- [ ] Add collapsible group rows for blocks sharing a `groupId`
- [ ] Group click in layers → selects all group members on canvas

---

### PHASE 10 — Migration & Cleanup
- [ ] In canvas block loading: map `type === 'section'` → `type === 'frame'`
- [ ] Update all `'section'` string literals in canvas context:
  - `CanvasPage.tsx` line 1123
  - `CanvasLayersPanel.tsx` icon map
  - `CanvasBlock.tsx` type checks
- [ ] Rename or alias `moveCanvasSection` → `moveCanvasFrame` in store
- [ ] Write history report for this feature

---

## SVG Icons for Flow Direction Buttons

```tsx
// Horizontal (row)
const HorizIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
    <rect x="1" y="3" width="4" height="8" rx="1"/>
    <rect x="9" y="3" width="4" height="8" rx="1"/>
    <line x1="5" y1="7" x2="9" y2="7" strokeDasharray="1 1"/>
  </svg>
);

// Vertical (column)
const VertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
    <rect x="3" y="1" width="8" height="4" rx="1"/>
    <rect x="3" y="9" width="8" height="4" rx="1"/>
    <line x1="7" y1="5" x2="7" y2="9" strokeDasharray="1 1"/>
  </svg>
);

// Grid (wrap)
const GridIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
    <rect x="1" y="1" width="5" height="5" rx="1"/>
    <rect x="8" y="1" width="5" height="5" rx="1"/>
    <rect x="1" y="8" width="5" height="5" rx="1"/>
    <rect x="8" y="8" width="5" height="5" rx="1"/>
  </svg>
);

// Freeform
const FreeformIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
    <rect x="1" y="1" width="5" height="4" rx="1"/>
    <rect x="8" y="3" width="5" height="6" rx="1"/>
    <rect x="2" y="8" width="4" height="5" rx="1"/>
  </svg>
);
```

---

## Implementation Order

```
Phase 1  → store.types.ts       (types only, safe)
Phase 2  → frameLayout.ts       (new file, no deps)
Phase 3  → groupUtils.ts        (new file, no deps)
Phase 4  → store.ts             (add actions + migration)
Phase 5  → CanvasToolbar.tsx    (quick rename)
Phase 6  → CanvasBlock.tsx      (update section→frame render)
Phase 7  → CanvasLayersPanel.tsx (icons + groups)
Phase 8  → CanvasPage.tsx       (shortcuts, drop, frame creation)
Phase 9  → CanvasStylePanel.tsx (layout panel — most time)
Phase 10 → migration + test
```

---

## Key Decisions

| Decision | Choice |
|----------|--------|
| `section` fate | Replaced entirely by `frame`; migrated on load |
| Group data model | Virtual (shared `groupId` only, no parent block) |
| Auto layout modes | Horizontal, Vertical, Grid, Freeform |
| Frame resize modes | Fixed, Hug, Fill (when nested) |
| Child resize modes | Fixed, Fill (Hug only for child frames) |
| Clip content | Toggle per frame in style panel |
| Auto layout activation | Immediately re-arranges children |
| Group spacing rule | 2 items OR N with uniform gaps → show; N unequal → hide |
| Multi-selection resize | Applies to all selected children that support the chosen mode |
