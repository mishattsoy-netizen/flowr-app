# Vector Arrow System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify arrow/line/freedraw into a single shape-based model with Excalidraw-style magnetic block binding and Figma-style double-click point editing.

**Architecture:** All arrows become `type: 'shape'` with optional `startBinding`/`endBinding` for block attachment. One `VectorPath` component handles rendering for both connected and standalone arrows. Paths use Catmull-Rom splines (simple mode) or per-point corner radius arcs (advanced mode). Live DOM path recalculation in `useDrag.ts` enhanced for dynamic binding resolution.

**Tech Stack:** TypeScript 5, React 19, Zustand 5, Tailwind CSS 4, SVG, GSAP

---

## Task 1: Data Model — Types & Migration

**Files:**
- Modify: `src/data/store.types.ts`
- Modify: `src/data/store.ts`

- [ ] **Step 1: Add ArrowBinding, ArrowheadStyle, EditMode types to store.types.ts**

In `src/data/store.types.ts`, add after the existing `ShapeKind` (line 84):

```ts
export interface ArrowBinding {
  blockId: string;
  focus?: number;
  gap?: number;
  fixedPoint?: [number, number];
  fixedPointType?: 'corner' | 'edge-center' | 'free';
}

export type ArrowheadType = 'none' | 'triangle' | 'filled-triangle' | 'circle' | 'bar' | 'diamond';

export interface ArrowheadStyle {
  type: ArrowheadType;
  size?: number;
}

export type EditMode = 'simple' | 'advanced';
```

Add to `EditorBlock` interface (after `points?: [number, number][]`):

```ts
  startBinding?: ArrowBinding;
  endBinding?: ArrowBinding;
  keyPoints?: [number, number][];
  editMode?: EditMode;
  pointRadiuses?: number[];
  startArrowhead?: ArrowheadStyle;
  endArrowhead?: ArrowheadStyle;
```

- [ ] **Step 2: Add migration to store.ts**

In `src/data/store.ts`, add migration helpers and update the persist config:

```ts
const CURRENT_SCHEMA_VERSION = 2;

function migrateBlock(block: EditorBlock): EditorBlock {
  if (block.type === 'shape' && (block.shapeKind === 'arrow' || block.shapeKind === 'line' || block.shapeKind === 'freedraw')) {
    if (block.editMode) return block;
    return {
      ...block,
      editMode: 'simple',
      keyPoints: block.points || [],
      startArrowhead: block.shapeKind === 'arrow' ? { type: 'filled-triangle', size: 1 } : { type: 'none' },
      endArrowhead: block.shapeKind === 'arrow' ? { type: 'filled-triangle', size: 1 } : { type: 'none' },
    };
  }

  if (block.type === 'connection') {
    const kind = block.shapeKind || 'arrow';
    return {
      ...block,
      type: 'shape' as const,
      shapeKind: kind,
      editMode: 'simple' as EditMode,
      startBinding: block.fromId ? { blockId: block.fromId } : undefined,
      endBinding: block.toId ? { blockId: block.toId } : undefined,
      keyPoints: block.points ? block.points.slice(1, -1) : [],
      startArrowhead: kind === 'arrow' ? { type: 'filled-triangle', size: 1 } : { type: 'none' },
      endArrowhead: kind === 'arrow' ? { type: 'filled-triangle', size: 1 } : { type: 'none' },
      fromId: undefined as any,
      toId: undefined as any,
      fromSide: undefined as any,
      toSide: undefined as any,
    };
  }

  return block;
}
```

Update persist config to include `version: CURRENT_SCHEMA_VERSION` and migrate function.

- [ ] **Step 3: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```powershell
git add src/data/store.types.ts src/data/store.ts
git commit -m "feat: add arrow binding types and block migration"
```

---

## Task 2: Binding Math (focusToPerimeter, pointToFocus, resolveBindingPosition)

**Files:**
- Create: `src/lib/geometry/binding.ts`

- [ ] **Step 1: Create binding.ts**

