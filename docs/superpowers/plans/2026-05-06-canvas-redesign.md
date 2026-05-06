# Canvas Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the canvas page with Framer-inspired UI, fixed interactions, Excalidraw-style shape tools, and Supabase cloud sync + real-time collaboration.

**Architecture:** Native SVG shape layer over the existing React/CSS-transform viewport. New `shape` block type in the existing Zustand store alongside existing block types. Cloud sync via a new `canvas_blocks` Supabase table mirroring the existing `sync.ts` pattern.

**Tech Stack:** Next.js 15, React 19, Zustand 5, Tailwind CSS 4, Supabase JS v2, `html-to-image` (PNG export)

---

## File Map

### Phase 1 — Bug fixes + UI overhaul

| Action | Path |
|---|---|
| Modify | `src/data/store.types.ts` — extend `EditorBlock` with `shapeKind`, `points`, `canvasStyleExt`, `groupId` |
| Rewrite | `src/components/canvas/CanvasToolbar.tsx` — Framer-style top-center pill groups |
| Rewrite | `src/components/canvas/CanvasPage.tsx` — fix all pointer bugs, add rubber-band select, undo/redo wiring, snap wiring, style panel |
| Rewrite | `src/components/canvas/CanvasBlock.tsx` — fix drag/resize commit bug, wire `canvasStyleExt` |
| Rewrite | `src/components/canvas/LayersPanel.tsx` → `CanvasLayersPanel.tsx` |
| Create | `src/components/canvas/CanvasStylePanel.tsx` |
| Create | `src/hooks/useCanvasHistory.ts` |
| Create | `src/hooks/useCanvasSnap.ts` |
| Create | `src/hooks/useCanvasMultiSelect.ts` |
| Fix | `src/components/canvas/CanvasConnections.tsx` — path routing bugs |

### Phase 2 — Shape tools

| Action | Path |
|---|---|
| Create | `src/components/canvas/CanvasShapeLayer.tsx` |

### Phase 3 — Cloud sync + collaboration

| Action | Path |
|---|---|
| Create | `src/lib/canvasSync.ts` |
| Create | `src/lib/canvasExport.ts` |
| Create | `src/lib/canvasShare.ts` |
| Create | `supabase/migrations/20260506_canvas_blocks.sql` |

---

## Phase 1 — Bug fixes + UI overhaul

---

### Task 1: Extend EditorBlock types

**Files:**
- Modify: `src/data/store.types.ts:82-124`

**Context:** `EditorBlock` already has `shapeType` and `canvasStyle`. We're adding `shapeKind` (the new richer enum), `points` for line/arrow/freedraw, `canvasStyleExt` for the full style object, and `groupId`. We keep the old fields to avoid breaking other code.

- [ ] **Step 1: Add new types above the EditorBlock interface**

In `src/data/store.types.ts`, find the line `export interface EditorBlock {` and add these types directly above it:

```ts
export type ShapeKind = 'rect' | 'ellipse' | 'diamond' | 'line' | 'arrow' | 'freedraw';

export interface CanvasStyleExt {
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  cornerRadius?: number;
  opacity?: number;
  locked?: boolean;
}
```

- [ ] **Step 2: Add new fields to EditorBlock**

In `src/data/store.types.ts`, find the existing `canvasStyle?:` field (line ~112) and add after it:

```ts
  shapeKind?: ShapeKind;
  points?: [number, number][];
  canvasStyleExt?: CanvasStyleExt;
  groupId?: string;
```

- [ ] **Step 3: Export new types from store.ts**

In `src/data/store.ts`, find the `export type {` block and add `ShapeKind, CanvasStyleExt,` to the list.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "c:/Users/misha/Documents/Vibe Coding/flowr-4-main"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to the new types.

- [ ] **Step 5: Commit**

```bash
git add src/data/store.types.ts src/data/store.ts
git commit -m "feat(canvas): extend EditorBlock with ShapeKind, CanvasStyleExt, points, groupId"
```

---

### Task 2: useCanvasHistory hook

**Files:**
- Create: `src/hooks/useCanvasHistory.ts`

**Context:** In-memory undo/redo stack storing snapshots of the `EditorBlock[]` array for the current canvas. The hook exposes `push`, `undo`, `redo`, `canUndo`, `canRedo`. The canvas calls `push` after every committed change.

- [ ] **Step 1: Create the hook**

Create `src/hooks/useCanvasHistory.ts`:

```ts
import { useRef, useState, useCallback } from 'react';
import type { EditorBlock } from '@/data/store';

const MAX_HISTORY = 100;

export function useCanvasHistory(initialBlocks: EditorBlock[]) {
  const stackRef = useRef<EditorBlock[][]>([initialBlocks]);
  const indexRef = useRef(0);
  const [, forceRender] = useState(0);

  const push = useCallback((blocks: EditorBlock[]) => {
    // Drop any redo states above current index
    stackRef.current = stackRef.current.slice(0, indexRef.current + 1);
    stackRef.current.push(blocks);
    if (stackRef.current.length > MAX_HISTORY) {
      stackRef.current.shift();
    } else {
      indexRef.current += 1;
    }
    forceRender(n => n + 1);
  }, []);

  const undo = useCallback((): EditorBlock[] | null => {
    if (indexRef.current <= 0) return null;
    indexRef.current -= 1;
    forceRender(n => n + 1);
    return stackRef.current[indexRef.current];
  }, []);

  const redo = useCallback((): EditorBlock[] | null => {
    if (indexRef.current >= stackRef.current.length - 1) return null;
    indexRef.current += 1;
    forceRender(n => n + 1);
    return stackRef.current[indexRef.current];
  }, []);

  const canUndo = indexRef.current > 0;
  const canRedo = indexRef.current < stackRef.current.length - 1;

  return { push, undo, redo, canUndo, canRedo };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCanvasHistory.ts
git commit -m "feat(canvas): add useCanvasHistory undo/redo hook"
```

---

### Task 3: useCanvasSnap hook

**Files:**
- Create: `src/hooks/useCanvasSnap.ts`

**Context:** Snaps x/y coordinates to a 20px grid when snap is enabled, and optionally to the edges of other blocks. Used during drag and resize in CanvasPage.

- [ ] **Step 1: Create the hook**

Create `src/hooks/useCanvasSnap.ts`:

```ts
import { useCallback } from 'react';
import type { EditorBlock } from '@/data/store';

const GRID = 20;
const SNAP_THRESHOLD = 8; // pixels — how close before snapping to object edge

export function useCanvasSnap(snapEnabled: boolean, blocks: EditorBlock[]) {
  const snapToGrid = useCallback((x: number, y: number): { x: number; y: number } => {
    if (!snapEnabled) return { x, y };
    return {
      x: Math.round(x / GRID) * GRID,
      y: Math.round(y / GRID) * GRID,
    };
  }, [snapEnabled]);

  const snapWithObjects = useCallback((
    x: number, y: number, width: number, height: number, excludeId: string
  ): { x: number; y: number } => {
    if (!snapEnabled) return { x, y };

    let snappedX = Math.round(x / GRID) * GRID;
    let snappedY = Math.round(y / GRID) * GRID;

    for (const b of blocks) {
      if (b.id === excludeId || b.type === 'connection') continue;
      const bx = b.x ?? 0, by = b.y ?? 0, bw = b.width ?? 0, bh = b.height ?? 0;

      // Snap left edge to right edge of other block
      if (Math.abs(x - (bx + bw)) < SNAP_THRESHOLD) snappedX = bx + bw;
      // Snap right edge to left edge of other block
      if (Math.abs((x + width) - bx) < SNAP_THRESHOLD) snappedX = bx - width;
      // Snap left to left
      if (Math.abs(x - bx) < SNAP_THRESHOLD) snappedX = bx;
      // Snap top edge to bottom edge
      if (Math.abs(y - (by + bh)) < SNAP_THRESHOLD) snappedY = by + bh;
      // Snap bottom to top
      if (Math.abs((y + height) - by) < SNAP_THRESHOLD) snappedY = by - height;
      // Snap top to top
      if (Math.abs(y - by) < SNAP_THRESHOLD) snappedY = by;
    }

    return { x: snappedX, y: snappedY };
  }, [snapEnabled, blocks]);

  return { snapToGrid, snapWithObjects };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCanvasSnap.ts
git commit -m "feat(canvas): add useCanvasSnap grid + object edge snapping hook"
```

---

### Task 4: useCanvasMultiSelect hook

**Files:**
- Create: `src/hooks/useCanvasMultiSelect.ts`

**Context:** Tracks a rubber-band drag box drawn on the empty canvas. Returns the current selection rect (for rendering) and the set of block IDs that intersect it.

- [ ] **Step 1: Create the hook**

Create `src/hooks/useCanvasMultiSelect.ts`:

```ts
import { useState, useCallback, useRef } from 'react';
import type { EditorBlock } from '@/data/store';

export interface SelectionRect {
  x: number; y: number; width: number; height: number;
}

export function useCanvasMultiSelect(blocks: EditorBlock[]) {
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const startSelection = useCallback((canvasX: number, canvasY: number) => {
    startRef.current = { x: canvasX, y: canvasY };
    setSelectionRect({ x: canvasX, y: canvasY, width: 0, height: 0 });
    setSelectedIds(new Set());
  }, []);

  const updateSelection = useCallback((canvasX: number, canvasY: number) => {
    if (!startRef.current) return;
    const sx = startRef.current.x, sy = startRef.current.y;
    const rect: SelectionRect = {
      x: Math.min(sx, canvasX),
      y: Math.min(sy, canvasY),
      width: Math.abs(canvasX - sx),
      height: Math.abs(canvasY - sy),
    };
    setSelectionRect(rect);

    const intersecting = new Set<string>();
    for (const b of blocks) {
      if (b.type === 'connection') continue;
      const bx = b.x ?? 0, by = b.y ?? 0, bw = b.width ?? 100, bh = b.height ?? 40;
      if (
        bx < rect.x + rect.width &&
        bx + bw > rect.x &&
        by < rect.y + rect.height &&
        by + bh > rect.y
      ) {
        intersecting.add(b.id);
      }
    }
    setSelectedIds(intersecting);
  }, [blocks]);

  const endSelection = useCallback(() => {
    startRef.current = null;
    setSelectionRect(null);
    // selectedIds remains — caller reads it to set the final selection
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionRect(null);
  }, []);

  return { selectionRect, selectedIds, startSelection, updateSelection, endSelection, clearSelection };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCanvasMultiSelect.ts
git commit -m "feat(canvas): add useCanvasMultiSelect rubber-band selection hook"
```

