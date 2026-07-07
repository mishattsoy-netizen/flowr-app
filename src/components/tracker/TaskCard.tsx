"use client";

import { AppTask, useStore } from '@/data/store';
import { Calendar, Check, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import React, { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { createPortal } from 'react-dom';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { disableNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview';

interface TaskCardUIProps {
  task: AppTask;
  isDragging?: boolean;
  // Plays the one-shot drop-settle animation right after this card lands.
  justDropped?: boolean;
  // The kanban column this card lives in (for the right-click menu context).
  columnId?: string;
  style?: React.CSSProperties;
  attributes?: any;
  listeners?: any;
  setNodeRef?: (node: HTMLElement | null) => void;
}

export function TaskCardUI({
  task,
  isDragging,
  justDropped,
  columnId,
  style,
  attributes,
  listeners,
  setNodeRef
}: TaskCardUIProps) {
  // Narrow selectors: subscribing to the whole store (the old `useStore()`)
  // re-rendered every card on any store change — including the rapid setState on
  // each drag commit. Select only what this card actually depends on.
  const toggleTask = useStore(s => s.toggleTask);
  const updateTask = useStore(s => s.updateTask);
  const workspaceName = useStore(s => task.entityId ? s.entities.find(e => e.id === task.entityId)?.title || null : null);
  const isSelected = useStore(s => s.selectedTaskIds.includes(task.id));
  const toggleTaskSelection = useStore(s => s.toggleTaskSelection);
  const openTaskContextMenu = useStore(s => s.openTaskContextMenu);
  const trackerFilterTag = useStore(s => s.trackerFilterTag);

  const handleToggleSubtask = (subId: string) => {
    if (!task.subtasks) return;
    const nextSubtasks = task.subtasks.map(s =>
      s.id === subId ? { ...s, completed: !s.completed } : s
    );
    updateTask(task.id, { subtasks: nextSubtasks });
  };

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = !task.completed && task.dueDate && task.dueDate < today;

  const openTaskPanel = useStore(s => s.openTaskPanel);
  const onClick = () => {
    openTaskPanel(task.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) return;
        // Shift+click toggles multi-selection instead of opening the task.
        if (e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          toggleTaskSelection(task.id);
          return;
        }
        onClick();
      }}
      onContextMenu={(e) => {
        if (isDragging) return;
        e.preventDefault();
        openTaskContextMenu(task.id, columnId ?? '', e.clientX, e.clientY);
      }}
      className={cn(
        "group relative p-3 rounded-[10px] border border-[var(--bone-10)] shrink-0 touch-none select-none flex flex-col gap-2 transition-colors duration-200 ease-in-out",
        isDragging
          // Dragging = same look as hover: just a bg change, no border. Dark mode
          // is the default (the app adds `.light` for light mode), so drop the
          // border by default and restore it only under `.light`.
          ? "bg-[var(--app-dark)] border-transparent [.light_&]:border-[var(--bone-10)] cursor-grabbing"
          // Selected = persistent hover fill (no ring); otherwise plain with hover fill.
          : isSelected
            ? "bg-[var(--app-dark)] cursor-pointer active:cursor-grabbing"
            : "bg-[var(--card-bg)] cursor-pointer active:cursor-grabbing hover:bg-[var(--app-dark)]",
        justDropped && "task-drop-settle"
      )}
    >
      <div className="flex flex-col gap-2 w-full h-full">
        {/* ID Line */}
        {/* Note: we don't need to show the raw entityId hash anymore as the pill is fixed */}
        {/*
        {task.entityId && (
          <div className="flex items-center justify-end gap-2">
            <span className="text-[10px] text-[var(--bone-30)] font-ui">#{task.entityId.slice(-4)}</span>
          </div>
        )}
        */}

        {/* Title & Color Dot */}
        <div className="flex items-start gap-2.5">
          {task.color && (
            <span
              className="shrink-0 w-2 h-2 rounded-full mt-[5px]"
              style={{ backgroundColor: task.completed ? 'var(--bone-20)' : task.color }}
            />
          )}
          <h3 className={cn(
            "text-sm font-medium leading-snug break-words flex-1",
            task.completed ? "text-[var(--bone-40)] line-through" : "text-[var(--bone-100)]"
          )}>
            {task.title}
          </h3>
        </div>

        {/* Description/Note Clamped */}
        {(task.description || task.note) && (
          <p className="text-[11px] text-[var(--bone-70)] leading-relaxed line-clamp-2 break-words">
            {task.description || task.note}
          </p>
        )}

        {/* Embedded Subtasks (Fix 3.7) */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-1">
            {task.subtasks.slice(0, 3).map(sub => (
              <div key={sub.id} className="flex items-start gap-2.5 text-[11px] text-[var(--bone-80)] font-medium">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSubtask(sub.id);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center flex-shrink-0 border-[var(--bone-30)] bg-[var(--bone-6)] hover:bg-[var(--app-dark)] transition-colors duration-200 ease-in-out cursor-pointer mt-[1px]"
                >
                  {sub.completed && <Check className="w-2.5 h-2.5 text-[var(--bone-100)] stroke-[3px]" />}
                </button>
                <span className={cn("flex-1 leading-snug truncate", sub.completed && "line-through text-[var(--bone-40)]")}>{sub.text}</span>
              </div>
            ))}
            {task.subtasks.length > 3 && (
              <span className="text-[9px] text-[var(--bone-40)] ml-4.5 font-medium">+{task.subtasks.length - 3} more</span>
            )}
          </div>
        )}

        {/* Meta (Due Date, Priority & Space) */}
        <div className="flex flex-wrap items-center gap-2 mt-auto pt-1 w-full justify-between">
          {task.dueDate ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <Calendar className={cn("w-3 h-3", isOverdue ? "text-red-400" : "text-[var(--bone-100)] opacity-30")} />
              <span className={cn(
                "text-[10px] font-ui whitespace-nowrap",
                isOverdue ? "text-red-400 font-medium" : "text-[var(--bone-40)]"
              )}>
                {(() => {
                  const formatTaskDate = (dateStr?: string | null, includeTime?: boolean) => {
                    if (!dateStr) return '';
                    try {
                      const date = new Date(dateStr);
                      const currentYear = new Date().getFullYear();
                      const formatStr = (date.getFullYear() === currentYear)
                        ? (includeTime ? "MMM d h:mma" : "MMM d")
                        : (includeTime ? "MMM d, yyyy h:mma" : "MMM d, yyyy");
                      return format(date, formatStr);
                    } catch (e) {
                      return dateStr;
                    }
                  };
                  const startStr = formatTaskDate(task.dueDate, task.includeTime);
                  if (task.endDate) {
                    const endStr = formatTaskDate(task.endDate, task.includeTime);
                    return `${startStr} → ${endStr}`;
                  }
                  return startStr;
                })()}
              </span>
            </div>
          ) : <div />}

          <div className="flex flex-wrap items-center gap-1.5 justify-end">
            {task.attachments && task.attachments.length > 0 && (
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] text-[10px] font-medium bg-[var(--bone-10)] text-[var(--bone-70)] shrink-0">
                <Paperclip className="w-2.5 h-2.5 opacity-70" />
                <span>{task.attachments.length}</span>
              </div>
            )}
            {task.priority && (
              <span className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-medium capitalize shrink-0",
                task.priority === 'high' ? "bg-red-500/15 text-red-400" :
                  task.priority === 'medium' ? "bg-amber-500/15 text-amber-400" :
                    "bg-blue-500/15 text-blue-400"
              )}>
                {task.priority}
              </span>
            )}
            {task.tag && (
              <span 
                className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-medium shrink-0 max-w-[80px] bg-[var(--bone-10)] text-[var(--bone-70)]"
                title={task.tag}
              >
                <span className="text-fade truncate max-w-full">
                  {task.tag}
                </span>
              </span>
            )}
            {workspaceName && (
              <span 
                className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-[var(--bone-10)] text-[var(--bone-80)] shrink-0 capitalize max-w-[90px]"
                title={workspaceName}
              >
                <span className="text-fade truncate max-w-full">
                  {workspaceName}
                </span>
              </span>
            )}
          </div>
        </div>


      </div>
    </div>
  );
}

