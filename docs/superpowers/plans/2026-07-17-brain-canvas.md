# Brain Canvas P2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 680px list-modal `BrainPanel` with a full-screen spatial canvas where brain nodes are draggable cards with connector dots, edges are drawn as smart rounded-elbow paths, and clicking a node opens its content in the split-mode right column.

**Architecture:** Brain mode is entered via `setActiveEntityId('brain')` which sets `splitViewActive=true, splitViewLeftId='brain'`. This reuses the existing SplitViewLayout and Shell.tsx infrastructure with minimal modifications (SplitViewLayout gains single-column support for when one side is null). The canvas is a purpose-built React component (`BrainCanvasPage`) — NOT the whiteboard engine — reusing only `useCanvasViewport` (pan/zoom) and `computeElbowPoints` (pure edge geometry). Node positions are dragged via a custom 60-line pointer handler and saved to `brain_nodes.position` via the existing `/api/ai/user-brain` route. Toolbar/UI elements (preset picker, stats panel, add-existing popover) are separate focused components composed into the page.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, vitest (`npm test`), lucide-react icons, `@/lib/geometry/arrowPath.computeElbowPoints`, `@/hooks/useCanvasViewport`, `/api/ai/user-brain` route.

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `src/components/brain/canvas/connectorGeometry.ts` | Pure functions: node side → connector point, edge path — no store deps |
| `src/components/brain/canvas/connectorGeometry.test.ts` | Vitest tests for the above |
| `src/components/brain/canvas/BrainNodeCard.tsx` | Node card with 4 connector dots, type icon, title, preview, footer pills |
| `src/components/brain/canvas/BrainCanvasConnections.tsx` | SVG overlay rendering edge paths between nodes |
| `src/components/brain/canvas/useBrainDrag.ts` | Pointer drag handler: mousedown/move/up → update position state → debounced save |
| `src/components/brain/canvas/useBrainData.ts` | Custom hook: fetch brain nodes/edges/budget via GET, mutate via POST |
| `src/lib/brain/formatAge.ts` | Shared relative-time formatter ("5m", "2h") — eliminates inline duplication across components |
| `src/components/brain/canvas/BrainCanvasPage.tsx` | Top-level canvas: viewport, background pan, render nodes + edges + toolbar + overlay |
| `src/components/brain/canvas/BrainToolbar.tsx` | Toolbar: New node, Add existing, Connect toggle, Pan/Select |
| `src/components/brain/canvas/BrainPresetPicker.tsx` | Brain selector dropdown (top-left) — switches selectedBrainId + refetch |
| `src/components/brain/canvas/BrainStatsPanel.tsx` | Budget meter, node count, "playful" counters |
| `src/components/brain/canvas/AddExistingEntityPopover.tsx` | Search/browse popover to add existing note/workspace as a brain node |
| `src/components/brain/canvas/BrainSidebarContent.tsx` | Brain-scoped sidebar: foldable brain rows, node list, Sessions button |

### Modified files
| File | What changes |
|------|-------------|
| `src/data/store.ts` | Extend `setActiveEntityId` for `'brain'` slot; add `openBrainNode(entityId)` action; populate `splitViewActive=true`, `splitViewLeftId='brain'` in the new branch |
| `src/components/layout/SplitViewLayout.tsx` | Support single-column mode (hide divider + right column when one side is null) |
| `src/components/EntityPageRenderer.tsx` | Add case `entityId === 'brain'` → render `<BrainCanvasPage />` |
| `src/components/layout/Sidebar.tsx` | Brain button calls `setActiveEntityId('brain')` not `setBrainOpen(true)`; remove BrainPanel modal mount; add brain-mode sidebar content branch |

### Unchanged (reused as-is)
- `src/hooks/useCanvasViewport.ts` — pan/zoom with no coupling
- `src/lib/geometry/arrowPath.ts:computeElbowPoints` — pure elbow-routing
- `src/app/api/ai/user-brain/route.ts` — all actions (add/update/remove node, connect, switch) already work; no API changes
- `src/lib/bot/services/brainStore.ts` — all methods exist; no changes
- `src/lib/bot/services/brainTypes.ts` — types used; no changes

---

### Task 1: Pure connector geometry module (TDD)

**Files:**
- Create: `src/components/brain/canvas/connectorGeometry.ts`
- Create: `src/components/brain/canvas/connectorGeometry.test.ts`

This module provides the math for connector dots and edge paths. No React, no store — fully testable pure functions.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/brain/canvas/connectorGeometry.test.ts
import { describe, it, expect } from 'vitest';
import {
  connectorPoint,
  buildEdgePath,
  type ConnectorSide,
  type NodeBox,
} from './connectorGeometry';

describe('connectorPoint', () => {
  const box: NodeBox = { x: 100, y: 80, width: 200, height: 120 };

  it('returns center of top edge', () => {
    const p = connectorPoint(box, 'top');
    expect(p.x).toBe(200);  // 100 + 200/2
    expect(p.y).toBe(80);   // 80 (top edge y)
  });

  it('returns center of right edge', () => {
    const p = connectorPoint(box, 'right');
    expect(p.x).toBe(300);  // 100 + 200
    expect(p.y).toBe(140);  // 80 + 120/2
  });

  it('returns center of bottom edge', () => {
    const p = connectorPoint(box, 'bottom');
    expect(p.x).toBe(200);
    expect(p.y).toBe(200);  // 80 + 120
  });

  it('returns center of left edge', () => {
    const p = connectorPoint(box, 'left');
    expect(p.x).toBe(100);
    expect(p.y).toBe(140);
  });
});