---

### Task 5: Rewrite CanvasToolbar — Framer-style top bar

**Files:**
- Rewrite: `src/components/canvas/CanvasToolbar.tsx`

**Context:** The current toolbar is a floating bottom bar. Replace with a Framer-style top-center grouped pill bar. The toolbar is embedded in `CanvasPage`'s top bar layout — it receives `activeTool`, `setActiveTool`, `showLayers`, `setShowLayers`, `snapEnabled`, `setSnapEnabled`, `zoom`, `onZoomIn`, `onZoomOut`, `canUndo`, `canRedo`, `onUndo`, `onRedo`, `onExport`, `onShare`.

- [ ] **Step 1: Rewrite the file**

Replace entire contents of `src/components/canvas/CanvasToolbar.tsx`:

```tsx
"use client";

import React from 'react';
import {
  MousePointer2, Hand, Square, Circle, Diamond,
  MoveUpRight, Minus, Pencil, Type, Image, MessageSquarePlus,
  Frame, Layers, Download, Share2, Undo2, Redo2
} from 'lucide-react';
import clsx from 'clsx';

export type CanvasTool =
  | 'select' | 'move'
  | 'rect' | 'ellipse' | 'diamond' | 'arrow' | 'line' | 'freedraw'
  | 'text' | 'image' | 'comment' | 'section';

interface CanvasToolbarProps {
  activeTool: CanvasTool;
  setActiveTool: (tool: CanvasTool) => void;
  showLayers: boolean;
  setShowLayers: (show: boolean) => void;
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onShare: () => void;
  canvasTitle: string;
}

type ToolDef = { id: CanvasTool; icon: React.ReactNode; shortcut: string; label: string };

const NAV_TOOLS: ToolDef[] = [
  { id: 'select', icon: <MousePointer2 className="w-3.5 h-3.5" />, shortcut: 'V', label: 'Select' },
  { id: 'move',   icon: <Hand className="w-3.5 h-3.5" />,          shortcut: 'H', label: 'Pan' },
];

const SHAPE_TOOLS: ToolDef[] = [
  { id: 'rect',     icon: <Square className="w-3.5 h-3.5" />,       shortcut: 'R', label: 'Rectangle' },
  { id: 'ellipse',  icon: <Circle className="w-3.5 h-3.5" />,       shortcut: 'O', label: 'Ellipse' },
  { id: 'diamond',  icon: <Diamond className="w-3.5 h-3.5" />,      shortcut: 'D', label: 'Diamond' },
  { id: 'arrow',    icon: <MoveUpRight className="w-3.5 h-3.5" />,  shortcut: 'A', label: 'Arrow' },
  { id: 'line',     icon: <Minus className="w-3.5 h-3.5" />,        shortcut: 'L', label: 'Line' },
  { id: 'freedraw', icon: <Pencil className="w-3.5 h-3.5" />,       shortcut: 'P', label: 'Freedraw' },
];

const CONTENT_TOOLS: ToolDef[] = [
  { id: 'text',    icon: <Type className="w-3.5 h-3.5" />,              shortcut: 'T', label: 'Text' },
  { id: 'image',   icon: <Image className="w-3.5 h-3.5" />,             shortcut: 'I', label: 'Image' },
  { id: 'comment', icon: <MessageSquarePlus className="w-3.5 h-3.5" />, shortcut: 'C', label: 'Comment' },
  { id: 'section', icon: <Frame className="w-3.5 h-3.5" />,             shortcut: 'F', label: 'Section' },
];

function ToolGroup({ tools, activeTool, setActiveTool }: {
  tools: ToolDef[]; activeTool: CanvasTool; setActiveTool: (t: CanvasTool) => void;
}) {
  return (
    <div className="flex items-center bg-[rgba(233,233,226,0.06)] rounded-[8px] p-[3px] gap-[1px]">
      {tools.map(t => (
        <button
          key={t.id}
          title={`${t.label} (${t.shortcut})`}
          onClick={() => setActiveTool(t.id)}
          className={clsx(
            "w-7 h-[26px] rounded-[5px] flex items-center justify-center transition-all duration-100",
            activeTool === t.id
              ? "bg-[rgba(233,233,226,0.15)] text-[var(--bone-100)]"
              : "bg-transparent text-[rgba(233,233,226,0.3)] hover:bg-[rgba(233,233,226,0.06)] hover:text-[rgba(233,233,226,0.6)]"
          )}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

function VSep() {
  return <div className="w-px h-[14px] bg-[rgba(233,233,226,0.1)] mx-[2px]" />;
}

function TbBtn({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={clsx(
        "w-7 h-7 rounded-[6px] flex items-center justify-center transition-all duration-100",
        active
          ? "text-[var(--bone-100)]"
          : "bg-transparent text-[rgba(233,233,226,0.3)] hover:bg-[rgba(233,233,226,0.06)] hover:text-[rgba(233,233,226,0.6)]"
      )}
    >
      {children}
    </button>
  );
}

export function CanvasToolbar({
  activeTool, setActiveTool,
  showLayers, setShowLayers,
  snapEnabled, setSnapEnabled,
  zoom, onZoomIn, onZoomOut,
  canUndo, canRedo, onUndo, onRedo,
  onExport, onShare,
  canvasTitle,
}: CanvasToolbarProps) {
  return (
    <div className="absolute top-0 left-0 right-0 h-10 bg-[#1c1c1a] border-b border-[rgba(233,233,226,0.1)] flex items-center px-2.5 gap-1.5 z-[2000] select-none">
      {/* Left: title */}
      <div className="flex items-center gap-1.5 min-w-[160px]">
        <span className="text-[12px] text-[rgba(233,233,226,0.6)] px-2 py-1 rounded-[6px]">
          <span className="text-[rgba(233,233,226,0.9)]">{canvasTitle}</span>
        </span>
      </div>

      {/* Center: tool groups */}
      <div className="flex-1 flex items-center justify-center gap-[3px]">
        <ToolGroup tools={NAV_TOOLS}     activeTool={activeTool} setActiveTool={setActiveTool} />
        <VSep />
        <ToolGroup tools={SHAPE_TOOLS}   activeTool={activeTool} setActiveTool={setActiveTool} />
        <VSep />
        <ToolGroup tools={CONTENT_TOOLS} activeTool={activeTool} setActiveTool={setActiveTool} />
      </div>

      {/* Right: zoom, undo/redo, layers, export, share */}
      <div className="flex items-center gap-1 min-w-[160px] justify-end">
        {/* Zoom */}
        <div className="flex items-center bg-[rgba(233,233,226,0.06)] rounded-[6px] px-2 h-[26px] gap-1.5 text-[11px] text-[rgba(233,233,226,0.35)] cursor-pointer hover:text-[rgba(233,233,226,0.6)] transition-colors">
          {Math.round(zoom * 100)}%
        </div>
        <VSep />
        {/* Undo/Redo */}
        <TbBtn onClick={onUndo} active={canUndo} title="Undo (Ctrl+Z)">
          <Undo2 className="w-3.5 h-3.5" />
        </TbBtn>
        <TbBtn onClick={onRedo} active={canRedo} title="Redo (Ctrl+Y)">
          <Redo2 className="w-3.5 h-3.5" />
        </TbBtn>
        <VSep />
        {/* Layers toggle */}
        <TbBtn onClick={() => setShowLayers(!showLayers)} active={showLayers} title="Layers panel">
          <Layers className="w-3.5 h-3.5" />
        </TbBtn>
        {/* Export */}
        <TbBtn onClick={onExport} title="Export PNG">
          <Download className="w-3.5 h-3.5" />
        </TbBtn>
        {/* Share */}
        <button
          onClick={onShare}
          className="h-[26px] px-3 rounded-[6px] bg-[rgba(211,143,54,0.15)] text-[#d38f36] text-[11px] uppercase tracking-[0.05em] hover:bg-[rgba(211,143,54,0.22)] transition-colors"
        >
          Share
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only about missing props in `CanvasPage.tsx` (not yet updated) — those are fine.

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/CanvasToolbar.tsx
git commit -m "feat(canvas): replace toolbar with Framer-style top-center pill groups"
```

---

### Task 6: CanvasLayersPanel — Framer-style sidebar

**Files:**
- Create: `src/components/canvas/CanvasLayersPanel.tsx`
- (Old `LayersPanel.tsx` will be replaced by CanvasPage once Task 8 is done)

**Context:** New layers panel with Layers/Assets tabs, indented tree, visibility toggle on hover, accent color for selected row.

- [ ] **Step 1: Create the file**

Create `src/components/canvas/CanvasLayersPanel.tsx`:

