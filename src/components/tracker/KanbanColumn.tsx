"use client";

import { AppTask } from '@/data/store';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { TaskCard } from './TaskCard';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  id: string;
  title: string;
  tasks: AppTask[];
  isDraggingOver?: boolean;
}

export function KanbanColumn({ id, title, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);

  return (
    <div
      className={cn(
        "flex flex-col w-[300px] shrink-0 h-full rounded-[var(--radius-big)] p-4 border transition-colors duration-150",
        isOver
          ? "bg-[var(--color-panel)] border-[var(--bone-15)]"
          : "bg-[var(--bone-5)]/30 border-transparent hover:bg-[var(--color-panel)] hover:border-[var(--bone-15)]"
      )}
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="text-xs font-ui-label font-bold uppercase tracking-widest text-[var(--bone-30)]">
          {title}
        </h3>
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-[var(--bone-10)] text-[var(--bone-70)]">
          {tasks.length}
        </span>
      </div>

      <div 
        ref={setNodeRef}
        className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1.5 min-h-0 scrollbar-thin scrollbar-thumb-[var(--bone-10)] scrollbar-track-transparent"
      >
        <SortableContext 
          id={id}
          items={taskIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3 min-h-0">
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </SortableContext>
        
        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-[var(--bone-10)] rounded-[var(--radius-medium)] min-h-[100px]">
            <span className="text-xs font-ui text-[var(--bone-15)]">No tasks here</span>
          </div>
        )}
      </div>
    </div>
  );
}
