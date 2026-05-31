"use client";

import { useStore, AppTask } from '@/data/store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { preventUnhandled } from '@atlaskit/pragmatic-drag-and-drop/prevent-unhandled';
import { KanbanColumn } from './KanbanColumn';
import {
  findContainer,
  computeFinalColumns,
  indexFromPointer,
  columnIdFromX,
  getTaskImplicitPosition,
  positionForDrop,
  type ColumnItems,
  type CardRect,
  type ColumnRect,
} from './dragLogic';

const COLUMN_KEYS = ['todo', 'inProgress', 'today', 'overdue', 'completed'] as const;

function buildColumns(tasks: AppTask[], today: string): ColumnItems {
  const sortTasks = (a: AppTask, b: AppTask) => {
    const posA = getTaskImplicitPosition(a);
    const posB = getTaskImplicitPosition(b);
    if (posA !== posB) return posA - posB;
    // Keep it stable with id fallback
    return a.id.localeCompare(b.id);
  };

  return {
    todo:      tasks.filter(t => !t.completed && t.status !== 'in-progress' && (!t.dueDate || t.dueDate > today)).sort(sortTasks),
    inProgress: tasks.filter(t => !t.completed && t.status === 'in-progress').sort(sortTasks),
    today:     tasks.filter(t => !t.completed && t.status !== 'in-progress' && t.dueDate === today).sort(sortTasks),
    overdue:   tasks.filter(t => !t.completed && t.status !== 'in-progress' && t.dueDate && t.dueDate < today).sort(sortTasks),
    completed: tasks.filter(t => t.completed).sort(sortTasks),
  };
}