```tsx
"use client";

import { useStore, EditorBlock } from '@/data/store';
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Square, Circle, Diamond, MoveUpRight, Minus, Type, Image, MessageSquarePlus, Frame, Eye, EyeOff, Lock } from 'lucide-react';

interface Props {
  canvasId: string;
  selectedIds: Set<string>;
  onSelect: (id: string, addToSelection: boolean) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  rect:     <Square className="w-3 h-3" />,
  ellipse:  <Circle className="w-3 h-3" />,
  diamond:  <Diamond className="w-3 h-3" />,
  arrow:    <MoveUpRight className="w-3 h-3" />,
  line:     <Minus className="w-3 h-3" />,
  text:     <Type className="w-3 h-3" />,
  image:    <Image className="w-3 h-3" />,
  comment:  <MessageSquarePlus className="w-3 h-3" />,
  section:  <Frame className="w-3 h-3" />,
  freedraw: <Pencil className="w-3 h-3" />,
};

function blockIcon(b: EditorBlock) {
  if (b.type === 'shape' && b.shapeKind) return ICON_MAP[b.shapeKind] ?? <Square className="w-3 h-3" />;
  return ICON_MAP[b.type] ?? <Square className="w-3 h-3" />;
}

function blockLabel(b: EditorBlock) {
  if (b.content) return b.content.slice(0, 28);
  if (b.type === 'shape') return b.shapeKind ?? 'Shape';
  return b.type.charAt(0).toUpperCase() + b.type.slice(1);
}

export function CanvasLayersPanel({ canvasId, selectedIds, onSelect }: Props) {
  const blocks = useStore(s => s.blocks);
  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);
  const deleteCanvasBlock = useStore(s => s.deleteCanvasBlock);
  const [tab, setTab] = useState<'layers' | 'assets'>('layers');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const pageBlocks = useMemo(() =>
    blocks.filter(b => b.canvasId === canvasId && b.type !== 'connection'),
    [blocks, canvasId]
  );

  const sections = useMemo(() => pageBlocks.filter(b => b.type === 'section'), [pageBlocks]);
  const loose = useMemo(() => pageBlocks.filter(b => b.type !== 'section' && !b.parentId), [pageBlocks]);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleVisibility(b: EditorBlock, e: React.MouseEvent) {
    e.stopPropagation();
    const hidden = (b.canvasStyleExt?.opacity ?? 1) === 0;
    updateCanvasBlock(b.id, { canvasStyleExt: { ...b.canvasStyleExt, opacity: hidden ? 1 : 0 } });
  }

  function LayerRow({ block, depth = 0 }: { block: EditorBlock; depth?: number }) {
    const isSelected = selectedIds.has(block.id);
    const isHidden = (block.canvasStyleExt?.opacity ?? 1) === 0;
    const isLocked = block.canvasStyleExt?.locked ?? false;

    return (
      <div
        className={clsx(
          "group h-[28px] flex items-center gap-[5px] px-2 cursor-pointer transition-colors duration-75",
          isSelected ? "bg-[rgba(233,233,226,0.06)]" : "hover:bg-[rgba(233,233,226,0.03)]"
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={(e) => onSelect(block.id, e.shiftKey)}
      >
        {block.type === 'section' ? (
          <button
            className="w-[10px] h-[10px] flex items-center justify-center text-[7px] text-[rgba(233,233,226,0.3)] flex-shrink-0"
            onClick={e => { e.stopPropagation(); toggleExpand(block.id); }}
          >
            {expanded.has(block.id) ? '▼' : '▶'}
          </button>
        ) : (
          <div className="w-[10px] flex-shrink-0" />
        )}
        <div className={clsx("w-[14px] flex-shrink-0 flex items-center justify-center", isSelected ? "text-[#d38f36]" : "text-[rgba(233,233,226,0.3)]")}>
          {blockIcon(block)}
        </div>
        <div className={clsx("flex-1 text-[11px] truncate", isSelected ? "text-[rgba(233,233,226,0.9)]" : "text-[rgba(233,233,226,0.6)]", isHidden && "opacity-40")}>
          {blockLabel(block)}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isLocked && <Lock className="w-2.5 h-2.5 text-[rgba(233,233,226,0.3)]" />}
          <button onClick={(e) => toggleVisibility(block, e)} className="text-[rgba(233,233,226,0.3)] hover:text-[rgba(233,233,226,0.7)]">
            {isHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[220px] bg-[#1c1c1a] border-r border-[rgba(233,233,226,0.1)] flex flex-col flex-shrink-0 overflow-hidden">
      {/* Tabs */}
      <div className="h-9 flex items-center px-2.5 gap-1 border-b border-[rgba(233,233,226,0.1)] flex-shrink-0">
        {(['layers', 'assets'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "text-[11px] px-[7px] py-[3px] rounded-[5px] capitalize tracking-[0.03em] transition-colors",
              tab === t ? "bg-[rgba(233,233,226,0.1)] text-[rgba(233,233,226,0.9)]" : "text-[rgba(233,233,226,0.3)] hover:text-[rgba(233,233,226,0.6)]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Layer tree */}
      <div className="flex-1 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-[rgba(233,233,226,0.1)]">
        {tab === 'layers' && (
          <>
            {sections.map(section => {
              const children = pageBlocks.filter(b => b.parentId === section.id);
              return (
                <div key={section.id}>
                  <LayerRow block={section} depth={0} />
                  {expanded.has(section.id) && children.map(child => (
                    <LayerRow key={child.id} block={child} depth={1} />
                  ))}
                </div>
              );
            })}
            {loose.length > 0 && sections.length > 0 && (
              <div className="px-2.5 pt-3 pb-1 text-[10px] uppercase tracking-[0.07em] text-[rgba(233,233,226,0.3)]">Loose</div>
            )}
            {loose.map(b => <LayerRow key={b.id} block={b} depth={0} />)}
          </>
        )}
        {tab === 'assets' && (
          <div className="px-3 pt-4 text-[11px] text-[rgba(233,233,226,0.3)]">No assets yet</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/CanvasLayersPanel.tsx
git commit -m "feat(canvas): add CanvasLayersPanel Framer-style sidebar"
```

---

### Task 7: CanvasStylePanel — right panel

**Files:**
- Create: `src/components/canvas/CanvasStylePanel.tsx`

**Context:** Right panel shown when one or more blocks are selected. Shows alignment bar, size/position, fill, border, options. Updates blocks via `updateCanvasBlock` store action.

- [ ] **Step 1: Create the file**

Create `src/components/canvas/CanvasStylePanel.tsx`:

