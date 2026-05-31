"use client";

import { AppTask, useStore } from '@/data/store';
import { TaskCard } from './TaskCard';
import { OverlayScrollbar } from './OverlayScrollbar';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Plus, MoreHorizontal, Trash2 } from 'lucide-react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

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
  // The card that just landed + a nonce that bumps each drop, so the settle
  // animation restarts every time (even on a rapid re-drop of the same card).
  justDropped: { taskId: string; nonce: number } | null;
}

export function KanbanColumn({ id, title, tasks, gap, activeDragId, justDropped }: KanbanColumnProps) {
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


  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      className="flex flex-col w-[300px] shrink-0 h-full rounded-[var(--radius-big)] p-4 bg-[var(--color-panel)] border border-[var(--bone-3)]"
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          {/* Dot */}
          <span 
            className="w-2 h-2 rounded-full shrink-0" 
            style={{ backgroundColor: DOT_COLORS[id] || 'var(--bone-20)' }} 
          />
          {/* Title */}
          <span className="text-[13px] font-sans font-semibold text-[var(--bone-90)] tracking-wide leading-none select-none">
            {title}
          </span>
          {/* Count Badge */}
          <span className="flex items-center justify-center w-[22px] h-[22px] rounded-[4px] text-[12px] font-ui font-medium bg-[var(--bone-6)] text-[var(--bone-70)] shrink-0 select-none">
            {tasks.length}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 text-[var(--bone-40)]">
          <button 
            onClick={() => useStore.getState().openModal({ kind: 'newTask' })}
            className="p-1 rounded-[var(--radius-small)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)] transition-none"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
          <button
            ref={buttonRef}
            onClick={() => id === 'completed' && setIsMenuOpen(prev => !prev)}
            className="p-1 rounded-[var(--radius-small)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)] transition-none"
          >
            <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
          {isMenuOpen && id === 'completed' && typeof document !== 'undefined' && createPortal(
            <div
              ref={menuRef}
              className="fixed popup-glass-small z-[9999] min-w-[150px] p-1.5 flex flex-col gap-[3px] shadow-2xl"
              style={{
                top: (buttonRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                left: (buttonRef.current?.getBoundingClientRect().right ?? 0) - 150,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  useStore.getState().clearCompletedTasks();
                  setIsMenuOpen(false);
                }}
                className="popup-item-danger gap-2"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>Clear completed</span>
              </button>
            </div>,
            document.body
          )}
        </div>
      </div>

      <OverlayScrollbar
        className="flex-1"
        scrollClassName="flex flex-col pr-2"
        scrollRef={(node) => { dropRef.current = node; }}
        scrollProps={{ 'data-kanban-column': id } as Record<string, unknown>}
      >
        {(() => {
          const gapBox = gap ? (
            <GapBox columnId={id} afterTaskId={gap.afterTaskId} height={gap.height} />
          ) : null;

          // Visible cards = all tasks except the one being dragged (it stays
          // mounted but invisible inside TaskCard, so it keeps its drag).
          const hasVisible = tasks.some(t => t.id !== activeDragId);

          if (!hasVisible && !gap) {
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
                    dropNonce={justDropped?.taskId === task.id ? justDropped.nonce : 0}
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
