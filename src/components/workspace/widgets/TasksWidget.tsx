"use client";

import { Entity, useStore } from '@/data/store';
import { useMemo, useState, useRef } from 'react';
import { Plus, CheckCircle2, Circle } from 'lucide-react';
import clsx from 'clsx';

type ViewMode = 'list' | 'by-status';

const formatDate = (dateStr: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dateStr));

export function TasksWidget({ entity: propEntity, contextId, data, onUpdateData }: {
  entity?: Entity;
  contextId?: string;
  data?: { view?: ViewMode };
  onUpdateData?: (d: any) => void;
  isEditing?: boolean;
}) {
  const tasks = useStore(s => s.tasks);
  const toggleTask = useStore(s => s.toggleTask);
  const addTask = useStore(s => s.addTask);
  const entities = useStore(s => s.entities);
  const view: ViewMode = data?.view ?? 'list';

  const entity = useMemo(() => {
    if (propEntity) return propEntity;
    if (!contextId || contextId === 'dashboard') return null;
    return entities.find(e => e.id === contextId) || null;
  }, [propEntity, contextId, entities]);

  const workspaceTasks = useMemo(() => {
    if (!entity && contextId === 'dashboard') return tasks;
    if (!entity) return [];
    const childIds = new Set(entities.filter(e => e.parentId === entity.id).map(e => e.id));
    childIds.add(entity.id);
    return tasks.filter(t => t.workspaceId === entity.id || (t.entityId && childIds.has(t.entityId)));
  }, [tasks, entities, entity, contextId]);

  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) { setIsAdding(false); return; }
    addTask({ title, workspaceId: entity?.id ?? contextId ?? null });
    setNewTitle('');
    inputRef.current?.focus();
  };

  const incomplete = workspaceTasks.filter(t => !t.completed);
  const completed = workspaceTasks.filter(t => t.completed);

  const today = new Date().toISOString().split('T')[0];
  const grouped = view === 'by-status' ? {
    Today: incomplete.filter(t => t.dueDate === today),
    Upcoming: incomplete.filter(t => t.dueDate && t.dueDate > today),
    'No date': incomplete.filter(t => !t.dueDate),
    Overdue: incomplete.filter(t => t.dueDate && t.dueDate < today),
  } : null;

  return (
    <section className="bg-sidebar border border-[var(--bone-3)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground">Tasks</h2>
        <div className="flex items-center gap-2">
          {onUpdateData && (
            <div className="flex items-center gap-0.5 bg-[var(--bone-6)] rounded-[4px] p-0.5">
              {(['list', 'by-status'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => onUpdateData({ ...data, view: v })}
                  className={clsx("px-2 py-0.5 text-[10px] font-semibold rounded-[3px] transition-colors",
                    view === v ? "bg-[var(--bone-15)] text-[var(--bone-100)]" : "text-[var(--bone-30)] hover:text-[var(--bone-100)]"
                  )}>{v === 'list' ? 'List' : 'Status'}</button>
              ))}
            </div>
          )}
          <button onClick={() => { setIsAdding(true); setTimeout(() => inputRef.current?.focus(), 50); }}
            className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-30)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

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
            {incomplete.map(t => (
              <div key={t.id} className="group flex items-center gap-3 px-3 py-2 rounded-[var(--radius-medium)] hover:bg-[var(--bone-6)] transition-all">
                <button onClick={() => toggleTask(t.id)} className="shrink-0 text-[var(--bone-20)] hover:text-accent transition-colors">
                  <Circle className="w-4 h-4" />
                </button>
                <span className="flex-1 text-sm text-foreground font-medium">{t.title}</span>
                {t.dueDate && <span className="text-[10px] font-bold text-[var(--bone-30)] uppercase tracking-wider shrink-0">{formatDate(t.dueDate)}</span>}
              </div>
            ))}
            {completed.slice(0, 3).map(t => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-medium)] opacity-40">
                <button onClick={() => toggleTask(t.id)} className="shrink-0 text-accent"><CheckCircle2 className="w-4 h-4" /></button>
                <span className="flex-1 text-sm text-muted-foreground line-through">{t.title}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped!).filter(([, items]) => items.length > 0).map(([group, items]) => (
              <div key={group}>
                <div className="text-[10px] font-semibold text-[var(--bone-30)] uppercase tracking-widest mb-1 px-1">{group}</div>
                {items.map(t => (
                  <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-medium)] hover:bg-[var(--bone-6)]">
                    <button onClick={() => toggleTask(t.id)} className="shrink-0 text-[var(--bone-20)] hover:text-accent"><Circle className="w-3.5 h-3.5" /></button>
                    <span className="text-sm text-foreground">{t.title}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {workspaceTasks.length === 0 && !isAdding && (
          <div className="h-full flex items-center justify-center"><p className="text-sm text-muted-foreground">No tasks.</p></div>
        )}
      </div>
    </section>
  );
}
