"use client";

import { Entity, useStore } from '@/data/store';
import { useMemo, useState, useRef } from 'react';
import { Plus, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { stripHtml } from '@/lib/utils';
import type { WidgetPropsWithEntity } from './types';

type ViewMode = 'list' | 'by-status';

const formatDate = (dateStr: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dateStr));

export function TasksWidget({ entity: propEntity, contextId, data, onUpdateData }: WidgetPropsWithEntity & {
  data?: { view?: ViewMode };
}) {
  const tasks = useStore(s => s.tasks);
  const toggleTask = useStore(s => s.toggleTask);
  const addTask = useStore(s => s.addTask);
  const entities = useStore(s => s.entities);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const view: ViewMode = data?.view ?? 'list';

  const entity = useMemo(() => {
    if (propEntity) return propEntity;
    if (!contextId || contextId === 'dashboard') return null;
    return entities.find(e => e.id === contextId) || null;
  }, [propEntity, contextId, entities]);

  const workspaceTasks = useMemo(() => {
    if (!entity && contextId === 'dashboard') {
      return tasks;
    }
    if (!entity) return [];
    const childIds = new Set(entities.filter(e => e.parentId === entity.id).map(e => e.id));
    childIds.add(entity.id);
    return tasks.filter(t => t.workspaceId === entity.id || (t.entityId && childIds.has(t.entityId)));
  }, [tasks, entities, entity, contextId]);

  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<'todo' | 'in-progress' | 'completed'>('todo');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) { setIsAdding(false); return; }
    addTask({
      title,
      workspaceId: entity?.id ?? activeWorkspaceId ?? null,
      status: activeTab === 'in-progress' ? 'in-progress' : 'todo'
    });
    setNewTitle('');
    inputRef.current?.focus();
  };

  const todoTasks = workspaceTasks.filter(t => !t.completed && t.status !== 'in-progress');
  const inProgressTasks = workspaceTasks.filter(t => !t.completed && t.status === 'in-progress');
  const completedTasks = workspaceTasks.filter(t => t.completed);

  const today = new Date().toISOString().split('T')[0];
  const grouped = view === 'by-status' ? {
    Today: workspaceTasks.filter(t => !t.completed && t.dueDate === today && t.status !== 'in-progress'),
    'To do': workspaceTasks.filter(t => !t.completed && (!t.dueDate || t.dueDate > today) && t.status !== 'in-progress'),
    'In progress': workspaceTasks.filter(t => !t.completed && t.status === 'in-progress'),
    Overdue: workspaceTasks.filter(t => !t.completed && t.dueDate && t.dueDate < today && t.status !== 'in-progress'),
  } : null;

  const currentTabTasks = activeTab === 'todo'
    ? todoTasks
    : activeTab === 'in-progress'
      ? inProgressTasks
      : completedTasks;

  return (
    <section className="bg-panel group/widget px-5 pb-5 pt-4 widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground">Tasks</h2>
        <div className="flex items-center gap-2">
          {onUpdateData && (
            <div className="flex items-center gap-0.5 bg-[var(--app-dark)] rounded-[4px] p-0.5">
              {(['list', 'by-status'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => onUpdateData({ ...data, view: v })}
                  className={cn("px-2 py-0.5 text-[10px] font-semibold rounded-[3px] transition-colors duration-200 ease-in-out",
                    view === v ? "bg-dark text-[var(--bone-100)]" : "text-[var(--bone-30)] hover:text-[var(--bone-100)]"
                  )}>{v === 'list' ? 'List' : 'Status'}</button>
              ))}
            </div>
          )}
          <button onClick={() => { setIsAdding(true); setTimeout(() => inputRef.current?.focus(), 50); }}
            className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-100)] opacity-30 hover:opacity-100 hover:bg-[var(--app-dark)] transition-all duration-200 ease-in-out">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === 'list' && (
        <div className="flex border-b border-[var(--bone-6)] mb-3 text-xs shrink-0 select-none">
          {(['todo', 'in-progress', 'completed'] as const).map(tab => {
            const isActive = activeTab === tab;
            const count = tab === 'todo' ? todoTasks.length : tab === 'in-progress' ? inProgressTasks.length : completedTasks.length;
            const label = tab === 'todo' ? 'To Do' : tab === 'in-progress' ? 'In Progress' : 'Completed';

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative pb-2 px-3 font-semibold transition-colors duration-200 ease-in-out flex items-center gap-1.5 border-none bg-transparent cursor-pointer text-xs focus:outline-none",
                  isActive ? "text-[var(--bone-100)] font-bold" : "text-[var(--bone-30)] hover:text-[var(--bone-60)]"
                )}
              >
                <span>{label}</span>
                <span className={cn(
                  "px-1.5 py-0.5 text-[9px] rounded-full font-bold transition-all duration-200 ease-in-out",
                  isActive ? "bg-[var(--accent)] text-white" : "bg-[var(--bone-6)] text-[var(--bone-40)]"
                )}>
                  {count}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)] rounded-t-[1px]" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {isAdding && (
        <div className="mb-2 flex items-center gap-2">
          <input ref={inputRef} value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setIsAdding(false); setNewTitle(''); } }}
            onBlur={() => { if (!newTitle.trim()) setIsAdding(false); }}
            placeholder="New task..." autoFocus
            className="flex-1 bg-transparent border-b border-[var(--bone-20)] py-1 text-sm text-foreground placeholder-muted-foreground outline-none" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {view === 'list' ? (
          <div className="space-y-1">
            {currentTabTasks.map(t => (
              <div key={t.id} className="group flex items-center gap-3 px-3 py-2 rounded-[var(--radius-medium)] hover:bg-[var(--app-dark)] transition-all duration-200 ease-in-out">
                <button onClick={() => toggleTask(t.id)} className={cn("shrink-0 transition-colors duration-200 ease-in-out", t.completed ? "text-accent" : "text-[var(--bone-20)] hover:text-accent")}>
                  {t.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                </button>
                <span className={cn("flex-1 text-sm font-medium", t.completed ? "text-muted-foreground line-through opacity-60" : "text-foreground")}>
                  {stripHtml(t.title || '')}
                </span>
                {t.dueDate && <span className="text-[10px] font-bold text-bone-70 uppercase tracking-wider shrink-0">{formatDate(t.dueDate)}</span>}
              </div>
            ))}
            {currentTabTasks.length === 0 && !isAdding && (
              <div className="h-full flex flex-col items-center justify-center py-8 opacity-60">
                <p className="text-sm text-muted-foreground">
                  {activeTab === 'todo' ? 'All caught up!' : activeTab === 'in-progress' ? 'No tasks in progress.' : 'No completed tasks yet.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped!).filter(([, items]) => items.length > 0).map(([group, items]) => (
              <div key={group}>
                <div className="text-[10px] font-semibold text-bone-70 uppercase tracking-widest mb-1 px-1">{group}</div>
                {items.map(t => (
                  <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-medium)] hover:bg-[var(--app-dark)] transition-all duration-200 ease-in-out">
                    <button onClick={() => toggleTask(t.id)} className="shrink-0 text-[var(--bone-20)] hover:text-accent transition-colors duration-200 ease-in-out"><Circle className="w-3.5 h-3.5" /></button>
                    <span className="text-sm text-foreground">{stripHtml(t.title || '')}</span>
                  </div>
                ))}
              </div>
            ))}
            {Object.values(grouped!).every(items => items.length === 0) && !isAdding && (
              <div className="h-full flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">No tasks.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
