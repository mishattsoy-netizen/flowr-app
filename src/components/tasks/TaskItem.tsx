"use client";

import { AppTask, useStore } from '@/data/store';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TaskItem({ task }: { task: AppTask }) {
  const toggleTask = useStore(s => s.toggleTask);

  return (
    <div className="group flex items-center px-4 py-3 rounded-[var(--radius-medium)] border border-border bg-panel text-sm hover:border-muted-foreground " onClick={() => toggleTask(task.id)}>
      <button 
        className={cn(
          "w-5 h-5 rounded-[var(--radius-small)] border mr-3 flex items-center justify-center ",
          task.completed ? "bg-foreground border-foreground text-background" : "border-muted-foreground hover:border-foreground"
        )}
      >
        {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
      </button>
      <span className={cn("flex-1", task.completed && "line-through text-muted-foreground")}>
        {task.title}
      </span>
      {task.dueDate && (
        <span className="text-xs text-muted-foreground shrink-0 ml-4">{task.dueDate}</span>
      )}
    </div>
  );
}

