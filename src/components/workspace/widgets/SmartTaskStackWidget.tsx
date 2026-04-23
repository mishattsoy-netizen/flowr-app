"use client";

import { useStore } from '@/data/store';
import { useMemo, useState, useEffect } from 'react';
import clsx from 'clsx';
import { Calendar, AlertCircle, Clock, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';

interface SmartTaskStackProps {
  contextId?: string;
  data?: {
    stackType: 'today-upcoming' | 'progress-overdue';
    activeTab?: string;
  };
  onUpdateData?: (newData: any) => void;
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
};

export function SmartTaskStackWidget({ data, onUpdateData }: SmartTaskStackProps) {
  const tasks = useStore(state => state.tasks);
  const toggleTask = useStore(state => state.toggleTask);
  
  const stackType = data?.stackType || 'today-upcoming';
  const [internalTab, setInternalTab] = useState<string | null>(data?.activeTab || null);

  // Sync internal state with prop data
  useEffect(() => {
    if (data?.activeTab) setInternalTab(data.activeTab);
  }, [data?.activeTab]);

  const { displayTasks, title, icon: Icon, colorClass, tabs, activeId } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayTasks = tasks.filter(t => {
      if (t.completed || !t.dueDate) return false;
      const d = new Date(t.dueDate);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === now.getTime();
    });

    const upcomingTasks = tasks.filter(t => {
      if (t.completed || !t.dueDate) return false;
      const d = new Date(t.dueDate);
      d.setHours(0, 0, 0, 0);
      return d.getTime() >= tomorrow.getTime();
    }).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

    const overdueTasks = tasks.filter(t => {
      if (t.completed || !t.dueDate) return false;
      const d = new Date(t.dueDate);
      d.setHours(0, 0, 0, 0);
      return d.getTime() < now.getTime();
    });

    const inProgressTasks = tasks.filter(t => {
      return !t.completed && t.status === 'in-progress';
    });

    if (stackType === 'today-upcoming') {
      const availableTabs = [
        { id: 'today', label: 'Today', icon: Clock, color: 'text-accent', tasks: todayTasks },
        { id: 'upcoming', label: 'Upcoming', icon: Calendar, color: 'text-blue-400', tasks: upcomingTasks }
      ];
      
      // Auto-select logic if no manual tab is set
      const activeId = internalTab || (todayTasks.length > 0 ? 'today' : 'upcoming');
      const active = availableTabs.find(t => t.id === activeId) || availableTabs[0];

      return {
        displayTasks: active.tasks.slice(0, 7),
        title: active.label,
        icon: active.icon,
        colorClass: active.color,
        tabs: availableTabs,
        activeId
      };
    } else {
      const availableTabs = [
        { id: 'overdue', label: 'Overdue', icon: AlertCircle, color: 'text-red-400', tasks: overdueTasks },
        { id: 'progress', label: 'In Progress', icon: CheckCircle2, color: 'text-amber-400', tasks: inProgressTasks }
      ];

      const activeId = internalTab || (overdueTasks.length > 0 ? 'overdue' : 'progress');
      const active = availableTabs.find(t => t.id === activeId) || availableTabs[0];

      return {
        displayTasks: active.tasks.slice(0, 7),
        title: active.label,
        icon: active.icon,
        colorClass: active.color,
        tabs: availableTabs,
        activeId
      };
    }
  }, [tasks, stackType, internalTab]);

  const handleTabSwitch = (tabId: string) => {
    setInternalTab(tabId);
    onUpdateData?.({ ...data, activeTab: tabId });
  };

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 h-8 shrink-0">
        <div 
          className="relative flex items-center p-0.5 bg-background rounded-[8px] min-w-[160px] no-drag"
        >
          {/* Sliding Background Pill */}
          <div 
            className="absolute top-[3px] bottom-[3px] rounded-[6px] bg-[var(--bone-10)] shadow-sm transition-all duration-300 ease-out"
            style={{ 
              left: tabs.findIndex(t => t.id === activeId) === 0 ? '3px' : 'calc(50% + 1px)',
              width: 'calc(50% - 4px)'
            }}
          />
          
          {tabs.map((tab, idx) => {
            const isActive = activeId === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabSwitch(tab.id)}
                className={clsx(
                  "relative z-10 flex-1 flex items-center justify-center py-1 rounded-[6px] transition-colors duration-200",
                  isActive ? "text-[var(--bone-100)]" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="text-[11px] font-semibold">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
        
        {displayTasks.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--bone-6)] border border-[var(--bone-10)]">
             <div className={clsx("w-1 h-1 rounded-full animate-pulse", colorClass.replace('text-', 'bg-'))} />
             <span className="text-[10px] text-[var(--bone-40)] font-semibold uppercase tracking-wider">
              {displayTasks.length}
            </span>
          </div>
        )}
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
                <span className="flex-1 text-sm text-foreground/90 font-medium truncate">{t.title}</span>
                {t.dueDate && (
                  <span className="text-[11px] text-[var(--bone-30)] font-medium tabular-nums shrink-0">{formatDate(t.dueDate)}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 opacity-50">
            <CheckCircle2 className="w-8 h-8 text-[var(--bone-20)]" />
            <p className="text-xs text-muted-foreground font-medium">All caught up in {title}!</p>
          </div>
        )}
      </div>
    </section>
  );
}