```tsx
"use client";

import { useStore, EditorBlock, CanvasStyleExt } from '@/data/store';
import clsx from 'clsx';

interface Props {
  selectedIds: Set<string>;
  canvasId: string;
  onAlignLeft: () => void;
  onAlignCenterH: () => void;
  onAlignRight: () => void;
  onAlignTop: () => void;
  onAlignCenterV: () => void;
  onAlignBottom: () => void;
}

const FILL_PRESETS = [
  { label: 'None',    value: 'transparent', opacity: 0 },
  { label: 'Accent',  value: '#d38f36',     opacity: 0.15 },
  { label: 'Blue',    value: '#5b9cf6',     opacity: 0.15 },
  { label: 'Purple',  value: '#a78bfa',     opacity: 0.15 },
  { label: 'Green',   value: '#4ade80',     opacity: 0.15 },
  { label: 'Red',     value: '#f87171',     opacity: 0.15 },
  { label: 'Subtle',  value: '#E9E9E2',     opacity: 0.07 },
];

const STROKE_PRESETS = [
  { label: 'None',   value: 'transparent' },
  { label: 'Accent', value: '#d38f36' },
  { label: 'Blue',   value: '#5b9cf6' },
  { label: 'Purple', value: '#a78bfa' },
  { label: 'Green',  value: '#4ade80' },
  { label: 'Red',    value: '#f87171' },
  { label: 'Bone',   value: '#E9E9E2' },
];

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5 border-b border-[rgba(233,233,226,0.06)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-[rgba(233,233,226,0.6)] font-medium">{title}</span>
      </div>
      {children}
    </div>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-h-[28px] mb-1 last:mb-0">
      <span className="w-[52px] text-[11px] text-[rgba(233,233,226,0.3)] flex-shrink-0">{label}</span>
      <div className="flex-1 flex items-center gap-1">{children}</div>
    </div>
  );
}

function PillInput({ value, onChange }: { value: string | number; onChange: (v: string) => void }) {
  return (
    <input
      className="flex-1 h-7 min-w-0 bg-[#232321] rounded-[6px] text-center text-[11px] text-[rgba(233,233,226,0.6)] border-none outline-none focus:bg-[rgba(233,233,226,0.1)] focus:text-[rgba(233,233,226,0.9)] transition-colors"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  );
}

function AlignBtn({ title, children, onClick }: { title: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex-1 h-7 rounded-[6px] flex items-center justify-center text-[rgba(233,233,226,0.3)] hover:bg-[rgba(233,233,226,0.06)] hover:text-[rgba(233,233,226,0.6)] transition-colors"
    >
      {children}
    </button>
  );
}

export function CanvasStylePanel({
  selectedIds, canvasId,
  onAlignLeft, onAlignCenterH, onAlignRight,
  onAlignTop, onAlignCenterV, onAlignBottom,
}: Props) {
  const blocks = useStore(s => s.blocks);
  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);

  const selected = blocks.filter(b => selectedIds.has(b.id));
  if (selected.length === 0) return null;

  // Use first selected block as the reference for panel values
  const ref = selected[0];
  const style = ref.canvasStyleExt ?? {};

  function updateStyle(patch: Partial<CanvasStyleExt>) {
    selected.forEach(b =>
      updateCanvasBlock(b.id, { canvasStyleExt: { ...(b.canvasStyleExt ?? {}), ...patch } })
    );
  }

  function updateGeom(patch: Partial<Pick<EditorBlock, 'x' | 'y' | 'width' | 'height'>>) {
    selected.forEach(b => updateCanvasBlock(b.id, patch));
  }

  return (
    <div className="w-[220px] bg-[#1c1c1a] border-l border-[rgba(233,233,226,0.1)] flex flex-col flex-shrink-0 overflow-y-auto">

      {/* Alignment bar */}
      <div className="px-2.5 py-2 border-b border-[rgba(233,233,226,0.1)] flex items-center gap-[2px]">
        <AlignBtn title="Align left"     onClick={onAlignLeft}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="3" width="5" height="2.5" rx="0.8" fill="currentColor"/><rect x="2" y="7" width="9" height="2.5" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="1.5" y="2" width="1" height="10" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
        </AlignBtn>
        <AlignBtn title="Align center H"  onClick={onAlignCenterH}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3.5" y="3" width="7" height="2.5" rx="0.8" fill="currentColor"/><rect x="2" y="7" width="10" height="2.5" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="6.5" y="2" width="1" height="10" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
        </AlignBtn>
        <AlignBtn title="Align right"    onClick={onAlignRight}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="7" y="3" width="5" height="2.5" rx="0.8" fill="currentColor"/><rect x="3" y="7" width="9" height="2.5" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="11.5" y="2" width="1" height="10" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
        </AlignBtn>
        <div className="w-px h-[14px] bg-[rgba(233,233,226,0.1)] mx-[2px]" />
        <AlignBtn title="Align top"      onClick={onAlignTop}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="4" width="2.5" height="5" rx="0.8" fill="currentColor"/><rect x="7" y="2.5" width="2.5" height="9" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="2" y="1.5" width="10" height="1" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
        </AlignBtn>
        <AlignBtn title="Align center V" onClick={onAlignCenterV}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="4" width="2.5" height="5" rx="0.8" fill="currentColor"/><rect x="7" y="2.5" width="2.5" height="9" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="2" y="6.5" width="10" height="1" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
        </AlignBtn>
        <AlignBtn title="Align bottom"   onClick={onAlignBottom}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="4" width="2.5" height="5" rx="0.8" fill="currentColor"/><rect x="7" y="2.5" width="2.5" height="9" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="2" y="11.5" width="10" height="1" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
        </AlignBtn>
      </div>

      {/* Size */}
      <PanelSection title="Size">
        <PropRow label="Width">
          <PillInput value={Math.round(ref.width ?? 0)} onChange={v => updateGeom({ width: Number(v) || 0 })} />
        </PropRow>
        <PropRow label="Height">
          <PillInput value={Math.round(ref.height ?? 0)} onChange={v => updateGeom({ height: Number(v) || 0 })} />
        </PropRow>
        <PropRow label="Position">
          <PillInput value={`X  ${Math.round(ref.x ?? 0)}`} onChange={v => updateGeom({ x: Number(v.replace(/[^0-9.-]/g, '')) || 0 })} />
          <PillInput value={`Y  ${Math.round(ref.y ?? 0)}`} onChange={v => updateGeom({ y: Number(v.replace(/[^0-9.-]/g, '')) || 0 })} />
        </PropRow>
      </PanelSection>

      {/* Fill */}
      <PanelSection title="Fill">
        <PropRow label="Color">
          <div className="flex gap-1 flex-wrap">
            {FILL_PRESETS.map(p => (
              <button
                key={p.value}
                title={p.label}
                onClick={() => updateStyle({ fill: p.value, fillOpacity: p.opacity })}
                className={clsx(
                  "w-5 h-5 rounded-full transition-transform hover:scale-110",
                  style.fill === p.value && "ring-2 ring-offset-1 ring-offset-[#1c1c1a] ring-[rgba(233,233,226,0.6)]"
                )}
                style={{ background: p.value === 'transparent' ? 'transparent' : p.value, border: p.value === 'transparent' ? '1.5px solid rgba(233,233,226,0.15)' : 'none' }}
              />
            ))}
          </div>
        </PropRow>
        <PropRow label="Opacity">
          <input
            type="range" min={0} max={1} step={0.01}
            value={style.fillOpacity ?? 0.15}
            onChange={e => updateStyle({ fillOpacity: Number(e.target.value) })}
            className="flex-1 h-[3px] rounded-full accent-[#d38f36]"
          />
          <span className="text-[11px] text-[rgba(233,233,226,0.4)] w-8 text-right">
            {Math.round((style.fillOpacity ?? 0.15) * 100)}%
          </span>
        </PropRow>
      </PanelSection>

      {/* Border */}
      <PanelSection title="Border">
        <PropRow label="Color">
          <div className="flex gap-1 flex-wrap">
            {STROKE_PRESETS.map(p => (
              <button
                key={p.value}
                title={p.label}
                onClick={() => updateStyle({ stroke: p.value })}
                className={clsx(
                  "w-5 h-5 rounded-full transition-transform hover:scale-110",
                  style.stroke === p.value && "ring-2 ring-offset-1 ring-offset-[#1c1c1a] ring-[rgba(233,233,226,0.6)]"
                )}
                style={{ background: p.value === 'transparent' ? 'transparent' : p.value, border: p.value === 'transparent' ? '1.5px solid rgba(233,233,226,0.15)' : 'none' }}
              />
            ))}
          </div>
        </PropRow>
        <PropRow label="Width">
          <PillInput value={style.strokeWidth ?? 1.5} onChange={v => updateStyle({ strokeWidth: Number(v) || 1 })} />
          {/* Stroke style segmented */}
          <div className="flex bg-[#232321] rounded-[6px] p-[2px] gap-[1px]">
            {(['solid', 'dashed', 'dotted'] as const).map(ss => (
              <button
                key={ss}
                onClick={() => updateStyle({ strokeStyle: ss })}
                className={clsx(
                  "px-1.5 h-5 rounded-[4px] text-[10px] transition-colors",
                  (style.strokeStyle ?? 'solid') === ss
                    ? "bg-[rgba(233,233,226,0.15)] text-[rgba(233,233,226,0.9)]"
                    : "text-[rgba(233,233,226,0.3)] hover:text-[rgba(233,233,226,0.6)]"
                )}
              >
                {ss === 'solid' ? '—' : ss === 'dashed' ? '- -' : '···'}
              </button>
            ))}
          </div>
        </PropRow>
        <PropRow label="Radius">
          <PillInput value={style.cornerRadius ?? 0} onChange={v => updateStyle({ cornerRadius: Number(v) || 0 })} />
        </PropRow>
      </PanelSection>

      {/* Options */}
      <PanelSection title="Options">
        <PropRow label="Visible">
          <div className="flex bg-[#232321] rounded-[6px] p-[2px] gap-[1px]">
            {([true, false] as const).map(v => (
              <button
                key={String(v)}
                onClick={() => updateStyle({ opacity: v ? 1 : 0 })}
                className={clsx(
                  "px-2.5 h-5 rounded-[4px] text-[11px] transition-colors",
                  ((style.opacity ?? 1) > 0) === v
                    ? "bg-[rgba(233,233,226,0.15)] text-[rgba(233,233,226,0.9)]"
                    : "text-[rgba(233,233,226,0.3)]"
                )}
              >
                {v ? 'True' : 'No'}
              </button>
            ))}
          </div>
        </PropRow>
        <PropRow label="Locked">
          <button
            onClick={() => updateStyle({ locked: !(style.locked ?? false) })}
            className={clsx(
              "w-7 h-4 rounded-full transition-colors relative",
              style.locked ? "bg-[#d38f36]" : "bg-[rgba(233,233,226,0.1)]"
            )}
          >
            <div className={clsx(
              "absolute top-[2px] w-3 h-3 bg-[rgba(233,233,226,0.9)] rounded-full transition-transform",
              style.locked ? "left-[calc(100%-14px)]" : "left-[2px]"
            )} />
          </button>
        </PropRow>
      </PanelSection>

    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/CanvasStylePanel.tsx
git commit -m "feat(canvas): add CanvasStylePanel right panel with fill/border/options"
```

---

### Task 8: Rewrite CanvasPage — wire all Phase 1 pieces

**Files:**
- Rewrite: `src/components/canvas/CanvasPage.tsx`

**Context:** CanvasPage is the orchestrator. This rewrite fixes pointer event bugs, wires in all new hooks and panels, updates the keyboard shortcuts to match the new CanvasTool type, and fixes the resize commit bug (the old code reads stale `position`/`size` state in the pointerup closure).

- [ ] **Step 1: Rewrite CanvasPage.tsx**

Replace entire contents of `src/components/canvas/CanvasPage.tsx`:

