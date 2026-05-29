# Tracker Kanban — pragmatic-drag-and-drop Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `@dnd-kit` in the 3 tracker files with `@atlaskit/pragmatic-drag-and-drop`, giving a live card-sized bone-3 placeholder gap that tracks the cursor, drops into empty columns, and never infinite-loops.

**Architecture:** Event-based drag. Cards register as `draggable` + `dropTargetForElements`; columns register as `dropTargetForElements`. A single `monitorForElements` in TrackerPage owns drag state `{ taskId, height, overColumnId, overIndex }`, updated only on target change. Columns render a bone-3 placeholder of the dragged card's measured height at `overIndex`. The store write + column side-effects happen once, on drop, reusing pure helpers in `dragLogic.ts`.

**Tech Stack:** Next.js 16 / React, `@atlaskit/pragmatic-drag-and-drop@1.8.1`, Zustand store, vitest.

---

## File Structure

- **Modify** `src/components/tracker/dragLogic.ts` — keep `findContainer`/`ColumnItems`; add pure `edgeToIndex()` and `computeFinalColumns()` (library-agnostic). Remove `dragOverReorder`/`dragEndReorder` (dnd-kit-era; replaced).
- **Modify** `src/components/tracker/dragLogic.test.ts` — drop dnd-kit-era reorder tests; add `edgeToIndex` + `computeFinalColumns` tests.
- **Rewrite** `src/components/tracker/TaskCard.tsx` — pragmatic `draggable` + card drop target + custom preview; placeholder hides source while dragging.
- **Rewrite** `src/components/tracker/KanbanColumn.tsx` — pragmatic column drop target; render bone-3 placeholder at `overIndex`.
- **Rewrite** `src/components/tracker/TrackerPage.tsx` — `monitorForElements`, drag state, drop commit (reuse helpers + existing side-effects). Remove `DndContext`/dnd-kit.

dnd-kit stays in the other 6 files. Both libraries coexist.

---

## Task 1: Install pragmatic-drag-and-drop

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependency**

Run: `npm install @atlaskit/pragmatic-drag-and-drop@1.8.1`
Expected: adds to `dependencies`, exits 0.

- [ ] **Step 2: Verify it resolves**

Run: `node -e "require.resolve('@atlaskit/pragmatic-drag-and-drop/element/adapter'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @atlaskit/pragmatic-drag-and-drop for tracker kanban"
```

---

## Task 2: Pure index helper `edgeToIndex`

Converts a drop on a card (with closest edge top/bottom) into an insertion index, accounting for same-list removal shift.