```ts
// src/lib/geometry/binding.ts
import type { ArrowBinding, EditorBlock } from '@/data/store';

interface BlockRect { x: number; y: number; width: number; height: number; }

export function focusToPerimeter(focus: number, rect: BlockRect, gap: number = 0): [number, number] {
  const { x, y, width, height } = rect;
  const perim = 2 * (width + height);
  let f = ((focus % 1) + 1) % 1;
  let dist = f * perim;

  const top = width;
  if (dist <= top) return [x + dist, gap > 0 ? y - gap : y];
  dist -= top;
  const right = height;
  if (dist <= right) return [gap > 0 ? x + width + gap : x + width, y + dist];
  dist -= right;
  if (dist <= width) return [x + width - dist, gap > 0 ? y + height + gap : y + height];
  dist -= width;
  return [gap > 0 ? x - gap : x, y + height - dist];
}

export function pointToFocus(cx: number, cy: number, rect: BlockRect): number {
  const { x, y, width, height } = rect;
  const perim = 2 * (width + height);
  
  const candidates = [
    { d: Math.abs(cy - y), pd: Math.max(x, Math.min(cx, x + width)) - x },
    { d: Math.abs(cx - (x + width)), pd: width + (Math.max(y, Math.min(cy, y + height)) - y) },
    { d: Math.abs(cy - (y + height)), pd: width + height + (x + width - Math.max(x, Math.min(cx, x + width))) },
    { d: Math.abs(cx - x), pd: 2 * width + height + (y + height - Math.max(y, Math.min(cy, y + height))) },
  ];
  const nearest = candidates.reduce((a, b) => a.d < b.d ? a : b);
  return nearest.pd / perim;
}

export function resolveBindingPosition(binding: ArrowBinding | undefined, blocks: EditorBlock[]): [number, number] | null {
  if (!binding) return null;
  const block = blocks.find(b => b.id === binding.blockId);
  if (!block) return null;
  const rect: BlockRect = { x: block.x ?? 0, y: block.y ?? 0, width: block.width ?? 280, height: block.height ?? 100 };
  if (binding.fixedPoint) return [rect.x + binding.fixedPoint[0], rect.y + binding.fixedPoint[1]];
  return focusToPerimeter(binding.focus ?? 0.5, rect, binding.gap ?? 0);
}

export function getBlockFixedPoints(rect: BlockRect) {
  return {
    corners: [[0,0],[rect.width,0],[rect.width,rect.height],[0,rect.height]] as [number,number][],
    edgeCenters: [[rect.width/2,0],[rect.width,rect.height/2],[rect.width/2,rect.height],[0,rect.height/2]] as [number,number][],
  };
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/lib/geometry/binding.ts
git commit -m "feat: add binding math utilities"
```

---

## Task 3: Advanced Path Calculation (per-point corner radius)

**Files:**
- Modify: `src/lib/geometry/splines.ts`

- [ ] **Step 1: Add calculateAdvancedPath to splines.ts**

```ts
export function calculateAdvancedPath(points: [number, number][], radiuses: number[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;

  let d = `M ${points[0][0]} ${points[0][1]}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    if (!next) { d += ` L ${curr[0]} ${curr[1]}`; break; }

    const r = radiuses[i] ?? 20;
    if (r <= 0.5) { d += ` L ${curr[0]} ${curr[1]}`; continue; }

    const dx1 = prev[0] - curr[0], dy1 = prev[1] - curr[1];
    const dx2 = next[0] - curr[0], dy2 = next[1] - curr[1];
    const len1 = Math.hypot(dx1, dy1), len2 = Math.hypot(dx2, dy2);
    if (len1 < 0.001 || len2 < 0.001) { d += ` L ${curr[0]} ${curr[1]}`; continue; }

    const cosAngle = Math.max(-1, Math.min(1, (dx1 * dx2 + dy1 * dy2) / (len1 * len2)));
    const angle = Math.acos(cosAngle);
    const maxR = Math.min(r, len1 * 0.99, len2 * 0.99, (r / Math.tan(angle / 2)) * 0.99);
    const t1 = maxR / len1, t2 = maxR / len2;
    const sx = curr[0] + dx1 * t1, sy = curr[1] + dy1 * t1;
    const ex = curr[0] + dx2 * t2, ey = curr[1] + dy2 * t2;

    d += ` L ${sx.toFixed(2)} ${sy.toFixed(2)}`;
    d += ` Q ${curr[0]} ${curr[1]} ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  }

  return d;
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/lib/geometry/splines.ts
git commit -m "feat: add advanced path calc with per-point corner radius"
```

---

## Task 4: Resolve Points Utility

**Files:**
- Create: `src/lib/geometry/resolvePoints.ts`