export type CardEdge = 'top' | 'bottom';

function TaskCardInner({
  task,
  columnId,
  closestEdge,
  isActiveDrag = false,
  activeDragId = null,
  dropNonce = 0,
}: {
  task: AppTask;
  columnId: string;
  closestEdge: CardEdge | null;
  isActiveDrag?: boolean;
  // Id of the card currently being dragged anywhere on the board (null = none).
  // Needed so a card can tell whether an in-progress drag is a group drag it
  // belongs to, and lift itself into the stacked preview accordingly.
  activeDragId?: string | null;
  // Bumps each time THIS card lands; a non-zero value plays the settle and the
  // changing value remounts the UI subtree so the animation restarts every drop.
  dropNonce?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Our own fully-opaque drag preview (the native one is disabled because the
  // browser renders it washed-out). `stackBehind` is captured from the store at
  // drag-start, NOT from render state: `activeDragId` is set via a state update
  // on the same tick, so it's still null here and would yield an empty stack.
  const [preview, setPreview] = useState<{ stackBehind: AppTask[] } | null>(null);
  // The follower-preview DOM node + where inside the card it was grabbed, so
  // onDrag can pin it under the cursor via direct transform writes (smooth, no
  // per-move React render).
  const previewRef = useRef<HTMLDivElement>(null);
  const grabOffsetRef = useRef({ x: 0, y: 0 });

  const selectedTaskIds = useStore(s => s.selectedTaskIds);
  const isSelected = selectedTaskIds.includes(task.id);
  // A group drag is in progress when the actively-dragged card is part of a
  // multi-selection. While it runs, every selected card (not just the grabbed
  // one) is lifted out of its column and into the stacked preview.
  const groupActive =
    activeDragId != null &&
    selectedTaskIds.length > 1 &&
    selectedTaskIds.includes(activeDragId);
  // Hide this card from its column if it's the grabbed card OR a selected
  // member of an in-progress group drag.
  const hiddenDuringDrag = isActiveDrag || (groupActive && isSelected);
  const stackBehind = preview?.stackBehind ?? [];

  // Clean up the ghost preview portal when drag ends.
  useEffect(() => {
    if (!isActiveDrag && preview) setPreview(null);
  }, [isActiveDrag]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return draggable({
      element: el,
      getInitialData: () => ({ type: 'task', taskId: task.id, columnId }),
      onGenerateDragPreview: ({ nativeSetDragImage, source, location }) => {
        // Disable the browser's native drag image — WebKit/Chrome render it at
        // a fixed reduced opacity (the washed-out look). Instead we render our
        // own fully-opaque preview that follows the pointer (positioned in
        // onDrag below via direct DOM writes for smoothness).
        disableNativeDragPreview({ nativeSetDragImage });
        const rect = (source.element as HTMLElement).getBoundingClientRect();
        // Where inside the card the user grabbed it — so the follower preview
        // sits under the cursor exactly where the real card was.
        grabOffsetRef.current = {
          x: location.current.input.clientX - rect.left,
          y: location.current.input.clientY - rect.top,
        };
        // Capture the group stack NOW, from the live store — `activeDragId`
        // render state isn't set yet on this tick. If the grabbed card is part
        // of a 2+ selection, the other selected cards fan out behind it.
        const { selectedTaskIds: sel, tasks: all } = useStore.getState();
        const stack =
          sel.length > 1 && sel.includes(task.id)
            ? sel
              .filter(id => id !== task.id)
              .map(id => all.find(t => t.id === id))
              .filter((t): t is AppTask => !!t)
            : [];
        setPreview({ stackBehind: stack });
      },
      onDrag: ({ location }) => {
        const node = previewRef.current;
        if (!node) return;
        const { x, y } = grabOffsetRef.current;
        // Follow the pointer; subtract the grab offset (and the 40px wrapper
        // padding) so the front card stays pinned under the cursor.
        node.style.transform = `translate(${location.current.input.clientX - x - 40}px, ${location.current.input.clientY - y - 40}px)`;
      },
      onDrop: () => setPreview(null),
    });
  }, [task.id, columnId]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      // Never let the dragged card target itself — that confuses edge/column
      // resolution and freezes the gap on its own slot.
      canDrop: ({ source }) => source.data.type === 'task' && source.data.taskId !== task.id,
      getData: ({ input, element }) =>
        attachClosestEdge(
          { type: 'card', taskId: task.id, columnId },
          { input, element, allowedEdges: ['top', 'bottom'] }
        ),
    });
  }, [task.id, columnId]);

  return (
    <>
      <div
        ref={ref}
        data-task-id={task.id}
        className={cn('relative', hiddenDuringDrag && 'hidden')}
      >
        {closestEdge && (
          <div
            className={cn(
              'absolute left-0 right-0 h-[2px] bg-[var(--bone-20)] rounded-full z-10',
              closestEdge === 'top' ? '-top-1.5' : '-bottom-1.5'
            )}
          />
        )}
        {/* Keyed by the drop nonce so each landing remounts this subtree and the
            CSS drop-settle animation restarts reliably — toggling a class on a
            reused node does not replay a CSS animation. */}
        <TaskCardUI key={`drop-${dropNonce}`} task={task} columnId={columnId} justDropped={dropNonce > 0} />
      </div>
      {preview &&
        createPortal(
          <div
            ref={previewRef}
            className="fixed top-0 left-0 z-[10000] pointer-events-none"
            style={{ padding: '40px', transform: 'translate(-9999px, -9999px)' }}
          >
            {/* Fully-opaque follower preview (native drag image disabled).
                onDrag writes `transform` to track the pointer. The 40px padding
                gives the box-shadow + tilted behind-layers room. */}
            <div className="relative w-[268px]">
              {/* Tidy stack hint: behind the grabbed card we draw plain blank
                  panels (NOT the real card content) — just enough to read as a
                  stack. 2 cards picked up → 1 panel behind; 3+ → 2 panels,
                  fanned symmetrically. The count badge carries the real total. */}
              {(() => {
                const behindCount = Math.min(stackBehind.length, 2);
                // Tilt angles per layer count: one card leans gently right; two
                // fan to opposite sides for a balanced look. All layers share the
                // same solid colour as the front card (no depth fade).
                const tilts = behindCount === 1 ? [4] : [-5, 5];
                return tilts.slice(0, behindCount).map((deg, i) => (
                  <div
                    key={i}
                    className="absolute inset-0 rounded-[10px] border border-[var(--bone-10)] bg-[var(--app-dark)]"
                    style={{
                      boxShadow: '0 6px 16px var(--popup-shadow-color)',
                      transform: `rotate(${deg}deg) translateY(4px)`,
                      transformOrigin: 'center bottom',
                      zIndex: -(i + 1),
                    }}
                  />
                ));
              })()}
              {/* Front card = the one actually grabbed. No border here — the
                  inner TaskCardUI already draws its own 1px border; adding one on
                  this wrapper too made the front card's edge look doubled/thick. */}
              <div
                className="relative rounded-[10px] bg-[var(--app-panel)]"
                style={{ boxShadow: '0 6px 16px var(--popup-shadow-color)' }}
              >
                <TaskCardUI task={task} isDragging />
                {stackBehind.length > 0 && (
                  <span
                    className="absolute -top-2.5 -right-2.5 z-10 w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-ui font-semibold bg-[var(--app-panel)] text-[var(--bone-90)] border border-[var(--bone-10)] shadow-[0_2px_8px_var(--popup-shadow-color)]"
                  >
                    {stackBehind.length + 1}
                  </span>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

// Memoized: when the moving gap changes slot, TrackerPage → KanbanColumn
// re-render, but every non-dragged card receives identical props (the `task`
// objects come from the memoized storeColumns, and activeDragId/isActiveDrag
// only flip at drag start/end — not per move). Shallow prop compare therefore
// bails out on all of them, so a gap move no longer re-renders the whole board.
export const TaskCard = React.memo(TaskCardInner);