**Files:**
- Modify: `src/components/tracker/dragLogic.ts`
- Test: `src/components/tracker/dragLogic.test.ts`

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `src/components/tracker/dragLogic.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import type { AppTask } from '@/data/store';
import {
  findContainer,
  edgeToIndex,
  computeFinalColumns,
  type ColumnItems,
} from './dragLogic';

const t = (id: string, extra: Partial<AppTask> = {}): AppTask =>
  ({ id, title: id, completed: false, ...extra } as AppTask);

describe('findContainer', () => {
  it('finds the column key by container id', () => {
    const cols: ColumnItems = { todo: [t('a')], done: [] };
    expect(findContainer('todo', cols)).toBe('todo');
  });
  it('finds the column key by an item id', () => {
    const cols: ColumnItems = { todo: [t('a')], done: [t('x')] };
    expect(findContainer('x', cols)).toBe('done');
  });
  it('returns null when not found', () => {
    expect(findContainer('nope', { todo: [] })).toBeNull();
  });
});

describe('edgeToIndex', () => {
  it('top edge → the target index', () => {
    expect(edgeToIndex(2, 'top')).toBe(2);
  });
  it('bottom edge → after the target', () => {
    expect(edgeToIndex(2, 'bottom')).toBe(3);
  });
  it('null edge (dropped on column body) → append sentinel -1', () => {
    expect(edgeToIndex(null, null)).toBe(-1);
  });
});

describe('computeFinalColumns', () => {
  it('moves a card within the same column (down)', () => {
    const cols: ColumnItems = { todo: [t('a'), t('b'), t('c')], done: [] };
    // move 'a' to bottom edge of 'c' (index 2, bottom → 3)
    const next = computeFinalColumns(cols, 'a', 'todo', 3);
    expect(next.todo.map(i => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('moves a card within the same column (up)', () => {
    const cols: ColumnItems = { todo: [t('a'), t('b'), t('c')], done: [] };
    // move 'c' to top edge of 'a' (index 0)
    const next = computeFinalColumns(cols, 'c', 'todo', 0);
    expect(next.todo.map(i => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('moves a card to another column at an index', () => {
    const cols: ColumnItems = { todo: [t('a'), t('b')], done: [t('x'), t('y')] };
    const next = computeFinalColumns(cols, 'a', 'done', 1);
    expect(next.todo.map(i => i.id)).toEqual(['b']);
    expect(next.done.map(i => i.id)).toEqual(['x', 'a', 'y']);
  });

  it('appends to a column when index is the append sentinel -1', () => {
    const cols: ColumnItems = { todo: [t('a')], done: [] };
    const next = computeFinalColumns(cols, 'a', 'done', -1);
    expect(next.todo.map(i => i.id)).toEqual([]);
    expect(next.done.map(i => i.id)).toEqual(['a']);
  });

  it('no-op when dropping a card at its own position', () => {
    const cols: ColumnItems = { todo: [t('a'), t('b')], done: [] };
    // 'a' at index 0, top edge of itself → index 0 → unchanged
    const next = computeFinalColumns(cols, 'a', 'todo', 0);
    expect(next).toBe(cols);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/tracker/dragLogic.test.ts`
Expected: FAIL — `edgeToIndex` / `computeFinalColumns` not exported.

- [ ] **Step 3: Rewrite `dragLogic.ts`**

Replace the entire contents of `src/components/tracker/dragLogic.ts` with:

```ts
import type { AppTask } from '@/data/store';

export type ColumnItems = Record<string, AppTask[]>;
export type Edge = 'top' | 'bottom';

export function findContainer(id: string, cols: ColumnItems): string | null {
  if (id in cols) return id;
  for (const key of Object.keys(cols)) {
    if (cols[key].find(item => item.id === id)) return key;
  }
  return null;
}

/**
 * Convert a drop on a target card into an insertion index within the target
 * column. `top` inserts before the target, `bottom` after it. A null edge means
 * the drop landed on the column body (not a card) → append sentinel -1.
 */
export function edgeToIndex(targetIndex: number | null, edge: Edge | null): number {
  if (targetIndex === null || edge === null) return -1;
  return edge === 'bottom' ? targetIndex + 1 : targetIndex;
}

/**
 * Produce the final column arrangement after dropping `activeId` into
 * `destColumn` at `destIndex` (or appended when destIndex === -1).
 * `destIndex` is interpreted against the destination array BEFORE removal of the
 * active item; same-column upward/downward shifts are handled here.
 * Returns the same `cols` reference when nothing changes.
 */
export function computeFinalColumns(
  cols: ColumnItems,
  activeId: string,
  destColumn: string,
  destIndex: number
): ColumnItems {
  const srcColumn = findContainer(activeId, cols);
  if (!srcColumn || !(destColumn in cols)) return cols;

  const srcItems = [...cols[srcColumn]];
  const srcIndex = srcItems.findIndex(i => i.id === activeId);
  if (srcIndex === -1) return cols;
  const [moved] = srcItems.splice(srcIndex, 1);

  // Destination array after the item was removed from the source.
  const destItems = srcColumn === destColumn ? srcItems : [...cols[destColumn]];

  // Resolve insert position. Append sentinel -1 → end.
  let insertAt = destIndex === -1 ? destItems.length : destIndex;
  // Same column, moving down: the removal shifted indices left by one.
  if (srcColumn === destColumn && destIndex !== -1 && srcIndex < destIndex) {
    insertAt = destIndex - 1;
  }
  insertAt = Math.max(0, Math.min(insertAt, destItems.length));

  // No-op detection: item ends exactly where it started.
  if (srcColumn === destColumn && insertAt === srcIndex) return cols;

  destItems.splice(insertAt, 0, moved);

  if (srcColumn === destColumn) {
    return { ...cols, [destColumn]: destItems };
  }
  return { ...cols, [srcColumn]: srcItems, [destColumn]: destItems };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/tracker/dragLogic.test.ts`