export function TrackerPage() {
  const trackerFilterWorkspace = useStore(s => s.trackerFilterWorkspace);
  const allTasks = useStore(s => s.tasks);
  const tasks = useMemo(() => {
    const rawTasks = trackerFilterWorkspace === null
      ? allTasks
      : allTasks.filter(t => (t.workspaceId || 'ws-personal') === trackerFilterWorkspace);

    // Defensive check: filter out null/undefined, tasks without a valid ID, and duplicates by ID
    const seen = new Set<string>();
    return rawTasks.filter((t): t is AppTask => {
      if (!t || typeof t !== 'object') return false;
      if (!t.id) return false;
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [allTasks, trackerFilterWorkspace]);
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Derived columns from store — stable when tasks don't change
  const storeColumns = useMemo(() => buildColumns(tasks, today), [tasks, today]);

  type Drag = {
    taskId: string;
    height: number;
    // The destination column the cursor is currently over.
    destColumn: string | null;
    // Insertion index in the destination (against storeColumns before removal;
    // -1 = append). Used to commit on drop, incl. when dropping on the gap.
    destIndex: number;
    // The full-size moving gap is rendered AFTER this card id (null = before the
    // first card). The dragged card's own DOM node stays mounted but invisible
    // in its origin slot, so pragmatic-dnd never loses it (no remount).
    placeholderAfterTaskId: string | null;
    // Dedupe key so we only setState when the resolved destination changes.
    signature: string;
  };
  const [drag, setDrag] = useState<Drag | null>(null);
  // The task that just landed + a monotonic nonce. The nonce bumps every drop so
  // the settle animation restarts even on a rapid re-drop of the same card; it
  // clears after the animation so it doesn't replay on later re-renders.
  const [justDropped, setJustDropped] = useState<{ taskId: string; nonce: number } | null>(null);
  const dropNonceRef = useRef(0);
  const dropAnimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The dragged card's gap height is captured once on dragStart and cached
  // here so move handlers don't read 0 from the hidden element.
  const heightRef = useRef(0);
  // Where inside the card it was grabbed + the card's size, captured at
  // dragStart. Used to turn the cursor position into the dragged preview's
  // CENTER, so the gap follows where the card sits rather than the cursor.
  const grabRef = useRef({ offsetX: 0, offsetY: 0, width: 0, height: 0 });
  // Sync ref written directly inside the move handlers (not via setDrag).
  // onDrop always reads this — never stale React state from a delayed render.
  const dropPosRef = useRef<{ destColumn: string; destIndex: number } | null>(null);
  // The card's ORIGIN slot, captured at dragStart. When the cursor goes
  // off-board the gap returns here so what's shown matches what will commit
  // (a drop off-board lands back at origin).
  const originPosRef = useRef<{ destColumn: string; destIndex: number } | null>(null);
  // Render store columns directly; the dragged card is invisible in place and
  // a separate moving gap is drawn at the destination. No optimistic reordering
  // → the dragged DOM node never unmounts mid-drag.
  const columns = storeColumns;

  // Apply a committed drop to the store (mirrors the previous handleDragEnd).
  const commitDrop = (activeItemId: string, destColumn: string, destIndex: number) => {
    const srcColumn = findContainer(activeItemId, storeColumns);
    const finalCols = computeFinalColumns(storeColumns, activeItemId, destColumn, destIndex);
    if (finalCols === storeColumns && srcColumn === destColumn) return; // no-op

    // Position the moved card strictly between its neighbours' EFFECTIVE
    // positions in the final order. Using effective positions (which honour
    // createdAt for never-dragged cards) is what makes a drop land on the right
    // side of an unpositioned neighbour — the old getOrGeneratePositions only
    // anchored on the raw `position` field and mis-placed such drops.
    const destTasks = finalCols[destColumn] ?? [];
    const movedIdx = destTasks.findIndex(t => t.id === activeItemId);
    const newPosition = positionForDrop(destTasks, activeItemId, movedIdx);

    let updates: Partial<AppTask> = { position: newPosition };
    const columnChanged = srcColumn !== null && srcColumn !== destColumn;
    if (columnChanged) {
      const yesterday = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
      })();
      switch (destColumn) {
        case 'todo':       updates = { ...updates, status: 'todo', dueDate: undefined, completed: false }; break;
        case 'inProgress': updates = { ...updates, status: 'in-progress', completed: false }; break;
        case 'today':      updates = { ...updates, status: 'todo', dueDate: today, completed: false }; break;
        case 'overdue':    updates = { ...updates, status: 'todo', dueDate: yesterday, completed: false }; break;
        case 'completed':  updates = { ...updates, completed: true }; break;
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
    
    // Always persist task status and position changes to the DB!
    useStore.getState().updateTask(activeItemId, updates);
  };

  type Resolved = { destColumn: string; destIndex: number } | null;

  // Read the rendered (non-hidden) card rects for a column, in DOM order. The
  // dragged card is `hidden` so it has no box and is naturally excluded.
  const columnCardRects = (destColumn: string): CardRect[] => {
    const container =
      typeof document !== 'undefined'
        ? document.querySelector<HTMLElement>(`[data-kanban-column="${destColumn}"]`)
        : null;
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLElement>('[data-task-id]'))
      .map(el => {
        const r = el.getBoundingClientRect();
        return { id: el.dataset.taskId as string, top: r.top, bottom: r.bottom };
      })
      // Skip zero-height boxes (the hidden dragged card, if it ever reports one).
      .filter(r => r.bottom > r.top);
  };

  // Translate a pointer Y over a column into a pre-removal insertion index.
  // indexFromPointer works against the *rendered* (dragged-excluded) cards, so
  // we map its "insert before rendered card X" result back to X's index in the
  // full storeColumns array — the convention used by the rest of the pipeline.
  const columnIndexFromPointer = (destColumn: string, clientY: number): number => {
    const rects = columnCardRects(destColumn);
    const renderedIdx = indexFromPointer(clientY, rects);
    if (renderedIdx === -1) return -1; // genuinely below the last card → append
    const beforeId = rects[renderedIdx].id;
    const colItems = storeColumns[destColumn] ?? [];
    const idx = colItems.findIndex(t => t.id === beforeId);
    return idx === -1 ? -1 : idx;
  };

  // Horizontal span + shared vertical extent of the columns, read from the DOM.
  const readColumns = (): { rects: ColumnRect[]; top: number; bottom: number } => {
    if (typeof document === 'undefined') return { rects: [], top: 0, bottom: 0 };
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-kanban-column]'));
    const rects: ColumnRect[] = [];
    let top = Infinity;
    let bottom = -Infinity;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      rects.push({ id: el.dataset.kanbanColumn as string, left: r.left, right: r.right });
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
    }
    return { rects, top, bottom };
  };

  // Resolve the drop position from the dragged card's CENTER, not the cursor.
  // The cursor sits wherever the card was grabbed, so a card straddling two
  // columns would otherwise drop under the cursor's column instead of the one
  // it visually overlaps most. We reconstruct the preview's center from the
  // cursor + grab geometry, pick the column by center-X, and the slot by
  // center-Y proximity. destIndex is against storeColumns BEFORE removal.
  // Off the board on EITHER axis (X past the side columns, or Y above/below the
  // columns — e.g. the header strip) → null, so the caller restores origin.
  const resolvePosition = (clientX: number, clientY: number): Resolved => {
    const g = grabRef.current;
    const centerX = clientX + (g.width / 2 - g.offsetX);
    const centerY = clientY + (g.height / 2 - g.offsetY);
    const { rects, top, bottom } = readColumns();
    // Above or below the columns (header / page chrome) → off-board.
    if (centerY < top || centerY > bottom) return null;
    const destColumn = columnIdFromX(centerX, rects);
    if (!destColumn) return null;
    return { destColumn, destIndex: columnIndexFromPointer(destColumn, centerY) };
  };

  // The full-size gap sits AFTER the returned card id (null = before first
  // card). Computed against the destination column with the dragged card
  // removed, so the gap lands exactly where the card would drop.
  const gapAfterId = (taskId: string, destColumn: string, destIndex: number): string | null => {
    const srcColumn = findContainer(taskId, storeColumns);
    const destItems = (storeColumns[destColumn] ?? []).filter(t => t.id !== taskId);
    let insertAt = destIndex === -1 ? destItems.length : destIndex;
    // Same column, moving down: removal shifted indices left by one.
    if (srcColumn === destColumn && destIndex !== -1) {
      const srcIndex = (storeColumns[destColumn] ?? []).findIndex(t => t.id === taskId);
      if (srcIndex !== -1 && srcIndex < destIndex) insertAt = destIndex - 1;
    }
    insertAt = Math.max(0, Math.min(insertAt, destItems.length));
    return insertAt === 0 ? null : destItems[insertAt - 1].id;
  };

  // Commit a resolved position to both the sync ref (read by onDrop) and the
  // gap render state. When the cursor is off-board (`resolved === null`) we fall
  // back to the card's ORIGIN slot — so the gap shown always matches where a
  // drop will actually land (off-board drops return to origin). This keeps the
  // displayed drop-box and the committed position in sync; they previously
  // diverged (gap stuck at the last column, but the drop committed at origin).
  // Shared by onDrag (every move) and onDropTargetChange.
  const applyResolved = (taskId: string, resolved: Resolved) => {
    const target = resolved ?? originPosRef.current;
    if (!target) return;
    const { destColumn, destIndex } = target;
    const height = heightRef.current;
    dropPosRef.current = target;
    const gapAfter = gapAfterId(taskId, destColumn, destIndex);
    const signature = `${destColumn}:${destIndex}`;
    setDrag(d =>
      d && d.signature === signature
        ? d
        : {
            taskId,
            height,
            destColumn,
            destIndex,
            placeholderAfterTaskId: gapAfter,
            signature,
          }
    );
  };

  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => source.data.type === 'task',
      onDragStart: ({ source, location }) => {
        // Make the whole window a "handled" drop surface for this drag. Without
        // this, releasing over the sidebar / empty space leaves the native drag
        // event unhandled and the browser plays its return-to-origin snapback
        // (the slow slide-back + fade) AND lets native text/element selection
        // highlight things mid-drag. Prevented here, stopped in onDrop.
        preventUnhandled.start();
        const taskId = source.data.taskId as string;
        const rect = (source.element as HTMLElement).getBoundingClientRect();
        heightRef.current = rect.height;
        // Capture where in the card it was grabbed + its size, so move handlers
        // can reconstruct the dragged preview's center from the cursor.
        const init = location.initial.input;
        grabRef.current = {
          offsetX: init.clientX - rect.left,
          offsetY: init.clientY - rect.top,
          width: rect.width,
          height: rect.height,
        };
        // Gap starts in the card's own column, in its own slot. This origin is
        // also where the gap returns (and the drop commits) when off-board.
        const destColumn = findContainer(taskId, storeColumns);
        const ownIndex = destColumn
          ? (storeColumns[destColumn] ?? []).findIndex(t => t.id === taskId)
          : -1;
        const fallbackColumn = destColumn ?? 'todo';
        originPosRef.current = { destColumn: fallbackColumn, destIndex: ownIndex };
        setDrag({
          taskId,
          height: rect.height,
          destColumn: fallbackColumn,
          destIndex: ownIndex,
          placeholderAfterTaskId: gapAfterId(taskId, fallbackColumn, ownIndex),
          signature: `${fallbackColumn}:${ownIndex}`,
        });
        dropPosRef.current = { destColumn: fallbackColumn, destIndex: ownIndex };
      },
      // Fires on EVERY pointer move — gives continuous proximity tracking so the
      // gap follows the dragged card's center without needing precise alignment.
      onDrag: ({ source, location }) => {
        const taskId = source.data.taskId as string;
        const resolved = resolvePosition(location.current.input.clientX, location.current.input.clientY);
        applyResolved(taskId, resolved);
      },
      onDropTargetChange: ({ source, location }) => {
        const taskId = source.data.taskId as string;
        const resolved = resolvePosition(location.current.input.clientX, location.current.input.clientY);
        applyResolved(taskId, resolved);
      },
      onDrop: ({ source, location }) => {
        // Stop intercepting window drag events now the drag is over.
        preventUnhandled.stop();
        const taskId = source.data.taskId as string;
        // Commit whatever the continuously-updated dropPosRef holds — it is the
        // SAME position the gap was showing (set by the last onDrag, geometry-
        // based). Do NOT gate on location.dropTargets: on a fast flick-drop the
        // browser can fire `drop` with an empty dropTargets list even while the
        // cursor is over a column, which previously skipped the commit and left
        // the card at origin (the "drops in initial place, not the box" bug).
        // Off-board drops are already handled: resolvePosition returned null and
        // dropPosRef fell back to origin, so commitDrop becomes a no-op there.
        const pos = dropPosRef.current;
        // eslint-disable-next-line no-console
        console.log('[DND fastdrop]', {
          dropTargetsLen: location.current.dropTargets.length,
          committing: pos,
        });
        if (pos) {
          commitDrop(taskId, pos.destColumn, pos.destIndex);
        }
        // Play the settle on EVERY drop — on a landing AND on an off-board drop
        // (where the card snaps back to origin) — for consistent feedback that
        // the drop was registered. Keep the class until the 0.4s color
        // animation finishes (+ buffer), else it gets cut off mid-fade.
        dropNonceRef.current += 1;
        setJustDropped({ taskId, nonce: dropNonceRef.current });
        if (dropAnimTimer.current) clearTimeout(dropAnimTimer.current);
        dropAnimTimer.current = setTimeout(() => setJustDropped(null), 450);
        setDrag(null);
      },
    });
    // Closures read storeColumns/allTasks/today/trackerFilterWorkspace, so
    // re-subscribe when those change to avoid stale reads.
  }, [storeColumns, allTasks, today, trackerFilterWorkspace]);

  // Clear any pending drop-settle timer on unmount.
  useEffect(() => () => {
    if (dropAnimTimer.current) clearTimeout(dropAnimTimer.current);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--color-background)] h-full overflow-hidden relative px-8 py-5">
      <header className="flex items-end justify-between mb-3 px-[6px] shrink-0">
        <div>
          <h1 className="text-2xl font-display font-medium text-foreground mb-1">Tasks</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Manage your progress across all workspaces.
          </p>
        </div>
      </header>

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
              // The moving gap is drawn in whichever column the cursor is over.
              const gap = drag && drag.destColumn === id
                ? { afterTaskId: drag.placeholderAfterTaskId, height: drag.height }
                : null;
              return (
                <KanbanColumn
                  key={id}
                  id={id}
                  title={title}
                  tasks={columns[id]}
                  gap={gap}
                  activeDragId={drag?.taskId ?? null}
                  justDropped={justDropped}
                />
              );
            })}
          </div>
        </div>
    </div>
  );
}
