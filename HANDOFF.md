# HANDOFF — Flowr Canvas (Frame & Group Feature)

> **Date:** 2026-06-29  
> **Branch:** `main`  
> **Latest commit:** `9058df3` — "feat: column-aware task creation, frame/group auto-layout, style panel polish"  
> **Release:** 1.0.6

---

## Summary

This handoff covers the **Frame & Group** implementation on the Flowr canvas — a Figma-like system replacing the old `section` block type with first-class `frame` containers and virtual `group` wrappers. All core functionality is implemented and the most persistent bug (stuck blue highlight) is now fixed.

---

## What's Built (All Phases Complete)

| Phase | File(s) | Status |
|-------|---------|--------|
| **Phase 1** — Data model types | `store.types.ts` | ✅ |
| **Phase 2** — Layout engine | `src/lib/frameLayout.ts` | ✅ |
| **Phase 3** — Group utilities | `src/lib/groupUtils.ts` | ✅ |
| **Phase 4** — Store actions | `src/data/store.ts` | ✅ |
| **Phase 5** — Canvas toolbar | `CanvasToolbar.tsx` | ✅ |
| **Phase 6** — Canvas page (shortcuts, creation, drop, groups, layout) | `CanvasPage.tsx` | ✅ |
| **Phase 7** — Canvas block rendering (frames) | `CanvasBlock.tsx` | ✅ |
| **Phase 8** — Style panel | `CanvasStylePanel.tsx` | ✅ |
| **Phase 9** — Layers panel | `CanvasLayersPanel.tsx` | ✅ |
| **Phase 10** — Migration & cleanup | Across codebase | ✅ |

### Live features:
- **Frame tool** (F key) — drag to create frames; title label always visible, frame body shows on hover
- **Group tool** (Ctrl+G / Cmd+G) — groups selected blocks; virtual (shared `groupId`, no parent block)
- **Ungroup** (Ctrl+Shift+G / Cmd+Shift+G)
- **Drop into frame** — drag any block into a frame, it becomes a child (`parentId`)
- **Nested frames** — frames inside frames
- **Auto layout** — horizontal/vertical/grid/freeform with gap, padding, alignment controls
- **Clip content** — toggle per frame; clips only child content, not handles/labels
- **Group drag** — all members move together
- **Group drill-down** — clicking a grouped block selects it individually; clicking background clears selection
- **Multi-selection** — drag-select blue rect, unified bounding box with resize handles

---

## Recent Critical Fix: Stuck Blue Selection Border

### Root cause
`isDraggingLocal` state in `CanvasBlock.tsx` was set to `true` in `handlePointerDown` (line 127) but **never reset to `false`** after the drag/click ended. The selection border overlay (line 595) uses `isDraggingLocal` in its visibility condition, so the blue border stayed permanently visible on any block that was clicked.

### Fix applied
`src/components/canvas/CanvasBlock.tsx` line 104: wrapped the `onCommit` prop to `useDrag` to call `setIsDraggingLocal(false)` before the original callback:

```tsx
onCommit: () => {
  setIsDraggingLocal(false);
  onCommit?.();
},
```

### Symptom
"Dimmed blue bounding box without handles" persisted after selecting and deselecting blocks.

---

## Key Architecture

### Frame data model
- **Frame** = a real block with `type: 'frame'`
- Children have `parentId` pointing to the frame
- Rendered as independent sibling divs on the canvas (not DOM-nested)
- Frame label (title) always visible, frame body only on hover

### Group data model
- **Group** = virtual — no parent block
- All group members share the same `groupId` string
- Bounding box computed on the fly from member positions
- Group drag overlay handles group interaction
- Group drill-down: clicking a member when the group is fully selected selects just that member

### Block rendering (z-index stack)
- Frame blocks: `z-0` (base layer)
- Regular blocks: `z-10`  
- Selected/dragging/resizing blocks: `z-0 + 1000` = sits on top
- Selection border overlay: `z-[190]`
- Rotation handle: `z-[200]`
- Multi-select SVG rect: `z-[4999]`
- Context menu: `z-[9999]`

### Canvas coordinates
- All positions are canvas-absolute (not affected by viewport transform)
- `viewport` object (`{ x, y, scale }`) controls pan/zoom via CSS transform on the canvas container
- `screenToCanvas` / `canvasToScreen` utilities for coordinate conversion

### State management
- **Zustand** with `persist` middleware (localStorage)
- Canvas blocks stored in `blocks` array with `canvasId` to associate with a canvas entity
- Selection: React state (`selectedIds: Set<string>`) in CanvasPage, not in Zustand

---

## Known Issues & Edge Cases

1. **Frame body visibility**: Frame body (white fill, border) shows on hover via `hoveredFrameId` state — relies on pointer hit-testing in blocks above the frame. If a child block fully covers the frame area, hovering can't reach the frame body below.

2. **Double-click shape in group**: Double-clicking a shape inside a fully-selected group now returns early (doesn't enter text edit mode). The handler is in `CanvasBlock.tsx` `handleDoubleClick`.

3. **Frame inside frame drop**: Inserting a frame inside another frame works via the parentId mechanism. Extracting it back out requires dragging outside the parent bounds (which clears parentId).

---

## Files to Know

| File | Purpose |
|------|---------|
| `src/components/canvas/CanvasBlock.tsx` | Central block renderer — handles selection, drag, resize, visual overlays |
| `src/components/canvas/CanvasPage.tsx` | Canvas container — selection logic, shortcuts, frame creation, drop handling |
| `src/components/canvas/CanvasStylePanel.tsx` | Style panel with layout controls for frames/groups |
| `src/components/canvas/CanvasToolbar.tsx` | Toolbar with frame tool |
| `src/components/canvas/CanvasLayersPanel.tsx` | Layer tree with frame icons and group rows |
| `src/components/canvas/CanvasShapeLayer.tsx` | SVG shape rendering layer |
| `src/components/canvas/MultiSelectionBox.tsx` | Unified bounding box for multi-selection |
| `src/hooks/useDrag.ts` | Drag engine — handles group drag, snapping, connection updates |
| `src/hooks/useCanvasMultiSelect.ts` | Drag-to-select rectangle selection |
| `src/lib/frameLayout.ts` | Layout engine: group bounds, auto layout computation |
| `src/lib/groupUtils.ts` | Group utilities: group/ungroup, group bounds, move |
| `src/data/store.ts` | Zustand store with all canvas actions |
| `src/data/store.types.ts` | Type definitions including frame/group types |
| `PLANS/frame-group-autolayout.md` | Original implementation plan |

---

## ESLint Note

There is one persistent ESLint warning in `CanvasStylePanel.tsx`:
```
The template literal is unnecessary because the interpolation only contains a single identifier.
```
This is harmless — a template string uses a single expression (`${name}`) where a plain string would work.

---

## Next Steps / Possible Work

1. **Auto layout visual feedback** — animate children transitioning to new positions when layout changes
2. **Frame presets** — common frame sizes (Desktop, Tablet, Mobile) like Figma
3. **Frame thumbnails in layers panel** — currently shows frame icon, not a preview
4. **Group nesting** — groups inside groups (currently one level only)
5. **Performance** — canvas can get slow with 200+ blocks; virtual scrolling or visibility-based culling
6. **Keyboard** — arrow keys for nudge, Delete for removal during selection
