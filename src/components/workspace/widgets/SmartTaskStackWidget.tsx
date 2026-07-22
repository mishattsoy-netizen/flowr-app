"use client";

import { useStore } from '@/data/store';
import { useMemo, useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { isTaskOverdue } from '@/lib/task-overdue';
import { Calendar, AlertCircle, Clock, CheckCircle2, Plus, X, Check, Play, ArrowUpRight, Paperclip } from 'lucide-react';
import { stripHtml } from '@/lib/utils';
import type { WidgetProps } from './types';
import type { AppTask } from '@/data/store.types';
import { getTaskImplicitPosition } from '@/components/tracker/dragLogic';
import { Skeleton } from '@/components/ui/Skeleton';

const ALL_TABS = [
  { id: 'todo', label: 'To do', icon: Calendar, color: 'text-blue-400', dotColor: '#3B82F6' },
  { id: 'inProgress', label: 'In progress', icon: Play, color: 'text-amber-400', dotColor: '#F59E0B' },
  { id: 'today', label: 'Today', icon: Clock, color: 'text-accent', dotColor: '#8B5CF6' },
  { id: 'overdue', label: 'Overdue', icon: AlertCircle, color: 'text-red-400', dotColor: '#EF4444' },
  { id: 'completed', label: 'Done', icon: CheckCircle2, color: 'text-emerald-400', dotColor: '#10B981' },
] as const;

type TabId = typeof ALL_TABS[number]['id'];

interface SmartTaskStackProps extends WidgetProps {
  data?: {
    stackType?: 'today-upcoming' | 'progress-overdue';
    activeTab?: string;
    hiddenTabs?: TabId[];
  };
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
};

export function SmartTaskStackWidget({ data, onUpdateData, isEditing, contextId, isLoading }: SmartTaskStackProps) {
  const tasks = useStore(state => state.tasks);
  const toggleTask = useStore(state => state.toggleTask);
  const addTask = useStore(state => state.addTask);
  const openTaskPanel = useStore(state => state.openTaskPanel);
  const entities = useStore(state => state.entities);
  const activeSpaceId = useStore(state => state.activeSpaceId);
  const addTab = useStore(state => state.addTab);

  const filteredTasks = useMemo(() => {
    if (!contextId || contextId === 'dashboard') {
      return tasks.filter(t => t.spaceId === activeSpaceId);
    }
    const entity = entities.find(e => e.id === contextId);
    if (!entity) return [];
    const childIds = new Set(entities.filter(e => e.parentId === entity.id).map(e => e.id));
    childIds.add(entity.id);
    return tasks.filter(t => t.spaceId === activeSpaceId && (t.entityId && childIds.has(t.entityId)));
  }, [tasks, entities, activeSpaceId, contextId]);

  const hiddenTabs: TabId[] = (data?.hiddenTabs ?? []) as TabId[];
  const visibleTabs = ALL_TABS.filter(t => !hiddenTabs.includes(t.id));
  const hiddenTabDefs = ALL_TABS.filter(t => hiddenTabs.includes(t.id));

  const [internalTab, setInternalTab] = useState<TabId | null>((data?.activeTab as TabId) || null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data?.activeTab) setInternalTab(data.activeTab as TabId);
  }, [data?.activeTab]);

  const isSubmitting = useRef(false);

  useEffect(() => {
    if (adding) {
      isSubmitting.current = false;
      inputRef.current?.focus();
    }
  }, [adding]);

  // Helper for local YYYY-MM-DD strings to avoid UTC/timezone shifts
  const getLocalDateStr = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const tasksByTab = useMemo(() => {
    const todayStr = getLocalDateStr();

    const getAutomaticTier = (t: AppTask): number => {
      if (t.dueDate) return 1;
      if (t.priority) return 2;
      if (t.color && t.color !== '') return 3;
      return 4;
    };

    const sortAutomatic = (a: AppTask, b: AppTask) => {
      const tierA = getAutomaticTier(a);
      const tierB = getAutomaticTier(b);
      if (tierA !== tierB) {
        return tierA - tierB;
      }

      if (tierA === 1) {
        const dateA = a.dueDate!;
        const dateB = b.dueDate!;
        const dateCompare = dateA.localeCompare(dateB);
        if (dateCompare !== 0) return dateCompare;
      }

      const priorityVal = (p: string | null | undefined) => {
        if (p === 'high') return 3;
        if (p === 'medium') return 2;
        if (p === 'low') return 1;
        return 0;
      };
      const prioA = priorityVal(a.priority);
      const prioB = priorityVal(b.priority);
      if (prioA !== prioB) {
        return prioB - prioA;
      }

      const colorA = a.color || '';
      const colorB = b.color || '';
      const colorCompare = colorA.localeCompare(colorB);
      if (colorCompare !== 0) return colorCompare;

      const posA = getTaskImplicitPosition(a);
      const posB = getTaskImplicitPosition(b);
      if (posA !== posB) return posA - posB;
      return a.id.localeCompare(b.id);
    };

    return {
      today: filteredTasks
        .filter(t => !t.completed && t.dueDate === todayStr && t.status !== 'in-progress')
        .sort(sortAutomatic),
      todo: filteredTasks
        .filter(t => !t.completed && t.status !== 'in-progress' && (!t.dueDate || t.dueDate > todayStr))
        .sort(sortAutomatic),
      inProgress: filteredTasks
        .filter(t => !t.completed && t.status === 'in-progress')
        .sort(sortAutomatic),
      overdue: filteredTasks
        .filter(t => !t.completed && t.dueDate && t.dueDate < todayStr && t.status !== 'in-progress')
        .sort(sortAutomatic),
      completed: filteredTasks
        .filter(t => t.completed)
        .sort(sortAutomatic),
    };
  }, [filteredTasks]);

  const activeId: TabId = (internalTab && !hiddenTabs.includes(internalTab))
    ? internalTab
    : (visibleTabs[0]?.id ?? 'today');

  const activeTabDef = ALL_TABS.find(t => t.id === activeId)!;

  const listContainerRef = useRef<HTMLDivElement>(null);
  const [maxVisibleItems, setMaxVisibleItems] = useState(10);

  const fullTasksForTab = tasksByTab[activeId] ?? [];
  const totalTasks = fullTasksForTab.length;
  let renderCount = maxVisibleItems;
  if (totalTasks > maxVisibleItems) {
    renderCount = Math.max(0, maxVisibleItems - 1);
  }
  const displayTasks = fullTasksForTab.slice(0, renderCount);

  function handleTabSwitch(tabId: TabId) {
    setInternalTab(tabId);
    onUpdateData?.({ ...data, activeTab: tabId });
  }

  function hideTab(tabId: TabId) {
    const next = [...hiddenTabs, tabId];
    onUpdateData?.({ ...data, hiddenTabs: next });
  }

  function showTab(tabId: TabId) {
    const next = hiddenTabs.filter(t => t !== tabId);
    onUpdateData?.({ ...data, hiddenTabs: next });
    setShowAddMenu(false);
  }

  function handleAddSubmit() {
    if (isSubmitting.current) return;

    const t = newTitle.trim();
    if (t) {
      isSubmitting.current = true;
      const taskData: Partial<AppTask> = {
        title: t,
        spaceId: activeSpaceId
      };

      // Smart defaults based on active tab to ensure visibility
      if (activeId === 'today') {
        taskData.dueDate = getLocalDateStr();
      } else if (activeId === 'todo') {
        taskData.dueDate = undefined;
      } else if (activeId === 'inProgress') {
        taskData.status = 'in-progress';
      } else if (activeId === 'overdue') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        taskData.dueDate = getLocalDateStr(yesterday);
      } else if (activeId === 'completed') {
        taskData.completed = true;
      }

      addTask(taskData as any);
      setNewTitle('');
    }
    setAdding(false);
  }

  function handleToggleAdding() {
    if (adding) {
      handleAddSubmit();
    } else {
      setAdding(true);
    }
  }

  const tabContainerRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    if (!tabContainerRef.current) return;
    const measure = () => {
      const activeEl = tabContainerRef.current?.querySelector('[data-active="true"]') as HTMLElement;
      if (activeEl) {
        const next = { left: activeEl.offsetLeft, width: activeEl.offsetWidth };
        setPillStyle(prev =>
          prev?.left === next.left && prev?.width === next.width ? prev : next
        );
      }
    };

    measure();
    window.addEventListener('resize', measure);

    const observer = new ResizeObserver(measure);
    observer.observe(tabContainerRef.current);

    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, [activeId, visibleTabs, showAddMenu]);

  useEffect(() => {
    if (!listContainerRef.current) return;
    const measureList = () => {
      const height = listContainerRef.current?.clientHeight || 0;
      // Each item is ~36px (32px + 4px gap)
      const count = Math.max(1, Math.floor(height / 36));
      setMaxVisibleItems(count);
    };
    measureList();
    const observer = new ResizeObserver(measureList);
    observer.observe(listContainerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="bg-panel group/widget px-5 pb-5 pt-4 widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 h-8 shrink-0 gap-2">

        {/* Tab switcher */}
        {visibleTabs.length > 0 ? (
          <div ref={tabContainerRef} className="relative flex items-center p-[2px] rounded-[8px] no-drag overflow-hidden w-fit" style={{ background: 'var(--slider-track)' }}>
            {/* Sliding pill — hidden until first measurement to avoid shifting from initial guess */}
            {pillStyle && (
              <div
                className="absolute top-[2px] bottom-[2px] rounded-[6px] bg-[var(--slider-pill)] transition-[left,width] duration-300 ease-out"
                style={{
                  left: `${pillStyle.left}px`,
                  width: `${pillStyle.width}px`,
                  boxShadow: 'var(--slider-pill-shadow)'
                }}
              />
            )}
            {visibleTabs.map(tab => (
              <div
                key={tab.id}
                data-active={activeId === tab.id ? "true" : undefined}
                className={cn(
                  "relative z-10 flex items-center justify-center px-3.5 group/tab shrink-0",
                  !pillStyle && activeId === tab.id && "bg-[var(--slider-pill)] rounded-[6px] shadow-[var(--slider-pill-shadow)]"
                )}
              >
                <button
                  onClick={() => handleTabSwitch(tab.id)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1 transition-colors duration-200 ease-in-out",
                    activeId === tab.id ? "text-[var(--bone-100)]" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tab.dotColor }} />
                  <span className="text-[11px] font-semibold">{tab.label}</span>
                </button>
                {/* X to hide this tab — visible on hover in edit mode */}
                {isEditing && visibleTabs.length > 1 && (
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); hideTab(tab.id); }}
                    className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-background border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/40 opacity-0 group-hover/tab:opacity-100 transition-opacity duration-200 ease-in-out z-20"
                  >
                    <X strokeWidth={2} className="w-2 h-2" />
                  </button>
                )}
              </div>
            ))}
            {/* Plus button to add tabs - visible in edit mode */}
            {isEditing && hiddenTabDefs.length > 0 && (
              <div className="relative z-10 w-8 flex items-center justify-center border-l border-[var(--bone-10)] ml-0.5">
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); setShowAddMenu(v => !v); }}
                  className="w-full flex items-center justify-center py-1 transition-colors duration-200 ease-in-out text-muted-foreground hover:text-foreground"
                  title="Add tab"
                >
                  <Plus strokeWidth={2} className="w-3.5 h-3.5" />
                </button>
                {showAddMenu && (
                  <div className="absolute left-0 top-8 z-50 bg-background border border-border rounded-xl shadow-lg p-1.5 min-w-[140px] space-y-0.5">
                    {hiddenTabDefs.map(tab => (
                      <button
                        key={tab.id}
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); showTab(tab.id); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--app-dark)] transition-colors duration-200 ease-in-out"
                      >
                        <tab.icon strokeWidth={2} className={cn("w-3 h-3", tab.color)} />
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">No tabs visible</span>
        )}

        {/* Right side: add-task button */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={cn(
            "w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] bg-[var(--bone-6)] select-none text-[11px] font-semibold text-[var(--bone-70)] font-mono shrink-0",
            (tasksByTab[activeId]?.length ?? 0) === 0 && "invisible"
          )}>
            {tasksByTab[activeId]?.length ?? 0}
          </div>
          <button
            onClick={handleToggleAdding}
            className="no-drag w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-100)] opacity-30 hover:opacity-100 hover:bg-[var(--app-dark)] transition-[background-color,opacity] duration-200 ease-in-out"
            title="Add task"
          >
            <Plus strokeWidth={2} className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div ref={listContainerRef} className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="space-y-1 flex-1 pointer-events-none">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-1.5 rounded-[var(--radius-medium)] h-[32px]">
                <div className="w-4 h-4 rounded-[4px] border border-[var(--bone-10)] bg-[var(--bone-3)] shrink-0" />
                <Skeleton className="h-2.5 w-48 bg-[var(--bone-5)] rounded-[3px]" />
              </div>
            ))}
          </div>
        ) : displayTasks.length > 0 ? (
          <div className="space-y-1">
            {displayTasks.map(t => {
              const workspaceName = entities.find(e => e.id === (t.entityId || t.spaceId))?.title || null;
              const isOverdue = isTaskOverdue({ completed: t.completed, dueDate: t.dueDate, endDate: t.endDate });
              return (
                <div
                  key={t.id}
                  onClick={() => openTaskPanel(t.id)}
                  className={cn(
                    "group flex items-center gap-3 px-2 py-1.5 rounded-[var(--radius-medium)] text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-[background-color,color,opacity] duration-200 ease-in-out cursor-pointer",
                    t.completed && "opacity-35 line-through decoration-[var(--bone-30)]"
                  )}
                >
                  <button
                    onClick={e => { e.stopPropagation(); toggleTask(t.id); }}
                    className="w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 border-[var(--bone-30)] hover:border-[var(--bone-70)] bg-[var(--bone-6)] hover:bg-[var(--app-dark)] transition-colors duration-200 ease-in-out"
                  >
                    {t.completed && <Check className="w-[10px] h-[10px] text-[var(--bone-100)] stroke-[3px]" />}
                  </button>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="text-sm text-foreground/90 font-medium truncate tracking-wide">{stripHtml(t.title || '')}</span>
                    {t.color && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: t.completed ? 'var(--bone-20)' : t.color }}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 select-none">
                    {t.attachments && t.attachments.length > 0 && (
                      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] text-[10px] font-medium bg-[var(--bone-10)] text-[var(--bone-70)] shrink-0">
                        <Paperclip className="w-2.5 h-2.5 opacity-70" />
                        <span>{t.attachments.length}</span>
                      </div>
                    )}
                    {t.priority && (
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-medium capitalize shrink-0",
                        t.priority === 'high' ? "bg-red-500/15 text-red-400" :
                          t.priority === 'medium' ? "bg-amber-500/15 text-amber-400" :
                            "bg-blue-500/15 text-blue-400"
                      )}>
                        {t.priority}
                      </span>
                    )}
                    {t.tag && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-medium shrink-0 max-w-[80px] bg-[var(--bone-10)] text-[var(--bone-70)]"
                        title={t.tag}
                      >
                        <span className="text-fade truncate max-w-full">
                          {t.tag}
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
                    {t.dueDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className={cn("w-3 h-3", isOverdue ? "text-red-400" : "text-[var(--bone-100)] opacity-30")} />
                        <span className={cn(
                          "text-[10px] font-ui",
                          isOverdue ? "text-red-400 font-medium" : "text-[var(--bone-40)]"
                        )}>
                          {formatDate(t.dueDate)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {totalTasks > renderCount && (
              <button
                onClick={() => addTab('tracker')}
                className="w-full text-left group flex items-center gap-3 px-2 py-1.5 rounded-[var(--radius-medium)] text-[var(--bone-50)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-[background-color,color] duration-200 ease-in-out cursor-pointer"
              >
                <div className="w-4 h-4 flex items-center justify-center shrink-0 text-[var(--bone-40)] group-hover:text-[var(--bone-100)] transition-colors">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
                <span className="flex-1 text-xs text-foreground/75 font-semibold tracking-wide">Show more</span>
              </button>
            )}
          </div>
        ) : !adding ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-4 bg-[var(--bone-2)] rounded-[12px] min-h-[140px] transition-[background-color,color] duration-200">
            <div className="text-center max-w-[320px]">
              <p className="text-base font-semibold text-bone-100 opacity-40">All caught up!</p>
              <p className="text-xs text-bone-70 opacity-40 mt-1 leading-snug text-balance">No tasks to display in {activeTabDef.label}. Enjoy your day!</p>
            </div>
            <button
              onClick={() => setAdding(true)}
              className="mt-2 flex items-center gap-1 px-3.5 py-2 rounded-[8px] bg-[var(--bone-5)] text-[var(--bone-70)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-100)] text-xs font-medium transition-[background-color,color] duration-200"
            >
              + New Task
            </button>
          </div>
        ) : null}

        {adding && (
          <div className="flex items-center gap-2 px-2 py-1.5 mt-1">
            <div className="w-4 h-4 rounded-[4px] border border-[var(--bone-20)] shrink-0" />
            <input
              ref={inputRef}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddSubmit();
                if (e.key === 'Escape') { setAdding(false); setNewTitle(''); }
              }}
              onBlur={handleAddSubmit}
              placeholder="New task…"
              className="flex-1 bg-transparent text-sm text-foreground/90 font-medium placeholder:text-muted-foreground/40 outline-none"
            />
          </div>
        )}
      </div>
    </section>
  );
}
