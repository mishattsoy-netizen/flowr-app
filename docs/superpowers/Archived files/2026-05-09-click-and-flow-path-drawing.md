# Click-and-Flow Path Drawing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the arrow tool into a multi-segment, spline-based path drawing tool with proximity-aware handles.

**Architecture:** 
- **Geometry**: Catmull-Rom splines converted to Cubic Beziers for SVG rendering.
- **State**: Transient "Flow" state managed in a local hook to avoid store bloat during mouse moves; permanent paths stored as arrays of points.
- **Rendering**: High-performance SVG overlay for real-time drawing previews.

**Tech Stack:** React, Zustand, SVG, GSAP (for commit transitions).

---

## Phase 1: Foundation & Geometry

### Task 1: Update EditorBlock Types
**Files:**
- Modify: `src/data/store.types.ts`

- [ ] **Step 1: Update EditorBlock interface**
Modify `EditorBlock` to make `fromId` and `toId` optional and ensure `pathPoints` is clearly defined as the primary source for connections.
```typescript
// src/data/store.types.ts
export interface EditorBlock {
  // ... existing fields
  fromId?: string;
  toId?: string;
  pathPoints?: [number, number][]; // Primary source for multi-segment paths
  // ...
}
```
- [ ] **Step 2: Commit**
```bash
git add src/data/store.types.ts
git commit -m "type: make connection ids optional to support free-floating paths"
```

### Task 2: Implement Catmull-Rom Spline Logic
**Files:**
- Create: `src/lib/geometry/splines.ts`

- [ ] **Step 1: Write the Spline converter**
Implement a function that takes an array of points and returns an SVG path string (`d` attribute) by calculating cubic bezier control points.
```typescript
// src/lib/geometry/splines.ts
export function calculateCatmullRomPath(points: [number, number][]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;
  }

  // Add virtual points at start and end to handle boundaries
  const p = [...points];
  p.unshift([p[0][0] - (p[1][0] - p[0][0]), p[0][1] - (p[1][1] - p[0][1])]);
  p.push([p[p.length-1][0] + (p[p.length-1][0] - p[p.length-2][0]), p[p.length-1][1] + (p[p.length-1][1] - p[p.length-2][1])]);

  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
    
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    
    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0]} ${p2[1]}`;
  }
  return path;
}
```
- [ ] **Step 2: Commit**
```bash
git add src/lib/geometry/splines.ts
git commit -m "feat: implement Catmull-Rom to Cubic Bezier conversion"
```

## Phase 2: Transient State & Proximity

### Task 3: Create Flow State Hook
**Files:**
- Create: `src/hooks/useFlowState.ts`

- [ ] **Step 1: Implement hook logic**
```typescript
// src/hooks/useFlowState.ts
import { create } from 'zustand';

interface FlowState {
  isDrawing: boolean;
  currentPath: [number, number][];
  mousePosition: { x: number, y: number };
  setDrawing: (val: boolean) => void;
  addPoint: (point: [number, number]) => void;
  updateMouse: (pos: { x: number, y: number }) => void;
  clear: () => void;
}

export const useFlowState = create<FlowState>((set) => ({
  isDrawing: false,
  currentPath: [],
  mousePosition: { x: 0, y: 0 },
  setDrawing: (val) => set({ isDrawing: val }),
  addPoint: (point) => set((state) => ({ currentPath: [...state.currentPath, point] })),
  updateMouse: (pos) => set({ mousePosition: pos }),
  clear: () => set({ isDrawing: false, currentPath: [], mousePosition: { x: 0, y: 0 } }),
}));
```
- [ ] **Step 2: Commit**
```bash
git add src/hooks/useFlowState.ts
git commit -m "feat: add transient flow state hook for arrow drawing"
```

### Task 4: Proximity-Aware Handles
**Files:**
- Modify: `src/components/canvas/CanvasShapeLayer.tsx`

- [ ] **Step 1: Add distance check logic**
Implement a check that compares current mouse position to handle positions.
- [ ] **Step 2: Update handle styles**
Apply a CSS class or inline style based on the proximity (e.g., `opacity: distance < 30 ? 1 : 0`).
- [ ] **Step 3: Commit**
```bash
git add src/components/canvas/CanvasShapeLayer.tsx
git commit -m "feat: implement proximity-aware ghost handles"
```

## Phase 3: Rendering & Interaction

### Task 5: Implement FlowPreview Component
**Files:**
- Create: `src/components/canvas/FlowPreview.tsx`
- Modify: `src/components/canvas/CanvasPage.tsx`

- [ ] **Step 1: Create the preview component**
```tsx
// src/components/canvas/FlowPreview.tsx
import React from 'react';
import { useFlowState } from '@/hooks/useFlowState';
import { calculateCatmullRomPath } from '@/lib/geometry/splines';

export const FlowPreview = () => {
  const { isDrawing, currentPath, mousePosition } = useFlowState();
  if (!isDrawing) return null;

  const points = [...currentPath, [mousePosition.x, mousePosition.y] as [number, number]];
  const d = calculateCatmullRomPath(points);

  return (
    <svg className="absolute inset-0 pointer-events-none w-full h-full z-[100]">
      <path 
        d={d} 
        fill="none" 
        stroke="var(--accent)" 
        strokeWidth={2} 
        markerEnd="url(#arrowhead)" 
      />
    </svg>
  );
};
```
- [ ] **Step 2: Integrate into CanvasPage**
Add `<FlowPreview />` to the canvas render tree.
- [ ] **Step 3: Commit**
```bash
git add src/components/canvas/FlowPreview.tsx src/components/canvas/CanvasPage.tsx
git commit -m "feat: add real-time path preview layer"
```

### Task 6: Implement Click-and-Flow Logic
**Files:**
- Modify: `src/components/canvas/CanvasPage.tsx`

- [ ] **Step 1: Handle first click (Start)**
Detect tool active state. On click, `setDrawing(true)` and `addPoint([x, y])`.
- [ ] **Step 2: Handle subsequent clicks (Vertex)**
If `isDrawing`, calling `addPoint([x, y])`.
- [ ] **Step 3: Handle mouse movement**
On mouse move, call `updateMouse({ x, y })`.
- [ ] **Step 4: Implement Commit triggers**
Listen for `keydown` (Enter/Esc) and `contextmenu` (Right-Click).
```typescript
const commitPath = () => {
  const finalPath = [...currentPath, [mousePosition.x, mousePosition.y]];
  addCanvasBlock({
    type: 'connection',
    pathPoints: finalPath,
    // Logic to check if first/last points snap to existing shapes
  });
  clear();
};
```
- [ ] **Step 5: Commit**
```bash
git add src/components/canvas/CanvasPage.tsx
git commit -m "feat: implement click-and-flow interaction sequence"
```

## Phase 4: Final Integration

### Task 7: Update Permanent Connection Rendering
**Files:**
- Modify: `src/components/canvas/CanvasConnections.tsx`
- Modify: `src/components/canvas/edges/SmartArrowEdge.tsx`

- [ ] **Step 1: Update ConnectionLine to use pathPoints**
Instead of `getBezierPath({ source, target })`, use `calculateCatmullRomPath(conn.pathPoints)`.
- [ ] **Step 2: Commit**
```bash
git add src/components/canvas/CanvasConnections.tsx src/components/canvas/edges/SmartArrowEdge.tsx
git commit -m "feat: render permanent connections as multi-segment splines"
```