Expected: PASS — all describe blocks green.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "dragLogic" || echo "clean"`
Expected: `clean`.

- [ ] **Step 6: Commit**

```bash
git add src/components/tracker/dragLogic.ts src/components/tracker/dragLogic.test.ts
git commit -m "refactor(tracker): pure edgeToIndex + computeFinalColumns helpers"
```

---

## Task 3: Rewrite TaskCard with pragmatic draggable + drop target

The presentational `TaskCardUI` is UNCHANGED. Only the `TaskCard` wrapper changes: it becomes a pragmatic draggable and a card drop target, hides itself while dragging, and renders a custom drag preview.

**Files:**
- Modify: `src/components/tracker/TaskCard.tsx` (replace the `TaskCard` function + imports at top; keep `TaskCardUI` and `TaskCardUIProps` exactly as-is)

- [ ] **Step 1: Replace the top imports**

In `src/components/tracker/TaskCard.tsx`, replace these lines:

```tsx
import { AppTask, useStore } from '@/data/store';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import React from 'react';
```

with:

```tsx
import { AppTask, useStore } from '@/data/store';
import { Calendar, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
```

(`extractClosestEdge` is NOT used here — only TrackerPage reads the edge. Do not import it in TaskCard.)

- [ ] **Step 2: Replace the `TaskCard` wrapper**

Replace the entire `export function TaskCard(...)` at the bottom of the file with:

```tsx
export type CardEdge = 'top' | 'bottom';

export function TaskCard({
  task,
  columnId,
  closestEdge,
}: {
  task: AppTask;
  columnId: string;
  closestEdge: CardEdge | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<{ container: HTMLElement } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return draggable({
      element: el,
      getInitialData: () => ({ type: 'task', taskId: task.id, columnId }),
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        setCustomNativeDragPreview({
          nativeSetDragImage,
          getOffset: () => ({ x: 16, y: 16 }),
          render: ({ container }) => {
            setPreview({ container });
            return () => setPreview(null);
          },
        });
      },
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });
  }, [task.id, columnId]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.type === 'task',
      getData: ({ input, element }) =>
        attachClosestEdge(
          { type: 'card', taskId: task.id, columnId },
          { input, element, allowedEdges: ['top', 'bottom'] }
        ),
    });
  }, [task.id, columnId]);

  return (
    <div ref={ref} className="relative">
      {/* Live insertion indicator: a card-sized bone-3 box is rendered by the
          column at the right slot, so here we only need the drop-edge line as a
          subtle aid. The placeholder box itself lives in KanbanColumn. */}
      {closestEdge && (
        <div
          className={cn(
            'absolute left-0 right-0 h-[2px] bg-[var(--bone-20)] rounded-full z-10',
            closestEdge === 'top' ? '-top-1.5' : '-bottom-1.5'
          )}
        />
      )}
      <div className={cn(isDragging && 'opacity-0')}>
        <TaskCardUI task={task} />
      </div>
      {preview &&
        createPortal(
          <div className="w-[268px] rounded-[10px] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.55)]">
            <TaskCardUI task={task} isDragging />
          </div>,
          preview.container
        )}
    </div>
  );
}
```

- [ ] **Step 3: Add the hitbox dependency (peer of pragmatic)**

Run: `npm install @atlaskit/pragmatic-drag-and-drop-hitbox`
Expected: installs, exits 0.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "TaskCard" || echo "clean"`
Expected: `clean`.

