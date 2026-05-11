"use client";

import { useStore, AppTask } from '@/data/store';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
  pointerWithin,
  rectIntersection,
  closestCorners,
  CollisionDetection
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMemo, useState, useCallback, useRef } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { TaskCardUI } from './TaskCard';
import { Plus } from 'lucide-react';

type ColumnItems = Record<string, AppTask[]>;

const COLUMN_KEYS = ['upcoming', 'today', 'inProgress', 'overdue', 'completed'] as const;

function buildColumns(tasks: AppTask[], today: string): ColumnItems {
  return {
    upcoming: tasks.filter(t => !t.completed && t.dueDate && t.dueDate > today),
    today:    tasks.filter(t => !t.completed && t.dueDate === today),
    inProgress: tasks.filter(t => !t.completed && !t.dueDate),
    overdue:  tasks.filter(t => !t.completed && t.dueDate && t.dueDate < today),
    completed: tasks.filter(t => t.completed),
  };
}

export function TrackerPage() {
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const allTasks = useStore(s => s.tasks);
  const tasks = useMemo(() => allTasks.filter(t => (t.workspaceId || 'ws-personal') === activeWorkspaceId), [allTasks, activeWorkspaceId]);
  const updateTask = useStore(s => s.updateTask);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Derived columns from store — stable when tasks don't change
  const storeColumns = useMemo(() => buildColumns(tasks, today), [tasks, today]);

  // During a drag we keep an optimistic copy so we can show live reordering
  const [dragColumns, setDragColumns] = useState<ColumnItems | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const initialContainerRef = useRef<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // What's rendered: drag-time snapshot or store-derived
  const columns = dragColumns ?? storeColumns;

  const findContainer = useCallback((id: string, cols: ColumnItems) => {
    if (id in cols) return id;
    for (const key of Object.keys(cols)) {
      if (cols[key].find(item => item.id === id)) return key;
    }
    return null;
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    activeIdRef.current = id;
    setActiveId(id);
    // Snapshot current store columns for drag
    setDragColumns(storeColumns);
    initialContainerRef.current = findContainer(id, storeColumns);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeItemId = active.id as string;
    const overId = over.id as string;

    setDragColumns(prev => {
      const cols = prev ?? storeColumns;
      const activeContainer = findContainer(activeItemId, cols);
      const overContainer = findContainer(overId, cols);

      if (!activeContainer || !overContainer || activeContainer === overContainer) return prev;

      const activeItems = [...cols[activeContainer]];
      const overItems = [...cols[overContainer]];
      const activeIndex = activeItems.findIndex(item => item.id === activeItemId);
      const overIndex = overItems.findIndex(item => item.id === overId);
      const itemToMove = activeItems[activeIndex];
      if (!itemToMove) return prev;

      activeItems.splice(activeIndex, 1);
      overItems.splice(overIndex >= 0 ? overIndex : overItems.length, 0, itemToMove);

      return { ...cols, [activeContainer]: activeItems, [overContainer]: overItems };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeItemId = active.id as string;

    if (over) {
      const overId = over.id as string;
      const finalContainer = findContainer(overId, columns);

      if (finalContainer && initialContainerRef.current && initialContainerRef.current !== finalContainer) {
        let updates: Partial<AppTask> = {};
        switch (finalContainer) {
          case 'upcoming':   updates = { dueDate: tomorrow, completed: false }; break;
          case 'today':      updates = { dueDate: today,    completed: false }; break;
          case 'inProgress': updates = { dueDate: undefined, completed: false }; break;
          case 'completed':  updates = { completed: true }; break;
        }
        updateTask(activeItemId, updates);
      }
    }

    // Clear drag state — storeColumns will take over
    setDragColumns(null);
    setActiveId(null);
    activeIdRef.current = null;
    initialContainerRef.current = null;
  };

  const collisionDetectionStrategy: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) return rectCollisions;
    return closestCorners(args);
  }, []);

  const activeTask = useMemo(() => tasks.find(t => t.id === activeId), [activeId, tasks]);

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '1' } } }),
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--color-background)] h-full overflow-hidden relative">
      <div className="flex items-center justify-between p-8 pb-4 shrink-0">
        <div className="mb-2">
          <h1 className="text-4xl font-display text-foreground mb-1 flex items-center gap-3">
            Tracker
          </h1>
          <p className="text-bone-60 text-sm font-medium">
            Manage your progress across all workspaces.
          </p>
        </div>
        
        <button
          onClick={() => useStore.getState().openModal({ kind: 'newTask' })}
          className="px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-sm rounded-[12px] flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/10 shrink-0"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          New Task
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-8 pb-8 scrollbar-thin">
          <div className="flex gap-6 h-full min-w-max py-2">
            {COLUMN_KEYS.map((id) => (
              <KanbanColumn
                key={id}
                id={id}
                title={id === 'inProgress' ? 'In Progress' : id.charAt(0).toUpperCase() + id.slice(1)}
                tasks={columns[id]}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeTask ? (
            <div style={{ width: 320, cursor: 'grabbing' }}>
              <TaskCardUI task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