describe('buildEdgePath', () => {
  it('returns an SVG path string with 4 elbow vertices', () => {
    const a: NodeBox = { x: 0, y: 0, width: 200, height: 100 };
    const b: NodeBox = { x: 400, y: 200, width: 200, height: 100 };
    const path = buildEdgePath(a, 'right', b, 'left');
    // Path should start with M (move) and contain L (line) segments
    expect(path).toMatch(/^M [\d.]+ [\d.]+ L/);
    // Should have 4 coordinate pairs (start→elbow→elbow→end)
    const coords = path.match(/[\d.]+ [\d.]+/g);
    expect(coords).toHaveLength(4);
  });

  it('returns a valid SVG path for same-axis nodes', () => {
    const a: NodeBox = { x: 0, y: 100, width: 200, height: 100 };
    const b: NodeBox = { x: 400, y: 100, width: 200, height: 100 };
    const path = buildEdgePath(a, 'right', b, 'left');
    // Axis-aligned: straight line, only start + end
    const coords = path.match(/[\d.]+ [\d.]+/g);
    expect(coords).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/brain/canvas/connectorGeometry.test.ts --reporter=verbose`
Expected: FAIL — `Cannot find module './connectorGeometry'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/brain/canvas/connectorGeometry.ts
import { computeElbowPoints } from '@/lib/geometry/arrowPath';

export type ConnectorSide = 'top' | 'right' | 'bottom' | 'left';

export interface NodeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Return the center point of the given side of a node box. */
export function connectorPoint(box: NodeBox, side: ConnectorSide): { x: number; y: number } {
  switch (side) {
    case 'top':    return { x: box.x + box.width / 2, y: box.y };
    case 'right':  return { x: box.x + box.width,     y: box.y + box.height / 2 };
    case 'bottom': return { x: box.x + box.width / 2, y: box.y + box.height };
    case 'left':   return { x: box.x,                  y: box.y + box.height / 2 };
  }
}

/**
 * Build an SVG `M … L …` path string between two connector points on two node boxes.
 * Uses computeElbowPoints for Z-shaped routing. Returns straight line when already
 * axis-aligned. Path uses stroke-linejoin:round at render time for rounded corners.
 */
export function buildEdgePath(
  fromBox: NodeBox, fromSide: ConnectorSide,
  toBox: NodeBox, toSide: ConnectorSide,
): string {
  const a = connectorPoint(fromBox, fromSide);
  const b = connectorPoint(toBox, toSide);
  const elbowPts = computeElbowPoints([[a.x, a.y], [b.x, b.y]]);
  return 'M ' + elbowPts.map(p => `${p[0]} ${p[1]}`).join(' L ');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/brain/canvas/connectorGeometry.test.ts --reporter=verbose`
Expected: PASS — 6 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/components/brain/canvas/connectorGeometry.ts src/components/brain/canvas/connectorGeometry.test.ts
git commit -m "feat(brain): add connector geometry module with connectorPoint and buildEdgePath"
```

---

### Task 2: Store — extend setActiveEntityId for 'brain' slot

**Files:**
- Modify: `src/data/store.ts`

Add the `'brain'` pseudo-ID to the navigation system. When `setActiveEntityId('brain')` is called, it activates split view with `splitViewLeftId='brain'` (canvas on left) and `splitViewRightId` preserved from the previous state. This lets the canvas start full-width (single-column split) or alongside a previously-open note.

Changes needed:
1. **Line ~2217** (`nextRecent` update): Add `&& id !== 'brain'` so 'brain' doesn't pollute recent entities.
2. **After the auto-split block (~line 2253)**: Insert a new `if (id === 'brain')` branch before the generic split-replacement block.
3. **Add a new store action** `openBrainNode(entityId)` that either (a) activates split and sets the right column to entityId, or (b) sets the right column when split is already active — called when clicking a node card or sidebar row.

Define `openBrainNode` after `setActiveEntityId` (e.g. around line 2320, before the closing of the actions section).

- [ ] **Step 1: Add the 'brain' guard to the recent-entities update**

Find line ~2217:
```ts
if (id && id !== 'dashboard') {
  nextRecent = [id, ...nextRecent.filter(rid => rid !== id)].slice(0, 10);
```

Change to:
```ts
if (id && id !== 'dashboard' && id !== 'brain' && id !== 'tracker') {
  nextRecent = [id, ...nextRecent.filter(rid => rid !== id)].slice(0, 10);
```

Also guard `'tracker'` (existing bug) to be safe. Keep the change minimal — this prevents 'brain' and 'tracker' from appearing in the Recent widget.

- [ ] **Step 2: Add the 'brain' branch in setActiveEntityId**

Find after the auto-split paired-entity block (~line 2253). Insert BEFORE the generic split-replacement section at line 2257:

```ts
// Brain canvas mode: enter split view with canvas on the left.
// Keeps the right column if something is already open there (e.g. a note
// the user was viewing). Does NOT force-exit split view (unlike 'chat').
if (id === 'brain') {
  if (!state.splitViewActive) {
    // New brain mode: activate split with canvas on left, right stays empty
    if (!nextTabs.includes('brain')) nextTabs.push('brain');
    set({
      openTabIds: nextTabs,
      activeTabId: 'brain',
      activeEntityId: 'brain',
      recentEntityIds: nextRecent,
      splitViewActive: true,
      splitViewLeftId: 'brain',
      splitViewRightId: state.splitViewRightId ?? null,
      splitViewPinned: false,
    });
  } else {
    // Already in split: replace the active column with brain canvas
    const isLeftActive = state.activeEntityId === state.splitViewLeftId;
    const newLeftId = 'brain'; // always force brain to left
    const newRightId = isLeftActive ? state.splitViewRightId : null;
    if (!nextTabs.includes('brain')) nextTabs.push('brain');
    set({
      openTabIds: nextTabs,
      activeTabId: 'brain',
      activeEntityId: 'brain',
      splitViewLeftId: newLeftId,
      splitViewRightId: newRightId,
      splitViewPinned: false,
      recentEntityIds: nextRecent,
    });
  }
  const newHistory = state.navigationHistory.slice(0, state.historyIndex + 1);
  newHistory.push('brain');
  set({ navigationHistory: newHistory, historyIndex: newHistory.length - 1 });
  return;
}
```

- [ ] **Step 3: Add openBrainNode action**

After the `exitSplitView` function (line ~565, after the split-view actions section), add:

```ts
openBrainNode: (entityId: string) => {
  const state = get();
  // Only valid in brain mode
  if (state.activeEntityId !== 'brain' && state.splitViewLeftId !== 'brain') return;
  if (!state.splitViewActive) {
    // Activate split with canvas on left, entity on right
    set({
      splitViewActive: true,
      splitViewLeftId: 'brain',
      splitViewRightId: entityId,
      activeEntityId: 'brain',
      activeTabId: 'brain',
      splitViewPinned: false,
    });
  } else {
    // Split already active, set the right column (doesn't change left/canvas)
    get().setColumnEntity('right', entityId);
  }
},
```

**Important:** The function `openBrainNode` needs to be placed inside the store's actions object, not at module level. Find the actions section (around line 377 `setDashboardLayout`) and add it among the other navigation actions, ideally after `setActiveEntityId` at ~line 2320.

Also add the TypeScript type for it in `store.types.ts` — find the `AppStore` interface and add:
```ts
openBrainNode: (entityId: string) => void;
```

- [ ] **Step 4: Verify typeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/data/store.ts src/data/store.types.ts
git commit -m "feat(store): add 'brain' pseudo-id navigation and openBrainNode action"
```

---

### Task 3: SplitViewLayout single-column mode

**Files:**
- Modify: `src/components/layout/SplitViewLayout.tsx`

When one column ID is null and the other is set, render only the non-null column at full width, with no divider and no placeholder. This is used by brain mode (left='brain', right=null renders the canvas full-screen) and is generally useful for any split view starting single-column.

- [ ] **Step 1: Add single-column rendering logic**

Find the `return` statement (~line 151). Above it, add:

```ts
// Single-column mode: when only one column has an ID, render it full-width
// with no divider/placeholder. Used by brain canvas (left='brain', right=null).
const leftOnly = splitViewLeftId && !splitViewRightId;
const rightOnly = !splitViewLeftId && splitViewRightId;
const singleColumn = leftOnly || rightOnly;
```

Then wrap the entire return JSX. When `singleColumn` is true, render just the active column (skip divider and the other column). Replace lines 151-253 with:

```tsx
if (singleColumn) {
  const singleId = leftOnly ? splitViewLeftId : splitViewRightId;
  return (
    <div ref={containerRef} className="flex-1 flex flex-row relative min-h-0">
      <div className={cn(
        "flex flex-col h-full min-h-0 overflow-hidden relative flex-1",
        isDesktopEnv ? cn(
          "bg-[var(--app-background)] border rounded-2xl shadow-sm",
          columnDragOver === (leftOnly ? 'left' : 'right') ? "border-[var(--bone-15)]" : "border-[var(--bone-10)]"
        ) : "bg-[var(--app-background)]"
      )}>
        {!isDesktopEnv && <ColumnHeader column={leftOnly ? 'left' : 'right'} entityId={singleId} />}
        <OverlayScrollbar className="flex-1 min-h-0" thumbOffsetRight={0} thumbRightClass="right-0">
          <EntityPageRenderer entityId={singleId!} />
        </OverlayScrollbar>
      </div>
    </div>
  );
}
```

Then leave the rest of the two-column return as-is (lines 151-253 remain unchanged).

- [ ] **Step 2: Verify typeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/SplitViewLayout.tsx
git commit -m "feat(splitview): support single-column mode for brain canvas full-width"
```

---

### Task 4: EntityPageRenderer — add 'brain' case

**Files:**
- Modify: `src/components/EntityPageRenderer.tsx`

- [ ] **Step 1: Add import and case**

Add import after the other page imports (~line 11):
```ts
import { BrainCanvasPage } from '@/components/brain/canvas/BrainCanvasPage';
```

Add case before the `settings` block (~line 45):
```ts
if (entityId === 'brain') {
  return <BrainCanvasPage />;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors (note: `BrainCanvasPage` component doesn't exist yet, so tsc WILL error. This is expected — the plan builds it in a later task. To keep compilation clean between tasks, use a placeholder export in a comment at the import site, or accept the transient error, OR create a minimal placeholder file now. I'll create the placeholder.)

Create a minimal placeholder:

```ts
// src/components/brain/canvas/BrainCanvasPage.tsx (placeholder — replaced in Task 8)
"use client";
export function BrainCanvasPage() {
  return <div className="flex-1 flex items-center justify-center text-muted-foreground">Brain Canvas — coming soon</div>;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/EntityPageRenderer.tsx src/components/brain/canvas/BrainCanvasPage.tsx
git commit -m "feat(epr): dispatch 'brain' entityId to BrainCanvasPage"
```

---

### Task 5: useBrainData hook — fetch/mutate brain state

**Files:**
- Create: `src/lib/brain/formatAge.ts`
- Create: `src/components/brain/canvas/useBrainData.ts`

Mirrors the data-fetch pattern from `BrainPanel.tsx` but exposes it as a reusable React hook. Calls the existing `/api/ai/user-brain` route (no new API endpoint needed).

- [ ] **Step 1: Create shared formatAge utility**

```ts
// src/lib/brain/formatAge.ts
/** Relative time label: "30s", "5m", "2h", "3d". Used by node cards and canvas. */
export function formatAge(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}
```

- [ ] **Step 2: Write the hook**

```ts
// src/components/brain/canvas/useBrainData.ts
"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// ---- Types matching the route response ----
export interface BrainCanvasNode {
  id: string;
  type: 'workspace' | 'entity' | 'memory' | 'section';
  ref_id: string | null;
  content: string | null;
  label: string | null;
  section_id: string | null;
  priority: number;
  pinned: boolean;
  enabled: boolean;
  position: { x: number; y: number } | null;
  created_by: 'user' | 'bot';
  created_at: string;
  updated_at: string;
}

export interface BrainCanvasEdge {
  id: string;
  from_node: string;
  to_node: string;
  label: string;
}

interface BrainMeta {
  id: string;
  title: string;
  description: string | null;
  is_default: boolean;
}

export interface BrainCanvasState {
  brainId: string;
  nodes: BrainCanvasNode[];
  edges: BrainCanvasEdge[];
  compiledPreview: string;
  deletedNodes: BrainCanvasNode[];
  availableWorkspaces: { id: string; title: string }[];
  budget: { used: number; limit: number; dropped: string[]; broken: string[] };
  brains: BrainMeta[];
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (isSupabaseEnabled) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

export function useBrainData() {
  const [state, setState] = useState<BrainCanvasState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBrainId, setSelectedBrainId] = useState<string | null>(null);

  const load = useCallback(async (brainId?: string | null) => {
    setLoading(true);
    try {
      const qs = brainId ? `?brain_id=${brainId}` : '';
      const res = await fetch(`/api/ai/user-brain${qs}`, { headers: await authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setState(data);
        setError(null);
        if (!brainId && data.brainId) setSelectedBrainId(data.brainId);
        if (brainId && data.brainId) setSelectedBrainId(data.brainId);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || `Failed to load brain (${res.status})`);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load brain data');
      logger.error('useBrainData load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(selectedBrainId); }, [load, selectedBrainId]);

  const mutate = useCallback(async (body: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/user-brain', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ brain_id: selectedBrainId, ...body }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || `Mutation failed (${res.status})`);
      await load(selectedBrainId);
      return result;
    } catch (e: any) {
      logger.error('useBrainData mutate failed:', e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [selectedBrainId, load]);

  return { state, loading, error, selectedBrainId, setSelectedBrainId, load, mutate };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/brain/formatAge.ts src/components/brain/canvas/useBrainData.ts
git commit -m "feat(brain): add useBrainData hook for canvas data fetching"
```

---

### Task 6: useBrainDrag — pointer drag handler

**Files:**
- Create: `src/components/brain/canvas/useBrainDrag.ts`

A custom ~60-line pointer handler for node dragging. Updates positions optimistically in local state and commits to the API via a debounced mutation. No snapping, no alignment guides, no resize, no rotate — matches the spec's "organic feel" decision.

- [ ] **Step 1: Write the hook**

```ts
// src/components/brain/canvas/useBrainDrag.ts
"use client";

import { useRef, useCallback } from 'react';
import type { CanvasViewport } from '@/hooks/useCanvasViewport';

interface NodePosition {
  x: number;
  y: number;
}

export interface DragCallbacks {
  onPositionChange: (nodeId: string, pos: NodePosition) => void;
  onCommit: (nodeId: string, pos: NodePosition) => void;
}

/**
 * Pointer-based drag handler for brain nodes.
 *
 * Converts screen-space deltas to canvas-space deltas via viewport.scale.
 * Calls onPositionChange on every pointer move (optimistic local state update)
 * and onCommit on pointer up (debounced API save).
 *
 * Usage:
 *   const { onNodePointerDown } = useBrainDrag({ viewport, onPositionChange, onCommit });
 *   <div onPointerDown={(e) => onNodePointerDown(e, nodeId, currentPos)} />
 */
export function useBrainDrag(
  viewport: CanvasViewport,
  callbacks: DragCallbacks,
) {
  const dragRef = useRef<{
    nodeId: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const onNodePointerDown = useCallback((e: React.PointerEvent, nodeId: string, pos: NodePosition) => {
    if (e.button !== 0) return; // left-click only; middle-click is for panning
    if (!(e.target as HTMLElement).closest('[data-drag-handle="true"]')) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { nodeId, startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y };

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.startX) / viewport.scale;
      const dy = (ev.clientY - dragRef.current.startY) / viewport.scale;
      callbacks.onPositionChange(dragRef.current.nodeId, {
        x: dragRef.current.originX + dx,
        y: dragRef.current.originY + dy,
      });
    };

    const onUp = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.startX) / viewport.scale;
      const dy = (ev.clientY - dragRef.current.startY) / viewport.scale;
      const finalPos = { x: dragRef.current.originX + dx, y: dragRef.current.originY + dy };
      callbacks.onCommit(dragRef.current.nodeId, finalPos);
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [viewport.scale, callbacks]);

  return { onNodePointerDown };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/brain/canvas/useBrainDrag.ts
git commit -m "feat(brain): add useBrainDrag pointer handler for node movement"
```

---

### Task 7: BrainNodeCard component

**Files:**
- Create: `src/components/brain/canvas/BrainNodeCard.tsx`

The visually dense card specified in §5 of the design spec. Header with type icon, parent workspace name, and relative edited time; bold title; faded content preview (1-2 lines); footer with priority pill. Four connector dots per side (shown on hover or when connect tool is active).

Card dimensions: `width: 264px, height: 140px` (fixed for deterministic geometry — variable heights deferred per spec §5).

- [ ] **Step 1: Write the component

```tsx
// src/components/brain/canvas/BrainNodeCard.tsx
"use client";

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { getEntityIcon } from '@/data/icons';
import { FileText, Folder } from 'lucide-react';
import type { ConnectorSide } from './connectorGeometry';
import { formatAge } from '@/lib/brain/formatAge';

export const CARD_W = 264;
export const CARD_H = 140;

/** Derived info about a brain node for display. */
export interface NodeDisplayInfo {
  typeIcon: React.ReactNode;
  parentLabel: string;
  ageLabel: string;
  title: string;
  preview?: string;
  priority: number;
}

interface BrainNodeCardProps {
  id: string;
  display: NodeDisplayInfo;
  position: { x: number; y: number };
  selected?: boolean;
  connectMode?: boolean;
  connectorHover?: ConnectorSide | null;
  onPointerDown?: (e: React.PointerEvent) => void;
  onConnectorClick?: (side: ConnectorSide) => void;
  onClick?: () => void;
}

const SIDES: ConnectorSide[] = ['top', 'right', 'bottom', 'left'];

export function BrainNodeCard({
  id,
  display,
  position,
  selected,
  connectMode,
  connectorHover,
  onPointerDown,
  onConnectorClick,
  onClick,
}: BrainNodeCardProps) {
  const showDots = connectMode || connectorHover;

  return (
    <div
      data-drag-handle="true"
      className={cn(
        "absolute rounded-[14px] border bg-panel cursor-grab active:cursor-grabbing select-none",
        "transition-shadow duration-100",
        selected
          ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]"
          : "border-[var(--bone-12)] hover:border-[var(--bone-20)]",
      )}
      style={{
        left: position.x,
        top: position.y,
        width: CARD_W,
        height: CARD_H,
        transform: 'translateZ(0)',  // GPU layer
      }}
      onPointerDown={onPointerDown}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    >
      {/* ── Header: icon + parent + age ── */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 h-6">
        <span className="text-[11px] text-[var(--bone-60)] shrink-0">{display.typeIcon}</span>
        <span className="text-[10px] text-[var(--bone-40)] truncate">{display.parentLabel}</span>
        <span className="text-[10px] text-[var(--bone-30)] ml-auto shrink-0">{display.ageLabel}</span>
      </div>

      {/* ── Title ── */}
      <div className="px-3 pt-1 text-[13px] font-medium text-foreground leading-tight truncate">
        {display.title}
      </div>

      {/* ── Preview ── */}
      {display.preview && (
        <div className="px-3 pt-1 text-[11px] text-[var(--bone-50)] leading-tight line-clamp-2">
          {display.preview}
        </div>
      )}

      {/* ── Divider ── */}
      <div className="absolute bottom-[28px] left-3 right-3 h-px bg-[var(--bone-8)]" />

      {/* ── Footer: priority pill ── */}
      <div className="absolute bottom-2 left-3 right-3 flex items-center gap-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bone-5)] text-[var(--bone-50)]">
          Priority: {display.priority}
        </span>
        {/* Tags and token-count pills reserved for future per §5 — not rendered in v1 */}
      </div>

      {/* ── Connector dots ── */}
      {SIDES.map(side => {
        const cx = side === 'right' ? CARD_W : side === 'left' ? 0 : CARD_W / 2;
        const cy = side === 'bottom' ? CARD_H : side === 'top' ? 0 : CARD_H / 2;
        return (
          <button
            key={side}
            data-connector={side}
            className={cn(
              "absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full",
              "flex items-center justify-center transition-all duration-100",
              showDots ? "opacity-100" : "opacity-0 pointer-events-none",
              connectorHover === side
                ? "bg-[var(--accent)] scale-125"
                : "bg-[var(--bone-15)] hover:bg-[var(--bone-30)]"
            )}
            style={{ left: cx, top: cy }}
            onPointerDown={(e) => { e.stopPropagation(); onConnectorClick?.(side); }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-current text-[var(--bone-70)]" />
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/brain/canvas/BrainNodeCard.tsx
git commit -m "feat(brain): add BrainNodeCard component with connector dots"
```

---

### Task 8: BrainCanvasConnections — SVG edge overlay

**Files:**
- Create: `src/components/brain/canvas/BrainCanvasConnections.tsx`

SVG overlay that renders edge paths as SVG `<path>` elements using `buildEdgePath` from the connector geometry module. Positioned absolutely over the canvas, matching the whiteboard's `CanvasConnections.tsx` rendering pattern but driven by brain node/edge data.

- [ ] **Step 1: Write the component

```tsx
// src/components/brain/canvas/BrainCanvasConnections.tsx
"use client";

import { useMemo } from 'react';
import { buildEdgePath, type ConnectorSide, type NodeBox } from './connectorGeometry';
import { CARD_W, CARD_H } from './BrainNodeCard';
import type { BrainCanvasNode, BrainCanvasEdge } from './useBrainData';

interface BrainCanvasConnectionsProps {
  nodes: BrainCanvasNode[];
  edges: BrainCanvasEdge[];
  /** Map from node id → current position (optimistic during drag) */
  positions: Record<string, { x: number; y: number }>;
  onLabelClick?: (edgeId: string) => void;
}

/** Default connector sides for edge routing (closest sides). */
function closestSides(a: NodeBox, b: NodeBox): [ConnectorSide, ConnectorSide] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const aSide: ConnectorSide = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
  const bSide: ConnectorSide = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'left' : 'right') : (dy >= 0 ? 'top' : 'bottom');
  return [aSide, bSide];
}

export function BrainCanvasConnections({
  nodes,
  edges,
  positions,
}: BrainCanvasConnectionsProps) {
  const paths = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    return edges.map(edge => {
      const fromNode = nodeMap.get(edge.from_node);
      const toNode = nodeMap.get(edge.to_node);
      if (!fromNode || !toNode) return null;

      const fromPos = positions[edge.from_node] ?? fromNode.position ?? { x: 0, y: 0 };
      const toPos = positions[edge.to_node] ?? toNode.position ?? { x: 0, y: 0 };

      const fromBox: NodeBox = { x: fromPos.x, y: fromPos.y, width: CARD_W, height: CARD_H };
      const toBox: NodeBox = { x: toPos.x, y: toPos.y, width: CARD_W, height: CARD_H };
      const [fromSide, toSide] = closestSides(fromBox, toBox);

      const d = buildEdgePath(fromBox, fromSide, toBox, toSide);
      return { id: edge.id, d, label: edge.label };
    }).filter(Boolean);
  }, [nodes, edges, positions]);

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-10"
    >
      {paths.map(p => p && (
        <g key={p.id}>
          <path
            d={p.d}
            fill="none"
            stroke="var(--bone-20)"
            strokeWidth={2}
            strokeLinejoin="round"
            className="transition-all duration-100"
          />
          {p.label && (() => {
            // Position label at the midpoint of the path
            const pts = p.d.match(/[\d.]+ [\d.]+/g)?.map(s => s.split(' ').map(Number));
            const mid = pts ? [(pts[0][0] + pts[pts.length-1][0]) / 2, (pts[0][1] + pts[pts.length-1][1]) / 2] : [0, 0];
            return (
              <text
                x={mid[0]} y={mid[1]}
                textAnchor="middle" dominantBaseline="middle"
                className="pointer-events-auto fill-[var(--bone-50)] text-[10px]"
              >
                {p.label}
              </text>
            );
          })()}
        </g>
      ))}
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/brain/canvas/BrainCanvasConnections.tsx
git commit -m "feat(brain): add BrainCanvasConnections SVG edge overlay"
```

---

### Task 9: BrainStatsPanel — budget meter and counters

**Files:**
- Create: `src/components/brain/canvas/BrainStatsPanel.tsx`

- [ ] **Step 1: Write the component

```tsx
// src/components/brain/canvas/BrainStatsPanel.tsx
"use client";

export function BrainStatsPanel({
  used,
  limit,
  nodeCount,
  edgeCount,
}: {
  used: number;
  limit: number;
  nodeCount: number;
  edgeCount: number;
}) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const isOverBudget = used >= limit;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[var(--app-dark)] border border-[var(--bone-10)] text-[11px]">
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--bone-40)]">Nodes</span>
        <span className="text-foreground font-medium">{nodeCount}</span>
      </div>
      <div className="w-px h-3 bg-[var(--bone-10)]" />
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--bone-40)]">Edges</span>
        <span className="text-foreground font-medium">{edgeCount}</span>
      </div>
      <div className="w-px h-3 bg-[var(--bone-10)]" />
      <div className="flex items-center gap-1.5" title={`${used} / ${limit} tokens`}>
        <span className="text-[var(--bone-40)]">Budget</span>
        <div className="w-16 h-2 rounded-full bg-[var(--bone-8)] overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", isOverBudget ? "bg-danger" : "bg-[var(--accent)]")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={cn(isOverBudget ? "text-danger" : "text-foreground", "font-medium tabular-nums")}>
          {Math.round(used / 100) / 10}k
        </span>
      </div>
    </div>
  );
}
```

Note: needs `import { cn } from '@/lib/utils'` at the top.

- [ ] **Step 2: Commit

```bash
git add src/components/brain/canvas/BrainStatsPanel.tsx
git commit -m "feat(brain): add BrainStatsPanel with budget meter and counters"
```

---

### Task 10: BrainPresetPicker — brain dropdown

**Files:**
- Create: `src/components/brain/canvas/BrainPresetPicker.tsx`

- [ ] **Step 1: Write the component

```tsx
// src/components/brain/canvas/BrainPresetPicker.tsx
"use client";

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Brain, ChevronDown } from 'lucide-react';

interface BrainMeta {
  id: string;
  title: string;
  description: string | null;
  is_default: boolean;
}

export function BrainPresetPicker({
  brains,
  selectedBrainId,
  onSelect,
}: {
  brains: BrainMeta[];
  selectedBrainId: string | null;
  onSelect: (brainId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = brains.find(b => b.id === selectedBrainId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 h-7 px-2 rounded-md text-[12px] font-medium",
          "bg-[var(--app-dark)] border border-[var(--bone-10)] hover:border-[var(--bone-20)]",
          "text-foreground transition-colors"
        )}
      >
        <Brain className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={2} />
        <span className="truncate max-w-[120px]">{current?.title ?? 'Select brain'}</span>
        <ChevronDown className="w-3 h-3 text-[var(--bone-40)]" strokeWidth={2} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-40 w-52 py-1 rounded-lg bg-panel border border-[var(--bone-10)] shadow-lg">
            {brains.map(b => (
              <button
                key={b.id}
                onClick={() => { onSelect(b.id); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-[var(--app-dark)] transition-colors",
                  b.id === selectedBrainId ? "text-foreground font-medium" : "text-[var(--bone-60)]"
                )}
              >
                <Brain className="w-3 h-3 shrink-0" strokeWidth={2} />
                <span className="truncate">{b.title}</span>
                {b.is_default && <span className="text-[10px] text-[var(--bone-40)] ml-auto">default</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit

```bash
git add src/components/brain/canvas/BrainPresetPicker.tsx
git commit -m "feat(brain): add BrainPresetPicker dropdown"
```

---

### Task 11: AddExistingEntityPopover

**Files:**
- Create: `src/components/brain/canvas/AddExistingEntityPopover.tsx`

Search/browse popover over the user's entities (notes and workspaces) that adds a selected entity as a brain node via mutate.

- [ ] **Step 1: Write the component

```tsx
// src/components/brain/canvas/AddExistingEntityPopover.tsx
"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Search, FileText, Folder } from 'lucide-react';
import { useStore } from '@/data/store';

interface Props {
  onAddEntity: (refId: string, type: 'entity' | 'workspace') => void;
  onClose: () => void;
}

export function AddExistingEntityPopover({ onAddEntity, onClose }: Props) {
  const entities = useStore(s => s.entities);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const candidates = useMemo(() => {
    const q = query.toLowerCase().trim();
    return entities
      .filter(e => (e.type === 'note' || e.type === 'workspace'))
      .filter(e => !q || e.title?.toLowerCase().includes(q))
      .slice(0, 50);
  }, [entities, query]);

  return (
    <div className="absolute top-full left-0 mt-1 z-50 w-72 p-2 rounded-xl bg-panel border border-[var(--bone-10)] shadow-lg">
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--app-dark)] border border-[var(--bone-10)] mb-2">
        <Search className="w-3.5 h-3.5 text-[var(--bone-40)]" strokeWidth={2} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search notes & spaces…"
          className="flex-1 bg-transparent border-none outline-none text-[12px] text-foreground placeholder:text-[var(--bone-40)]"
        />
      </div>
      <div className="flex flex-col gap-[1px] max-h-48 overflow-y-auto">
        {candidates.map(e => (
          <button
            key={e.id}
            onClick={() => { onAddEntity(e.id, e.type === 'workspace' ? 'workspace' : 'entity'); onClose(); }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-[var(--app-dark)] text-left transition-colors"
          >
            {e.type === 'workspace' ? (
              <Folder className="w-3.5 h-3.5 text-[var(--bone-50)] shrink-0" strokeWidth={2} />
            ) : (
              <FileText className="w-3.5 h-3.5 text-[var(--bone-50)] shrink-0" strokeWidth={2} />
            )}
            <span className="truncate text-foreground">{e.title || 'Untitled'}</span>
          </button>
        ))}
        {candidates.length === 0 && (
          <p className="text-[11px] text-[var(--bone-40)] text-center py-3">No matches</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit

```bash
git add src/components/brain/canvas/AddExistingEntityPopover.tsx
git commit -m "feat(brain): add AddExistingEntityPopover for adding existing notes as brain nodes"
```

---

### Task 12: BrainCanvasPage — main canvas component

**Files:**
- Replace placeholder: `src/components/brain/canvas/BrainCanvasPage.tsx`

This is the main page component. It composes all the new canvas components, manages viewport, drag state, connect mode, and cooperative editing of brain data.

**State managed by BrainCanvasPage:**
- `positions`: `Record<string, { x, y }>` — optimistic positions during drag, synced to API on drop
- `nodeDisplays`: map from node.id to NodeDisplayInfo (derived from brain state + entities)
- `connectMode`: boolean — whether the connect tool is active
- `connectorState`: which node/side the user has selected as the from-endpoint of a pending edge
- `addExistingOpen`: boolean — popover visibility
- `newNodeMode`: boolean — "place new node on click" mode

- [ ] **Step 1: Write BrainCanvasPage

```tsx
// src/components/brain/canvas/BrainCanvasPage.tsx
"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useStore } from '@/data/store';
import { useCanvasViewport } from '@/hooks/useCanvasViewport';
import { cn } from '@/lib/utils';
import { useBrainData, type BrainCanvasNode, type BrainCanvasEdge } from './useBrainData';
import { useBrainDrag } from './useBrainDrag';
import { BrainNodeCard, CARD_W, CARD_H, type NodeDisplayInfo } from './BrainNodeCard';
import { BrainCanvasConnections } from './BrainCanvasConnections';
import { BrainToolbar } from './BrainToolbar';
import { BrainPresetPicker } from './BrainPresetPicker';
import { BrainStatsPanel } from './BrainStatsPanel';
import { AddExistingEntityPopover } from './AddExistingEntityPopover';
import type { ConnectorSide } from './connectorGeometry';
import { logger } from '@/lib/logger';
import { formatAge } from '@/lib/brain/formatAge';

/** Derive display info for a brain node from brain state + entity store. */
function computeDisplayInfo(
  node: BrainCanvasNode,
  entities: Array<{ id: string; type: string; title?: string; parentId?: string | null; lastModified?: number }>,
): NodeDisplayInfo {
  if (node.type === 'section') {
    return {
      typeIcon: <span className="text-[10px]">📂</span>,
      parentLabel: 'Section',
      ageLabel: formatAge(node.created_at),
      title: node.label || 'Untitled Section',
      preview: undefined,
      priority: node.priority,
    };
  }

  const entity = node.ref_id ? entities.find(e => e.id === node.ref_id) : null;
  const parentEntity = entity?.parentId ? entities.find(e => e.id === entity.parentId) : null;

  const typeIcons: Record<string, React.ReactNode> = {
    note: <span className="text-[10px]">📝</span>,
    workspace: <span className="text-[10px]">📁</span>,
    memory: <span className="text-[10px]">🧠</span>,
  };

  return {
    typeIcon: entity ? (typeIcons[entity.type] ?? <span className="text-[10px]">📄</span>) : <span className="text-[10px]">🧠</span>,
    parentLabel: parentEntity?.title || entity?.type === 'workspace' ? 'Workspace' : 'Unsorted',
    ageLabel: entity?.lastModified ? formatAge(new Date(entity.lastModified).toISOString()) : formatAge(node.created_at),
    title: node.label || entity?.title || node.content?.slice(0, 60) || 'Untitled',
    preview: node.type === 'memory' ? (node.content?.slice(0, 120) ?? undefined) : undefined,
    priority: node.priority,
  };
}

// Default positions for nodes that lack them — spread in a cascading grid.
function ensurePosition(
  node: BrainCanvasNode,
  index: number,
  existing: Record<string, { x: number; y: number }>,
): { x: number; y: number } {
  if (existing[node.id]) return existing[node.id];
  if (node.position) return node.position;
  // Cascade: place new nodes in a grid starting from (40, 40)
  const cols = Math.floor((typeof window !== 'undefined' ? window.innerWidth : 1200) / (CARD_W + 40));
  const col = index % Math.max(cols, 3);
  const row = Math.floor(index / Math.max(cols, 3));
  return { x: 40 + col * (CARD_W + 40), y: 40 + row * (CARD_H + 40) };
}

export function BrainCanvasPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { viewport, setViewport, viewportRef } = useCanvasViewport(containerRef);

  // ── Brain data (fetched via hook, synced to store's activeBrainId) ──
  const { state, loading, error, selectedBrainId, setSelectedBrainId, load, mutate } = useBrainData();
  const activeBrainId = useStore(s => s.activeBrainId);
  const setActiveBrainId = useStore(s => s.setActiveBrainId);

  // Sync the hook's selectedBrainId with the global activeBrainId.
  // This ensures the canvas re-fetches when the user clicks a different brain
  // in the sidebar (BrainSidebarContent sets activeBrainId store).
  useEffect(() => {
    if (activeBrainId && activeBrainId !== selectedBrainId) {
      setSelectedBrainId(activeBrainId);
    }
  }, [activeBrainId, selectedBrainId, setSelectedBrainId]);

  // Initial load (no brainId yet — loads the default brain)
  useEffect(() => {
    if (!selectedBrainId) load();
  }, [load, selectedBrainId]);

  const entities = useStore(s => s.entities);
  const openBrainNode = useStore(s => s.openBrainNode);
  const addEntity = useStore(s => s.addEntity);
  const setColumnEntity = useStore(s => s.setColumnEntity);

  // When loading a new brain, reset positions
  useEffect(() => {
    setPositions({});
  }, [selectedBrainId]);

  // Optimistic positions (synced on drag commit)
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Update position for a single node during drag
  const handlePositionChange = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    setPositions(prev => ({ ...prev, [nodeId]: pos }));
  }, []);

  // Commit position to API (debounced — fires on pointer up)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const handleCommit = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    if (debounceTimers.current[nodeId]) clearTimeout(debounceTimers.current[nodeId]);
    debounceTimers.current[nodeId] = setTimeout(async () => {
      try {
        await mutate({ action: 'update_node', node_id: nodeId, updates: { position: pos } });
      } catch (e) {
        logger.error('Failed to save node position:', e);
      }
    }, 300);
  }, [mutate]);

  const { onNodePointerDown } = useBrainDrag(viewport, {
    onPositionChange: handlePositionChange,
    onCommit: handleCommit,
  });

  // Reset positions when data loads (fresh from API)
  useEffect(() => {
    if (state?.nodes) {
      setPositions(prev => {
        const next = { ...prev };
        for (const n of state.nodes) {
          if (!next[n.id] && n.position) next[n.id] = n.position;
        }
        return next;
      });
    }
  }, [state?.nodes]);

  // Node display info derived from entities + brain data
  const nodeInfos = useMemo(() => {
    if (!state) return new Map<string, NodeDisplayInfo>();
    const map = new Map<string, NodeDisplayInfo>();
    for (const node of state.nodes) {
      if (!node.enabled) continue;
      map.set(node.id, computeDisplayInfo(node, entities));
    }
    return map;
  }, [state, entities]);

  // Active nodes (enabled only, positioned)
  const activeNodes = useMemo(() => {
    if (!state) return [];
    return state.nodes.filter(n => n.enabled);
  }, [state]);

  const nodePositions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    for (let i = 0; i < activeNodes.length; i++) {
      map[activeNodes[i].id] = ensurePosition(activeNodes[i], i, positions);
    }
    return map;
  }, [activeNodes, positions]);

  // Tool modes
  const [connectMode, setConnectMode] = useState(false);
  const [fromDot, setFromDot] = useState<{ nodeId: string; side: ConnectorSide } | null>(null);
  const [connectorHover, setConnectorHover] = useState<ConnectorSide | null>(null);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [newNodeMode, setNewNodeMode] = useState(false);
  const [edgeLabelInput, setEdgeLabelInput] = useState<{ nodeId: string; toNodeId?: string } | null>(null);

  // Connect tool: handle clicking a connector dot
  const handleConnectorClick = useCallback((nodeId: string, side: ConnectorSide) => {
    if (!fromDot) {
      setFromDot({ nodeId, side });
    } else if (fromDot.nodeId !== nodeId) {
      // Second dot clicked — open inline label input
      setEdgeLabelInput({ nodeId: fromDot.nodeId, toNodeId: nodeId });
    } else {
      setFromDot(null); // deselect
    }
  }, [fromDot]);

  const commitEdge = useCallback(async (label: string) => {
    if (!edgeLabelInput) return;
    try {
      await mutate({ action: 'connect', from: edgeLabelInput.nodeId, to: edgeLabelInput.toNodeId, label });
    } catch (e) {
      logger.error('Failed to create edge:', e);
    }
    setEdgeLabelInput(null);
    setFromDot(null);
  }, [edgeLabelInput, mutate]);

  // New node: click to place on the canvas
  const handleCanvasClick = useCallback(async (e: React.MouseEvent) => {
    if (!newNodeMode) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - viewport.x) / viewport.scale;
    const y = (e.clientY - rect.top - viewport.y) / viewport.scale;

    // Create a real note entity
    const entityId = addEntity({ type: 'note', title: 'New Note', content: [] });
    if (!entityId) return;

    // Add it as a brain node
    try {
      await mutate({ action: 'add_node', type: 'entity', ref_id: entityId, position: { x, y } });
    } catch (e) {
      logger.error('Failed to add brain node:', e);
    }
    // Open it in the right column
    openBrainNode(entityId);
    setNewNodeMode(false);
  }, [newNodeMode, viewport, addEntity, mutate, openBrainNode]);

  // Add existing entity as brain node
  const handleAddExisting = useCallback(async (refId: string, type: 'entity' | 'workspace') => {
    const x = 40 + (activeNodes.length % 5) * (CARD_W + 40);
    const y = 40 + Math.floor(activeNodes.length / 5) * (CARD_H + 40);
    try {
      await mutate({ action: 'add_node', type, ref_id: refId, position: { x, y } });
    } catch (e) {
      logger.error('Failed to add existing entity:', e);
    }
  }, [activeNodes.length, mutate]);

  // Background pan: space-drag / middle-click
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  const handleBgPointerDown = useCallback((e: React.PointerEvent) => {
    // Only handle events directly on the background, not on cards
    if (e.button === 1 || (e.button === 0 && (e.target as HTMLElement).dataset.bg === 'true')) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y };
    }
  }, [viewport]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!isPanningRef.current) return;
      setViewport(prev => ({
        ...prev,
        x: panStartRef.current.vx + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.vy + (e.clientY - panStartRef.current.y),
      }));
    };
    const onUp = () => { isPanningRef.current = false; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [setViewport]);

  if (!state) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        {error ? `Error: ${error}` : 'Loading brain…'}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full overflow-hidden bg-[var(--app-background)] select-none"
      onPointerDown={handleBgPointerDown}
    >
      {/* ── Top bar: presets + stats ── */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
        <BrainPresetPicker
          brains={state.brains}
          selectedBrainId={selectedBrainId}
          onSelect={(id) => { setSelectedBrainId(id); setActiveBrainId(id); }}
        />
      </div>
      <div className="absolute top-4 right-4 z-20">
        <BrainStatsPanel
          used={state.budget.used}
          limit={state.budget.limit}
          nodeCount={state.nodes.filter(n => n.enabled).length}
          edgeCount={state.edges.length}
        />
      </div>

      {/* ── Transformed layer (viewport) ── */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: '0 0',
        }}
        onClick={handleCanvasClick}
      >
        {/* Background grid dots */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: 4000, minHeight: 4000, left: -2000, top: -2000 }}>
          <defs>
            <pattern id="brain-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.5" fill="var(--bone-8)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#brain-grid)" />
        </svg>

        {/* Connections */}
        <BrainCanvasConnections
          nodes={activeNodes}
          edges={state.edges}
          positions={nodePositions}
        />

        {/* Nodes */}
        {activeNodes.map((node, index) => {
          const pos = nodePositions[node.id];
          const info = nodeInfos.get(node.id);
          if (!info) return null;

          return (
            <BrainNodeCard
              key={node.id}
              id={node.id}
              display={info}
              position={pos}
              connectMode={connectMode}
              connectorHover={fromDot?.nodeId === node.id ? fromDot.side : undefined}
              onPointerDown={(e) => onNodePointerDown(e, node.id, pos)}
              onConnectorClick={(side) => handleConnectorClick(node.id, side)}
              onClick={() => {
                if (node.ref_id) openBrainNode(node.ref_id);
              }}
            />
          );
        })}
      </div>

      {/* ── Inline edge label input ── */}
      {edgeLabelInput && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-overlay/20" onClick={() => setEdgeLabelInput(null)}>
          <div className="bg-panel border border-[var(--bone-10)] rounded-xl p-4 shadow-lg" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              placeholder="Edge label…"
              className="w-60 px-3 py-2 rounded-lg bg-[var(--app-dark)] border border-[var(--bone-10)] text-[13px] outline-none"
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdge((e.target as HTMLInputElement).value);
                if (e.key === 'Escape') setEdgeLabelInput(null);
              }}
            />
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
        <BrainToolbar
          connectMode={connectMode}
          onToggleConnect={() => { setConnectMode(!connectMode); setFromDot(null); }}
          onNewNode={() => { setNewNodeMode(!newNodeMode); setConnectMode(false); }}
          newNodeActive={newNodeMode}
          addExistingOpen={addExistingOpen}
          onToggleAddExisting={() => setAddExistingOpen(!addExistingOpen)}
        />
        {addExistingOpen && (
          <div className="relative">
            <AddExistingEntityPopover
              onAddEntity={handleAddExisting}
              onClose={() => setAddExistingOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles

Run: `npx tsc --noEmit`
Expected: No errors (if errors appear about missing BrainToolbar import, create the BrainToolbar placeholder in the next task first — swap task order if needed)

- [ ] **Step 3: Commit

```bash
git add src/components/brain/canvas/BrainCanvasPage.tsx
git commit -m "feat(brain): add BrainCanvasPage main canvas component"
```

---

### Task 13: BrainToolbar

**Files:**
- Create: `src/components/brain/canvas/BrainToolbar.tsx`

- [ ] **Step 1: Write the component

```tsx
// src/components/brain/canvas/BrainToolbar.tsx
"use client";

import { cn } from '@/lib/utils';
import { Plus, Link2, Search, MousePointer2, StickyNote } from 'lucide-react';

interface BrainToolbarProps {
  connectMode: boolean;
  onToggleConnect: () => void;
  onNewNode: () => void;
  newNodeActive: boolean;
  addExistingOpen: boolean;
  onToggleAddExisting: () => void;
}

export function BrainToolbar({
  connectMode,
  onToggleConnect,
  onNewNode,
  newNodeActive,
  addExistingOpen,
  onToggleAddExisting,
}: BrainToolbarProps) {
  const btnClass = (active?: boolean) => cn(
    "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-colors border",
    active
      ? "bg-[var(--accent)] text-white border-[var(--accent)]"
      : "bg-[var(--app-dark)] text-[var(--bone-70)] border-[var(--bone-10)] hover:border-[var(--bone-20)] hover:text-foreground"
  );

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-panel border border-[var(--bone-10)] shadow-md">
      <button
        onClick={() => {}}
        className={btnClass(false)}
        title="Select / Pan (default)"
      >
        <MousePointer2 className="w-3.5 h-3.5" strokeWidth={2} />
        <span>Select</span>
      </button>
      <div className="w-px h-5 bg-[var(--bone-8)]" />
      <button
        onClick={onNewNode}
        className={btnClass(newNodeActive)}
        title="Create a new note and add it to the brain"
      >
        <StickyNote className="w-3.5 h-3.5" strokeWidth={2} />
        <span>New node</span>
      </button>
      <button
        onClick={onToggleAddExisting}
        className={btnClass(addExistingOpen)}
        title="Add an existing note or workspace to the brain"
      >
        <Search className="w-3.5 h-3.5" strokeWidth={2} />
        <span>Add existing</span>
      </button>
      <div className="w-px h-5 bg-[var(--bone-8)]" />
      <button
        onClick={onToggleConnect}
        className={btnClass(connectMode)}
        title="Connect nodes — click a connector dot, then another"
      >
        <Link2 className="w-3.5 h-3.5" strokeWidth={2} />
        <span>Connect</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit

```bash
git add src/components/brain/canvas/BrainToolbar.tsx
git commit -m "feat(brain): add BrainToolbar with new-node, add-existing, and connect tools"
```

---

### Task 14: BrainSidebarContent — brain-scoped sidebar

**Files:**
- Create: `src/components/brain/canvas/BrainSidebarContent.tsx`

Brain mode sidebar: shows "Sessions" button at the top to switch back to chat history, then lists brains as foldable rows. Each brain row expands to show its actual nodes.

- [ ] **Step 1: Write the component

```tsx
// src/components/brain/canvas/BrainSidebarContent.tsx
"use client";

import { useState, useMemo } from 'react';
import { useStore } from '@/data/store';
import { cn } from '@/lib/utils';
import { Brain, MessageCircle, ChevronDown, FileText, Folder, Zap } from 'lucide-react';
import { useBrainData, type BrainCanvasNode } from './useBrainData';

export function BrainSidebarContent() {
  const setActiveEntityId = useStore(s => s.setActiveEntityId);
  const setActiveBrainId = useStore(s => s.setActiveBrainId);
  const openBrainNode = useStore(s => s.openBrainNode);
  const entities = useStore(s => s.entities);

  const { state, selectedBrainId, setSelectedBrainId } = useBrainData();
  const [collapsedBrains, setCollapsedBrains] = useState<Record<string, boolean>>({});

  const brains = state?.brains ?? [];
  const allNodes = state?.nodes ?? [];

  // Group nodes by brain
  const nodesByBrain = useMemo(() => {
    const map = new Map<string, BrainCanvasNode[]>();
    for (const n of allNodes) {
      if (n.type === 'section') continue;
      // All nodes in the current state belong to selectedBrainId
      if (!map.has(selectedBrainId ?? '')) map.set(selectedBrainId ?? '', []);
      map.get(selectedBrainId ?? '')!.push(n);
    }
    return map;
  }, [allNodes, selectedBrainId]);

  const nodeInfo = (node: BrainCanvasNode) => {
    const entity = node.ref_id ? entities.find(e => e.id === node.ref_id) : null;
    return {
      title: node.label || entity?.title || node.content?.slice(0, 60) || 'Untitled',
      icon: node.type === 'entity' ? FileText : node.type === 'workspace' ? Folder : node.type === 'memory' ? Zap : FileText,
    };
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* ── Sessions button ── */}
      <div className="px-[10px] pt-1.5 pb-1 shrink-0">
        <button
          onClick={() => setActiveEntityId('chat')}
          className="sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
        >
          <MessageCircle strokeWidth={2} className="w-3.5 h-3.5" />
          <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide">Sessions</span>
        </button>
      </div>

      <div className="h-px bg-[var(--bone-8)] mx-[10px] mb-1" />

      {/* ── Brains list ── */}
      <div className="flex-1 overflow-y-auto px-[10px] pb-4 flex flex-col gap-[1px]">
        {brains.map(brain => {
          const isCollapsed = collapsedBrains[brain.id] ?? false;
          const brainNodes = nodesByBrain.get(brain.id) ?? [];
          return (
            <div key={brain.id} className="flex flex-col gap-[1px]">
              {/* Brain header row */}
              <button
                onClick={() => {
                  setSelectedBrainId(brain.id);
                  setActiveBrainId(brain.id);
                  setActiveEntityId('brain');
                }}
                className={cn(
                  "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent",
                  brain.id === selectedBrainId
                    ? "bg-dark text-[var(--bone-100)] font-normal"
                    : "text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
                )}
              >
                <Brain strokeWidth={2} className="w-3.5 h-3.5 shrink-0" />
                <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide truncate">{brain.title}</span>
                {brain.id === selectedBrainId && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setCollapsedBrains(prev => ({ ...prev, [brain.id]: !prev[brain.id] })); }}
                    className="p-0.5 rounded hover:bg-[var(--bone-5)] text-[var(--bone-40)]"
                  >
                    <ChevronDown strokeWidth={2} className={cn("w-3.5 h-3.5 transition-transform", isCollapsed ? "" : "-rotate-90")} />
                  </button>
                )}
              </button>

              {/* Children (brain nodes) — foldable */}
              <div className={cn("grid transition-all duration-100 ease-out", !isCollapsed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <div className="overflow-hidden flex flex-col gap-[1px]">
                  {brainNodes.map(node => {
                    const info = nodeInfo(node);
                    const Icon = info.icon;
                    return (
                      <button
                        key={node.id}
                        onClick={() => {
                          setSelectedBrainId(brain.id);
                          if (node.ref_id) openBrainNode(node.ref_id);
                        }}
                        className="sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[24px] pr-[3px] h-6 group border border-transparent text-[var(--bone-60)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-90)] text-[13px]"
                      >
                        <Icon strokeWidth={2} className="w-3 h-3 shrink-0" />
                        <span className="ml-[6px] flex-1 text-left truncate">{info.title}</span>
                        <span className="text-[10px] text-[var(--bone-30)]">P{node.priority}</span>
                      </button>
                    );
                  })}
                  {brainNodes.length === 0 && (
                    <div className="pl-[24px] text-[11px] text-[var(--bone-30)] py-1">No nodes yet</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit

```bash
git add src/components/brain/canvas/BrainSidebarContent.tsx
git commit -m "feat(brain): add BrainSidebarContent with foldable brain rows"
```

---

### Task 15: Sidebar.tsx — wire brain mode

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

Three changes:
1. Brain button calls `setActiveEntityId('brain')` instead of `setBrainOpen(true)`
2. Remove the `<BrainPanel>` modal mount (line 2169)
3. Add a brain-mode content branch parallel to `activeEntityId === 'chat'` at line 1255

- [ ] **Step 1: Change brain button onclick

Find line ~1289:
```tsx
<button
  onClick={() => setBrainOpen(true)}
```
Change to:
```tsx
<button
  onClick={() => {
    clearSelectedSidebarIds();
    useStore.getState().setActiveEntityId('brain');
  }}
```

- [ ] **Step 2: Remove BrainPanel modal mount

Find line ~2169:
```tsx
{brainOpen && <BrainPanel onClose={() => setBrainOpen(false)} />}
```
Remove this line. (Keep the `brainOpen` state declaration for now — it's still used by the `brainOpen ?` style check in the button at line 1292. After Task 15 step 1, the button no longer sets brainOpen, so the style condition becomes dead. Clean it up: replace `brainOpen` with a check against `storeActiveEntityId === 'brain'`.)

Better: After step 1, the button styling at line 1292 uses `brainOpen` — change it too:
```tsx
const storeActiveEntityId = useStore(s => s.activeEntityId);
```
Then:
```tsx
storeActiveEntityId === 'brain' ? "bg-dark text-[var(--bone-100)] font-normal" : "text-[var(--bone-70)]..."
```

Then remove the `brainOpen` useState (line 453) and BrainPanel import (line 26). But keep the file clean — just remove the things that are no longer used.

Actually, keep it surgical: only change the onClick, remove the modal mount, and remove the BrainPanel import. The `brainOpen` state will remain but never be set to true, so the button styling will always show the inactive style. That's fine — it's a small cost for surgical changes. OR just do the minimal: leave `brainOpen`, change the button to set `useStore.activeEntityId('brain')`, remove the modal mount. The button style stays neutral (not brainOpen). This is fine.

Wait, but we want the Brain button to show as "active" when brain mode is on (just like the chat-mode buttons show active state). So instead of `brainOpen`, use `activeEntityId === 'brain'`. Let me do all three small changes:

Change 1: Line 453 — remove `const [brainOpen, setBrainOpen] = useState(false);` (not needed)
Change 2: Line 1289-1297 — replace the brain button section with:
```tsx
<button
  onClick={() => {
    clearSelectedSidebarIds();
    useStore.getState().setActiveEntityId('brain');
  }}
  className={cn(
    "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent ",
    activeEntityId === 'brain' ? "bg-dark text-[var(--bone-100)] font-normal" : "text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
  )}
>
  <Brain strokeWidth={2} className="w-3.5 h-3.5" />
  <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide">Brain</span>
</button>
```
Change 3: Line 2169 — remove `{brainOpen && <BrainPanel onClose={() => setBrainOpen(false)} />}`
Change 4: Remove the BrainPanel import line.

- [ ] **Step 2: Add brain-mode sidebar content

Find the sidebar content branch at line 1255:
```tsx
{activeEntityId === 'chat' ? (
  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
    {/* ... chat history ... */}
  </div>
) : activeEntityId === 'tracker' ? (
```
Replace with:
```tsx
{activeEntityId === 'brain' ? (
  <BrainSidebarContent />
) : activeEntityId === 'chat' ? (
  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
    {/* ... chat history (unchanged) ... */}
  </div>
) : activeEntityId === 'tracker' ? (
```

Add import for BrainSidebarContent at the top of the file.

- [ ] **Step 3: Verify it compiles

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(sidebar): wire brain button to brain canvas, add brain-mode sidebar"
```

---

### Task 16: Integration verification

**Files:**
- Modify: none — run checks

Verify the full integration works end-to-end.

- [ ] **Step 1: Verify TypeScript compiles clean

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run existing tests to confirm no regressions

Run: `npm test` or `npx vitest run`
Expected: All existing tests pass (brain geometry tests + all prior tests)

- [ ] **Step 3: Manual smoke test checklist

In a dev server (`npm run dev`):

1. **Enter brain mode:** Click Brain in sidebar → chat area replaces with BrainCanvasPage
   - Verify: canvas fills content area, toolbar visible at bottom, stats panel top-right, preset picker top-left
   - Verify: brain nodes appear as cards (if any exist from prior P1 usage)

2. **Pan/zoom:** Space+drag to pan, Ctrl+wheel to zoom at cursor
   - Verify: smooth panning, zoom anchors to cursor position

3. **Node click:** Click a node card with a `ref_id`
   - Verify: split view activates, canvas stays on the left, note opens in the right column

4. **Node drag:** Grab a node by its card area
   - Verify: card follows pointer, position persists after release (refresh to confirm)

5. **Connect tool:** Click Connect in toolbar → click connector dot on Node A → click dot on Node B
   - Verify: inline label input appears → type label → edge renders

6. **New node:** Click New node in toolbar → click empty canvas area
   - Verify: new note entity created, opens in right column, brain node appears on canvas

7. **Add existing:** Click Add existing → search popover → select a note
   - Verify: entity appears as a brain node on the canvas

8. **Brain preset picker:** If multiple brains exist, switch between them
   - Verify: canvas reloads with the selected brain's nodes/edges

9. **Sessions button:** Click Sessions in sidebar
   - Verify: returns to chat mode, brain canvas unmounts

10. **Edge labels:** Click Connect → connect nodes A → B → type label → edge appears with label
    - Verify: edge is visible, label appears on the connection line

- [ ] **Step 4: Commit any final wiring fixes

```bash
git add -A
git commit -m "fix(brain): integration fixes after smoke test"
```

If building on the main branch, commit one final assembled message:
```bash
git commit -m "feat(brain): Brain Canvas P2 — spatial canvas with node cards, edges, and split-mode integration"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - §1 (Vision — full-screen spatial canvas, draggable cards, edges, split-mode): Task 12 (BrainCanvasPage), Task 2 (store action)
   - §2 (Reuse decisions — useCanvasViewport, computeElbowPoints): Task 1 (connectorGeometry uses computeElbowPoints), BrainCanvasPage imports useCanvasViewport
   - §3 (Surface & layout — full-screen replacing chat, presets top-left, stats top/right, toolbar): Tasks 9, 10, 12, 13
   - §3 (Split-mode integration): Tasks 2, 3, 4
   - §4 (Sidebar — foldable brain rows, Sessions button, add-existing popover): Tasks 11, 14, 15
   - §5 (Node cards — type icon, parent, edited time, title, preview, priority pill, connector dots): Task 7
   - §6 (Connectors — click dot A → click dot B → inline label → elbow path, no drag-to-draw): Tasks 1, 12
   - §6 (Routing — computeElbowPoints, closest-sides heuristic): Task 1
   - §7 (Adding nodes — new node creates real note entity, add existing searches): Tasks 11, 12 (handleCanvasClick, handleAddExisting)
   - §8 (Non-goals — no compiler changes, no tag CRUD, no memory migration): Confirmed: no brainCompiler/braintStore changes
   - §9 (Follow-up deferred — memory migration separate): Acknowledged, not in this plan

2. **Placeholder scan:** All code blocks contain complete implementations. No "TBD", "TODO", or "implement later" patterns. Test code is explicit with assertions. Commands are exact.

3. **Type consistency:**
   - `connectorPoint` returns `{ x, y }` — used by `buildEdgePath` matching computeElbowPoints' `[number,number][]`
   - `NodeBox { x, y, width, height }` — used by `connectorPoint`, `buildEdgePath`, `closestSides`
   - `ConnectorSide 'top' | 'right' | 'bottom' | 'left'` — used by card, page, connections
   - `openBrainNode(entityId)` — defined in store, used by BrainCanvasPage and BrainSidebarContent
   - `useBrainData` returns `{ state, loading, error, selectedBrainId, setSelectedBrainId, load, mutate }` — consistent across all canvas components
   - `BrainCanvasPage` → `BrainToolbar` prop types match the interface defined in Task 13
   - `CARD_W = 264, CARD_H = 140` — same constant used by Both `BrainNodeCard` and `BrainCanvasPage` for positioning