- [ ] **Step 5: Commit**

```bash
git add src/components/tracker/TaskCard.tsx package.json package-lock.json
git commit -m "feat(tracker): TaskCard as pragmatic draggable + drop target"
```

---

## Task 4: Rewrite KanbanColumn as pragmatic drop target with live placeholder

KanbanColumn renders the bone-3 placeholder box (sized to the dragged card) at the active insertion index, and is itself a drop target so empty columns accept drops. The header/menu UI is UNCHANGED.

**Files:**
- Modify: `src/components/tracker/KanbanColumn.tsx`

- [ ] **Step 1: Replace the top imports**

Replace:

```tsx
import { AppTask, useStore } from '@/data/store';
import { SortableContext, type SortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { TaskCard } from './TaskCard';
import { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Plus, MoreHorizontal, Trash2 } from 'lucide-react';
```

with:

```tsx
import { AppTask, useStore } from '@/data/store';
import { TaskCard, type CardEdge } from './TaskCard';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Plus, MoreHorizontal, Trash2 } from 'lucide-react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
```

- [ ] **Step 2: Remove the no-op strategy constant and update props**

Delete the `noopSortingStrategy` constant (the `const noopSortingStrategy: SortingStrategy = () => null;` block and its comment).

Replace the `KanbanColumnProps` interface and the `useDroppable`/`taskIds` block with:

```tsx
interface KanbanColumnProps {
  id: string;
  title: string;
  tasks: AppTask[];
  // Live drag info from TrackerPage (null when not dragging into this column).
  placeholder: { afterTaskId: string | null; height: number } | null;
  edgeByTaskId: Record<string, CardEdge | null>;
}

export function KanbanColumn({ id, title, tasks, placeholder, edgeByTaskId }: KanbanColumnProps) {
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.type === 'task',
      getData: () => ({ type: 'column', columnId: id }),
    });
  }, [id]);
```

(Keep the existing `isMenuOpen`/`menuRef`/`buttonRef` state and the click-outside `useEffect` immediately below.)

- [ ] **Step 3: Render the placeholder among the cards**

Replace the task-list render block (the `<div ref={setNodeRef}...>` through the closing of the `SortableContext`/empty-state ternary) with:

```tsx
      <div
        ref={dropRef}
        className="flex-1 flex flex-col overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-[var(--bone-10)] scrollbar-track-transparent"
      >
        {tasks.length > 0 ? (
          <div className="flex flex-col gap-3 min-h-0">
            {/* Placeholder before the first card */}
            {placeholder && placeholder.afterTaskId === null && (
              <div
                className="rounded-[10px] bg-[var(--bone-3)] shrink-0"
                style={{ height: placeholder.height }}
              />
            )}
            {tasks.map(task => (
              <React.Fragment key={task.id}>
                <TaskCard task={task} columnId={id} closestEdge={edgeByTaskId[task.id] ?? null} />
                {placeholder && placeholder.afterTaskId === task.id && (
                  <div
                    className="rounded-[10px] bg-[var(--bone-3)] shrink-0"
                    style={{ height: placeholder.height }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[var(--bone-3)] rounded-[var(--radius-medium)] min-h-[100px]">
            {placeholder ? (
              <div
                className="w-full rounded-[10px] bg-[var(--bone-6)] shrink-0"
                style={{ height: placeholder.height }}
              />
            ) : (
              <span className="text-xs font-ui text-[var(--bone-15)]">No tasks here</span>
            )}
          </div>
        )}
      </div>
```

- [ ] **Step 4: Add the React import for `React.Fragment`**

