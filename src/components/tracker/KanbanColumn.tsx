"use client";

import { AppTask, useStore, generateId } from '@/data/store';
import { TaskCard } from './TaskCard';
import { OverlayScrollbar } from './OverlayScrollbar';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import { Plus, MoreHorizontal, Trash2, ArrowUpDown, Check } from 'lucide-react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { shouldShowEmptyState } from './dragLogic';
import { Tooltip } from '@/components/layout/Tooltip';
import { Skeleton } from '@/components/ui/Skeleton';

const DOT_COLORS: Record<string, string> = {
  todo: '#3B82F6',       // Blue
  inProgress: '#F59E0B', // Amber
  today: '#8B5CF6',
  overdue: '#EF4444',
  completed: '#10B981'   // Emerald
};

// The moving full-size gap. It is ITSELF a drop target reporting its own
// current position, so hovering the gap resolves to the same slot it already
// occupies — this is what prevents the insert/relayout oscillation (the loop).
// The drop target is registered once (empty deps) and reads latest props from
// a ref so it never needs to tear down and re-create on cursor moves.
function GapBox({ columnId, afterTaskId, height }: { columnId: string; afterTaskId: string | null; height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const dataRef = useRef({ columnId, afterTaskId });
  dataRef.current = { columnId, afterTaskId };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.type === 'task',
      getData: () => ({ type: 'gap', ...dataRef.current }),
    });
  }, []);
  return (
    <div
      ref={ref}
      className="rounded-[10px] bg-[color-mix(in_srgb,var(--app-dark)_50%,transparent)] shrink-0 transition-[height] duration-150 ease-out"
      style={{ height }}
    />
  );
}

interface KanbanColumnProps {
  id: string;
  title: string;
  tasks: AppTask[];
  // The moving full-size gap, when the cursor is over THIS column (else null).
  // afterTaskId === null → gap before the first card.
  gap: { afterTaskId: string | null; height: number } | null;
  // Id of the card currently being dragged (null when no drag in progress).
  // That card stays mounted but hidden in its origin slot so pragmatic-dnd
  // keeps tracking it; the visual gap is drawn separately.
  activeDragId: string | null;
  // The cards that just landed + a nonce that bumps each drop, so the settle
  // animation restarts every time (even on a rapid re-drop of the same card).
  justDropped: { taskIds: string[]; nonce: number } | null;
  isLoading?: boolean;
}

