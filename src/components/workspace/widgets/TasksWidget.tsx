"use client";

import { Entity, useStore } from '@/data/store';
import { useMemo } from 'react';
import clsx from 'clsx';

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
};

export function TasksWidget({ entity: propEntity, contextId }: { entity?: Entity; contextId?: string }) {
  const tasks = useStore(state => state.tasks);
  const toggleTask = useStore(state => state.toggleTask);
  const entities = useStore(state => state.entities);

  // If entity is not passed, try to find it from contextId
  const entity = useMemo(() => {
    if (propEntity) return propEntity;
    if (!contextId || contextId === 'dashboard') return null;
    return entities.find(e => e.id === contextId) || null;
  }, [propEntity, contextId, entities]);

  const workspaceTasks = useMemo(() => {
    // Global dashboard: show all tasks
    if (!entity && contextId === 'dashboard') {
      return tasks;
    }

    // No entity found and not dashboard: show nothing or handle error
    if (!entity) return [];

    const childIds = new Set(entities.filter(e => e.parentId === entity.id).map(e => e.id));
    childIds.add(entity.id);

    return tasks.filter(t =>
      t.workspaceId === entity.id ||
      (t.entityId && childIds.has(t.entityId))
    );
  }, [tasks, entities, entity, contextId]);

  const incomplete = workspaceTasks.filter(t => !t.completed);
  const completed = workspaceTasks.filter(t => t.completed);

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-widget-header font-semibold  text-muted-foreground group-hover/widget:text-foreground ">
          Tasks
        </h2>
        {workspaceTasks.length > 0 && (
          <span className="text-xs text-[var(--bone-30)] font-medium">
            {incomplete.length} remaining
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {workspaceTasks.length > 0 ? (
          <div className="space-y-1">
            {incomplete.map(t => (
              <div key={t.id} className="group flex items-center gap-3 px-3 py-2 rounded-[var(--radius-medium)] text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] transition-all duration-200">
                <button
                  onClick={() => toggleTask(t.id)}
                  className="w-4.5 h-4.5 rounded-[5px] border-2 border-[var(--bone-20)] group-hover:border-[var(--bone-40)] hover:!border-accent flex items-center justify-center shrink-0 transition-all bg-[var(--bone-5)]"
                />
                <span className="flex-1 text-sm text-foreground text-fade font-medium">{t.title}</span>
                {t.dueDate && (
                  <span className="text-[10px] font-bold text-[var(--bone-30)] uppercase tracking-wider shrink-0">{formatDate(t.dueDate)}</span>
                )}
                {t.color && (
                  <span className="w-2 h-2 rounded-full shrink-0 opacity-60 shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: t.color, boxShadow: `0 0 10px ${t.color}44` }} />
                )}
              </div>
            ))}
            {completed.length > 0 && (
              <>
                <div className="h-px bg-[var(--bone-5)] my-2" />
                {completed.slice(0, 3).map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-2 py-1.5 rounded-[var(--radius-medium)] opacity-40 hover:opacity-70 ">
                    <button
                      onClick={() => toggleTask(t.id)}
                      className="w-4 h-4 rounded-[3px] bg-[var(--bone-10)] border border-[var(--bone-10)] flex items-center justify-center shrink-0"
                    >
                      <svg className="w-3 h-3 text-[var(--bone-60)]" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <span className="flex-1 text-sm text-muted-foreground text-fade line-through">{t.title}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No tasks.</p>
          </div>
        )}
      </div>
    </section>
  );
}

