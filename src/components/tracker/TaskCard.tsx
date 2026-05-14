"use client";

import { AppTask, useStore } from '@/data/store';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import React from 'react';

interface TaskCardUIProps {
  task: AppTask;
  isDragging?: boolean;
  style?: React.CSSProperties;
  attributes?: any;
  listeners?: any;
  setNodeRef?: (node: HTMLElement | null) => void;
}

export function TaskCardUI({ 
  task, 
  isDragging, 
  style, 
  attributes, 
  listeners, 
  setNodeRef 
}: TaskCardUIProps) {
  const { entities } = useStore();
  const workspaceName = entities.find(e => e.id === task.workspaceId)?.title || 'Unsorted';

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = !task.completed && task.dueDate && task.dueDate < today;

  const openModal = useStore(s => s.openModal);
  const onClick = () => {
    openModal({ kind: 'newTask', taskId: task.id });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Prevent default click behavior if drag was initiated (though dnd-kit usually handles this, be explicit)
        if (!isDragging) {
          onClick();
        }
      }}
      className={cn(
        "group relative bg-[var(--bone-2)] border border-[var(--bone-6)] p-3 rounded-[12px] cursor-pointer active:cursor-grabbing shrink-0",
        "touch-none select-none",
        !isDragging && "hover:bg-[var(--bone-6)] transition-colors duration-150",
        "flex flex-col gap-2"
      )}
    >
      {/* Workspace Tag & Category Line */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 opacity-60">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
          <span className="text-[10px] font-ui font-medium uppercase tracking-wider text-[var(--bone-70)]">
            {workspaceName}
          </span>
        </div>
        {task.entityId && (
          <span className="text-[10px] text-[var(--bone-30)] font-ui">#{task.entityId.slice(-4)}</span>
        )}
      </div>

      {/* Title */}
      <h3 className={cn(
        "text-sm font-medium leading-snug break-words",
        task.completed ? "text-[var(--bone-40)] line-through" : "text-[var(--bone-100)]"
      )}>
        {task.title}
      </h3>

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
            <div key={sub.id} className="flex items-center gap-2 text-[10px] text-[var(--bone-70)]">
              <div className={cn(
                "w-2.5 h-2.5 rounded-full border flex items-center justify-center flex-shrink-0",
                sub.completed ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--bone-30)]"
              )}>
                {sub.completed && <div className="w-1 h-1 rounded-full bg-white" />}
              </div>
              <span className={cn(sub.completed && "line-through text-[var(--bone-40)]")}>{sub.text}</span>
            </div>
          ))}
          {task.subtasks.length > 3 && (
            <span className="text-[9px] text-[var(--bone-40)] ml-4.5 font-medium">+{task.subtasks.length - 3} more</span>
          )}
        </div>
      )}

      {/* Meta (Due Date & Priority) */}
      <div className="flex items-center justify-between mt-auto pt-1">
        {task.dueDate ? (
          <div className="flex items-center gap-1.5">
            <Calendar className={cn("w-3 h-3", isOverdue ? "text-red-400" : "text-[var(--bone-30)]")} />
            <span className={cn(
              "text-[10px] font-ui",
              isOverdue ? "text-red-400 font-medium" : "text-[var(--bone-40)]"
            )}>
              {task.dueDate}
            </span>
          </div>
        ) : <div />}

        {task.priority && (
          <div className={cn(
            "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
            task.priority === 'high' ? "bg-red-500/10 text-red-400 border border-red-500/20" :
            task.priority === 'medium' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
            "bg-blue-500/10 text-blue-400 border border-blue-500/20"
          )}>
            {task.priority}
          </div>
        )}
      </div>

      {/* Decorative side strip */}
      <div 
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full" 
        style={{ backgroundColor: task.completed ? 'var(--bone-20)' : (task.color || 'var(--accent)') }}
      />
    </div>
  );
}

export function TaskCard({ task }: { task: AppTask }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: task.id,
    data: React.useMemo(() => ({
      type: 'Task',
      task
    }), [task])
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="rounded-[12px] border-2 border-dashed border-[var(--accent)]/40 bg-[var(--accent)]/5 h-[88px]"
      />
    );
  }

  return (
    <TaskCardUI
      task={task}
      isDragging={isDragging}
      style={style}
      attributes={attributes}
      listeners={listeners}
      setNodeRef={setNodeRef}
    />
  );
}