function KanbanColumnInner({ id, title, tasks, gap, activeDragId, justDropped, isLoading }: KanbanColumnProps) {
  const { resolvedTheme } = useTheme();
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


  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);

  const currentSortMode = useStore(s => s.trackerColumnSortModes?.[id] || 'manual');
  const setTrackerColumnSortMode = useStore(s => s.setTrackerColumnSortMode);
  const isLocked = useStore(s => s.trackerColumnSortLocks?.[id]);
  const toggleTrackerColumnSortLock = useStore(s => s.toggleTrackerColumnSortLock);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [id]);

  return (
    <div
      className="flex flex-col w-[300px] shrink-0 h-full rounded-[var(--radius-big)] p-4 bg-[var(--color-panel)] border border-[var(--bone-3)]"
      style={{ borderColor: resolvedTheme === 'dark' ? 'var(--bone-3)' : 'var(--bone-6)' }}
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          {/* Dot */}
          <span 
            className="w-2 h-2 rounded-full shrink-0" 
            style={{ backgroundColor: DOT_COLORS[id] || 'var(--bone-20)' }} 
          />
          {isLoading ? (
            <Skeleton className="h-5 w-24 rounded-md bg-[var(--bone-5)]" />
          ) : (
            <>
              {/* Title */}
              <span className="text-[13px] font-sans font-semibold text-[var(--bone-90)] tracking-wide leading-none select-none">
                {title}
              </span>
              {/* Count Badge */}
              <span className="flex items-center justify-center w-[22px] h-[22px] rounded-[4px] text-[12px] font-ui font-medium bg-[var(--bone-6)] text-[var(--bone-70)] shrink-0 select-none">
                {tasks.length}
              </span>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 text-[var(--bone-40)]">
          {id === 'completed' && (
            <Tooltip content="Clear completed tasks" position="bottom" delay={400}>
              <button
                onClick={() => {
                  if (window.confirm("Are you sure you want to clear all completed tasks?")) {
                    useStore.getState().clearCompletedTasks();
                  }
                }}
                className="p-1 rounded-[var(--radius-small)] hover:bg-[var(--app-dark)] hover:text-red-400 transition-none cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            </Tooltip>
          )}
          <Tooltip content="Sort tasks" position="bottom" delay={400}>
            <button
              ref={sortButtonRef}
              onClick={() => setIsSortMenuOpen(prev => !prev)}
              className={cn(
                "p-1 rounded-[var(--radius-small)] hover:bg-[var(--app-dark)] transition-none",
                isSortMenuOpen ? "text-[var(--bone-100)] bg-[var(--app-dark)]" : "hover:text-[var(--bone-100)]"
              )}
            >
              <ArrowUpDown className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          </Tooltip>
          {isSortMenuOpen && typeof document !== 'undefined' && createPortal(
            <div
              ref={sortMenuRef}
              className="fixed popup-glass-small z-[9999] min-w-[160px] p-1.5 flex flex-col gap-[3px] shadow-2xl"
              style={{
                top: (sortButtonRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                left: (sortButtonRef.current?.getBoundingClientRect().right ?? 0) - 160,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setTrackerColumnSortMode(id, 'manual');
                }}
                className={cn(
                  "popup-item flex items-center justify-between gap-3 text-left w-full transition-none",
                  currentSortMode === 'manual' && "bg-[var(--bone-6)] text-[var(--bone-100)] font-semibold"
                )}
              >
                <span>Manual sorting</span>
                {currentSortMode === 'manual' && <Check className="w-3.5 h-3.5 shrink-0 text-[var(--bone-60)]" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrackerColumnSortMode(id, 'automatic');
                }}
                className={cn(
                  "popup-item flex items-center justify-between gap-3 text-left w-full transition-none",
                  currentSortMode === 'automatic' && "bg-[var(--bone-6)] text-[var(--bone-100)] font-semibold"
                )}
              >
                <span>Auto-sorting</span>
                {currentSortMode === 'automatic' && <Check className="w-3.5 h-3.5 shrink-0 text-[var(--bone-60)]" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrackerColumnSortMode(id, 'recently_added');
                }}
                className={cn(
                  "popup-item flex items-center justify-between gap-3 text-left w-full transition-none",
                  currentSortMode === 'recently_added' && "bg-[var(--bone-6)] text-[var(--bone-100)] font-semibold"
                )}
              >
                <span>Recently Added</span>
                {currentSortMode === 'recently_added' && <Check className="w-3.5 h-3.5 shrink-0 text-[var(--bone-60)]" />}
              </button>
              {currentSortMode !== 'manual' && (
                <>
                  <div className="popup-divider" />
                  <div
                    onClick={() => {
                      toggleTrackerColumnSortLock(id);
                    }}
                    className={cn(
                      "popup-item flex items-center justify-between gap-3 text-left w-full transition-none",
                      isLocked && "text-[var(--bone-100)]"
                    )}
                  >
                    <span>Lock sorting</span>
                    <label className="toggle-switch toggle-sm pointer-events-none">
                      <input
                        type="checkbox"
                        className="toggle-input"
                        checked={!!isLocked}
                        readOnly
                      />
                      <span className="toggle-label" />
                    </label>
                  </div>
                </>
              )}
            </div>,
            document.body
          )}

          {id !== 'completed' && (
            <Tooltip content="New task" position="bottom" delay={400}>
              <button
                onClick={() => {
                  const state = useStore.getState();
                  const presets: any = { entityId: state.trackerFilterEntityIds[0] || undefined };
                  if (id === 'todo') {
                    presets.status = 'todo';
                  } else if (id === 'inProgress') {
                    presets.status = 'in-progress';
                  } else if (id === 'today') {
                    presets.status = 'todo';
                    presets.dueDate = new Date().toISOString().split('T')[0];
                  } else if (id === 'overdue') {
                    presets.status = 'todo';
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    presets.dueDate = d.toISOString().split('T')[0];
                  }
                  useStore.getState().openTaskPanel(generateId(), presets);
                }}
                className="p-1 rounded-[var(--radius-small)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)] transition-none"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <OverlayScrollbar
        className="flex-1 -mr-4"
        scrollClassName="flex flex-col pr-4"
        scrollRef={(node) => { dropRef.current = node; }}
        scrollProps={{ 'data-kanban-column': id } as Record<string, unknown>}
      >
        {(() => {
          const gapBox = gap ? (
            <GapBox columnId={id} afterTaskId={gap.afterTaskId} height={gap.height} />
          ) : null;

          if (isLoading) {
            let hash = 0;
            for (let i = 0; i < id.length; i++) {
              hash = id.charCodeAt(i) + ((hash << 5) - hash);
            }
            const count = (Math.abs(hash) % 4) + 2;
            const heights = [];
            for (let i = 0; i < count; i++) {
              heights.push(80 + (Math.abs(hash + i * 123) % 80));
            }
            return (
              <div className="flex flex-col gap-3 min-h-0">
                {heights.map((h, i) => (
                  <Skeleton key={i} className="w-full rounded-[var(--radius-medium)] bg-[var(--bone-5)]" style={{ height: h }} />
                ))}
              </div>
            );
          }

          // Empty-state must NOT show while this column still owns the dragged
          // card — the hidden dragged card carries its follower-preview portal,
          // which React would destroy if we collapsed to the empty branch. That
          // is what made a card dragged OUT of its only-card column vanish
          // mid-drag (gap moves away → column looks empty) until drop. See
          // shouldShowEmptyState for the full reasoning.
          if (shouldShowEmptyState(tasks.map(t => t.id), activeDragId, gap !== null)) {
            return (
              <div className="flex-1 flex items-center justify-center bg-[var(--bone-3)] rounded-[var(--radius-medium)] min-h-[100px]">
                <span className="text-xs font-ui text-[var(--bone-15)]">No tasks here</span>
              </div>
            );
          }

          return (
            <div className="flex flex-col gap-3 min-h-0">
              {/* Gap before the first card */}
              {gap && gap.afterTaskId === null && gapBox}
              {tasks.map(task => (
                <React.Fragment key={task.id}>
                  <TaskCard
                    task={task}
                    columnId={id}
                    closestEdge={null}
                    isActiveDrag={task.id === activeDragId}
                    activeDragId={activeDragId}
                    dropNonce={justDropped?.taskIds.includes(task.id) ? justDropped.nonce : 0}
                  />
                  {gap && gap.afterTaskId === task.id && gapBox}
                </React.Fragment>
              ))}
            </div>
          );
        })()}
      </OverlayScrollbar>
    </div>
  );
}

// Memoized: TrackerPage re-renders on each gap/slot change during a card drag.
// The 4 columns the cursor is NOT over receive gap={null} plus otherwise-stable
// props (tasks from memoized storeColumns, constant activeDragId), so the shallow
// prop compare bails out on them — only the hovered column re-renders. This stops
// all 5 columns (and their OverlayScrollbars) re-rendering per slot move. This is
// safe here because the tracker uses pragmatic-dnd (drag state in refs/DOM), not
// dnd-kit's per-item React context.
export const KanbanColumn = React.memo(KanbanColumnInner);