At the top of `KanbanColumn.tsx`, change `import { useState, useRef, useEffect } from 'react';` to `import React, { useState, useRef, useEffect } from 'react';`

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "KanbanColumn" || echo "clean"`
Expected: `clean` (TrackerPage will still error until Task 5 — that is expected; only check KanbanColumn here).

- [ ] **Step 6: Commit**

```bash
git add src/components/tracker/KanbanColumn.tsx
git commit -m "feat(tracker): KanbanColumn pragmatic drop target + bone-3 placeholder"
```

---

## Task 5: Rewrite TrackerPage with monitorForElements

TrackerPage owns drag state, computes the live placeholder + per-card edge, and commits the drop using `computeFinalColumns` plus the EXISTING column side-effects.

**Files:**
- Modify: `src/components/tracker/TrackerPage.tsx`

- [ ] **Step 1: Replace the imports + remove dnd-kit**

Replace the entire import block (lines 1 through the `import { dragOverReorder, ... }` line) with:

```tsx
"use client";

import { useStore, AppTask } from '@/data/store';
import { useEffect, useMemo, useState, useRef } from 'react';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { KanbanColumn } from './KanbanColumn';
import type { CardEdge } from './TaskCard';
import {
  findContainer,
  edgeToIndex,
  computeFinalColumns,
  type ColumnItems,
} from './dragLogic';
```

- [ ] **Step 2: Keep buildColumns/COLUMN_KEYS/tasks/today; replace drag state + handlers**

Keep `COLUMN_KEYS`, `buildColumns`, and (inside the component) the `trackerFilterWorkspace`, `allTasks`, `tasks` memo, `today`, `storeColumns` memo exactly as they are. DELETE `tomorrow` (unused) only if tsc flags it — otherwise leave it.

Replace the old drag state block:

```tsx
  const [dragColumns, setDragColumns] = useState<ColumnItems | null>(null);
  const initialContainerRef = useRef<string | null>(null);
  const lastOverIdRef = useRef<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // What's rendered: drag-time snapshot or store-derived
  const columns = dragColumns ?? storeColumns;
```

with:

```tsx
  type Drag = {
    taskId: string;
    height: number;
    destColumn: string | null;
    destIndex: number;            // -1 = append
    placeholderAfterTaskId: string | null; // null = before first card
    edgeByTaskId: Record<string, CardEdge | null>;
  };
  const [drag, setDrag] = useState<Drag | null>(null);
  const columns = storeColumns;