- [ ] **Step 1: Create resolvePoints.ts**

```ts
// src/lib/geometry/resolvePoints.ts
import type { EditorBlock } from '@/data/store';
import { resolveBindingPosition } from './binding';

export function resolvePoints(block: EditorBlock, allBlocks: EditorBlock[]): [number, number][] {
  const start = resolveBindingPosition(block.startBinding, allBlocks);
  const end = resolveBindingPosition(block.endBinding, allBlocks);
  const mids = block.keyPoints ?? [];

  if (!start && !end && mids.length < 2) return block.points ?? [];

  const pts: [number, number][] = [];
  if (start) pts.push(start);
  pts.push(...mids);
  if (end) pts.push(end);
  if (pts.length === 1) pts.push([pts[0][0] + 0.01, pts[0][1] + 0.01]);
  if (pts.length === 0) {
    const x = block.x ?? 0, y = block.y ?? 0;
    pts.push([x, y], [x + (block.width ?? 100), y + (block.height ?? 60)]);
  }
  return pts;
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/lib/geometry/resolvePoints.ts
git commit -m "feat: add resolvePoints utility"
```

---

## Task 5: Arrowhead Markers Component

**Files:**
- Create: `src/components/canvas/edges/arrowheadMarkers.tsx`

- [ ] **Step 1: Create arrowheadMarkers.tsx**

```tsx
"use client";
import type { ArrowheadStyle } from '@/data/store';

export function getMarkerIds(blockId: string) {
  return { start: `ah-s-${blockId}`, end: `ah-e-${blockId}` };
}

export function ArrowheadMarker({ id, style, strokeColor }: { id: string; style: ArrowheadStyle; strokeColor: string }) {
  if (style.type === 'none') return null;
  const s = style.size ?? 1;
  const w = 8 * s, h = 8 * s, rx = 6 * s, ry = 4 * s;

  if (style.type === 'circle') return (
    <marker id={id} markerWidth={w} markerHeight={h} refX={rx} refY={ry} orient="auto">
      <circle cx={4*s} cy={4*s} r={3.5*s} fill={strokeColor} />
    </marker>
  );
  if (style.type === 'bar') return (
    <marker id={id} markerWidth={w} markerHeight={h} refX={rx} refY={ry} orient="auto">
      <line x1={0} y1={0} x2={0} y2={h} stroke={strokeColor} strokeWidth={2*s} strokeLinecap="round" />
    </marker>
  );
  if (style.type === 'diamond') return (
    <marker id={id} markerWidth={w} markerHeight={h} refX={rx} refY={ry} orient="auto">
      <path d={`M0,${4*s} L${4*s},0 L${8*s},${4*s} L${4*s},${8*s} Z`} fill={strokeColor} />
    </marker>
  );

  const filled = style.type === 'filled-triangle' || style.type === 'triangle';
  return (
    <marker id={id} markerWidth={w} markerHeight={h} refX={rx} refY={ry} orient="auto">
      <path d="M0,0 L0,8 L8,4 z" fill={style.type === 'triangle' ? 'none' : strokeColor} stroke={style.type === 'triangle' ? strokeColor : 'none'} strokeWidth={1} />
    </marker>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/components/canvas/edges/arrowheadMarkers.tsx
git commit -m "feat: add arrowhead marker component"
```

---

## Task 6: VectorPath Component (Core)

**Files:**
- Create: `src/components/canvas/edges/VectorPath.tsx`

- [ ] **Step 1: Create VectorPath.tsx**

