---
name: Click-and-Flow Path Drawing System
description: Design for a multi-segment, spline-based arrow system with proximity-aware handles.
type: design-spec
date: 2026-05-09
---

# Design Spec: Click-and-Flow Path Drawing System

## 1. Overview
The "Click-and-Flow" system transforms the arrow tool from a simple point-to-point connector into a professional path-drawing tool. Users can create multi-segment curved arrows by clicking a sequence of points, with the path smoothly interpolating between them using a Catmull-Rom spline.

## 2. Data Model

### 2.1 EditorBlock Evolution
The `EditorBlock` for connections will move from a rigid `fromId`/`toId` model to a point-based model.

- **Primary Storage**: `pathPoints: [number, number][]` — An ordered array of coordinates defining the path vertices.
- **Metadata**: 
  - `fromId?: string`: The ID of the shape snapped at the start point.
  - `toId?: string`: The ID of the shape snapped at the end point.
  - `fromSide`/`toSide`: Retained for initial snapping logic.

### 2.2 Transient State (The "Flow" State)
To avoid polluting the main Zustand store with high-frequency mouse movements, a local `useFlowState` hook will manage the active drawing session:
- `isDrawing`: Boolean indicating if a path is currently being created.
- `currentPath`: `[number, number][]` — Points pinned by the user.
- `mousePosition`: `{ x: number, y: number }` — The current cursor position for the final, unpinned segment.

## 3. Interaction Design

### 3.1 Proximity-Aware Handles ("Ghost" Handles)
- **Behavior**: Handles are invisible by default.
- **Trigger**: When the cursor is within a 30px radius of any shape handle, that handle fades in (opacity $0 \rightarrow 1$) with a subtle glow.
- **Scope**: Global. Any handle on any shape will trigger this if the cursor is nearby.

### 3.2 The Drawing Sequence
1. **Origin (Point A)**: First click sets the start point. If clicking a "ghost" handle, the path snaps exactly to that handle.
2. **The Flow**: A preview line is rendered from the current path points to the mouse cursor.
3. **Vertex Pinning (Point B...N)**: Subsequent clicks add points to the `currentPath`. The line continues to flow from the last pinned point toward the mouse.
4. **Commitment**: The path is finalized and saved to the store upon:
   - `Right-Click`
   - `Enter` key
   - `Escape` key

## 4. Technical Implementation

### 4.1 Geometry: Catmull-Rom Splines
To achieve smooth curves without jagged corners:
- **Algorithm**: The system will implement a Catmull-Rom spline interpolation.
- **SVG Translation**: Since SVG paths use Cubic Beziers, the spline will be converted into a series of `C` (cubic bezier) commands.
- **Continuity**: Tangents will be calculated at each vertex to ensure $C^1$ continuity.

### 4.2 Rendering Performance
- **Layering**: `FlowPreview` will be rendered in a dedicated high-z-index SVG overlay to avoid triggering expensive re-renders of the entire canvas.
- **Update Cycle**: The preview path `d` attribute will be updated via a high-frequency loop (requestAnimationFrame) linked to `mousePosition`.
- **Simplification**: Points closer than 2px will be automatically merged during the drawing process to prevent spline artifacts.

## 5. Success Criteria
- [ ] Handles fade in smoothly based on proximity.
- [ ] Path allows infinite segments (A $\rightarrow$ B $\rightarrow$ C $\dots$).
- [ ] The resulting curve is a smooth spline, not a polyline.
- [ ] Arrowhead rotates in real-time to follow the mouse during "Flow".
- [ ] Right-click/Enter/Esc correctly commits the path to the store.
- [ ] Performance remains fluid (60fps) during path preview.