```

- [ ] **Step 3: Replace handleDragStart/handleDragOver/handleDragEnd/sensors/collision with a monitor effect**

Delete `sensors`, `handleDragStart`, `handleDragOver`, `handleDragEnd`, `collisionDetectionStrategy`, and `activeTask`. Replace them with this single effect (place it after the `storeColumns` memo and `drag` state):

```tsx
  // Apply a committed drop to the store (mirrors the previous handleDragEnd).
  const commitDrop = (activeItemId: string, destColumn: string, destIndex: number) => {
    const srcColumn = findContainer(activeItemId, storeColumns);
    const finalCols = computeFinalColumns(storeColumns, activeItemId, destColumn, destIndex);
    if (finalCols === storeColumns && srcColumn === destColumn) return; // no-op

    let updates: Partial<AppTask> = {};
    const columnChanged = srcColumn !== null && srcColumn !== destColumn;
    if (columnChanged) {
      const yesterday = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
      })();
      switch (destColumn) {
        case 'todo':       updates = { status: 'todo', dueDate: undefined, completed: false }; break;
        case 'inProgress': updates = { status: 'in-progress', completed: false }; break;
        case 'today':      updates = { status: 'todo', dueDate: today, completed: false }; break;
        case 'overdue':    updates = { status: 'todo', dueDate: yesterday, completed: false }; break;
        case 'completed':  updates = { completed: true }; break;
      }
    }

    const originalTask = allTasks.find(t => t.id === activeItemId);
    if (!originalTask) return;
    const nextCompleted = updates.completed !== undefined ? updates.completed : originalTask.completed;
    const completedAt = nextCompleted
      ? (originalTask.completed ? originalTask.completedAt : Date.now())
      : undefined;
    const updatedTask: AppTask = { ...originalTask, ...updates, completedAt };

    const updatedCols: ColumnItems = { ...finalCols };
    updatedCols[destColumn] = updatedCols[destColumn].map(t =>
      t.id === activeItemId ? updatedTask : t
    );

    const orderedFilteredTasks: AppTask[] = [
      ...updatedCols.todo,
      ...updatedCols.inProgress,
      ...updatedCols.today,
      ...updatedCols.overdue,
      ...updatedCols.completed,
    ];
    const otherTasks = allTasks.filter(t =>
      trackerFilterWorkspace !== null && (t.workspaceId || 'ws-personal') !== trackerFilterWorkspace
    );
    useStore.setState({ tasks: [...orderedFilteredTasks, ...otherTasks] });
    if (columnChanged) {
      useStore.getState().updateTask(activeItemId, updates);
    }
  };

  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => source.data.type === 'task',
      onDragStart: ({ source }) => {
        const taskId = source.data.taskId as string;
        const height = (source.element as HTMLElement).getBoundingClientRect().height;
        setDrag({ taskId, height, destColumn: null, destIndex: -1, placeholderAfterTaskId: null, edgeByTaskId: {} });
      },
      onDropTargetChange: ({ source, location }) => {
        const taskId = source.data.taskId as string;
        const height = (source.element as HTMLElement).getBoundingClientRect().height;
        const target = location.current.dropTargets[0];
        if (!target) { setDrag(d => d && { ...d, destColumn: null, edgeByTaskId: {} }); return; }

        if (target.data.type === 'card') {
          const overTaskId = target.data.taskId as string;
          const destColumn = target.data.columnId as string;
          const edge = extractClosestEdge(target.data) as CardEdge | null;
          const colItems = storeColumns[destColumn] ?? [];
          const targetIndex = colItems.findIndex(t => t.id === overTaskId);
          const destIndex = edgeToIndex(targetIndex, edge);
          // placeholder sits relative to the over card
          const placeholderAfterTaskId = edge === 'bottom' ? overTaskId
            : (targetIndex > 0 ? colItems[targetIndex - 1].id : null);
          setDrag({ taskId, height, destColumn, destIndex,
            placeholderAfterTaskId, edgeByTaskId: { [overTaskId]: edge } });
        } else if (target.data.type === 'column') {
          const destColumn = target.data.columnId as string;
          const colItems = storeColumns[destColumn] ?? [];
          const lastId = colItems.length > 0 ? colItems[colItems.length - 1].id : null;
          setDrag({ taskId, height, destColumn, destIndex: -1,
            placeholderAfterTaskId: lastId, edgeByTaskId: {} });
        }
      },
      onDrop: ({ source, location }) => {
        const taskId = source.data.taskId as string;
        const target = location.current.dropTargets[0];
        if (target) {
          let destColumn: string;
          let destIndex: number;
          if (target.data.type === 'card') {
            destColumn = target.data.columnId as string;
            const edge = extractClosestEdge(target.data) as CardEdge | null;
            const colItems = storeColumns[destColumn] ?? [];
            const targetIndex = colItems.findIndex(t => t.id === target.data.taskId);
            destIndex = edgeToIndex(targetIndex, edge);
          } else {
            destColumn = target.data.columnId as string;
            destIndex = -1;
          }
          commitDrop(taskId, destColumn, destIndex);
        }
        setDrag(null);
      },
    });
    // storeColumns/allTasks/today/trackerFilterWorkspace are read fresh via refs of
    // closures recreated each render, so re-subscribe when they change.
  }, [storeColumns, allTasks, today, trackerFilterWorkspace]);