```tsx
"use client";
import React, { useRef, useEffect, useMemo } from 'react';
import gsap from 'gsap';
import { useStore, type EditorBlock } from '@/data/store';
import { calculateCatmullRomPath, calculateAdvancedPath } from '@/lib/geometry/splines';
import { resolvePoints } from '@/lib/geometry/resolvePoints';
import { resolveBindingPosition } from '@/lib/geometry/binding';
import { ArrowheadMarker, getMarkerIds } from './arrowheadMarkers';

interface VectorPathProps {
  block: EditorBlock;
  selected: boolean;
  editing: boolean;
  onSelect: (id: string, addToSelection: boolean) => void;
  onPointDragStart?: (index: number, e: React.PointerEvent) => void;
  onBindingDragStart?: (end: 'start' | 'end', e: React.PointerEvent) => void;
  onPathClickForAdd?: (t: number, x: number, y: number) => void;
}

export function VectorPath({ block, selected, editing, onSelect, onPointDragStart, onBindingDragStart }: VectorPathProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const allBlocks = useStore(s => s.blocks);
  const canvasBlocks = useMemo(() => allBlocks.filter(b => b.canvasId === block.canvasId), [allBlocks, block.canvasId]);

  const resolvedPts = useMemo(() => resolvePoints(block, canvasBlocks), [block, canvasBlocks]);
  const isAdvanced = block.editMode === 'advanced';
  const radiuses = block.pointRadiuses ?? [];

  const edgePath = useMemo(() => {
    if (resolvedPts.length < 2) return '';
    if (isAdvanced && radiuses.length > 0) return calculateAdvancedPath(resolvedPts, radiuses);
    return calculateCatmullRomPath(resolvedPts);
  }, [resolvedPts, isAdvanced, radiuses]);

  const path = useMemo(() => {
    if (!edgePath) return edgePath;
    const tokens = edgePath.match(/[a-zA-Z]|-?\d+(?:\.\d+)?/g);
    if (!tokens || tokens.length < 4) return edgePath;
    const len = tokens.length;
    const lx = parseFloat(tokens[len-2]), ly = parseFloat(tokens[len-1]);
    const px = parseFloat(tokens[len-4]), py = parseFloat(tokens[len-3]);
    if (isNaN(lx) || isNaN(ly) || isNaN(px) || isNaN(py)) return edgePath;
    const dx = lx - px, dy = ly - py, dist = Math.hypot(dx, dy);
    if (dist === 0) return edgePath;
    const gap = 12, ratio = Math.max(0, (dist - gap) / dist);
    tokens[len-2] = (px + dx * ratio).toFixed(1);
    tokens[len-1] = (py + dy * ratio).toFixed(1);
    return tokens.join(' ');
  }, [edgePath]);

  useEffect(() => {
    if (pathRef.current) {
      const len = pathRef.current.getTotalLength();
      gsap.fromTo(pathRef.current, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.5, ease: "power2.out" });
    }
  }, [block.id]);

  const style = block.canvasStyleExt ?? {};
  const strokeColor = selected ? 'var(--brand-blue)' : (style.stroke || 'var(--accent)');
  const strokeWidth = selected ? 3 : (style.strokeWidth || 2);
  const strokeStyle = style.strokeStyle || 'solid';
  const dasharray = strokeStyle === 'dashed' ? '6 4' : strokeStyle === 'dotted' ? '2 3' : undefined;

  const markerIds = getMarkerIds(block.id);
  const sHead = block.startArrowhead ?? (block.shapeKind === 'arrow' ? { type: 'filled-triangle' as const, size: 1 } : { type: 'none' as const });
  const eHead = block.endArrowhead ?? (block.shapeKind === 'arrow' ? { type: 'filled-triangle' as const, size: 1 } : { type: 'none' as const });

  const startPos = block.startBinding ? resolveBindingPosition(block.startBinding, canvasBlocks) : null;
  const endPos = block.endBinding ? resolveBindingPosition(block.endBinding, canvasBlocks) : null;

  return (
    <g>
      <defs>
        <ArrowheadMarker id={markerIds.start} style={sHead} strokeColor={strokeColor} />
        <ArrowheadMarker id={markerIds.end} style={eHead} strokeColor={strokeColor} />
      </defs>
      <path
        d={path}
        fill="none" stroke="transparent" strokeWidth={22}
        className="cursor-pointer" style={{ pointerEvents: 'auto' }}
        onPointerDown={e => { e.stopPropagation(); onSelect?.(block.id, e.shiftKey); }}
        data-connection-hitbox={block.id}
        data-block-id={block.id}
        data-start-binding={block.startBinding ? JSON.stringify(block.startBinding) : undefined}
        data-end-binding={block.endBinding ? JSON.stringify(block.endBinding) : undefined}
        data-key-points={block.keyPoints ? JSON.stringify(block.keyPoints) : undefined}
      />
      <path
        ref={pathRef} d={path}
        fill="none" stroke={strokeColor} strokeWidth={strokeWidth}
        strokeDasharray={dasharray} opacity={style.opacity ?? 1}
        markerStart={sHead.type !== 'none' ? `url(#${markerIds.start})` : undefined}
        markerEnd={eHead.type !== 'none' ? `url(#${markerIds.end})` : undefined}
        style={{ pointerEvents: 'none', transition: 'stroke 0.2s, stroke-width 0.2s' }}
        data-connection-path={block.id}
        data-block-id={block.id}
        data-start-binding={block.startBinding ? JSON.stringify(block.startBinding) : undefined}
        data-end-binding={block.endBinding ? JSON.stringify(block.endBinding) : undefined}
        data-key-points={block.keyPoints ? JSON.stringify(block.keyPoints) : undefined}
      />
      {editing && (
        <>
          {block.keyPoints?.map((pt, i) => (
            <circle key={`wp-${i}`} cx={pt[0]} cy={pt[1]} r={5}
              fill="white" stroke={strokeColor} strokeWidth={1.5}
              style={{ cursor: 'grab', pointerEvents: 'auto' }}
              onPointerDown={e => { e.stopPropagation(); onPointDragStart?.(i, e); }} />
          ))}
          {startPos && (
            <circle cx={startPos[0]} cy={startPos[1]} r={6}
              fill="#d38f36" stroke="white" strokeWidth={1.5}
              style={{ cursor: 'grab', pointerEvents: 'auto' }}
              onPointerDown={e => { e.stopPropagation(); onBindingDragStart?.('start', e); }} />
          )}
          {endPos && (
            <circle cx={endPos[0]} cy={endPos[1]} r={6}
              fill="#d38f36" stroke="white" strokeWidth={1.5}
              style={{ cursor: 'grab', pointerEvents: 'auto' }}
              onPointerDown={e => { e.stopPropagation(); onBindingDragStart?.('end', e); }} />
          )}
        </>
      )}
    </g>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/components/canvas/edges/VectorPath.tsx
git commit -m "feat: add VectorPath shared vector rendering component"
```

---

## Task 7: Refactor CanvasConnections

**Files:**
- Modify: `src/components/canvas/CanvasConnections.tsx`

- [ ] **Step 1: Rewrite CanvasConnections to use VectorPath**

Replace the entire file content. Filter to only arrows with bindings (or old `fromId`/`toId` for migrated blocks). Remove `getPointPosition`, bezier fallback, marker defs. Use `VectorPath`.

```tsx
"use client";
import { useStore } from "@/data/store";
import { useMemo } from "react";
import { VectorPath } from "./edges/VectorPath";

interface CanvasConnectionsProps {
  canvasId: string;
  selectedIds: Set<string>;
  onSelect: (id: string, addToSelection: boolean) => void;
  editingBlockId?: string | null;
}

export function CanvasConnections({ canvasId, selectedIds, onSelect, editingBlockId }: CanvasConnectionsProps) {
  const allBlocks = useStore(s => s.blocks);
  const blocks = useMemo(() => allBlocks.filter(b => b.canvasId === canvasId), [allBlocks, canvasId]);

  const linkedArrows = useMemo(() =>
    blocks.filter(b =>
      (b.type === 'shape' || b.type === 'connection') &&
      (b.shapeKind === 'arrow' || b.shapeKind === 'line') &&
      (b.startBinding || b.endBinding || b.fromId || b.toId)
    ), [blocks]
  );

  return (
    <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-[5]">
      {linkedArrows.map(block => (
        <VectorPath key={block.id} block={block}
          selected={selectedIds.has(block.id)}
          editing={editingBlockId === block.id}
          onSelect={onSelect} />
      ))}
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/components/canvas/CanvasConnections.tsx
git commit -m "refactor: use VectorPath in CanvasConnections"
```

---

## Task 8: Refactor CanvasShapeLayer

**Files:**
- Modify: `src/components/canvas/CanvasShapeLayer.tsx`

- [ ] **Step 1: Remove arrow/line/freedraw from ShapeEl, render them with VectorPath**

In `ShapeEl`, remove the `shapeKind === 'line'/'arrow'/'freedraw'` cases (lines 72-117). Keep only rect/ellipse/diamond.

In `CanvasShapeLayer`, after the existing `<g>` loop for `ShapeEl`, add a parallel loop for arrow/line/freedraw using VectorPath:

```tsx
{shapes.filter(b => b.shapeKind === 'arrow' || b.shapeKind === 'line' || b.shapeKind === 'freedraw').map(b => (
  <VectorPath key={b.id} block={b}
    selected={selectedIds.has(b.id)}
    editing={false}
    onSelect={(id, add) => onSelect(id, add)} />
))}
```

Update the existing `ShapeEl` loop filter to exclude arrow/line/freedraw:
```tsx
{shapes.filter(b => b.shapeKind !== 'arrow' && b.shapeKind !== 'line' && b.shapeKind !== 'freedraw').map(b => (...))}
```

Add import: `import { VectorPath } from './edges/VectorPath';`

- [ ] **Step 2: Commit**

```powershell
git add src/components/canvas/CanvasShapeLayer.tsx
git commit -m "refactor: use VectorPath in CanvasShapeLayer for arrows/lines"
```

---

## Task 9: Delete SmartArrowEdge

**Files:**
- Delete: `src/components/canvas/edges/SmartArrowEdge.tsx`

- [ ] **Step 1: Remove SmartArrowEdge**

```powershell
git rm src/components/canvas/edges/SmartArrowEdge.tsx
git commit -m "refactor: remove SmartArrowEdge (replaced by VectorPath)"
```

---

## Task 10: CanvasPage — Edit Mode State + New commitFlowConnection

**Files:**
- Modify: `src/components/canvas/CanvasPage.tsx`

- [ ] **Step 1: Add editingBlockId state**

```tsx
const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
```

- [ ] **Step 2: Add double-click handler for edit mode**

```tsx
const handleDoubleClickBlock = useCallback((blockId: string) => {
  const block = blocks.find(b => b.id === blockId);
  if (block && (block.shapeKind === 'arrow' || block.shapeKind === 'line' || block.shapeKind === 'freedraw')) {
    setEditingBlockId(blockId);
    setActiveTool('select');
  }
}, [blocks]);
```

Pass `onDoubleClick` to CanvasShapeLayer/CanvasBlock.

- [ ] **Step 3: Exit edit mode on Esc / canvas click**

```tsx
// In keyboard handler:
if (e.key === 'Escape') { setEditingBlockId(null); return; }

// On canvas background click:
const handleCanvasClick = (e: React.MouseEvent) => {
  if (e.target === e.currentTarget) setEditingBlockId(null);
};
```

- [ ] **Step 4: Pass editingBlockId to CanvasConnections**

```tsx
<CanvasConnections canvasId={entity.id} selectedIds={selectedIds}
  onSelect={handleSelect} editingBlockId={editingBlockId} />
```

- [ ] **Step 5: Update commitFlowConnection for new binding model**

Replace `commitFlowConnection` (lines 113-151) to create binding-based blocks instead of `connection` type:

```tsx
const commitFlowConnection = useCallback(() => {
  const { currentPath, isDrawing, clear } = useFlowState.getState();
  if (!isDrawing || currentPath.length < 2) { clear(); return; }

  const tool = activeTool === 'arrow' || activeTool === 'line' ? activeTool : 'arrow';
  const liveBlocks = useStore.getState().blocks.filter(b => b.canvasId === entity.id);
  const first = currentPath[0], last = currentPath[currentPath.length - 1];
  const startSnap = findClosestBlockHandle(first[0], first[1]);
  const endSnap = findClosestBlockHandle(last[0], last[1]);
  const hasStart = startSnap && startSnap.dist < 120;
  const hasEnd = endSnap && endSnap.dist < 120;

  const mkBinding = (snap: { id: string; side: string }) => ({
    blockId: snap.id,
  });

  addCanvasBlock({
    id: generateId(), type: 'shape', content: '', canvasId: entity.id,
    shapeKind: tool,
    startBinding: hasStart ? mkBinding(startSnap!) : undefined,
    endBinding: hasEnd ? mkBinding(endSnap!) : undefined,
    keyPoints: currentPath.slice(hasStart ? 1 : 0, currentPath.length - (hasEnd ? 1 : 0)),
    x: 0, y: 0, width: 0, height: 0,
    editMode: 'simple',
    startArrowhead: tool === 'arrow' ? { type: 'filled-triangle', size: 1 } : { type: 'none' },
    endArrowhead: tool === 'arrow' ? { type: 'filled-triangle', size: 1 } : { type: 'none' },
    canvasStyleExt: { stroke: '#d38f36', strokeWidth: 2, strokeStyle: 'solid', fill: 'transparent', fillOpacity: 0 },
  });
  clear();
  history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
}, [activeTool, addCanvasBlock, entity.id, findClosestBlockHandle, history]);
```

- [ ] **Step 6: Commit**

```powershell
git add src/components/canvas/CanvasPage.tsx
git commit -m "feat: add edit mode state and binding-aware commitFlowConnection"
```

---

## Task 11: CanvasBlock — Enhanced Connection Dots

**Files:**
- Modify: `src/components/canvas/CanvasBlock.tsx`

- [ ] **Step 1: Add corner dots alongside edge-mid dots**

Find the connectionPoints rendering (~line 632-656). Expand to include 8 total dots (4 edge-mid + 4 corner):

```tsx
const allConnectionPoints = [
  { key: 'top',        type: 'edge',  cls: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2' },
  { key: 'right',      type: 'edge',  cls: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2' },
  { key: 'bottom',     type: 'edge',  cls: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2' },
  { key: 'left',       type: 'edge',  cls: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2' },
  { key: 'top-left',   type: 'corner', cls: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2' },
  { key: 'top-right',  type: 'corner', cls: 'top-0 right-0 translate-x-1/2 -translate-y-1/2' },
  { key: 'bottom-right', type: 'corner', cls: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2' },
  { key: 'bottom-left',  type: 'corner', cls: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2' },
];
```

Render with different styling per type:
```tsx
{(activeTool === 'arrow' || activeTool === 'line') && allConnectionPoints.map(pt => (
  <div key={pt.key} className={cn("absolute rounded-full border-2 border-background z-[100] cursor-crosshair",
    pt.type === 'corner' ? "w-2.5 h-2.5 bg-[#ec4899]" : "w-3 h-3 bg-accent",
    pt.cls
  )}
  onPointerDown={(e) => { /* existing handler */ }} />
))}
```

- [ ] **Step 2: Commit**

```powershell
git add src/components/canvas/CanvasBlock.tsx
git commit -m "feat: add corner connection dots to blocks"
```

---

## Task 12: CanvasStylePanel — Arrowhead + Mode Controls

**Files:**
- Modify: `src/components/canvas/CanvasStylePanel.tsx`

- [ ] **Step 1: Add arrowhead controls**

After the Border section, when a line/arrow shape is selected, add a PanelSection with Start/End type dropdowns and size slider.

- [ ] **Step 2: Add Simple/Advanced toggle**

Add a PanelSection "Edit Mode" with two buttons (simple/advanced). When switched to advanced: set `pointRadiuses` to all 20s. When switched to simple: clear `pointRadiuses`.

- [ ] **Step 3: Commit**

```powershell
git add src/components/canvas/CanvasStylePanel.tsx
git commit -m "feat: add arrowhead and edit mode controls to style panel"
```

---

## Task 13: useDrag — Live Binding Recalculation

**Files:**
- Modify: `src/hooks/useDrag.ts`

- [ ] **Step 1: Update path element caching for new data attrs**

Update selector/caching to use `data-block-id`, `data-start-binding`, `data-end-binding` attributes. Import `focusToPerimeter` from binding.ts.

- [ ] **Step 2: In handlePointerMove, resolve bindings dynamically**

For cached paths with `data-start-binding`/`data-end-binding`, use `focusToPerimeter` to compute correct position rather than simple dx/dy offset. Fall back to old method for paths without binding data.

- [ ] **Step 3: Commit**

```powershell
git add src/hooks/useDrag.ts
git commit -m "feat: add binding-aware live path recalculation during drag"
```

---

## Task 14: Integration Testing & Cleanup

**Files:** Various

- [ ] **Step 1: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

- [ ] **Step 2: Verify no remaining SmartArrowEdge imports**

```powershell
rg "SmartArrowEdge" src/
```
Expected: No results.

- [ ] **Step 3: Verify no remaining `type: 'connection'` references in render logic**

```powershell
rg "type.*===.*['\"]connection['\"]" src/components/canvas/
```
Expected: Only in CanvasConnections.tsx where we coerce both `'shape'` and `'connection'` types for migration compat.

- [ ] **Step 4: Manual smoke test**

1. Open a canvas, draw an arrow between two blocks — should work
2. Drag a connected block — arrow should follow
3. Double-click arrow — should show edit dots
4. Change arrowhead styles in panel — should update
5. Toggle advanced mode — corner radius handles should appear

- [ ] **Step 5: Commit final cleanup**

```powershell
git add -A
git commit -m "chore: final cleanup and integration verification"
```
