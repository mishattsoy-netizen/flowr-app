"use client";

import { useStore, AppTask } from '@/data/store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { preventUnhandled } from '@atlaskit/pragmatic-drag-and-drop/prevent-unhandled';
import { KanbanColumn } from './KanbanColumn';
import { TaskContextMenu } from './TaskContextMenu';
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

function buildColumns(
  tasks: AppTask[],
  today: string,
  sortModes: Record<string, 'manual' | 'automatic' | 'recently_added'>
): ColumnItems {
  const getAutomaticTier = (t: AppTask): number => {
    if (t.dueDate) return 1;
    if (t.priority) return 2;
    if (t.color && t.color !== '') return 3;
    return 4;
  };

  const sortManual = (a: AppTask, b: AppTask) => {
    const posA = getTaskImplicitPosition(a);
    const posB = getTaskImplicitPosition(b);
    if (posA !== posB) return posA - posB;
    return a.id.localeCompare(b.id);
  };

  const sortAutomatic = (a: AppTask, b: AppTask) => {
    const tierA = getAutomaticTier(a);
    const tierB = getAutomaticTier(b);
    if (tierA !== tierB) {
      return tierA - tierB;
    }

    if (tierA === 1) {
      const dateA = a.dueDate!;
      const dateB = b.dueDate!;
      const dateCompare = dateA.localeCompare(dateB);
      if (dateCompare !== 0) return dateCompare;
    }

    const priorityVal = (p: string | null | undefined) => {
      if (p === 'high') return 3;
      if (p === 'medium') return 2;
      if (p === 'low') return 1;
      return 0;
    };
    const prioA = priorityVal(a.priority);
    const prioB = priorityVal(b.priority);
    if (prioA !== prioB) {
      return prioB - prioA;
    }

    const colorA = a.color || '';
    const colorB = b.color || '';
    const colorCompare = colorA.localeCompare(colorB);
    if (colorCompare !== 0) return colorCompare;

    const posA = getTaskImplicitPosition(a);
    const posB = getTaskImplicitPosition(b);
    if (posA !== posB) return posA - posB;
    return a.id.localeCompare(b.id);
  };

  const sortRecentlyAdded = (a: AppTask, b: AppTask) => {
    const timeA = a.completed ? (a.completedAt ?? a.createdAt ?? 0) : (a.createdAt ?? 0);
    const timeB = b.completed ? (b.completedAt ?? b.createdAt ?? 0) : (b.createdAt ?? 0);
    if (timeA !== timeB) return timeB - timeA;
    return a.id.localeCompare(b.id);
  };

  const getSorter = (colId: string) => {
    const mode = sortModes?.[colId] || 'manual';
    if (mode === 'automatic') return sortAutomatic;
    if (mode === 'recently_added') return sortRecentlyAdded;
    return sortManual;
  };

  return {
    todo:      tasks.filter(t => !t.completed && t.status !== 'in-progress' && (!t.dueDate || t.dueDate > today)).sort(getSorter('todo')),
    inProgress: tasks.filter(t => !t.completed && t.status === 'in-progress').sort(getSorter('inProgress')),
    today:     tasks.filter(t => !t.completed && t.status !== 'in-progress' && t.dueDate === today).sort(getSorter('today')),
    overdue:   tasks.filter(t => !t.completed && t.status !== 'in-progress' && t.dueDate && t.dueDate < today).sort(getSorter('overdue')),
    completed: tasks.filter(t => t.completed).sort(getSorter('completed')),
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

  const trackerColumnSortModes = useStore(s => s.trackerColumnSortModes);

  // Derived columns from store — stable when tasks don't change
  const storeColumns = useMemo(
    () => buildColumns(tasks, today, trackerColumnSortModes),
    [tasks, today, trackerColumnSortModes]
  );

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
  const [justDropped, setJustDropped] = useState<{ taskIds: string[]; nonce: number } | null>(null);
  const dropNonceRef = useRef(0);
  const dropAnimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The board root, used to clear Safari's stuck `:hover` after a drop (below).
  const boardRef = useRef<HTMLDivElement>(null);
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
  // Per-frame geometry cache. Pointer events fire many times per frame; reading
  // getBoundingClientRect() on every card+column each time forces a synchronous
  // layout flush (reflow) per event — the main source of drag stutter. We
  // measure at most once per animation frame and reuse within the frame. A new
  // frame (or a re-render that may have shifted the cards) invalidates it, so it
  // never goes more than ~16ms stale and still tracks the moving gap/scroll.
  const geomCacheRef = useRef<{
    frameId: number;
    columns: { rects: ColumnRect[]; top: number; bottom: number };
    cardRects: Record<string, CardRect[]>;
  } | null>(null);
  // Bumped on each rAF so the cache knows when a fresh frame has started.
  const frameIdRef = useRef(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => { frameIdRef.current += 1; raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const freshGeomCache = () => {
    const c = geomCacheRef.current;
    if (c && c.frameId === frameIdRef.current) return c;
    const next = { frameId: frameIdRef.current, columns: readColumnsRaw(), cardRects: {} as Record<string, CardRect[]> };
    geomCacheRef.current = next;
    return next;
  };
  // Render store columns directly; the dragged card is invisible in place and
  // a separate moving gap is drawn at the destination. No optimistic reordering
  // → the dragged DOM node never unmounts mid-drag.
  const columns = storeColumns;

  // The status/date changes a task needs to belong to a given column.
  const columnUpdates = (destColumn: string, task?: AppTask): Partial<AppTask> => {
    const yesterday = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    })();
    switch (destColumn) {
      case 'todo': {
        const userDueDate = task?.userDueDate;
        const restoredDate = (userDueDate && userDueDate > today) ? userDueDate : undefined;
        return { status: 'todo', dueDate: restoredDate, completed: false };
      }
      case 'inProgress': {
        const userDueDate = task?.userDueDate;
        return { status: 'in-progress', dueDate: userDueDate || undefined, completed: false };
      }
      case 'today':      return { status: 'todo', dueDate: today, completed: false };
      case 'overdue':    return { status: 'todo', dueDate: yesterday, completed: false };
      case 'completed':  return { completed: true };
      default:           return {};
    }
  };

  // Apply a committed drop to the store (mirrors the previous handleDragEnd).
  const commitDrop = (activeItemId: string, destColumn: string, destIndex: number) => {
    // If the destination column is not sorted manually, drop toggles it to manual (unless locked)
    const isLocked = useStore.getState().trackerColumnSortLocks?.[destColumn];
    if (trackerColumnSortModes[destColumn] !== 'manual' && !isLocked) {
      useStore.getState().setTrackerColumnSortMode(destColumn, 'manual');
    }

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

    const originalTask = allTasks.find(t => t.id === activeItemId);
    if (!originalTask) return;

    let updates: Partial<AppTask> = { position: newPosition };
    const columnChanged = srcColumn !== null && srcColumn !== destColumn;
    if (columnChanged) {
      updates = { ...updates, ...columnUpdates(destColumn, originalTask) };
    }

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

  // ─── Context-menu / keyboard moves (no drag) ──────────────────────────────

  // Move one or more tasks to the end of `destColumn`, preserving their relative
  // order, applying the column's status/date changes. Used by the context menu's
  // "Move to →" (works on a single task or the whole selection).
  const moveTasksToColumn = (ids: string[], destColumn: string) => {
    const isLocked = useStore.getState().trackerColumnSortLocks?.[destColumn];
    if (trackerColumnSortModes[destColumn] !== 'manual' && !isLocked) {
      useStore.getState().setTrackerColumnSortMode(destColumn, 'manual');
    }

    const moving = ids
      .map(id => allTasks.find(t => t.id === id))
      .filter((t): t is AppTask => !!t)
      // Keep them in their current visual order within the move.
      .sort((a, b) => getTaskImplicitPosition(a) - getTaskImplicitPosition(b));
    if (moving.length === 0) return;

    // Base position = just past the current max in the destination column.
    const destItems = (storeColumns[destColumn] ?? []).filter(t => !ids.includes(t.id));
    const maxPos = destItems.length
      ? Math.max(...destItems.map(getTaskImplicitPosition))
      : 0;
    const base = maxPos + 1000;

    moving.forEach((task, i) => {
      const updates: Partial<AppTask> = { ...columnUpdates(destColumn, task), position: base + i * 1000 };
      useStore.getState().updateTask(task.id, updates);
    });
    // The moved cards have landed; drop the selection so they aren't left
    // highlighted and stale in their new column.
    if (moving.length > 1) useStore.getState().clearTaskSelection();
  };

  // Move a single task one row up/down within its own column by swapping its
  // effective position with the adjacent neighbour.
  const moveTaskByOne = (id: string, dir: 'up' | 'down') => {
    const col = findContainer(id, storeColumns);
    if (!col) return;

    // If the column sorting is locked, moving up/down in the same column is disabled
    if (useStore.getState().trackerColumnSortLocks?.[col]) {
      return;
    }

    if (trackerColumnSortModes[col] !== 'manual') {
      useStore.getState().setTrackerColumnSortMode(col, 'manual');
    }

    const items = storeColumns[col] ?? [];
    const idx = items.findIndex(t => t.id === id);
    if (idx === -1) return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return; // already at an edge
    const a = items[idx];
    const b = items[swapIdx];
    const posA = getTaskImplicitPosition(a);
    const posB = getTaskImplicitPosition(b);
    useStore.getState().updateTask(a.id, { position: posB });
    useStore.getState().updateTask(b.id, { position: posA });
  };

  type Resolved = { destColumn: string; destIndex: number } | null;

  // Read the rendered (non-hidden) card rects for a column, in DOM order. The
  // dragged card is `hidden` so it has no box and is naturally excluded.
  // Cached per frame (see freshGeomCache) so repeated pointer events within one
  // frame don't each force a layout flush.
  const columnCardRects = (destColumn: string): CardRect[] => {
    const cache = freshGeomCache();
    const hit = cache.cardRects[destColumn];
    if (hit) return hit;
    const rects = readCardRectsRaw(destColumn);
    cache.cardRects[destColumn] = rects;
    return rects;
  };

  const readCardRectsRaw = (destColumn: string): CardRect[] => {
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

  // Horizontal span + shared vertical extent of the columns, cached per frame.
  const readColumns = (): { rects: ColumnRect[]; top: number; bottom: number } =>
    freshGeomCache().columns;

  // Horizontal span + shared vertical extent of the columns, read from the DOM.
  const readColumnsRaw = (): { rects: ColumnRect[]; top: number; bottom: number } => {
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
  const resolvePosition = (taskId: string, clientX: number, clientY: number): Resolved => {
    const g = grabRef.current;
    const centerX = clientX + (g.width / 2 - g.offsetX);
    const centerY = clientY + (g.height / 2 - g.offsetY);
    const { rects, top, bottom } = readColumns();
    // Above or below the columns (header / page chrome) → off-board.
    if (centerY < top || centerY > bottom) return null;
    const destColumn = columnIdFromX(centerX, rects);
    if (!destColumn) return null;

    // Check lock
    const srcColumn = findContainer(taskId, storeColumns);
    const isLocked = useStore.getState().trackerColumnSortLocks?.[destColumn];
    if (isLocked && srcColumn === destColumn) {
      return null;
    }

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
        const resolved = resolvePosition(taskId, location.current.input.clientX, location.current.input.clientY);
        applyResolved(taskId, resolved);
      },
      onDropTargetChange: ({ source, location }) => {
        const taskId = source.data.taskId as string;
        const resolved = resolvePosition(taskId, location.current.input.clientX, location.current.input.clientY);
        applyResolved(taskId, resolved);
      },
      onDrop: ({ source }) => {
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
        // The cards that just landed — the whole group on a group drag, else the
        // single grabbed card. Captured here so the settle plays on ALL of them
        // (and before moveTasksToColumn clears the selection).
        let landedIds = [taskId];
        if (pos) {
          const selected = useStore.getState().selectedTaskIds;
          // Group drag: dragging any card that is part of a multi-selection
          // moves the WHOLE selection to the drop column together (preserving
          // their order). Otherwise just the one grabbed card moves.
          if (selected.length > 1 && selected.includes(taskId)) {
            landedIds = [...selected];
            moveTasksToColumn(selected, pos.destColumn);
          } else {
            commitDrop(taskId, pos.destColumn, pos.destIndex);
          }
        }
        // Play the settle on EVERY drop — on a landing AND on an off-board drop
        // (where the card snaps back to origin) — for consistent feedback that
        // the drop was registered. On a group drop, every moved card settles.
        // Keep the class until the 0.7s color animation finishes (+ buffer),
        // else it gets cut off mid-fade.
        dropNonceRef.current += 1;
        setJustDropped({ taskIds: landedIds, nonce: dropNonceRef.current });
        if (dropAnimTimer.current) clearTimeout(dropAnimTimer.current);
        dropAnimTimer.current = setTimeout(() => setJustDropped(null), 800);
        setDrag(null);

        // Safari latches `:hover` onto whatever card lands under the stationary
        // cursor after the drop reorders the DOM, and never clears it until the
        // next real pointer move — leaving a card stuck with the hover fill.
        // Briefly disabling pointer-events on the board removes every element
        // from hit-testing, so Safari drops the stale :hover; restoring it next
        // frame re-evaluates hover against the real cursor position. (No-op in
        // Chrome, which clears :hover correctly on its own.)
        const board = boardRef.current;
        if (board) {
          board.style.pointerEvents = 'none';
          requestAnimationFrame(() => {
            requestAnimationFrame(() => { board.style.pointerEvents = ''; });
          });
        }
      },
    });
    // Closures read storeColumns/allTasks/today/trackerFilterWorkspace, so
    // re-subscribe when those change to avoid stale reads.
  }, [storeColumns, allTasks, today, trackerFilterWorkspace]);

  // Clear any pending drop-settle timer on unmount.
  useEffect(() => () => {
    if (dropAnimTimer.current) clearTimeout(dropAnimTimer.current);
  }, []);

  // Lock document body cursor to grabbing during task drag
  useEffect(() => {
    if (drag) {
      document.body.classList.add('is-dragging');
    } else {
      document.body.classList.remove('is-dragging');
    }
    return () => {
      document.body.classList.remove('is-dragging');
    };
  }, [drag]);

  return (
    <div
      ref={boardRef}
      className="flex-1 flex flex-col min-h-0 bg-[var(--color-background)] h-full overflow-hidden relative py-5"
      onClick={(e) => {
        // Click on empty board space (not on a card) clears the selection.
        if (
          useStore.getState().selectedTaskIds.length > 0 &&
          !(e.target as HTMLElement).closest('[data-task-id]')
        ) {
          useStore.getState().clearTaskSelection();
        }
      }}
    >
      <header className="flex items-end justify-between mb-3 px-8 shrink-0">
        <div>
          <h1 className="text-2xl font-display font-medium text-foreground mb-1">Tasks</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Manage your progress across all workspaces.
          </p>
        </div>
      </header>

        <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin min-h-0">
          <div className="flex gap-3 h-full min-w-max">
            <div className="w-4 shrink-0" />
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
            <div className="w-4 shrink-0" />
          </div>
        </div>
      <TaskContextMenu onMoveToColumn={moveTasksToColumn} onMoveByOne={moveTaskByOne} />
    </div>
  );
}
