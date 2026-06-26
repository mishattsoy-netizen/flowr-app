# Vector Arrow System Design

## Overview

Redesign the arrow/line/freedraw system to work like Excalidraw (magnetic binding to blocks) + Figma pen tool (point editing, corner radius per point, two edit modes). Unify `type: 'connection'` and `type: 'shape'` (with `shapeKind: 'arrow'|'line'|'freedraw'`) into a single shape-based model with optional block bindings.

---

## 1. Data Model

### 1.1 Unified Block Type

All arrows/lines/freedraw are `type: 'shape'` with a `shapeKind`. No more separate `type: 'connection'`.

```ts
interface ArrowBinding {
  blockId: string;
  focus?: number;              // 0-1 on perimeter (0=top-left, clockwise). 0.5 = center of top edge
  gap?: number;                // Offset from edge in px (default ~5)
  fixedPoint?: [number, number]; // Relative coords within block for corner/edge-center snap
  fixedPointType?: 'corner' | 'edge-center' | 'free';
}

interface ArrowheadStyle {
  type: 'none' | 'triangle' | 'filled-triangle' | 'circle' | 'bar' | 'diamond';
  size?: number; // Scale factor, default 1.0
}

type EditMode = 'simple' | 'advanced';

// New fields on EditorBlock:
interface EditorBlock {
  // ...existing fields...
  startBinding?: ArrowBinding;
  endBinding?: ArrowBinding;
  keyPoints?: [number, number][];
  editMode?: EditMode;
  pointRadiuses?: number[];
  startArrowhead?: ArrowheadStyle;
  endArrowhead?: ArrowheadStyle;
}
```

### 1.2 Retained Fields

`points: [number,number][]` — full resolved path (computed from bindings + keyPoints). Used for rendering.
`canvasStyleExt` — stroke, strokeWidth, strokeStyle, cornerRadius, opacity, fill, etc. all stay.

### 1.3 Simple vs Advanced Mode

| Property | Simple | Advanced |
|----------|--------|----------|
| Default cornerRadius | Smooth (Catmull-Rom) | 20 per point |
| Edit mode: radius handles | Hidden | Visible + draggable |
| Style panel "Corner radius" | N/A | Adjusts all pointRadiuses at once |
| Toggle | Style panel button | |

---

## 2. Binding Model

### 2.1 Three Scenarios (mixable per-endpoint)

| # | Creation | Behavior |
|---|----------|----------|
| 1 | Click anywhere inside a shape | Endpoint stays at nearest perimeter point. Dot can be anywhere inside — projects to edge. |
| 2 | Click near edge | Arrow slides along edge as block moves. Small gap from block edge. |
| 3 | Click corner/edge-midpoint | Snaps to structural point. Stays there. |

### 2.2 Endpoint Resolution

- `{ blockId, focus, gap }` — projects focus (0-1 around perimeter clockwise from top-left) to an [x,y], plus gap offset
- `{ blockId, fixedPoint }` — relative [x,y] within block bounds, added to block position

### 2.3 Creating & Editing

- Arrow tool active → hover over block → magenta corner dots + edge-mid dots + inside-hover preview dot
- Click to set endpoint
- Select arrow → drag binding dot to rebind/unbind
- Shift+click while connecting → locks binding

---

## 3. Rendering

### 3.1 VectorPath component (shared, replaces SmartArrowEdge)

Used by: CanvasConnections, CanvasShapeLayer, FlowPreview

Renders:
1. Main path (Catmull-Rom for simple, advanced arcs for advanced mode)
2. Thick invisible hitbox (22px)
3. Arrowheads (SVG markers at start/end)
4. Edit overlay (waypoint dots + binding dots + radius handles)

### 3.2 Where used

| Layer | z-index | Content |
|-------|---------|---------|
| CanvasConnections | z-[5] | Arrows with bindings (under blocks) |
| CanvasShapeLayer | z-[1] | Standalone arrows/lines/freedraw |
| FlowPreview | z-[100] | Drawing preview |

---

## 4. Point Editing (DblClick → Edit Mode)

- Enter: Double-click arrow/line/freedraw
- Exit: Esc or click empty canvas
- Move waypoint: Drag dot
- Add waypoint: Click path line between existing points
- Delete waypoint: Select + Delete/Backspace
- Adjust radius: Drag radius handle from point (advanced mode only)
- Rebind: Drag binding dot to another block or empty canvas
- Visual: 6px white dots (waypoints), 6px accent dots (bindings)

---

## 5. Arrowhead Styles

6 types: none, triangle, filled-triangle, circle, bar, diamond
Per-end: startArrowhead + endArrowhead each with type + size
Style panel: dropdowns + quick presets (← → ↔ — o→)

Defaults: arrows get end=filled-triangle, start=none. Lines get none on both.

---

## 6. Migration

- `type: 'connection'` → `type: 'shape'` with computed bindings from fromId/fromSide
- `type: 'shape'` + arrow/line → add defaults (editMode=simple, arrowhead defaults)
- Run once on store init via schemaVersion bump

---

## 7. Files

| File | Change |
|------|--------|
| store.types.ts | New types (ArrowBinding, ArrowheadStyle, EditMode) + EditorBlock fields |
| store.ts | Migration + schemaVersion |
| lib/geometry/binding.ts | **NEW** — focusToPerimeter, pointToFocus, resolveBindingPosition |
| lib/geometry/splines.ts | Add calculateAdvancedPath |
| lib/geometry/resolvePoints.ts | **NEW** — compute full points from bindings + keyPoints |
| components/canvas/edges/VectorPath.tsx | **NEW** — shared vector rendering |
| components/canvas/edges/arrowheadMarkers.tsx | **NEW** — arrowhead SVG markers |
| components/canvas/edges/SmartArrowEdge.tsx | **DELETED** |
| components/canvas/CanvasConnections.tsx | Use VectorPath, filter to bound arrows |
| components/canvas/CanvasShapeLayer.tsx | Use VectorPath for arrow/line/freedraw |
| components/canvas/CanvasPage.tsx | Edit mode state, new commitFlowConnection |
| components/canvas/CanvasBlock.tsx | Corner connection dots + inside-hover |
| components/canvas/CanvasStylePanel.tsx | Arrowhead controls, Simple/Advanced toggle |
| components/canvas/FlowPreview.tsx | Minor: use shared calc |
| hooks/useDrag.ts | Binding-aware live path recalculation |