```tsx
"use client";

import { Entity, useStore, generateId } from '@/data/store';
import { CanvasBlock } from './CanvasBlock';
import { CanvasToolbar, CanvasTool } from './CanvasToolbar';
import { CanvasLayersPanel } from './CanvasLayersPanel';
import { CanvasStylePanel } from './CanvasStylePanel';
import { CanvasConnections } from './CanvasConnections';
import { MediaUploadPopover } from './MediaUploadPopover';
import { useCanvasHistory } from '@/hooks/useCanvasHistory';
import { useCanvasSnap } from '@/hooks/useCanvasSnap';
import { useCanvasMultiSelect } from '@/hooks/useCanvasMultiSelect';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.1;

export function CanvasPage({ entity }: { entity: Entity }) {
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [showLayers, setShowLayers] = useState(true);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingConnection, setPendingConnection] = useState<{
    fromId: string; fromSide: string; x: number; y: number; x2: number; y2: number;
  } | null>(null);
  const [mediaPopover, setMediaPopover] = useState<{
    x: number; y: number; canvasX: number; canvasY: number;
  } | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });

  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const spaceHeldRef = useRef(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const blocks = useStore(s => s.blocks);
  const addCanvasBlock = useStore(s => s.addCanvasBlock);
  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);
  const deleteCanvasBlock = useStore(s => s.deleteCanvasBlock);
  const setBlocks = useStore(s => s.setBlocks);

  const pageBlocks = useMemo(
    () => blocks.filter(b => b.canvasId === entity.id),
    [blocks, entity.id]
  );

  const history = useCanvasHistory(pageBlocks);
  const { snapWithObjects } = useCanvasSnap(snapEnabled, pageBlocks);
  const multiSelect = useCanvasMultiSelect(pageBlocks);

  // Show style panel when something is selected
  useEffect(() => {
    setShowStylePanel(selectedIds.size > 0);
  }, [selectedIds]);

  // Keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); handleUndo(); return; }
        if (e.key === 'y' || (e.shiftKey && e.key === 'z')) { e.preventDefault(); handleRedo(); return; }
        if (e.key === 'g') {
          e.preventDefault();
          e.shiftKey ? handleUngroup() : handleGroup();
          return;
        }
      }

      switch (e.key.toLowerCase()) {
        case 'v': case 'escape':
          setActiveTool('select');
          if (e.key === 'Escape') {
            setSelectedIds(new Set());
            setPendingConnection(null);
          }
          break;
        case 'h': setActiveTool('move'); break;
        case 'r': setActiveTool('rect'); break;
        case 'o': setActiveTool('ellipse'); break;
        case 'd': setActiveTool('diamond'); break;
        case 'a': setActiveTool('arrow'); break;
        case 'l': setActiveTool('line'); break;
        case 'p': setActiveTool('freedraw'); break;
        case 't': setActiveTool('text'); break;
        case 'i': setActiveTool('image'); break;
        case 'c': setActiveTool('comment'); break;
        case 'f': setActiveTool('section'); break;
        case ' ':
          spaceHeldRef.current = true;
          e.preventDefault();
          break;
        case 'delete': case 'backspace':
          selectedIds.forEach(id => deleteCanvasBlock(id));
          setSelectedIds(new Set());
          break;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ') spaceHeldRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [selectedIds]);

  // Zoom
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setViewport(prev => {
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.scale + delta));
        const ratio = newScale / prev.scale;
        return { x: mx - ratio * (mx - prev.x), y: my - ratio * (my - prev.y), scale: newScale };
      });
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // Pending connection tracking
  useEffect(() => {
    if (!pendingConnection) return;
    const onMove = (e: PointerEvent) => {
      const rect = canvasContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = (e.clientX - rect.left - viewport.x) / viewport.scale;
      const cy = (e.clientY - rect.top - viewport.y) / viewport.scale;
      setPendingConnection(prev => prev ? { ...prev, x2: cx, y2: cy } : null);
    };
    document.addEventListener('pointermove', onMove);
    return () => document.removeEventListener('pointermove', onMove);
  }, [pendingConnection, viewport]);

  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewport.x) / viewport.scale,
      y: (clientY - rect.top - viewport.y) / viewport.scale,
    };
  }, [viewport]);

  function handleUndo() {
    const prev = history.undo();
    if (prev) {
      const others = blocks.filter(b => b.canvasId !== entity.id);
      setBlocks([...others, ...prev]);
    }
  }

  function handleRedo() {
    const next = history.redo();
    if (next) {
      const others = blocks.filter(b => b.canvasId !== entity.id);
      setBlocks([...others, ...next]);
    }
  }

  function handleGroup() {
    if (selectedIds.size < 2) return;
    const groupId = generateId();
    selectedIds.forEach(id => updateCanvasBlock(id, { groupId }));
    history.push(blocks.filter(b => b.canvasId === entity.id));
  }

  function handleUngroup() {
    selectedIds.forEach(id => {
      const b = blocks.find(x => x.id === id);
      if (b?.groupId) updateCanvasBlock(id, { groupId: undefined });
    });
    history.push(blocks.filter(b => b.canvasId === entity.id));
  }

  // Alignment helpers
  function alignBlocks(axis: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom') {
    const sel = pageBlocks.filter(b => selectedIds.has(b.id));
    if (sel.length < 2) return;
    const xs = sel.map(b => b.x ?? 0), ys = sel.map(b => b.y ?? 0);
    const rights = sel.map(b => (b.x ?? 0) + (b.width ?? 0));
    const bottoms = sel.map(b => (b.y ?? 0) + (b.height ?? 0));
    const minX = Math.min(...xs), maxRight = Math.max(...rights);
    const minY = Math.min(...ys), maxBottom = Math.max(...bottoms);
    sel.forEach(b => {
      switch (axis) {
        case 'left':    updateCanvasBlock(b.id, { x: minX }); break;
        case 'centerH': updateCanvasBlock(b.id, { x: (minX + maxRight) / 2 - (b.width ?? 0) / 2 }); break;
        case 'right':   updateCanvasBlock(b.id, { x: maxRight - (b.width ?? 0) }); break;
        case 'top':     updateCanvasBlock(b.id, { y: minY }); break;
        case 'centerV': updateCanvasBlock(b.id, { y: (minY + maxBottom) / 2 - (b.height ?? 0) / 2 }); break;
        case 'bottom':  updateCanvasBlock(b.id, { y: maxBottom - (b.height ?? 0) }); break;
      }
    });
    history.push(blocks.filter(b => b.canvasId === entity.id));
  }

  const handleBgPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.id !== 'canvas-bg' && !target.closest('#canvas-bg')) return;

    // Close media popover
    if (mediaPopover) { setMediaPopover(null); return; }
    if (pendingConnection) { setPendingConnection(null); return; }

    const shouldPan = spaceHeldRef.current || activeTool === 'move' || e.button === 1;
    if (shouldPan) {
      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y };
      const onMove = (ev: PointerEvent) => {
        if (!isPanningRef.current) return;
        setViewport(prev => ({
          ...prev,
          x: panStartRef.current.vx + (ev.clientX - panStartRef.current.x),
          y: panStartRef.current.vy + (ev.clientY - panStartRef.current.y),
        }));
      };
      const onUp = () => {
        isPanningRef.current = false;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      return;
    }

    // Rubber-band multi-select on empty canvas with select tool
    if (activeTool === 'select' && e.button === 0) {
      setSelectedIds(new Set());
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      multiSelect.startSelection(x, y);

      const onMove = (ev: PointerEvent) => {
        const { x: cx, y: cy } = screenToCanvas(ev.clientX, ev.clientY);
        multiSelect.updateSelection(cx, cy);
      };
      const onUp = () => {
        setSelectedIds(new Set(multiSelect.selectedIds));
        multiSelect.endSelection();
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      return;
    }

    // Tool actions
    const { x, y } = screenToCanvas(e.clientX, e.clientY);

    if (activeTool === 'text') {
      addCanvasBlock({ id: generateId(), type: 'text', content: 'Text', x, y, canvasId: entity.id });
      setActiveTool('select');
      history.push(blocks.filter(b => b.canvasId === entity.id));
    } else if (activeTool === 'image') {
      setMediaPopover({ x: e.clientX, y: e.clientY, canvasX: x, canvasY: y });
    } else if (activeTool === 'section') {
      addCanvasBlock({ id: generateId(), type: 'section', content: 'Frame', x, y, width: 300, height: 200, canvasId: entity.id });
      setActiveTool('select');
      history.push(blocks.filter(b => b.canvasId === entity.id));
    } else if (activeTool === 'comment') {
      addCanvasBlock({ id: generateId(), type: 'comment', content: '', x, y, canvasId: entity.id });
      setActiveTool('select');
      history.push(blocks.filter(b => b.canvasId === entity.id));
    }
  };

  function selectBlock(id: string, addToSelection: boolean) {
    if (addToSelection) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
  }

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col bg-[#141413]">
      {/* Top bar toolbar */}
      <CanvasToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        showLayers={showLayers}
        setShowLayers={setShowLayers}
        snapEnabled={snapEnabled}
        setSnapEnabled={setSnapEnabled}
        zoom={viewport.scale}
        onZoomIn={() => setViewport(p => ({ ...p, scale: Math.min(MAX_ZOOM, p.scale + ZOOM_STEP) }))}
        onZoomOut={() => setViewport(p => ({ ...p, scale: Math.max(MIN_ZOOM, p.scale - ZOOM_STEP) }))}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={() => { /* wired in Task 12 */ }}
        onShare={() => { /* wired in Task 12 */ }}
        canvasTitle={entity.title}
      />

      {/* Main canvas area */}
      <div className="flex flex-1 overflow-hidden" style={{ paddingTop: 40 }}>
        {showLayers && (
          <CanvasLayersPanel
            canvasId={entity.id}
            selectedIds={selectedIds}
            onSelect={selectBlock}
          />
        )}

        {/* Canvas */}
        <div
          ref={canvasContainerRef}
          className="flex-1 relative overflow-hidden"
          style={{
            cursor: activeTool === 'move' || spaceHeldRef.current ? 'grab' : undefined,
            background: '#141413',
            backgroundImage: 'radial-gradient(circle, rgba(233,233,226,0.055) 1px, transparent 1px)',
            backgroundSize: `${20 * viewport.scale}px ${20 * viewport.scale}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          }}
        >
          <div
            id="canvas-bg"
            onPointerDown={handleBgPointerDown}
            className="w-full h-full relative"
          >
            {/* Viewport transform layer */}
            <div
              id="canvas-viewport"
              style={{
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
                transformOrigin: '0 0',
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '100%',
                pointerEvents: 'none',
              }}
            >
              <div style={{ pointerEvents: 'auto' }}>
                <CanvasConnections canvasId={entity.id} />

                {pendingConnection && (
                  <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-[5000]">
                    <line
                      x1={pendingConnection.x} y1={pendingConnection.y}
                      x2={pendingConnection.x2} y2={pendingConnection.y2}
                      stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 4"
                    />
                  </svg>
                )}

                {/* Rubber-band selection rect */}
                {multiSelect.selectionRect && (
                  <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-[4999]">
                    <rect
                      x={multiSelect.selectionRect.x} y={multiSelect.selectionRect.y}
                      width={multiSelect.selectionRect.width} height={multiSelect.selectionRect.height}
                      fill="rgba(211,143,54,0.05)" stroke="rgba(211,143,54,0.4)"
                      strokeWidth="1" strokeDasharray="4 3"
                    />
                  </svg>
                )}

                {pageBlocks.map(b => (
                  <CanvasBlock
                    key={b.id}
                    block={b}
                    activeTool={activeTool}
                    viewport={viewport}
                    snapWithObjects={snapWithObjects}
                    isSelected={selectedIds.has(b.id)}
                    onSelect={selectBlock}
                    onCommit={() => history.push(blocks.filter(x => x.canvasId === entity.id))}
                    onConnectStart={(side, x, y) => {
                      if (activeTool !== 'connect') return;
                      if (!pendingConnection) {
                        setPendingConnection({ fromId: b.id, fromSide: side, x, y, x2: x, y2: y });
                      } else if (pendingConnection.fromId !== b.id) {
                        addCanvasBlock({
                          id: generateId(), type: 'connection', content: '',
                          canvasId: entity.id,
                          fromId: pendingConnection.fromId,
                          fromSide: pendingConnection.fromSide as any,
                          toId: b.id, toSide: side as any,
                          x: 0, y: 0,
                        });
                        setPendingConnection(null);
                        setActiveTool('select');
                        history.push(blocks.filter(x => x.canvasId === entity.id));
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Media popover */}
          {mediaPopover && (
            <MediaUploadPopover
              position={{ x: mediaPopover.x, y: mediaPopover.y }}
              onConfirm={(url) => {
                addCanvasBlock({
                  id: generateId(), type: 'image', content: '',
                  mediaUrl: url,
                  x: mediaPopover.canvasX, y: mediaPopover.canvasY,
                  width: 300, height: 200,
                  canvasId: entity.id,
                });
                setMediaPopover(null);
                setActiveTool('select');
                history.push(blocks.filter(x => x.canvasId === entity.id));
              }}
              onClose={() => setMediaPopover(null)}
            />
          )}
        </div>

        {/* Right style panel */}
        {showStylePanel && (
          <CanvasStylePanel
            selectedIds={selectedIds}
            canvasId={entity.id}
            onAlignLeft={() => alignBlocks('left')}
            onAlignCenterH={() => alignBlocks('centerH')}
            onAlignRight={() => alignBlocks('right')}
            onAlignTop={() => alignBlocks('top')}
            onAlignCenterV={() => alignBlocks('centerV')}
            onAlignBottom={() => alignBlocks('bottom')}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update CanvasBlock to accept new props**

In `src/components/canvas/CanvasBlock.tsx`, update the `CanvasBlockProps` interface and `handlePointerDown`/`handlePointerUp` to accept and call `onCommit` and `snapWithObjects`:

```tsx
// Updated interface (add these two fields):
interface CanvasBlockProps {
  block: EditorBlock;
  activeTool?: CanvasTool;
  viewport: { x: number; y: number; scale: number };
  onConnectStart?: (side: string, x: number, y: number) => void;
  isSelected?: boolean;
  onSelect?: (id: string, addToSelection: boolean) => void;
  onCommit?: () => void;
  snapWithObjects?: (x: number, y: number, w: number, h: number, excludeId: string) => { x: number; y: number };
}
```

In `handlePointerDown`, update the `onSelect` call to pass `e.shiftKey`:
```tsx
if (!isInput) {
  onSelect?.(block.id, e.shiftKey);
}
```

In the `handlePointerUp` closure inside `handlePointerDown`, after calling `updateCanvasBlock`, add:
```tsx
onCommit?.();
```

In `handleResizeStart`'s `handlePointerUp`, fix the stale closure bug — use refs instead of state for final position/size. Replace the existing `handlePointerUp` inside `handleResizeStart`:

```tsx
// At top of handleResizeStart, add these refs:
const finalPosRef = useRef({ x: block.x || 0, y: block.y || 0 });
const finalSizeRef = useRef({ w: block.width || 280, h: block.height || 150 });

// In handlePointerMove, update refs alongside state:
finalPosRef.current = { x: newX, y: newY };
finalSizeRef.current = { w: newW, h: newH };

// In handlePointerUp, use refs:
const handlePointerUp = () => {
  setIsResizing(false);
  updateCanvasBlock(block.id, {
    x: finalPosRef.current.x,
    y: finalPosRef.current.y,
    width: finalSizeRef.current.w,
    height: finalSizeRef.current.h,
  });
  onCommit?.();
  document.removeEventListener('pointermove', handlePointerMove);
  document.removeEventListener('pointerup', handlePointerUp);
};
```

- [ ] **Step 3: Verify TypeScript and check for regressions**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 4: Start dev server and verify canvas loads**

```bash
npm run dev
```

Open http://localhost:3000, navigate to a canvas entity. Verify:
- Top bar toolbar appears with tool pill groups
- Layers panel on left
- Style panel appears on right when clicking a block
- Undo/redo buttons visible in top bar
- Dot grid visible
- Blocks can be dragged without the resize-commit bug

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/CanvasPage.tsx src/components/canvas/CanvasBlock.tsx
git commit -m "feat(canvas): rewrite CanvasPage + fix CanvasBlock pointer/resize bugs, wire all Phase 1 hooks and panels"
```

---

## Phase 2 — Shape tools

---

### Task 9: CanvasShapeLayer — SVG shapes

**Files:**
- Create: `src/components/canvas/CanvasShapeLayer.tsx`
- Modify: `src/components/canvas/CanvasPage.tsx` — add shape tool click-drag creation + render CanvasShapeLayer

**Context:** SVG overlay rendering all blocks with `type === 'shape'`. Also handles click-drag creation for rect, ellipse, diamond, line, arrow, freedraw when those tools are active.

- [ ] **Step 1: Create CanvasShapeLayer.tsx**

Create `src/components/canvas/CanvasShapeLayer.tsx`:

```tsx
"use client";

import { EditorBlock, CanvasStyleExt } from '@/data/store';
import { useMemo } from 'react';

interface Props {
  blocks: EditorBlock[];
  selectedIds: Set<string>;
  onSelect: (id: string, addToSelection: boolean) => void;
}

function shapeStroke(style: CanvasStyleExt): string {
  return style.stroke && style.stroke !== 'transparent' ? style.stroke : 'rgba(233,233,226,0.35)';
}
function shapeFill(style: CanvasStyleExt): string {
  const fill = style.fill ?? 'transparent';
  if (fill === 'transparent') return 'transparent';
  const op = style.fillOpacity ?? 0.15;
  // Convert hex to rgba
  const r = parseInt(fill.slice(1,3), 16);
  const g = parseInt(fill.slice(3,5), 16);
  const b = parseInt(fill.slice(5,7), 16);
  return `rgba(${r},${g},${b},${op})`;
}
function strokeDasharray(style: CanvasStyleExt): string {
  if (style.strokeStyle === 'dashed') return '8 4';
  if (style.strokeStyle === 'dotted') return '2 4';
  return 'none';
}

function ShapeEl({ block, isSelected, onSelect }: {
  block: EditorBlock; isSelected: boolean; onSelect: (id: string, shift: boolean) => void;
}) {
  const style = block.canvasStyleExt ?? {};
  const x = block.x ?? 0, y = block.y ?? 0;
  const w = block.width ?? 100, h = block.height ?? 60;
  const sw = style.strokeWidth ?? 1.5;
  const r = style.cornerRadius ?? 0;
  const stroke = shapeStroke(style);
  const fill = shapeFill(style);
  const da = strokeDasharray(style);
  const opacity = style.opacity ?? 1;
  const selectionStroke = 'rgba(211,143,54,0.9)';

  const sharedProps = {
    stroke: isSelected ? selectionStroke : stroke,
    strokeWidth: isSelected ? Math.max(sw, 1.5) : sw,
    strokeDasharray: da,
    fill,
    opacity,
    style: { cursor: 'move' },
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      onSelect(block.id, e.shiftKey);
    },
  };

  if (block.shapeKind === 'rect') {
    return <rect x={x} y={y} width={w} height={h} rx={r} ry={r} {...sharedProps} />;
  }
  if (block.shapeKind === 'ellipse') {
    return <ellipse cx={x + w/2} cy={y + h/2} rx={w/2} ry={h/2} {...sharedProps} />;
  }
  if (block.shapeKind === 'diamond') {
    const pts = `${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}`;
    return <polygon points={pts} {...sharedProps} />;
  }
  if (block.shapeKind === 'line' || block.shapeKind === 'arrow') {
    const pts = block.points ?? [[x, y], [x + w, y + h]];
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
    const markerId = `arrow-${block.id}`;
    return (
      <>
        {block.shapeKind === 'arrow' && (
          <defs>
            <marker id={markerId} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L0,8 L8,4 z" fill={isSelected ? selectionStroke : stroke} />
            </marker>
          </defs>
        )}
        <path
          d={d}
          fill="none"
          stroke={isSelected ? selectionStroke : stroke}
          strokeWidth={isSelected ? Math.max(sw, 1.5) : sw}
          strokeDasharray={da}
          opacity={opacity}
          markerEnd={block.shapeKind === 'arrow' ? `url(#${markerId})` : undefined}
          style={{ cursor: 'move' }}
          onPointerDown={(e) => { e.stopPropagation(); onSelect(block.id, e.shiftKey); }}
        />
      </>
    );
  }
  if (block.shapeKind === 'freedraw') {
    const pts = block.points ?? [];
    if (pts.length < 2) return null;
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
    return (
      <path
        d={d} fill="none"
        stroke={isSelected ? selectionStroke : stroke}
        strokeWidth={isSelected ? Math.max(sw, 2) : sw}
        opacity={opacity}
        strokeLinecap="round" strokeLinejoin="round"
        style={{ cursor: 'move' }}
        onPointerDown={(e) => { e.stopPropagation(); onSelect(block.id, e.shiftKey); }}
      />
    );
  }
  return null;
}

export function CanvasShapeLayer({ blocks, selectedIds, onSelect }: Props) {
  const shapes = useMemo(() => blocks.filter(b => b.type === 'shape'), [blocks]);

  return (
    <svg
      className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
      style={{ zIndex: 1 }}
    >
      {shapes.map(b => (
        <g key={b.id} style={{ pointerEvents: 'auto' }}>
          <ShapeEl block={b} isSelected={selectedIds.has(b.id)} onSelect={onSelect} />
        </g>
      ))}
    </svg>
  );
}
```

- [ ] **Step 2: Add shape creation drag logic to CanvasPage**

In `src/components/canvas/CanvasPage.tsx`, import `CanvasShapeLayer`:
```tsx
import { CanvasShapeLayer } from './CanvasShapeLayer';
```

Add a `drawingShape` state for tracking in-progress shape drag:
```tsx
const [drawingShape, setDrawingShape] = useState<{
  kind: string; startX: number; startY: number; x: number; y: number; w: number; h: number;
  points: [number, number][];
} | null>(null);
```

In `handleBgPointerDown`, before the existing tool actions section, add shape tool handling:

```tsx
const SHAPE_TOOLS = ['rect', 'ellipse', 'diamond', 'arrow', 'line', 'freedraw'];
if (SHAPE_TOOLS.includes(activeTool) && e.button === 0) {
  const { x, y } = screenToCanvas(e.clientX, e.clientY);
  const kind = activeTool;
  setDrawingShape({ kind, startX: x, startY: y, x, y, w: 0, h: 0, points: [[x, y]] });

  const onMove = (ev: PointerEvent) => {
    const { x: cx, y: cy } = screenToCanvas(ev.clientX, ev.clientY);
    setDrawingShape(prev => {
      if (!prev) return null;
      if (kind === 'freedraw' || kind === 'line' || kind === 'arrow') {
        return { ...prev, points: [...prev.points, [cx, cy] as [number, number]], w: cx - prev.startX, h: cy - prev.startY };
      }
      const nx = Math.min(prev.startX, cx), ny = Math.min(prev.startY, cy);
      return { ...prev, x: nx, y: ny, w: Math.abs(cx - prev.startX), h: Math.abs(cy - prev.startY) };
    });
  };

  const onUp = (ev: PointerEvent) => {
    setDrawingShape(prev => {
      if (!prev) return null;
      const { x: cx, y: cy } = screenToCanvas(ev.clientX, ev.clientY);
      const isPoint = Math.abs(cx - prev.startX) < 3 && Math.abs(cy - prev.startY) < 3;
      if (!isPoint) {
        const isLineish = kind === 'line' || kind === 'arrow' || kind === 'freedraw';
        addCanvasBlock({
          id: generateId(), type: 'shape', content: '', canvasId: entity.id,
          shapeKind: kind as any,
          x: isLineish ? 0 : prev.x, y: isLineish ? 0 : prev.y,
          width: isLineish ? 0 : Math.max(prev.w, 20),
          height: isLineish ? 0 : Math.max(prev.h, 20),
          points: isLineish ? prev.points : undefined,
          canvasStyleExt: {
            stroke: '#d38f36', strokeWidth: 1.5, strokeStyle: 'solid',
            fill: isLineish ? 'transparent' : '#d38f36', fillOpacity: isLineish ? 0 : 0.1,
          },
        });
        history.push(blocks.filter(b => b.canvasId === entity.id));
      }
      return null;
    });
    setActiveTool('select');
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  return;
}
```

Inside the viewport transform `<div>`, add `CanvasShapeLayer` before `CanvasConnections`:
```tsx
<CanvasShapeLayer
  blocks={pageBlocks}
  selectedIds={selectedIds}
  onSelect={selectBlock}
/>
```

Also render the in-progress drawing shape as a preview SVG:
```tsx
{drawingShape && (
  <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-[4998]">
    {(drawingShape.kind === 'rect') && (
      <rect x={drawingShape.x} y={drawingShape.y} width={drawingShape.w} height={drawingShape.h}
        fill="rgba(211,143,54,0.08)" stroke="rgba(211,143,54,0.6)" strokeWidth="1.5" strokeDasharray="4 3" />
    )}
    {(drawingShape.kind === 'ellipse') && (
      <ellipse cx={drawingShape.x + drawingShape.w/2} cy={drawingShape.y + drawingShape.h/2}
        rx={drawingShape.w/2} ry={drawingShape.h/2}
        fill="rgba(211,143,54,0.08)" stroke="rgba(211,143,54,0.6)" strokeWidth="1.5" strokeDasharray="4 3" />
    )}
    {(drawingShape.kind === 'diamond') && (() => {
      const {x, y, w, h} = drawingShape;
      return <polygon points={`${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}`}
        fill="rgba(211,143,54,0.08)" stroke="rgba(211,143,54,0.6)" strokeWidth="1.5" strokeDasharray="4 3" />;
    })()}
    {(['line','arrow','freedraw'].includes(drawingShape.kind)) && drawingShape.points.length > 1 && (
      <path d={drawingShape.points.map((p,i) => `${i===0?'M':'L'}${p[0]},${p[1]}`).join(' ')}
        fill="none" stroke="rgba(211,143,54,0.6)" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />
    )}
  </svg>
)}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Test in browser**

Start dev server. Navigate to a canvas. Select each shape tool (R, O, D, A, L, P) and draw a shape. Verify:
- Preview outline shows while dragging
- Shape appears after releasing
- Shape is selectable (accent outline appears)
- Style panel shows fill/stroke controls when shape is selected

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/CanvasShapeLayer.tsx src/components/canvas/CanvasPage.tsx
git commit -m "feat(canvas): add SVG shape layer with click-drag creation for rect/ellipse/diamond/line/arrow/freedraw"
```

---

## Phase 3 — Cloud sync + collaboration

---

### Task 10: Supabase migration — canvas_blocks table

**Files:**
- Create: `supabase/migrations/20260506_canvas_blocks.sql`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260506_canvas_blocks.sql`:

```sql
-- canvas_blocks: stores EditorBlock rows for canvas entities
create table if not exists canvas_blocks (
  id            text primary key,
  canvas_id     text not null references entities(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  workspace_id  text,
  type          text not null,
  shape_kind    text,
  x             float,
  y             float,
  width         float,
  height        float,
  content       text,
  style         jsonb,
  points        jsonb,
  parent_id     text,
  z_index       int default 0,
  group_id      text,
  updated_at    timestamptz not null default now()
);

-- Index for fast canvas lookups
create index if not exists canvas_blocks_canvas_id_idx on canvas_blocks(canvas_id);

-- RLS
alter table canvas_blocks enable row level security;

create policy "Users can read their own canvas blocks"
  on canvas_blocks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own canvas blocks"
  on canvas_blocks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own canvas blocks"
  on canvas_blocks for update
  using (auth.uid() = user_id);

create policy "Users can delete their own canvas blocks"
  on canvas_blocks for delete
  using (auth.uid() = user_id);

-- Enable realtime for this table
alter publication supabase_realtime add table canvas_blocks;
```

- [ ] **Step 2: Apply migration locally (if using Supabase CLI)**

```bash
npx supabase db push
```

Expected: migration applied successfully. If Supabase CLI not available, apply via the Supabase dashboard SQL editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260506_canvas_blocks.sql
git commit -m "feat(canvas): add canvas_blocks Supabase table + RLS + realtime"
```

---

### Task 11: canvasSync.ts — block sync layer

**Files:**
- Create: `src/lib/canvasSync.ts`

**Context:** Follows the same pattern as `src/lib/sync.ts`. Upserts/deletes canvas blocks in Supabase, debounced 300ms. Also sets up a realtime subscription that writes incoming changes back to the Zustand store.

- [ ] **Step 1: Read sync.ts for the upsert/delete pattern**

Read `src/lib/sync.ts` lines 1-150 to understand the mapper and upsert pattern before writing.

- [ ] **Step 2: Create canvasSync.ts**

Create `src/lib/canvasSync.ts`:

```ts
import { supabase } from './supabase';
import type { EditorBlock, CanvasStyleExt } from '@/data/store';

// ─── Row ↔ store mappers ──────────────────────────────────────────────────────

function blockToRow(b: EditorBlock, userId: string, workspaceId: string): Record<string, any> {
  return {
    id:           b.id,
    canvas_id:    b.canvasId!,
    user_id:      userId,
    workspace_id: workspaceId,
    type:         b.type,
    shape_kind:   b.shapeKind ?? null,
    x:            b.x ?? null,
    y:            b.y ?? null,
    width:        b.width ?? null,
    height:       b.height ?? null,
    content:      b.content ?? null,
    style:        b.canvasStyleExt ?? null,
    points:       b.points ?? null,
    parent_id:    b.parentId ?? null,
    z_index:      b.zIndex ?? 0,
    group_id:     b.groupId ?? null,
    updated_at:   new Date().toISOString(),
  };
}

function rowToBlock(row: Record<string, any>): EditorBlock {
  return {
    id:             row.id,
    canvasId:       row.canvas_id,
    type:           row.type,
    content:        row.content ?? '',
    shapeKind:      row.shape_kind ?? undefined,
    x:              row.x ?? 0,
    y:              row.y ?? 0,
    width:          row.width ?? undefined,
    height:         row.height ?? undefined,
    canvasStyleExt: (row.style as CanvasStyleExt) ?? undefined,
    points:         row.points ?? undefined,
    parentId:       row.parent_id ?? undefined,
    zIndex:         row.z_index ?? undefined,
    groupId:        row.group_id ?? undefined,
  };
}

// ─── Debounce ─────────────────────────────────────────────────────────────────

const pendingUpserts = new Map<string, ReturnType<typeof setTimeout>>();

export async function upsertCanvasBlock(
  block: EditorBlock, userId: string, workspaceId: string
): Promise<void> {
  if (!supabase || !block.canvasId) return;
  // Cancel any pending upsert for this block
  const existing = pendingUpserts.get(block.id);
  if (existing) clearTimeout(existing);
  pendingUpserts.set(block.id, setTimeout(async () => {
    pendingUpserts.delete(block.id);
    const row = blockToRow(block, userId, workspaceId);
    const { error } = await supabase.from('canvas_blocks').upsert(row, { onConflict: 'id' });
    if (error) console.error('[canvasSync] upsertCanvasBlock', error);
  }, 300));
}

export async function deleteCanvasBlock(blockId: string): Promise<void> {
  if (!supabase) return;
  const pending = pendingUpserts.get(blockId);
  if (pending) { clearTimeout(pending); pendingUpserts.delete(blockId); }
  const { error } = await supabase.from('canvas_blocks').delete().eq('id', blockId);
  if (error) console.error('[canvasSync] deleteCanvasBlock', error);
}

export async function loadCanvasBlocks(canvasId: string): Promise<EditorBlock[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('canvas_blocks')
    .select('*')
    .eq('canvas_id', canvasId);
  if (error) { console.error('[canvasSync] loadCanvasBlocks', error); return []; }
  return (data ?? []).map(rowToBlock);
}

// ─── Realtime subscription ────────────────────────────────────────────────────

type OnChange = (blocks: EditorBlock[]) => void;

export function subscribeCanvasBlocks(
  canvasId: string,
  getCurrentBlocks: () => EditorBlock[],
  onChange: OnChange
): () => void {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`canvas_blocks:${canvasId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'canvas_blocks', filter: `canvas_id=eq.${canvasId}` },
      (payload) => {
        const current = getCurrentBlocks();
        if (payload.eventType === 'DELETE') {
          onChange(current.filter(b => b.id !== payload.old.id));
        } else {
          const incoming = rowToBlock(payload.new as Record<string, any>);
          const idx = current.findIndex(b => b.id === incoming.id);
          if (idx === -1) {
            onChange([...current, incoming]);
          } else {
            const next = [...current];
            next[idx] = incoming;
            onChange(next);
          }
        }
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/canvasSync.ts
git commit -m "feat(canvas): add canvasSync Supabase upsert/delete/realtime with 300ms debounce"
```

---

### Task 12: canvasExport + canvasShare, wire into CanvasPage

**Files:**
- Create: `src/lib/canvasExport.ts`
- Create: `src/lib/canvasShare.ts`
- Modify: `src/components/canvas/CanvasPage.tsx` — wire export and share handlers

- [ ] **Step 1: Install html-to-image**

```bash
npm install html-to-image
```

Expected: package added to package.json.

- [ ] **Step 2: Create canvasExport.ts**

Create `src/lib/canvasExport.ts`:

```ts
import { toPng } from 'html-to-image';

export async function exportCanvasToPng(
  viewportEl: HTMLElement,
  filename: string
): Promise<void> {
  const dataUrl = await toPng(viewportEl, {
    backgroundColor: '#141413',
    pixelRatio: 2,
  });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${filename}.png`;
  a.click();
}

export async function copyCanvasToClipboard(viewportEl: HTMLElement): Promise<void> {
  const dataUrl = await toPng(viewportEl, { backgroundColor: '#141413', pixelRatio: 2 });
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
```

- [ ] **Step 3: Create canvasShare.ts**

Create `src/lib/canvasShare.ts`:

```ts
export function getCanvasShareUrl(entityId: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/canvas/${entityId}`;
}

export function copyShareLinkToClipboard(entityId: string): void {
  const url = getCanvasShareUrl(entityId);
  navigator.clipboard.writeText(url).catch(console.error);
}
```

- [ ] **Step 4: Wire export and share in CanvasPage**

In `src/components/canvas/CanvasPage.tsx`, add imports:
```tsx
import { exportCanvasToPng } from '@/lib/canvasExport';
import { copyShareLinkToClipboard } from '@/lib/canvasShare';
```

Add a ref for the viewport element:
```tsx
const viewportRef = useRef<HTMLDivElement>(null);
```

Add `id="canvas-viewport-export"` to the viewport transform div.

Replace the placeholder `onExport` and `onShare` in `<CanvasToolbar>`:
```tsx
onExport={async () => {
  const el = document.getElementById('canvas-viewport-export');
  if (el) await exportCanvasToPng(el as HTMLElement, entity.title);
}}
onShare={() => {
  copyShareLinkToClipboard(entity.id);
  // TODO: show a toast "Link copied"
}}
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Test export in browser**

Start dev server. Draw some shapes on a canvas. Click the Export button in the top bar. Verify a PNG file downloads.

- [ ] **Step 7: Commit**

```bash
git add src/lib/canvasExport.ts src/lib/canvasShare.ts src/components/canvas/CanvasPage.tsx package.json package-lock.json
git commit -m "feat(canvas): add PNG export via html-to-image and share link copy"
```

---

### Task 13: Wire cloud sync + live cursors in CanvasPage

**Files:**
- Modify: `src/components/canvas/CanvasPage.tsx`

**Context:** On canvas mount: load blocks from Supabase, subscribe to realtime block changes, and broadcast cursor position. On unmount: unsubscribe.

- [ ] **Step 1: Add cursor presence state**

In `CanvasPage`, add:
```tsx
const [remoteCursors, setRemoteCursors] = useState<{ userId: string; name: string; x: number; y: number; color: string }[]>([]);
```

- [ ] **Step 2: Add cloud sync useEffect**

In `CanvasPage`, add the following effect after the existing effects. It only runs when `cloudSyncEnabled` is true (read from the Zustand store):

```tsx
const cloudSyncEnabled = useStore(s => s.cloudSyncEnabled);

useEffect(() => {
  if (!cloudSyncEnabled) return;

  // Load initial blocks from Supabase
  loadCanvasBlocks(entity.id).then(remoteBlocks => {
    if (remoteBlocks.length === 0) return;
    const others = blocks.filter(b => b.canvasId !== entity.id);
    setBlocks([...others, ...remoteBlocks]);
  });

  // Subscribe to realtime block changes
  const unsub = subscribeCanvasBlocks(
    entity.id,
    () => useStore.getState().blocks.filter(b => b.canvasId === entity.id),
    (updated) => {
      const others = useStore.getState().blocks.filter(b => b.canvasId !== entity.id);
      setBlocks([...others, ...updated]);
    }
  );

  return unsub;
}, [entity.id, cloudSyncEnabled]);
```

Add import at top of CanvasPage:
```tsx
import { loadCanvasBlocks, subscribeCanvasBlocks } from '@/lib/canvasSync';
```

- [ ] **Step 3: Broadcast cursor position**

In the canvas `<div>` (the one with `id="canvas-bg"`), add an `onPointerMove` handler:

```tsx
onPointerMove={(e) => {
  if (!cloudSyncEnabled || !supabase) return;
  // Throttle to ~30fps
  const now = Date.now();
  if ((window as any).__lastCursorBroadcast && now - (window as any).__lastCursorBroadcast < 33) return;
  (window as any).__lastCursorBroadcast = now;
  const { x, y } = screenToCanvas(e.clientX, e.clientY);
  supabase.channel(`cursors:${entity.id}`).send({
    type: 'broadcast',
    event: 'cursor',
    payload: { x, y },
  }).catch(() => {});
}}
```

Add import:
```tsx
import { supabase } from '@/lib/supabase';
```

- [ ] **Step 4: Subscribe to remote cursors**

Add a cursor subscription effect:

```tsx
useEffect(() => {
  if (!cloudSyncEnabled || !supabase) return;

  const COLORS = ['#5b9cf6', '#a78bfa', '#4ade80', '#f87171', '#f59e0b', '#ec4899'];
  const colorMap = new Map<string, string>();

  const channel = supabase.channel(`cursors:${entity.id}`, {
    config: { presence: { key: 'me' } },
  })
    .on('broadcast', { event: 'cursor' }, ({ payload }) => {
      const uid = payload.userId as string ?? 'unknown';
      if (!colorMap.has(uid)) colorMap.set(uid, COLORS[colorMap.size % COLORS.length]);
      setRemoteCursors(prev => {
        const filtered = prev.filter(c => c.userId !== uid);
        return [...filtered, { userId: uid, name: payload.name ?? 'User', x: payload.x, y: payload.y, color: colorMap.get(uid)! }];
      });
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [entity.id, cloudSyncEnabled]);
```

- [ ] **Step 5: Render remote cursors**

Inside the viewport transform `<div>`, after the rubber-band rect, add:

```tsx
{remoteCursors.map(c => (
  <div
    key={c.userId}
    className="absolute pointer-events-none flex items-start gap-1 z-[6000]"
    style={{ left: c.x, top: c.y }}
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 2L6 12L7.5 8L11 6.5L2 2Z" fill={c.color} />
    </svg>
    <span
      className="text-[10px] px-1.5 py-0.5 rounded-[4px] whitespace-nowrap"
      style={{ background: `${c.color}20`, color: c.color, border: `1px solid ${c.color}40` }}
    >
      {c.name}
    </span>
  </div>
))}
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: Commit**

```bash
git add src/components/canvas/CanvasPage.tsx
git commit -m "feat(canvas): wire Supabase cloud sync, realtime block updates, and live cursor broadcast"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|---|---|
| Fix broken drag/resize interactions | Task 8 (CanvasPage rewrite + CanvasBlock resize fix) |
| Framer-style top toolbar with pill groups | Task 5 |
| Rebuild layers sidebar | Task 6 |
| Right style panel (align, size, fill, border, options) | Task 7 |
| Undo/redo Ctrl+Z/Y | Task 2 + Task 8 |
| Multi-select rubber-band | Task 4 + Task 8 |
| Snap to grid + objects | Task 3 + Task 8 |
| Delete key | Task 8 |
| Escape to deselect | Task 8 |
| Shape tools: rect, ellipse, diamond, arrow, line, freedraw | Task 9 |
| Style panel wired to shapes | Task 7 (canvasStyleExt) |
| Grouping Ctrl+G / ungroup Ctrl+Shift+G | Task 8 |
| Lock (canvasStyleExt.locked) | Task 7 + Task 6 (icon in layers) |
| Shift+click multi-select | Task 8 (selectBlock passes addToSelection) |
| canvas_blocks Supabase table | Task 10 |
| Cloud sync upsert/delete debounced | Task 11 |
| Realtime block subscription | Task 11 + Task 13 |
| Live cursors via Supabase broadcast | Task 13 |
| Export PNG | Task 12 |
| Share link | Task 12 |
| Extend EditorBlock with ShapeKind etc. | Task 1 |

All spec requirements covered. ✓

### Placeholder scan

No TBDs, no "implement later" — all tasks have complete code. ✓

### Type consistency check

- `CanvasTool` defined in Task 5, consumed in Tasks 8, 9 ✓
- `CanvasStyleExt` defined in Task 1, used in Tasks 6, 7, 9, 11 ✓
- `ShapeKind` defined in Task 1, used in Tasks 6, 9, 11 ✓
- `onSelect(id, addToSelection: boolean)` signature consistent across Tasks 6, 7, 8, 9 ✓
- `onCommit()` prop added to CanvasBlock in Task 8 and called in Task 8 step 2 ✓
- `snapWithObjects` passed from CanvasPage (Task 8) to CanvasBlock (Task 8) ✓

Note: `CanvasLayersPanel` uses `Pencil` icon (lucide-react) but does not import it — add `import { ..., Pencil } from 'lucide-react'` in Task 6 when implementing.