```

- [ ] **Step 4: Update the JSX render (remove DndContext, pass placeholder props)**

Replace the `return ( ... )` block's drag region. Replace the `<DndContext ...>` wrapper and its children down through `</DndContext>` with a plain container, and pass placeholder props to each column:

```tsx
        <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin min-h-0">
          <div className="flex gap-3 h-full min-w-max">
            {COLUMN_KEYS.map((id) => {
              let title = '';
              switch (id) {
                case 'todo': title = 'To do'; break;
                case 'inProgress': title = 'In progress'; break;
                case 'today': title = 'Today'; break;
                case 'overdue': title = 'Overdue'; break;
                case 'completed': title = 'Done'; break;
                default: title = (id as string).charAt(0).toUpperCase() + (id as string).slice(1);
              }
              const placeholder = drag && drag.destColumn === id
                ? { afterTaskId: drag.placeholderAfterTaskId, height: drag.height }
                : null;
              const edgeByTaskId = drag && drag.destColumn === id ? drag.edgeByTaskId : {};
              return (
                <KanbanColumn
                  key={id}
                  id={id}
                  title={title}
                  tasks={columns[id]}
                  placeholder={placeholder}
                  edgeByTaskId={edgeByTaskId}
                />
              );
            })}
          </div>
        </div>
```

- [ ] **Step 5: Typecheck the whole project**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS"`
Expected: `0`. If `tomorrow`/`updateTask`/`useRef` are flagged unused, remove those unused declarations only.

- [ ] **Step 6: Run all tracker tests**

Run: `npx vitest run src/components/tracker/dragLogic.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/tracker/TrackerPage.tsx
git commit -m "feat(tracker): TrackerPage monitorForElements + live placeholder, drop commit"
```

---

## Task 6: Cleanup + manual verification

**Files:**
- Modify: any tracker file with leftover unused imports.

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS"`
Expected: `0`.

- [ ] **Step 2: Confirm dnd-kit fully removed from tracker (and still present elsewhere)**

Run: `grep -rl "@dnd-kit" src/components/tracker/ || echo "tracker clean"`
Expected: `tracker clean`.
Run: `grep -rl "@dnd-kit" src/components/layout/Sidebar.tsx`
Expected: still lists Sidebar (untouched).

- [ ] **Step 3: Full test suite**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 4: Manual verification (dev server)**

Run: `npm run dev` (if not already running on :3000).
Verify in the browser, checking each historical failure mode:
- Drag a card within "To do" and hold/move several seconds → **no "Maximum update depth" error**.
- Drag the tall "Task sidebar" card and small cards → **no stretching/shrinking** of other cards.
- Drag a card into empty "In progress" and "Today" → **drop succeeds**, task moves and status updates.
- During drag → a **card-sized bone-3 placeholder** opens at the cursor position, matching the dragged card's height; cards below slide down.
- Drop → card lands exactly where the placeholder was.
- Drop into "Done" → card marked completed.

- [ ] **Step 5: Commit any cleanup**

```bash
git add -A src/components/tracker/
git commit -m "chore(tracker): remove unused imports after pragmatic-dnd migration" || echo "nothing to commit"
```

---

## Notes for the implementer

- `TaskCardUI` and `TaskCardUIProps` in `TaskCard.tsx` are UNCHANGED — only the `TaskCard` wrapper is rewritten. Do not touch the presentational markup.
- The placeholder box height comes from `getBoundingClientRect().height` of the source element captured at `onDragStart` — this is what makes the gap match small vs tall cards.
- `edgeByTaskId` drives the thin 2px edge line on the hovered card; the bone-3 box is the primary indicator. If the edge line proves redundant in manual testing, it can be dropped — but keep the bone-3 box.
- Do NOT modify the other 6 dnd-kit files.
- Known out-of-scope quirk: the "Done" column re-sorts by `completedAt` in `buildColumns`, so manual ordering within Done won't persist. Leave as-is.
