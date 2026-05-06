"use client";

import { useStore } from '@/data/store';
import { useMemo, useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { Calendar, AlertCircle, Clock, CheckCircle2, Plus, X } from 'lucide-react';

const ALL_TABS = [
  { id: 'today', label: 'Today', icon: Clock, color: 'text-accent' },
  { id: 'upcoming', label: 'Upcoming', icon: Calendar, color: 'text-blue-400' },
  { id: 'overdue', label: 'Overdue', icon: AlertCircle, color: 'text-red-400' },
  { id: 'progress', label: 'In Progress', icon: CheckCircle2, color: 'text-amber-400' },
] as const;

type TabId = typeof ALL_TABS[number]['id'];

interface SmartTaskStackProps {
  contextId?: string;
  isEditing?: boolean;
  data?: {
    stackType?: 'today-upcoming' | 'progress-overdue';
    activeTab?: string;
    hiddenTabs?: TabId[];
  };
  onUpdateData?: (newData: any) => void;
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
};

export function SmartTaskStackWidget({ data, onUpdateData, isEditing }: SmartTaskStackProps) {
  const tasks = useStore(state => state.tasks);
  const toggleTask = useStore(state => state.toggleTask);
  const addTask = useStore(state => state.addTask);

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

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  // If current tab was hidden, switch to first visible
  useEffect(() => {
    if (internalTab && hiddenTabs.includes(internalTab) && visibleTabs.length > 0) {
      setInternalTab(visibleTabs[0].id);
    }
  }, [hiddenTabs.join(',')]);

  const tasksByTab = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return {
      today: tasks.filter(t => {
        if (t.completed || !t.dueDate) return false;
        const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0);
        return d.getTime() === now.getTime();
      }),
      upcoming: tasks.filter(t => {
        if (t.completed || !t.dueDate) return false;
        const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0);
        return d.getTime() >= tomorrow.getTime();
      }).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()),
      overdue: tasks.filter(t => {
        if (t.completed || !t.dueDate) return false;
        const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0);
        return d.getTime() < now.getTime();
      }),
      progress: tasks.filter(t => !t.completed && t.status === 'in-progress'),
    };
  }, [tasks]);

  const activeId: TabId = (internalTab && !hiddenTabs.includes(internalTab))
    ? internalTab
    : (visibleTabs[0]?.id ?? 'today');

  const activeTabDef = ALL_TABS.find(t => t.id === activeId)!;
  const displayTasks = tasksByTab[activeId]?.slice(0, 7) ?? [];

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
    const t = newTitle.trim();
    if (t) addTask({ title: t });
    setNewTitle('');
    setAdding(false);
  }

  // Sliding pill: position by index among visible tabs
  const activeIndex = visibleTabs.findIndex(t => t.id === activeId);
  const tabCount = visibleTabs.length || 1;

  return (
    <section className="bg-sidebar group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 h-8 shrink-0 gap-2">

        {/* Tab switcher */}
        {visibleTabs.length > 0 ? (
          <div className="relative flex items-center p-[3px] bg-background rounded-[8px] no-drag overflow-hidden w-fit">
            {/* Sliding pill */}
            <div
              className="absolute top-[3px] bottom-[3px] rounded-[6px] bg-[var(--bone-10)] shadow-sm transition-all duration-300 ease-out"
              style={{
                left: `calc(3px + ${activeIndex * 80}px)`,
                width: '80px',
              }}
            />
            {visibleTabs.map(tab => (
              <div key={tab.id} className="relative z-10 w-20 flex items-center justify-center group/tab">
                <button
                  onClick={() => handleTabSwitch(tab.id)}
                  className={clsx(
                    "w-full flex items-center justify-center py-1 px-1 transition-colors duration-200",
                    activeId === tab.id ? "text-[var(--bone-100)]" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="text-[11px] font-semibold truncate">{tab.label}</span>
                </button>
                {/* X to hide this tab — visible on hover in edit mode */}
                {isEditing && visibleTabs.length > 1 && (
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); hideTab(tab.id); }}
                    className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-background border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/40 opacity-0 group-hover/tab:opacity-100 transition-opacity z-20"
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
                  className="w-full flex items-center justify-center py-1 transition-colors duration-200 text-muted-foreground hover:text-foreground"
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
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--bone-6)] transition-colors"
                      >
                        <tab.icon strokeWidth={2} className={clsx("w-3 h-3", tab.color)} />
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

        {/* Right side: count badge + add-task button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {displayTasks.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--bone-6)] border border-[var(--bone-3)]">
              <div className={clsx("w-1 h-1 rounded-full animate-pulse", activeTabDef.color.replace('text-', 'bg-'))} />
              <span className="text-[10px] text-[var(--bone-40)] font-semibold uppercase tracking-wider">
                {displayTasks.length}
              </span>
            </div>
          )}

          <button
            onClick={() => setAdding(a => !a)}
            className="no-drag w-6 h-6 flex items-center justify-center rounded-full bg-[var(--bone-6)] hover:bg-[var(--bone-10)] text-muted-foreground hover:text-foreground transition-colors"
            title="Add task"
          >
            <Plus strokeWidth={2} className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none hover:scrollbar-thin transition-all">
        {displayTasks.length > 0 ? (
          <div className="space-y-1">
            {displayTasks.map(t => (
              <div key={t.id} className="group flex items-center gap-3 px-2 py-1.5 rounded-[var(--radius-medium)] text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]">
                <button
                  onClick={() => toggleTask(t.id)}
                  className="w-4 h-4 rounded-[4px] border border-[var(--bone-30)] hover:border-[var(--bone-60)] flex items-center justify-center shrink-0 hover:scale-105 active:scale-95"
                />
                <span className="flex-1 text-sm text-foreground/90 font-medium truncate tracking-wide">{t.title}</span>
                {t.dueDate && (
                  <span className="text-[11px] text-[var(--bone-30)] font-medium tabular-nums shrink-0">{formatDate(t.dueDate)}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-4 bg-white/[0.01] rounded-[12px] min-h-[140px] transition-all duration-300">
            <CheckCircle2 strokeWidth={2} className="w-12 h-12 text-accent opacity-20 mb-1 animate-in fade-in duration-300" />
            <div className="text-center max-w-[320px]">
              <p className="text-base font-semibold text-bone-100 opacity-40">All caught up!</p>
              <p className="text-xs text-bone-60 opacity-40 mt-1 leading-snug text-balance">No tasks to display in {activeTabDef.label}. Enjoy your day!</p>
            </div>
            <button
              onClick={() => setAdding(true)}
              className="mt-2 flex items-center gap-1 px-3.5 py-2 rounded-[8px] bg-accent/[0.06] hover:bg-accent/[0.12] text-accent/60 text-xs font-medium transition-all duration-300"
            >
              + New Task
            </button>
          </div>
        )}

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
