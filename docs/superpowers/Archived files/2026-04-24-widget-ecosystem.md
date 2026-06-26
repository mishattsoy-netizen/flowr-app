# Widget Ecosystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver new widgets (Calendar, Notes Scratchpad, Habit Tracker, 3 Analytics), improve all 8 existing widgets, and add a widget link/alias system.

**Architecture:** Each widget is a React component in `src/components/workspace/widgets/` receiving `{ contextId, data, onUpdateData }` props. Widget settings are stored in `BentoLayoutItem.data` via `onUpdateData`. New data types extend `src/data/store.types.ts` with matching store actions in `src/data/store.ts`. New widgets are registered in `src/components/bento/registry.tsx`.

**Tech Stack:** Next.js 14, React, TypeScript, Zustand, Tailwind CSS, `recharts` (charts), `react-day-picker` (calendar), `date-fns` (date math), `lucide-react` (icons). No test framework — verify with `npx tsc --noEmit` then `npm run dev` + manual browser check.

---

## Phase 0: Wire `isEditing` to All Widgets

This enables settings UIs (like Clock's style picker) that exist in code but are never shown.

### Task 0.1: Pass `editMode` as `isEditing` in BentoWidget

**Files:**
- Modify: `src/components/bento/BentoWidget.tsx`

- [ ] **Step 1: Add `isEditing` to the component render**

In `src/components/bento/BentoWidget.tsx`, find the `<WidgetComponent .../>` call and add `isEditing={editMode}`:

```tsx
<WidgetComponent 
  contextId={contextId} 
  data={item.data} 
  onUpdateData={onUpdateData}
  isEditing={editMode}
/>
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors (TypeScript ignores unknown props on `ComponentType<any>`).

- [ ] **Step 3: Browser verify**

Run `npm run dev`, open the dashboard, click Edit mode → the Clock widget should show its style-switcher pill.

- [ ] **Step 4: Commit**

```bash
git add src/components/bento/BentoWidget.tsx
git commit -m "feat: pass editMode as isEditing to all widget components"
```

---

## Phase 1: Existing Widget Improvements

### Task 1.1: Clock — timezone selector + 12/24h toggle

**Files:**
- Modify: `src/components/workspace/widgets/ClockWidget.tsx`

- [ ] **Step 1: Replace ClockWidget.tsx**

The existing widget already has `simple/datetime/analog` styles. Add `hour12` and `timezone` to `ClockData`, and show a timezone picker + 12/24h toggle in the settings pill when `isEditing`.

```tsx
"use client";

import { useState, useEffect } from 'react';
import clsx from 'clsx';

type ClockStyle = 'simple' | 'datetime' | 'analog';

interface ClockData {
  style?: ClockStyle;
  hour12?: boolean;
  timezone?: string;
}

interface Props {
  data?: ClockData;
  onUpdateData?: (d: ClockData) => void;
  isEditing?: boolean;
}

const TIMEZONES = [
  { label: 'Local', value: '' },
  { label: 'UTC', value: 'UTC' },
  { label: 'New York', value: 'America/New_York' },
  { label: 'London', value: 'Europe/London' },
  { label: 'Paris', value: 'Europe/Paris' },
  { label: 'Dubai', value: 'Asia/Dubai' },
  { label: 'Singapore', value: 'Asia/Singapore' },
  { label: 'Tokyo', value: 'Asia/Tokyo' },
  { label: 'Sydney', value: 'Australia/Sydney' },
];

export function ClockWidget({ data, onUpdateData, isEditing }: Props) {
  const [now, setNow] = useState(new Date());
  const style: ClockStyle = data?.style ?? 'simple';
  const hour12 = data?.hour12 ?? true;
  const timezone = data?.timezone ?? '';

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fmtOpts = (extra: Intl.DateTimeFormatOptions = {}) => ({
    ...extra,
    ...(timezone ? { timeZone: timezone } : {}),
  });

  const timeStr = new Intl.DateTimeFormat('en-US', fmtOpts({ hour: '2-digit', minute: '2-digit', hour12 })).format(now);
  const dateStr = new Intl.DateTimeFormat('en-US', fmtOpts({ weekday: 'long', month: 'long', day: 'numeric' })).format(now);

  const hours = Number(new Intl.DateTimeFormat('en-US', fmtOpts({ hour: 'numeric', hour12: false })).format(now));
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const hourAngle = ((hours % 12) + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;

  const STYLES: { key: ClockStyle; label: string }[] = [
    { key: 'simple', label: 'Simple' },
    { key: 'datetime', label: 'Date' },
    { key: 'analog', label: 'Analog' },
  ];

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget rounded-[var(--radius-big)] widget-shadow h-full flex flex-col relative">
      {onUpdateData && isEditing && (
        <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-0.5 bg-[var(--bone-6)] rounded-[var(--radius-small)] p-0.5">
            {STYLES.map(s => (
              <button
                key={s.key}
                onClick={() => onUpdateData({ ...data, style: s.key })}
                className={clsx(
                  "px-2.5 py-0.5 text-[10px] font-semibold rounded-[4px] transition-colors",
                  style === s.key ? "bg-[var(--bone-15)] text-[var(--bone-100)]" : "text-[var(--bone-30)] hover:text-[var(--bone-100)]"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onUpdateData({ ...data, hour12: !hour12 })}
              className="px-2 py-0.5 text-[10px] font-semibold rounded-[4px] bg-[var(--bone-6)] text-[var(--bone-60)] hover:text-[var(--bone-100)] transition-colors"
            >
              {hour12 ? '12h' : '24h'}
            </button>
            <select
              value={timezone}
              onChange={e => onUpdateData({ ...data, timezone: e.target.value })}
              className="text-[10px] bg-[var(--bone-6)] border-none rounded-[4px] px-1.5 py-0.5 text-[var(--bone-60)] outline-none"
            >
              {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
            </select>
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-5">
        {style === 'simple' && (
          <p className="text-6xl font-display font-semibold text-foreground tabular-nums">{timeStr}</p>
        )}
        {style === 'datetime' && (
          <div className="text-center space-y-1.5">
            <p className="text-5xl font-display font-semibold text-foreground tabular-nums">{timeStr}</p>
            <p className="text-sm font-medium text-muted-foreground">{dateStr}</p>
          </div>
        )}
        {style === 'analog' && (
          <svg viewBox="0 0 100 100" className="w-32 h-32">
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--bone-10)" strokeWidth="1.5" />
            {[...Array(12)].map((_, i) => {
              const angle = i * 30;
              const r1 = 40, r2 = i % 3 === 0 ? 43 : 42;
              const rad = (angle * Math.PI) / 180;
              return <line key={i} x1={50 + r1 * Math.sin(rad)} y1={50 - r1 * Math.cos(rad)} x2={50 + r2 * Math.sin(rad)} y2={50 - r2 * Math.cos(rad)} stroke="var(--bone-30)" strokeWidth={i % 3 === 0 ? 2 : 1} strokeLinecap="round" />;
            })}
            <line x1="50" y1="50" x2={50 + 22 * Math.sin((hourAngle * Math.PI) / 180)} y2={50 - 22 * Math.cos((hourAngle * Math.PI) / 180)} stroke="var(--bone-100)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="50" y1="50" x2={50 + 32 * Math.sin((minuteAngle * Math.PI) / 180)} y2={50 - 32 * Math.cos((minuteAngle * Math.PI) / 180)} stroke="var(--bone-60)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="50" y1="50" x2={50 + 37 * Math.sin((secondAngle * Math.PI) / 180)} y2={50 - 37 * Math.cos((secondAngle * Math.PI) / 180)} stroke="color-mix(in srgb, var(--accent) 80%, transparent)" strokeWidth="0.8" strokeLinecap="round" />
            <circle cx="50" cy="50" r="2" fill="var(--bone-60)" />
          </svg>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check and verify**

```bash
npx tsc --noEmit
```

Open dashboard in edit mode → Clock widget → confirm timezone select and 12/24h button appear.

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/widgets/ClockWidget.tsx
git commit -m "feat(clock): add timezone selector and 12/24h toggle"
```

---

### Task 1.2: Timer — session counter + completion notification

**Files:**
- Modify: `src/components/workspace/widgets/TimerWidget.tsx`

The existing Timer has pomodoro + stopwatch modes and a progress ring. Add: session counter (how many pomodoros completed today), custom duration input, and browser notification on completion.

- [ ] **Step 1: Replace TimerWidget.tsx**

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Plus, Minus } from 'lucide-react';

type TimerMode = 'pomodoro' | 'stopwatch';

interface TimerData {
  mode?: TimerMode;
  pomoDuration?: number; // minutes, default 25
  breakDuration?: number; // minutes, default 5
}

export function TimerWidget({ data, onUpdateData, isEditing }: { data?: TimerData; onUpdateData: (d: TimerData) => void; isEditing?: boolean }) {
  const mode = (data?.mode ?? 'pomodoro') as TimerMode;
  const pomoDuration = (data?.pomoDuration ?? 25) * 60;
  const breakDuration = (data?.breakDuration ?? 5) * 60;

  const [seconds, setSeconds] = useState(mode === 'pomodoro' ? pomoDuration : 0);
  const [isRunning, setIsRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const notify = useCallback((msg: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Flowr Timer', { body: msg, icon: '/favicon.ico' });
    }
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          if (mode === 'pomodoro') {
            if (prev <= 1) {
              setIsRunning(false);
              setSessions(s => s + 1);
              notify('Pomodoro complete! Take a break.');
              return 0;
            }
            return prev - 1;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [isRunning, mode, clearTimer, notify]);

  // Request notification permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Reset when duration config changes
  useEffect(() => {
    setIsRunning(false);
    setSeconds(mode === 'pomodoro' ? pomoDuration : 0);
  }, [pomoDuration, mode]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const reset = () => { setIsRunning(false); setSeconds(mode === 'pomodoro' ? pomoDuration : 0); };

  const switchMode = (m: TimerMode) => {
    setIsRunning(false);
    onUpdateData({ ...data, mode: m });
    setSeconds(m === 'pomodoro' ? pomoDuration : 0);
  };

  const progress = mode === 'pomodoro' ? (pomoDuration - seconds) / pomoDuration : 0;

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground">Timer</h2>
        {sessions > 0 && (
          <span className="text-[10px] font-semibold text-[var(--bone-40)] tracking-wide">{sessions} session{sessions !== 1 ? 's' : ''} today</span>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-[var(--bone-5)] rounded-[var(--radius-small)] mb-4">
        {(['pomodoro', 'stopwatch'] as TimerMode[]).map(m => (
          <button key={m} onClick={() => switchMode(m)}
            className={`flex-1 text-xs py-1.5 rounded-[3px] font-medium ${mode === m ? 'bg-[var(--bone-10)] text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {m === 'pomodoro' ? 'Pomodoro' : 'Stopwatch'}
          </button>
        ))}
      </div>

      {isEditing && mode === 'pomodoro' && (
        <div className="flex items-center justify-center gap-4 mb-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <button onClick={() => onUpdateData({ ...data, pomoDuration: Math.max(5, (data?.pomoDuration ?? 25) - 5) })} className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--bone-10)]"><Minus className="w-3 h-3" /></button>
            <span className="w-8 text-center font-mono text-foreground">{data?.pomoDuration ?? 25}m</span>
            <button onClick={() => onUpdateData({ ...data, pomoDuration: Math.min(90, (data?.pomoDuration ?? 25) + 5) })} className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--bone-10)]"><Plus className="w-3 h-3" /></button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="relative w-28 h-28 flex items-center justify-center">
          {mode === 'pomodoro' && (
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="var(--bone-5)" strokeWidth="3" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="var(--bone-100)" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 44}`} strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress)}`} />
            </svg>
          )}
          <span className="text-2xl font-mono text-foreground font-semibold tracking-wider">{formatTime(seconds)}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsRunning(p => !p)} className="w-10 h-10 rounded-full bg-[var(--bone-5)] flex items-center justify-center text-[var(--bone-60)] hover:text-foreground hover:bg-[var(--bone-10)]">
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button onClick={reset} className="w-10 h-10 rounded-full bg-[var(--bone-5)] flex items-center justify-center text-[var(--bone-60)] hover:text-foreground hover:bg-[var(--bone-10)]">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check and verify**

```bash
npx tsc --noEmit
```

Open dashboard → Timer widget → start a very short custom timer (set to 5m in edit mode) → confirm notification appears and session counter increments.

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/widgets/TimerWidget.tsx
git commit -m "feat(timer): add session counter, custom duration, and browser notification"
```

---

### Task 1.3: Tasks Widget — inline create + view toggle + filter

**Files:**
- Modify: `src/components/workspace/widgets/TasksWidget.tsx`

- [ ] **Step 1: Replace TasksWidget.tsx**

```tsx
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
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
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
```

- [ ] **Step 2: Type-check and verify**

```bash
npx tsc --noEmit
```

Open tasks widget → confirm + button opens inline input → Enter adds task → Status view groups tasks by due date status.

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/widgets/TasksWidget.tsx
git commit -m "feat(tasks-widget): add inline create, list/status view toggle"
```

---

### Task 1.4: Quick Links — drag-to-reorder + favicon

**Files:**
- Modify: `src/components/workspace/widgets/QuickLinksWidget.tsx`

The existing widget has add/remove. Add favicon (via `favicon.im` proxy to avoid CSP issues), drag-to-reorder using array splice on drag end, and compact/expanded display toggle.

- [ ] **Step 1: Replace QuickLinksWidget.tsx**

```tsx
"use client";

import { useState, useRef } from 'react';
import { Plus, ExternalLink, X, GripVertical } from 'lucide-react';
import clsx from 'clsx';

interface QuickLink { id: string; label: string; url: string; }

interface QLData { links?: QuickLink[]; compact?: boolean; }

export function QuickLinksWidget({ data, onUpdateData }: { data?: QLData; onUpdateData: (d: QLData) => void; isEditing?: boolean }) {
  const links = data?.links ?? [];
  const compact = data?.compact ?? false;
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const dragIdx = useRef<number | null>(null);

  const handleAdd = () => {
    if (!newUrl.trim()) return;
    const label = newLabel.trim() || (() => { try { return new URL(newUrl.trim()).hostname; } catch { return newUrl.trim(); } })();
    onUpdateData({ ...data, links: [...links, { id: `ql-${Date.now()}`, label, url: newUrl.trim() }] });
    setNewLabel(''); setNewUrl(''); setIsAdding(false);
  };

  const handleRemove = (id: string) => onUpdateData({ ...data, links: links.filter(l => l.id !== id) });

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDrop = (targetIdx: number) => {
    if (dragIdx.current === null || dragIdx.current === targetIdx) return;
    const reordered = [...links];
    const [moved] = reordered.splice(dragIdx.current, 1);
    reordered.splice(targetIdx, 0, moved);
    onUpdateData({ ...data, links: reordered });
    dragIdx.current = null;
  };

  const faviconUrl = (url: string) => {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; } catch { return null; }
  };

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground">Quick Links</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => onUpdateData({ ...data, compact: !compact })}
            className={clsx("px-2 py-0.5 text-[10px] font-semibold rounded-[4px] transition-colors", compact ? "bg-[var(--bone-15)] text-[var(--bone-100)]" : "text-[var(--bone-30)] hover:text-[var(--bone-100)]")}>
            {compact ? 'Icons' : 'List'}
          </button>
          <button onClick={() => setIsAdding(true)} className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-30)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]">
            <Plus strokeWidth={2} className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1">
        {links.map((link, idx) => {
          const favicon = faviconUrl(link.url);
          return (
            <div key={link.id} draggable onDragStart={() => handleDragStart(idx)} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(idx)}
              className={clsx("group/link flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-medium)] hover:bg-[var(--bone-6)] cursor-grab", compact && "justify-center")}>
              <GripVertical className="w-3 h-3 text-[var(--bone-15)] shrink-0 opacity-0 group-hover/link:opacity-100" />
              {favicon ? (
                <img src={favicon} alt="" className="w-4 h-4 rounded-sm shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <ExternalLink className="w-3.5 h-3.5 text-[var(--bone-30)] shrink-0" />
              )}
              {!compact && (
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-foreground hover:underline truncate flex-1">{link.label}</a>
              )}
              <button onClick={() => handleRemove(link.id)} className="opacity-0 group-hover/link:opacity-100 w-5 h-5 flex items-center justify-center rounded text-[var(--bone-30)] hover:text-red-400 hover:bg-red-400/10 transition-all">
                <X strokeWidth={2} className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {links.length === 0 && !isAdding && (
          <div className="h-full flex items-center justify-center"><p className="text-sm text-muted-foreground">No links added.</p></div>
        )}

        {isAdding && (
          <div className="space-y-2 p-2 border border-[var(--bone-10)] rounded-[var(--radius-medium)]">
            <input autoFocus placeholder="Label (auto-detected if empty)" value={newLabel} onChange={e => setNewLabel(e.target.value)}
              className="w-full bg-transparent border border-[var(--bone-5)] rounded-[var(--radius-medium)] px-2.5 py-1.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-[var(--bone-30)]" />
            <input placeholder="https://..." value={newUrl} onChange={e => setNewUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setIsAdding(false); }}
              className="w-full bg-transparent border border-[var(--bone-5)] rounded-[var(--radius-medium)] px-2.5 py-1.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-[var(--bone-30)]" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsAdding(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={handleAdd} className="text-xs text-accent font-medium hover:opacity-80">Add</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check and verify**

```bash
npx tsc --noEmit
```

Add a link → favicon loads → drag rows to reorder → compact toggle shows icon-only mode.

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/widgets/QuickLinksWidget.tsx
git commit -m "feat(quick-links): add favicon, drag-to-reorder, compact mode"
```

---

### Task 1.5: Recent — workspace badge + type filter

**Files:**
- Modify: `src/components/workspace/widgets/RecentWidget.tsx`

- [ ] **Step 1: Replace RecentWidget.tsx**

```tsx
"use client";

import { useStore } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { Clock, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { EntityType } from '@/data/store.types';

function formatAge(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

type Filter = 'all' | 'note' | 'canvas';

export function RecentWidget({ data, onUpdateData }: { data?: { filter?: Filter }; onUpdateData?: (d: any) => void; isEditing?: boolean }) {
  const recentEntityIds = useStore(s => s.recentEntityIds);
  const entities = useStore(s => s.entities);
  const workspaces = useStore(s => s.workspaces);
  const setActiveEntityId = useStore(s => s.setActiveEntityId);
  const filter: Filter = data?.filter ?? 'all';

  const recentEntities = useMemo(() =>
    recentEntityIds.map(id => entities.find(e => e.id === id)).filter(Boolean)
      .filter(e => filter === 'all' || e!.type === filter),
    [recentEntityIds, entities, filter]
  );

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground group-hover/widget:text-accent transition-colors" />
          <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground">Recent</h2>
        </div>
        {onUpdateData && (
          <div className="flex items-center gap-0.5 bg-[var(--bone-6)] rounded-[4px] p-0.5">
            {(['all', 'note', 'canvas'] as Filter[]).map(f => (
              <button key={f} onClick={() => onUpdateData({ ...data, filter: f })}
                className={clsx("px-2 py-0.5 text-[10px] font-semibold rounded-[3px] capitalize transition-colors",
                  filter === f ? "bg-[var(--bone-15)] text-[var(--bone-100)]" : "text-[var(--bone-30)] hover:text-[var(--bone-100)]")}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-1">
        {recentEntities.length > 0 ? recentEntities.map(entity => {
          if (!entity) return null;
          const Icon = getEntityIcon(entity.icon);
          const ws = entity.workspaceId ? workspaces.find(w => w.id === entity.workspaceId) : null;
          return (
            <button key={entity.id} onClick={() => setActiveEntityId(entity.id)}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--bone-6)] transition-all group/item text-left">
              <div className="w-8 h-8 rounded-lg bg-[var(--bone-10)] border border-[var(--bone-10)] flex items-center justify-center text-[var(--bone-60)] group-hover/item:text-accent group-hover/item:border-accent/30 transition-all shadow-sm">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground truncate">{entity.title}</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <span>{formatAge(entity.lastModified)} ago</span>
                  {ws && <><span>·</span><span className="truncate max-w-[80px]">{ws.name}</span></>}
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[var(--bone-20)] opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-0.5 transition-all" />
            </button>
          );
        }) : (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-50">
            <Clock className="w-8 h-8 text-[var(--bone-20)]" />
            <p className="text-[11px] text-muted-foreground">No recent pages.</p>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check and verify**

```bash
npx tsc --noEmit
```

Open recent widget → workspace name shows under page title → filter tabs narrow results.

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/widgets/RecentWidget.tsx
git commit -m "feat(recent): add workspace badge and type filter"
```

---

### Task 1.6: All Files — tree view toggle + filter bar

**Files:**
- Modify: `src/components/workspace/widgets/AllFilesWidget.tsx`

- [ ] **Step 1: Read the current AllFilesWidget**

```bash
cat src/components/workspace/widgets/AllFilesWidget.tsx
```

Understand the existing layout. Then add:
1. A search `<input>` at the top that filters by `entity.title`
2. A flat/tree toggle in the header (tree groups by `entity.parentId`)
3. Sort-by dropdown (name | modified)

Below is the full replacement. Adjust className details if the existing file uses different patterns:

```tsx
"use client";

import { useStore } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { Search, List, GitBranch } from 'lucide-react';
import { useMemo, useState } from 'react';
import clsx from 'clsx';

type SortBy = 'modified' | 'name';
type ViewMode = 'flat' | 'tree';

export function AllFilesWidget({ data, onUpdateData, contextId }: { data?: { sort?: SortBy; view?: ViewMode }; onUpdateData?: (d: any) => void; contextId?: string; isEditing?: boolean }) {
  const entities = useStore(s => s.entities);
  const setActiveEntityId = useStore(s => s.setActiveEntityId);
  const [search, setSearch] = useState('');
  const sort: SortBy = data?.sort ?? 'modified';
  const view: ViewMode = data?.view ?? 'flat';

  const filtered = useMemo(() => {
    const notes = entities.filter(e => ['note', 'canvas', 'collection', 'folder'].includes(e.type));
    const q = search.toLowerCase();
    const searched = q ? notes.filter(e => e.title.toLowerCase().includes(q)) : notes;
    return [...searched].sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title) : b.lastModified - a.lastModified);
  }, [entities, search, sort]);

  const rootItems = useMemo(() => filtered.filter(e => !e.parentId || !filtered.find(p => p.id === e.parentId)), [filtered]);

  const renderItem = (entity: typeof filtered[0], depth = 0) => {
    const Icon = getEntityIcon(entity.icon);
    const children = view === 'tree' ? filtered.filter(e => e.parentId === entity.id) : [];
    return (
      <div key={entity.id}>
        <button onClick={() => setActiveEntityId(entity.id)} style={{ paddingLeft: `${8 + depth * 16}px` }}
          className="w-full flex items-center gap-2 pr-2 py-1.5 rounded-[var(--radius-medium)] hover:bg-[var(--bone-6)] transition-all group/item text-left">
          <Icon className="w-3.5 h-3.5 text-[var(--bone-40)] group-hover/item:text-accent shrink-0 transition-colors" />
          <span className="text-sm text-foreground truncate flex-1">{entity.title || 'Untitled'}</span>
        </button>
        {children.map(c => renderItem(c, depth + 1))}
      </div>
    );
  };

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget px-4 pb-4 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground">All Files</h2>
        {onUpdateData && (
          <div className="flex items-center gap-1">
            <select value={sort} onChange={e => onUpdateData({ ...data, sort: e.target.value as SortBy })}
              className="text-[10px] bg-[var(--bone-6)] border-none rounded-[4px] px-1.5 py-0.5 text-[var(--bone-60)] outline-none">
              <option value="modified">Modified</option>
              <option value="name">Name</option>
            </select>
            <button onClick={() => onUpdateData({ ...data, view: view === 'flat' ? 'tree' : 'flat' })}
              className={clsx("w-6 h-6 flex items-center justify-center rounded-[4px] transition-colors",
                view === 'tree' ? "bg-[var(--bone-15)] text-[var(--bone-100)]" : "text-[var(--bone-30)] hover:text-[var(--bone-100)]")}>
              {view === 'tree' ? <GitBranch className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--bone-30)]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter..."
          className="w-full pl-7 pr-3 py-1.5 bg-[var(--bone-5)] border border-[var(--bone-10)] rounded-[var(--radius-small)] text-sm text-foreground placeholder-muted-foreground outline-none focus:border-[var(--bone-20)]" />
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {(view === 'flat' ? filtered : rootItems).map(e => renderItem(e))}
        {filtered.length === 0 && <div className="flex items-center justify-center h-16"><p className="text-sm text-muted-foreground">No files found.</p></div>}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check and verify**

```bash
npx tsc --noEmit
```

Open All Files widget → search filters in real time → tree toggle groups by parent → sort select reorders list.

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/widgets/AllFilesWidget.tsx
git commit -m "feat(all-files): add search filter, tree view, sort toggle"
```

---

### Task 1.7: Shortcuts — drag-to-reorder (native HTML5 drag)

**Files:**
- Modify: `src/components/workspace/widgets/ShortcutsWidget.tsx`

The current widget is already good. Add drag-to-reorder between grid items using the same native-drag approach as Quick Links (Task 1.4).

- [ ] **Step 1: Add drag refs and handlers**

In `ShortcutsWidget.tsx`, add `useRef` for `dragIdx`, then add `draggable`, `onDragStart`, `onDragOver`, `onDrop` to each shortcut `<div>`:

```tsx
// At the top of the component body:
const dragIdx = useRef<number | null>(null);

const handleDragStart = (idx: number) => { dragIdx.current = idx; };
const handleDrop = (targetIdx: number) => {
  if (dragIdx.current === null || dragIdx.current === targetIdx) return;
  const reordered = [...shortcuts];
  const [moved] = reordered.splice(dragIdx.current, 1);
  reordered.splice(targetIdx, 0, moved);
  onUpdateData({ shortcuts: reordered });
  dragIdx.current = null;
};
```

On the `<div key={s.id} className="relative group/shortcut">` element, add:
```tsx
draggable
onDragStart={() => handleDragStart(shortcuts.indexOf(s))}
onDragOver={e => e.preventDefault()}
onDrop={() => handleDrop(shortcuts.indexOf(s))}
className="relative group/shortcut cursor-grab"
```

- [ ] **Step 2: Add the import**

Add `useRef` to the existing React import:
```tsx
import { useState, useRef } from 'react';
```

- [ ] **Step 3: Type-check and verify**

```bash
npx tsc --noEmit
```

Drag shortcut tiles to reorder them → order persists after release.

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/widgets/ShortcutsWidget.tsx
git commit -m "feat(shortcuts): add drag-to-reorder for shortcut tiles"
```

---

### Task 1.8: Update registry with improved minW/maxW settings

The `quick-links` widget currently has `minH: 2` but works fine at `minH: 1`. Update to accurate values.

**Files:**
- Modify: `src/components/bento/registry.tsx`

- [ ] **Step 1: Fix quick-links minH and add display info**

Change `'quick-links'` entry:
```tsx
'quick-links': { label: 'Quick Links', description: 'Bookmark shortcuts', component: QuickLinksWidget, defaultW: 4, defaultH: 1, minW: 2, minH: 1, maxW: 6, maxH: 2, category: 'Organization' },
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/bento/registry.tsx
git commit -m "fix(registry): correct quick-links minH to 1"
```

---

## Phase 2: Tracker Calendar View + Calendar Widget

### Task 2.1: Add view state to TrackerPage

**Files:**
- Modify: `src/components/tracker/TrackerPage.tsx`

- [ ] **Step 1: Add view state and tab bar to TrackerPage**

At the top of `TrackerPage` component body, add:
```tsx
const [trackerView, setTrackerView] = useState<'kanban' | 'list' | 'calendar'>('kanban');
```

Add this tab bar just before the `<DndContext>` return, replacing the existing outer wrapper's opening tag:
```tsx
return (
  <div className="h-full flex flex-col">
    {/* View switcher */}
    <div className="flex items-center gap-1 px-6 pt-4 pb-2 shrink-0">
      {(['kanban', 'list', 'calendar'] as const).map(v => (
        <button key={v} onClick={() => setTrackerView(v)}
          className={clsx(
            'px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-small)] capitalize transition-colors',
            trackerView === v ? 'bg-[var(--bone-15)] text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-[var(--bone-6)]'
          )}>
          {v}
        </button>
      ))}
    </div>

    {trackerView === 'kanban' && (
      /* existing DndContext JSX goes here — wrap it */
      <DndContext ...>
```

The existing Kanban JSX becomes the body of `trackerView === 'kanban'`. Add a closing `}` after the Kanban block, then:
```tsx
    {trackerView === 'list' && <TrackerListView tasks={tasks} today={today} updateTask={updateTask} />}
    {trackerView === 'calendar' && <TrackerCalendarView tasks={tasks} today={today} updateTask={updateTask} />}
  </div>
);
```

Also add `clsx` import if not already present:
```tsx
import clsx from 'clsx';
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expect errors about `TrackerListView` and `TrackerCalendarView` not existing — implement them in the next tasks.

---

### Task 2.2: Implement TrackerListView

**Files:**
- Create: `src/components/tracker/TrackerListView.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { AppTask } from '@/data/store';
import { CheckCircle2, Circle } from 'lucide-react';

interface Props {
  tasks: AppTask[];
  today: string;
  updateTask: (id: string, updates: Partial<AppTask>) => void;
}

const formatDate = (d: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(d));

export function TrackerListView({ tasks, today, updateTask }: Props) {
  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  return (
    <div className="flex-1 overflow-y-auto px-6 py-2">
      <table className="w-full">
        <thead>
          <tr className="text-[10px] font-semibold text-[var(--bone-30)] uppercase tracking-widest border-b border-[var(--bone-8)]">
            <th className="pb-2 text-left w-8"></th>
            <th className="pb-2 text-left">Title</th>
            <th className="pb-2 text-left w-24">Status</th>
            <th className="pb-2 text-left w-24">Due</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(task => (
            <tr key={task.id} className="group border-b border-[var(--bone-5)] hover:bg-[var(--bone-5)] transition-colors">
              <td className="py-2 pr-2">
                <button onClick={() => updateTask(task.id, { completed: !task.completed })}
                  className="text-[var(--bone-30)] hover:text-accent transition-colors">
                  {task.completed ? <CheckCircle2 className="w-4 h-4 text-accent" /> : <Circle className="w-4 h-4" />}
                </button>
              </td>
              <td className={`py-2 text-sm ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {task.title}
              </td>
              <td className="py-2 text-xs text-muted-foreground capitalize">{task.status ?? 'todo'}</td>
              <td className="py-2 text-xs text-[var(--bone-40)]">
                {task.dueDate ? formatDate(task.dueDate) : <span className="text-[var(--bone-20)]">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {tasks.length === 0 && (
        <div className="flex items-center justify-center h-32"><p className="text-sm text-muted-foreground">No tasks.</p></div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Import in TrackerPage.tsx**

```tsx
import { TrackerListView } from './TrackerListView';
```

---

### Task 2.3: Implement TrackerCalendarView

**Files:**
- Create: `src/components/tracker/TrackerCalendarView.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from 'react';
import { AppTask } from '@/data/store';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import clsx from 'clsx';

interface Props {
  tasks: AppTask[];
  today: string;
  updateTask: (id: string, updates: Partial<AppTask>) => void;
}

const STATUS_COLORS: Record<string, string> = {
  done: 'bg-green-500/60',
  'in-progress': 'bg-accent/60',
  todo: 'bg-[var(--bone-30)]',
};

export function TrackerCalendarView({ tasks, today, updateTask }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Zustand addTask — pull from store at usage site
  const { addTask } = require('@/data/store').useStore.getState();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart); // 0=Sun

  const tasksByDate: Record<string, AppTask[]> = {};
  tasks.forEach(t => {
    if (t.dueDate) {
      if (!tasksByDate[t.dueDate]) tasksByDate[t.dueDate] = [];
      tasksByDate[t.dueDate].push(t);
    }
  });

  const unscheduled = tasks.filter(t => !t.dueDate && !t.completed);

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr === selectedDate ? null : dateStr);
    setIsCreating(false);
  };

  const handleCreateTask = () => {
    if (!newTaskTitle.trim() || !selectedDate) return;
    addTask({ title: newTaskTitle.trim(), dueDate: selectedDate });
    setNewTaskTitle('');
    setIsCreating(false);
  };

  const handleDrop = (e: React.DragEvent, targetDate: string) => {
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) updateTask(taskId, { dueDate: targetDate });
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col px-6 pb-4">
      {/* Month nav */}
      <div className="flex items-center justify-between py-3 shrink-0">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bone-6)] text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">{format(currentMonth, 'MMMM yyyy')}</span>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bone-6)] text-muted-foreground hover:text-foreground">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 text-center shrink-0">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="text-[10px] font-semibold text-[var(--bone-30)] uppercase py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 flex-1 min-h-0 gap-px bg-[var(--bone-8)] rounded-xl overflow-hidden">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="bg-sidebar/50" />
        ))}
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate[dateStr] ?? [];
          const isSelected = selectedDate === dateStr;
          const todayMark = isToday(day);
          return (
            <div key={dateStr} className={clsx("bg-sidebar p-1.5 flex flex-col gap-1 cursor-pointer hover:bg-[var(--bone-5)] transition-colors min-h-[80px]", isSelected && "ring-2 ring-accent ring-inset")}
              onClick={() => handleDayClick(dateStr)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, dateStr)}>
              <span className={clsx("text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full", todayMark && "bg-accent text-white", !todayMark && "text-muted-foreground")}>
                {format(day, 'd')}
              </span>
              {dayTasks.slice(0, 3).map(t => (
                <div key={t.id} draggable onDragStart={e => e.dataTransfer.setData('taskId', t.id)}
                  className={clsx("text-[10px] px-1.5 py-0.5 rounded font-medium truncate text-white", STATUS_COLORS[t.status ?? 'todo'])}>
                  {t.title}
                </div>
              ))}
              {dayTasks.length > 3 && <span className="text-[9px] text-[var(--bone-30)]">+{dayTasks.length - 3} more</span>}
            </div>
          );
        })}
      </div>

      {/* Selected day popover */}
      {selectedDate && (
        <div className="mt-3 p-3 border border-[var(--bone-10)] rounded-xl bg-sidebar shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground">{format(new Date(selectedDate + 'T12:00:00'), 'EEEE, MMM d')}</span>
            <button onClick={() => setIsCreating(c => !c)} className="w-6 h-6 flex items-center justify-center rounded text-[var(--bone-40)] hover:text-accent hover:bg-[var(--bone-6)]">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {isCreating && (
            <div className="flex items-center gap-2 mb-2">
              <input autoFocus value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateTask(); if (e.key === 'Escape') setIsCreating(false); }}
                placeholder="New task title..." className="flex-1 bg-transparent border-b border-[var(--bone-20)] py-1 text-sm text-foreground placeholder-muted-foreground outline-none" />
            </div>
          )}
          {(tasksByDate[selectedDate] ?? []).map(t => (
            <div key={t.id} className="flex items-center gap-2 py-1 text-sm text-foreground">
              <span className={clsx("w-2 h-2 rounded-full shrink-0", STATUS_COLORS[t.status ?? 'todo'])} />
              {t.title}
            </div>
          ))}
          {(tasksByDate[selectedDate] ?? []).length === 0 && !isCreating && (
            <p className="text-xs text-muted-foreground">No tasks — click + to add one.</p>
          )}
        </div>
      )}

      {/* Unscheduled tasks */}
      {unscheduled.length > 0 && (
        <div className="mt-3 shrink-0">
          <div className="text-[10px] font-semibold text-[var(--bone-30)] uppercase tracking-widest mb-1">Unscheduled</div>
          <div className="flex flex-wrap gap-1">
            {unscheduled.slice(0, 8).map(t => (
              <div key={t.id} draggable onDragStart={e => e.dataTransfer.setData('taskId', t.id)}
                className="text-[10px] px-2 py-1 bg-[var(--bone-8)] rounded font-medium text-[var(--bone-60)] cursor-grab hover:bg-[var(--bone-15)]">
                {t.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Import in TrackerPage.tsx**

```tsx
import { TrackerCalendarView } from './TrackerCalendarView';
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Fix any type errors. The `useStore.getState()` call inside the component is intentionally used only for `addTask` side effects — if TypeScript complains, restructure to call `useStore(s => s.addTask)` at the top of the component instead.

- [ ] **Step 4: Browser verify**

Open `/tracker` → click Calendar tab → month grid renders → click a date → popover appears → add a task → it appears on the date → drag task chip to a new date.

- [ ] **Step 5: Commit**

```bash
git add src/components/tracker/TrackerPage.tsx src/components/tracker/TrackerListView.tsx src/components/tracker/TrackerCalendarView.tsx
git commit -m "feat(tracker): add List and Calendar views with task creation and drag-to-reschedule"
```

---

### Task 2.4: Calendar Widget

**Files:**
- Create: `src/components/workspace/widgets/CalendarWidget.tsx`
- Modify: `src/components/bento/registry.tsx`

- [ ] **Step 1: Create CalendarWidget.tsx**

```tsx
"use client";

import { useStore } from '@/data/store';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, addMonths, subMonths } from 'date-fns';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

export function CalendarWidget({ contextId }: { contextId?: string; data?: any; onUpdateData?: (d: any) => void }) {
  const allTasks = useStore(s => s.tasks);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const tasks = useMemo(() =>
    contextId === 'dashboard' ? allTasks : allTasks.filter(t => (t.workspaceId ?? 'ws-personal') === contextId),
    [allTasks, contextId]
  );

  const monthStart = startOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(currentMonth) });
  const startPad = getDay(monthStart);

  const tasksByDate: Record<string, number> = {};
  tasks.forEach(t => { if (t.dueDate) tasksByDate[t.dueDate] = (tasksByDate[t.dueDate] ?? 0) + 1; });

  const handleDayClick = (dateStr: string) => {
    window.location.href = `/tracker?view=calendar&date=${dateStr}`;
  };

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget px-4 pb-4 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => window.location.href = '/tracker?view=calendar'}
          className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground hover:underline">
          Calendar
        </button>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="w-6 h-6 flex items-center justify-center rounded text-[var(--bone-30)] hover:text-foreground hover:bg-[var(--bone-6)]"><ChevronLeft className="w-3.5 h-3.5" /></button>
          <span className="text-xs text-[var(--bone-60)] min-w-[80px] text-center">{format(currentMonth, 'MMM yyyy')}</span>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="w-6 h-6 flex items-center justify-center rounded text-[var(--bone-30)] hover:text-foreground hover:bg-[var(--bone-6)]"><ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center mb-1">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-[9px] font-semibold text-[var(--bone-25)] py-0.5">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 flex-1 gap-px">
        {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const count = tasksByDate[dateStr] ?? 0;
          const todayMark = isToday(day);
          return (
            <button key={dateStr} onClick={() => handleDayClick(dateStr)}
              className={clsx("flex flex-col items-center py-0.5 rounded hover:bg-[var(--bone-6)] transition-colors", todayMark && "bg-accent/10")}>
              <span className={clsx("text-[10px] font-medium w-5 h-5 flex items-center justify-center rounded-full", todayMark ? "bg-accent text-white" : "text-muted-foreground")}>
                {format(day, 'd')}
              </span>
              {count > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <span key={i} className="w-1 h-1 rounded-full bg-accent/60" />
                  ))}
                  {count > 3 && <span className="text-[7px] text-[var(--bone-30)]">+</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Register in registry.tsx**

Add the import and entry:

```tsx
import { CalendarWidget } from '@/components/workspace/widgets/CalendarWidget';
```

In `widgetRegistry`:
```tsx
'calendar': { label: 'Calendar', description: 'Monthly task calendar', component: CalendarWidget, defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4, category: 'Organization' },
```

- [ ] **Step 3: Type-check and verify**

```bash
npx tsc --noEmit
```

Add Calendar widget to dashboard → month grid renders with dots on task dates → clicking header navigates to Tracker calendar view.

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/widgets/CalendarWidget.tsx src/components/bento/registry.tsx
git commit -m "feat: add Calendar widget with month grid and task dots"
```

---

## Phase 3: Notes Scratchpad Widget

### Task 3.1: Extend Entity type for scratchpad flag

**Files:**
- Modify: `src/data/store.types.ts`

- [ ] **Step 1: Add fields to Entity interface**

In `store.types.ts`, find the `Entity` interface and add two optional fields:

```ts
export interface Entity {
  // ... existing fields ...
  isDashboardScratchpad?: boolean;
  scratchpadWidgetId?: string;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

---

### Task 3.2: Create ScratchpadWidget

**Files:**
- Create: `src/components/workspace/widgets/ScratchpadWidget.tsx`
- Modify: `src/components/bento/registry.tsx`

- [ ] **Step 1: Create ScratchpadWidget.tsx**

```tsx
"use client";

import { useStore } from '@/data/store';
import { useMemo, useRef, useEffect, useState } from 'react';
import { generateId } from '@/data/store';
import { ExternalLink } from 'lucide-react';
import clsx from 'clsx';

interface ScratchpadData { noteId?: string; }

export function ScratchpadWidget({ data, onUpdateData, contextId }: {
  data?: ScratchpadData;
  onUpdateData: (d: ScratchpadData) => void;
  contextId?: string;
  isEditing?: boolean;
}) {
  const entities = useStore(s => s.entities);
  const addEntity = useStore(s => s.addEntity);
  const updateEntityContent = useStore(s => s.updateEntityContent);
  const renameEntity = useStore(s => s.renameEntity);
  const setActiveEntityId = useStore(s => s.setActiveEntityId);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);

  const note = useMemo(() => data?.noteId ? entities.find(e => e.id === data.noteId) : null, [entities, data?.noteId]);

  // Auto-create note on first mount if no noteId
  useEffect(() => {
    if (!data?.noteId) {
      const newId = generateId();
      addEntity({
        id: newId,
        title: 'Scratchpad',
        type: 'note',
        parentId: null,
        lastModified: Date.now(),
        workspaceId: contextId === 'dashboard' ? null : (activeWorkspaceId ?? null),
        isDashboardScratchpad: true,
        content: [{ id: generateId(), type: 'text', content: '' }],
      } as any);
      onUpdateData({ noteId: newId });
    }
  }, []);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const noteText = useMemo(() => {
    if (!note?.content) return '';
    return note.content.map((b: any) => b.content ?? '').join('\n');
  }, [note]);

  const [localText, setLocalText] = useState(noteText);

  useEffect(() => { setLocalText(noteText); }, [noteText]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setLocalText(text);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      if (note) {
        updateEntityContent(note.id, [{ id: note.content?.[0]?.id ?? generateId(), type: 'text', content: text }] as any);
      }
    }, 500);
  };

  if (!note) return (
    <section className="bg-sidebar border border-[var(--bone-10)] rounded-[var(--radius-big)] widget-shadow h-full flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading...</p>
    </section>
  );

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget px-4 pb-4 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-2 shrink-0">
        {isEditingTitle ? (
          <input autoFocus value={titleInput}
            onChange={e => setTitleInput(e.target.value)}
            onBlur={() => { renameEntity(note.id, titleInput || 'Scratchpad'); setIsEditingTitle(false); }}
            onKeyDown={e => { if (e.key === 'Enter') { renameEntity(note.id, titleInput || 'Scratchpad'); setIsEditingTitle(false); } }}
            className="flex-1 bg-transparent border-b border-[var(--bone-20)] py-0.5 text-[15px] font-semibold text-foreground outline-none" />
        ) : (
          <button onClick={() => { setTitleInput(note.title); setIsEditingTitle(true); }}
            className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground hover:text-foreground transition-colors text-left">
            {note.title}
          </button>
        )}
        <button onClick={() => setActiveEntityId(note.id)} className="w-6 h-6 flex items-center justify-center rounded text-[var(--bone-30)] hover:text-foreground hover:bg-[var(--bone-6)] opacity-0 group-hover/widget:opacity-100 transition-all">
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
      <textarea
        ref={textAreaRef}
        value={localText}
        onChange={handleTextChange}
        placeholder="Start writing..."
        className="flex-1 w-full bg-transparent resize-none text-sm text-foreground placeholder-muted-foreground outline-none leading-relaxed scrollbar-thin"
      />
    </section>
  );
}
```

- [ ] **Step 2: Register in registry.tsx**

```tsx
import { ScratchpadWidget } from '@/components/workspace/widgets/ScratchpadWidget';
```

```tsx
'scratchpad': { label: 'Scratchpad', description: 'Quick note in a widget', component: ScratchpadWidget, defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4, category: 'General' },
```

- [ ] **Step 3: Type-check and verify**

```bash
npx tsc --noEmit
```

Add Scratchpad widget → a note is auto-created → type text → wait 0.5s → navigate away and back → text persists → click title to rename → open-full icon navigates to the note.

- [ ] **Step 4: Commit**

```bash
git add src/data/store.types.ts src/components/workspace/widgets/ScratchpadWidget.tsx src/components/bento/registry.tsx
git commit -m "feat: add Notes Scratchpad widget with auto-created linked note"
```

---

## Phase 4: Habit Tracker Widget

### Task 4.1: Extend Habit type with frequency model

**Files:**
- Modify: `src/data/store.types.ts`

- [ ] **Step 1: Replace the Habit interface**

Find and replace:
```ts
export interface Habit { id: string; title: string; frequency: string; icon?: string; color?: string; workspaceId?: string; }
```

With:
```ts
export type HabitFrequency = 'daily' | 'weekdays' | 'weekly' | 'xPerWeek';

export interface Habit {
  id: string;
  title: string;
  frequency: HabitFrequency;
  targetDays?: number[];   // 0=Sun…6=Sat; used by 'weekly' and custom 'weekdays'
  targetCount?: number;    // used by 'xPerWeek' (e.g. 3 times/week)
  icon?: string;
  color?: string;
  workspaceId?: string;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Fix any `habit.frequency` usages that relied on `string` — they now need to match `HabitFrequency`. Search:
```bash
grep -rn "habit\.frequency\|lifeHabits" src/ --include="*.ts" --include="*.tsx"
```

Any comparison like `habit.frequency === 'daily'` already works. Callers that set `frequency` as a plain string need updating.

- [ ] **Step 3: Commit**

```bash
git add src/data/store.types.ts
git commit -m "feat(types): extend Habit with typed frequency model (daily/weekdays/weekly/xPerWeek)"
```

---

### Task 4.2: Add habitScheduledForDate helper

**Files:**
- Create: `src/lib/habit-utils.ts`

- [ ] **Step 1: Create the helper**

```ts
import type { Habit } from '@/data/store.types';

/** Returns true if a habit is scheduled for the given date string (YYYY-MM-DD) */
export function habitScheduledForDate(habit: Habit, dateStr: string): boolean {
  const date = new Date(dateStr + 'T12:00:00');
  const dow = date.getDay(); // 0=Sun, 6=Sat

  switch (habit.frequency) {
    case 'daily':
      return true;
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'weekly':
      return (habit.targetDays ?? []).includes(dow);
    case 'xPerWeek':
      return true; // shown every day; completion count tracked elsewhere
    default:
      return true;
  }
}

/** Calculates the current streak for a habit given its check records */
export function habitStreak(habitId: string, checks: Array<{ habitId: string; date: string; done: boolean }>, habit: Habit): number {
  const today = new Date().toISOString().split('T')[0];
  let streak = 0;
  let cursor = new Date(today + 'T12:00:00');

  for (let i = 0; i < 365; i++) {
    const dateStr = cursor.toISOString().split('T')[0];
    if (!habitScheduledForDate(habit, dateStr)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    const check = checks.find(c => c.habitId === habitId && c.date === dateStr);
    if (check?.done) {
      streak++;
    } else if (dateStr !== today) {
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/habit-utils.ts
git commit -m "feat(habits): add habitScheduledForDate and habitStreak helpers"
```

---

### Task 4.3: Create HabitWidget

**Files:**
- Create: `src/components/workspace/widgets/HabitWidget.tsx`
- Modify: `src/components/bento/registry.tsx`

- [ ] **Step 1: Create HabitWidget.tsx**

```tsx
"use client";

import { useStore } from '@/data/store';
import { useMemo, useState } from 'react';
import { Plus, CheckCircle2, Circle, Settings } from 'lucide-react';
import clsx from 'clsx';
import { habitScheduledForDate, habitStreak } from '@/lib/habit-utils';
import { format, startOfWeek, addDays } from 'date-fns';

type HabitView = 'today' | 'week';

export function HabitWidget({ contextId, data, onUpdateData }: {
  contextId?: string;
  data?: { view?: HabitView };
  onUpdateData?: (d: any) => void;
  isEditing?: boolean;
}) {
  const habits = useStore(s => s.lifeHabits);
  const checks = useStore(s => s.lifeHabitChecks);
  const toggleHabitCheck = useStore(s => s.toggleHabitCheck);
  const view: HabitView = data?.view ?? 'today';

  const today = new Date().toISOString().split('T')[0];
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Mon
  const weekDays = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));

  const scopedHabits = useMemo(() =>
    contextId === 'dashboard'
      ? habits
      : habits.filter(h => !h.workspaceId || h.workspaceId === contextId),
    [habits, contextId]
  );

  const todayHabits = useMemo(() =>
    scopedHabits.filter(h => habitScheduledForDate(h, today)),
    [scopedHabits, today]
  );

  const isChecked = (habitId: string, date: string) =>
    checks.find(c => c.habitId === habitId && c.date === date)?.done ?? false;

  const streak = (habitId: string) => habitStreak(habitId, checks, scopedHabits.find(h => h.id === habitId)!);

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground">Habits</h2>
        {onUpdateData && (
          <div className="flex items-center gap-0.5 bg-[var(--bone-6)] rounded-[4px] p-0.5">
            {(['today', 'week'] as HabitView[]).map(v => (
              <button key={v} onClick={() => onUpdateData({ ...data, view: v })}
                className={clsx("px-2 py-0.5 text-[10px] font-semibold rounded-[3px] capitalize transition-colors",
                  view === v ? "bg-[var(--bone-15)] text-[var(--bone-100)]" : "text-[var(--bone-30)] hover:text-[var(--bone-100)]")}>
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {view === 'today' ? (
          <div className="space-y-1">
            {todayHabits.length === 0 && (
              <div className="flex items-center justify-center h-16"><p className="text-sm text-muted-foreground">No habits scheduled today.</p></div>
            )}
            {todayHabits.map(habit => {
              const checked = isChecked(habit.id, today);
              const s = streak(habit.id);
              return (
                <div key={habit.id} className="flex items-center gap-3 px-2 py-2 rounded-[var(--radius-medium)] hover:bg-[var(--bone-6)] transition-all">
                  <button onClick={() => toggleHabitCheck(habit.id, today, !checked)}
                    className={clsx("shrink-0 transition-colors", checked ? "text-accent" : "text-[var(--bone-20)] hover:text-accent")}>
                    {checked ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                  </button>
                  {habit.icon && <span className="text-base shrink-0">{habit.icon}</span>}
                  <span className={clsx("flex-1 text-sm font-medium", checked ? "text-muted-foreground line-through" : "text-foreground")}>
                    {habit.title}
                  </span>
                  {s > 0 && (
                    <span className="text-[10px] font-bold text-[var(--bone-40)] shrink-0">🔥 {s}</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Week view */
          <div className="space-y-2">
            {/* Day headers */}
            <div className="grid grid-cols-[1fr_repeat(7,28px)] gap-1 text-[9px] font-semibold text-[var(--bone-30)] uppercase tracking-wide">
              <div />
              {weekDays.map(d => <div key={d} className="text-center">{format(new Date(d + 'T12:00:00'), 'EEEEE')}</div>)}
            </div>
            {scopedHabits.map(habit => (
              <div key={habit.id} className="grid grid-cols-[1fr_repeat(7,28px)] gap-1 items-center">
                <span className="text-xs text-foreground truncate">{habit.title}</span>
                {weekDays.map(d => {
                  const scheduled = habitScheduledForDate(habit, d);
                  const checked = isChecked(habit.id, d);
                  if (!scheduled) return <div key={d} className="w-5 h-5 mx-auto rounded-full bg-[var(--bone-5)]" />;
                  return (
                    <button key={d} onClick={() => toggleHabitCheck(habit.id, d, !checked)}
                      className={clsx("w-5 h-5 mx-auto rounded-full border transition-colors",
                        checked ? "bg-accent border-accent" : "border-[var(--bone-20)] hover:border-accent")}>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 shrink-0">
        <button className="w-full py-1.5 text-[10px] font-semibold text-[var(--bone-30)] hover:text-foreground hover:bg-[var(--bone-6)] rounded-[var(--radius-small)] transition-colors flex items-center justify-center gap-1">
          <Plus className="w-3 h-3" /> Manage Habits
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Register in registry.tsx**

```tsx
import { HabitWidget } from '@/components/workspace/widgets/HabitWidget';
```

```tsx
'habits': { label: 'Habits', description: 'Daily habit tracker', component: HabitWidget, defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4, category: 'General' },
```

- [ ] **Step 3: Type-check and verify**

```bash
npx tsc --noEmit
```

Add some habits via the existing habits system (store `addHabit`) → add Habit widget to dashboard → Today view shows habits with check circles → Week view shows 7-column grid → streak badge appears after consecutive completions.

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/widgets/HabitWidget.tsx src/components/bento/registry.tsx
git commit -m "feat: add Habit Tracker widget with today/week views and streak badges"
```

---

## Phase 5: Analytics Widgets

### Task 5.1: Task Productivity bar chart widget

**Files:**
- Create: `src/components/workspace/widgets/TaskProductivityWidget.tsx`
- Modify: `src/components/bento/registry.tsx`

- [ ] **Step 1: Create TaskProductivityWidget.tsx**

```tsx
"use client";

import { useStore } from '@/data/store';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { subDays, format } from 'date-fns';

type Range = '7d' | '30d';

export function TaskProductivityWidget({ contextId, data, onUpdateData }: {
  contextId?: string;
  data?: { range?: Range };
  onUpdateData?: (d: any) => void;
  isEditing?: boolean;
}) {
  const tasks = useStore(s => s.tasks);
  const range: Range = data?.range ?? '7d';
  const days = range === '7d' ? 7 : 30;
  const today = new Date();

  const chartData = useMemo(() => {
    const scoped = contextId === 'dashboard' ? tasks : tasks.filter(t => (t.workspaceId ?? 'ws-personal') === contextId);
    return Array.from({ length: days }, (_, i) => {
      const date = subDays(today, days - 1 - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const label = days === 7 ? format(date, 'EEE') : format(date, 'M/d');
      const count = scoped.filter(t => t.completed && t.dueDate === dateStr).length;
      return { label, count, dateStr };
    });
  }, [tasks, contextId, range]);

  const maxCount = Math.max(...chartData.map(d => d.count), 1);
  const todayStr = format(today, 'yyyy-MM-dd');

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground">Task Productivity</h2>
        {onUpdateData && (
          <div className="flex items-center gap-0.5 bg-[var(--bone-6)] rounded-[4px] p-0.5">
            {(['7d', '30d'] as Range[]).map(r => (
              <button key={r} onClick={() => onUpdateData({ ...data, range: r })}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-[3px] transition-colors ${range === r ? 'bg-[var(--bone-15)] text-[var(--bone-100)]' : 'text-[var(--bone-30)] hover:text-[var(--bone-100)]'}`}>
                {r}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--bone-40)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--bone-40)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: 'var(--color-panel)', border: '1px solid var(--bone-10)', borderRadius: 8, fontSize: 11 }}
              cursor={{ fill: 'var(--bone-5)' }}
              formatter={(v: number) => [v, 'tasks completed']}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.dateStr} fill={entry.dateStr === todayStr ? 'var(--accent)' : 'var(--bone-20)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Register in registry.tsx**

```tsx
import { TaskProductivityWidget } from '@/components/workspace/widgets/TaskProductivityWidget';
```

```tsx
'task-productivity': { label: 'Task Productivity', description: 'Completed tasks per day', component: TaskProductivityWidget, defaultW: 4, defaultH: 2, minW: 4, minH: 2, maxW: 6, maxH: 3, category: 'General' },
```

- [ ] **Step 3: Type-check and verify**

```bash
npx tsc --noEmit
```

Add widget → bar chart renders → toggle 7d/30d → bars show completed tasks per day.

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/widgets/TaskProductivityWidget.tsx src/components/bento/registry.tsx
git commit -m "feat: add Task Productivity bar chart analytics widget"
```

---

### Task 5.2: Habit Consistency heatmap widget

**Files:**
- Create: `src/components/workspace/widgets/HabitConsistencyWidget.tsx`
- Modify: `src/components/bento/registry.tsx`

- [ ] **Step 1: Create HabitConsistencyWidget.tsx**

```tsx
"use client";

import { useStore } from '@/data/store';
import { useMemo } from 'react';
import { subDays, format } from 'date-fns';
import { habitScheduledForDate } from '@/lib/habit-utils';
import clsx from 'clsx';

export function HabitConsistencyWidget({ contextId }: { contextId?: string; data?: any; onUpdateData?: (d: any) => void; isEditing?: boolean }) {
  const habits = useStore(s => s.lifeHabits);
  const checks = useStore(s => s.lifeHabitChecks);

  const scopedHabits = useMemo(() =>
    contextId === 'dashboard' ? habits : habits.filter(h => !h.workspaceId || h.workspaceId === contextId),
    [habits, contextId]
  );

  const today = new Date();
  const WEEKS = 12;
  const DAYS = WEEKS * 7;

  const cells = useMemo(() => {
    return Array.from({ length: DAYS }, (_, i) => {
      const date = subDays(today, DAYS - 1 - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const scheduled = scopedHabits.filter(h => habitScheduledForDate(h, dateStr));
      if (scheduled.length === 0) return { dateStr, pct: -1, label: null }; // not applicable
      const done = scheduled.filter(h => checks.find(c => c.habitId === h.id && c.date === dateStr && c.done)).length;
      const pct = done / scheduled.length;
      return { dateStr, pct, label: `${format(date, 'MMM d')}: ${done}/${scheduled.length} done` };
    });
  }, [scopedHabits, checks]);

  const colorClass = (pct: number) => {
    if (pct < 0) return 'bg-[var(--bone-5)]';
    if (pct === 0) return 'bg-[var(--bone-8)]';
    if (pct < 0.25) return 'bg-accent/20';
    if (pct < 0.5) return 'bg-accent/40';
    if (pct < 0.75) return 'bg-accent/60';
    return 'bg-accent/90';
  };

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="mb-3 shrink-0">
        <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground">Habit Consistency</h2>
        <p className="text-[10px] text-[var(--bone-30)] mt-0.5">Last {WEEKS} weeks</p>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${WEEKS}, 1fr)`, gridTemplateRows: 'repeat(7, 1fr)', height: '100%' }}>
          {cells.map(cell => (
            <div key={cell.dateStr} title={cell.label ?? undefined}
              className={clsx('rounded-[2px] cursor-default transition-opacity hover:opacity-80', colorClass(cell.pct))} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2 shrink-0">
        <span className="text-[9px] text-[var(--bone-30)]">0%</span>
        {[0, 0.25, 0.5, 0.75, 1].map(p => (
          <div key={p} className={clsx('w-3 h-3 rounded-[2px]', colorClass(p))} />
        ))}
        <span className="text-[9px] text-[var(--bone-30)]">100%</span>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Register in registry.tsx**

```tsx
import { HabitConsistencyWidget } from '@/components/workspace/widgets/HabitConsistencyWidget';
```

```tsx
'habit-consistency': { label: 'Habit Consistency', description: 'Habit completion heatmap', component: HabitConsistencyWidget, defaultW: 4, defaultH: 2, minW: 4, minH: 2, maxW: 6, maxH: 3, category: 'General' },
```

- [ ] **Step 3: Type-check and verify**

```bash
npx tsc --noEmit
```

Add widget → 12-week heatmap renders → hover cells shows date + count → color intensity reflects completion %.

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/widgets/HabitConsistencyWidget.tsx src/components/bento/registry.tsx
git commit -m "feat: add Habit Consistency heatmap analytics widget"
```

---

### Task 5.3: Notes Activity area chart widget

**Files:**
- Create: `src/components/workspace/widgets/NotesActivityWidget.tsx`
- Modify: `src/components/bento/registry.tsx`

- [ ] **Step 1: Create NotesActivityWidget.tsx**

```tsx
"use client";

import { useStore } from '@/data/store';
import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { subDays, format } from 'date-fns';

type Range = '7d' | '30d';

export function NotesActivityWidget({ contextId, data, onUpdateData }: {
  contextId?: string;
  data?: { range?: Range };
  onUpdateData?: (d: any) => void;
  isEditing?: boolean;
}) {
  const entities = useStore(s => s.entities);
  const range: Range = data?.range ?? '30d';
  const days = range === '7d' ? 7 : 30;
  const today = new Date();

  const notes = useMemo(() =>
    entities.filter(e => ['note', 'canvas'].includes(e.type) &&
      (contextId === 'dashboard' || e.workspaceId === contextId)),
    [entities, contextId]
  );

  const chartData = useMemo(() =>
    Array.from({ length: days }, (_, i) => {
      const date = subDays(today, days - 1 - i);
      const startMs = date.setHours(0, 0, 0, 0);
      const endMs = startMs + 86400000;
      const count = notes.filter(n => n.lastModified >= startMs && n.lastModified < endMs).length;
      return { label: days === 7 ? format(new Date(startMs), 'EEE') : format(new Date(startMs), 'M/d'), count };
    }),
    [notes, range]
  );

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground">Notes Activity</h2>
        {onUpdateData && (
          <div className="flex items-center gap-0.5 bg-[var(--bone-6)] rounded-[4px] p-0.5">
            {(['7d', '30d'] as Range[]).map(r => (
              <button key={r} onClick={() => onUpdateData({ ...data, range: r })}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-[3px] transition-colors ${range === r ? 'bg-[var(--bone-15)] text-[var(--bone-100)]' : 'text-[var(--bone-30)] hover:text-[var(--bone-100)]'}`}>
                {r}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id="notesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--bone-40)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--bone-40)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: 'var(--color-panel)', border: '1px solid var(--bone-10)', borderRadius: 8, fontSize: 11 }}
              cursor={{ stroke: 'var(--bone-20)', strokeWidth: 1 }}
              formatter={(v: number) => [v, 'notes modified']}
            />
            <Area type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={1.5} fill="url(#notesGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Register in registry.tsx**

```tsx
import { NotesActivityWidget } from '@/components/workspace/widgets/NotesActivityWidget';
```

```tsx
'notes-activity': { label: 'Notes Activity', description: 'Notes created/edited per day', component: NotesActivityWidget, defaultW: 4, defaultH: 2, minW: 4, minH: 2, maxW: 6, maxH: 3, category: 'General' },
```

- [ ] **Step 3: Type-check and verify**

```bash
npx tsc --noEmit
```

Add widget → area chart renders with gradient fill → hover shows count → range toggle works.

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/widgets/NotesActivityWidget.tsx src/components/bento/registry.tsx
git commit -m "feat: add Notes Activity area chart analytics widget"
```

---

## Phase 6: Widget Link / Alias System

### Task 6.1: Extend BentoLayoutItem with link support

**Files:**
- Modify: `src/components/bento/types.ts`

- [ ] **Step 1: Add sourceWidgetId to BentoLayoutItem**

```ts
export interface BentoLayoutItem {
  i: string;
  type: string;
  row: number;
  order: number;
  w: number;
  h: number;
  data?: any;
  sourceWidgetId?: string; // set = linked (read-only) alias of another widget instance
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/bento/types.ts
git commit -m "feat(bento-types): add sourceWidgetId for widget link/alias support"
```

---

### Task 6.2: Add link UI to useBentoLayout

**Files:**
- Modify: `src/hooks/useBentoLayout.ts`

- [ ] **Step 1: Add linkWidget action**

At the bottom of the returned object from `useBentoLayout`, add:

```ts
linkWidget: (instanceId: string, sourceId: string) => {
  commitLayout(layout.map(it =>
    it.i === instanceId ? { ...it, sourceWidgetId: sourceId } : it
  ));
},

unlinkWidget: (instanceId: string) => {
  commitLayout(layout.map(it => {
    if (it.i !== instanceId) return it;
    const { sourceWidgetId: _, ...rest } = it;
    return rest;
  }));
},
```

Where `commitLayout` is the existing helper that pushes to undo stack and saves. If no such helper exists, replicate the pattern of existing state mutations (push old layout to undoStack, call `setLayout`, call `debounceSave`).

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

---

### Task 6.3: Show link badge and block writes in BentoWidget

**Files:**
- Modify: `src/components/bento/BentoWidget.tsx`

- [ ] **Step 1: Detect linked widgets and block onUpdateData**

In `BentoWidget`, after the `entry` lookup:

```tsx
const isLinked = !!item.sourceWidgetId;

// If linked, resolve the source widget's data for display
const sourceData = isLinked
  ? layout.find(it => it.i === item.sourceWidgetId)?.data
  : item.data;
```

Note: `layout` is not currently a prop of `BentoWidget`. Either:
- Pass it from `BentoDashboard` as a new prop, OR
- Use a Zustand-based layout store if one exists

The simpler approach: pass `sourceData` as a resolved prop from `BentoDashboard` when rendering each widget. In `BentoDashboard.tsx`, when rendering `<BentoWidget>`:

```tsx
const resolvedData = item.sourceWidgetId
  ? layout.find(it => it.i === item.sourceWidgetId)?.data
  : item.data;
```

Pass `resolvedData` to `BentoWidget` as `resolvedData` prop, and use it instead of `item.data` when calling `<WidgetComponent data={resolvedData} .../>`.

- [ ] **Step 2: Block writes for linked widgets**

In `BentoWidget`, when the widget is linked, pass a no-op `onUpdateData`:

```tsx
<WidgetComponent
  contextId={contextId}
  data={resolvedData}
  onUpdateData={isLinked ? () => {} : onUpdateData}
  isEditing={editMode}
/>
```

- [ ] **Step 3: Show link badge**

In `BentoWidget`, add a small badge in edit mode:

```tsx
{editMode && isLinked && (
  <div className="absolute bottom-2 left-2 z-30 flex items-center gap-1 px-1.5 py-0.5 bg-background/80 backdrop-blur-sm border border-border rounded-md text-[9px] font-semibold text-muted-foreground">
    <Link2 className="w-2.5 h-2.5" />
    Linked
  </div>
)}
```

Add `Link2` import from `lucide-react`.

- [ ] **Step 4: Type-check and verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/bento/BentoWidget.tsx src/components/bento/BentoDashboard.tsx src/hooks/useBentoLayout.ts
git commit -m "feat(bento): add widget link/alias system — linked widgets display source data read-only"
```

---

### Task 6.4: Add Link/Unlink to WidgetPicker or context menu

**Files:**
- Modify: `src/components/bento/WidgetPicker.tsx`

- [ ] **Step 1: Read the current WidgetPicker**

```bash
cat src/components/bento/WidgetPicker.tsx
```

Find where the picker is rendered and where widget instances are listed. Add a "Link existing widget" flow:

1. When in edit mode, show a chain icon button on each widget (alongside the remove X button)
2. Clicking it opens a small popover listing other widget instances of the same type
3. Selecting a source calls `linkWidget(currentId, sourceId)`

This UI varies depending on WidgetPicker's current implementation — adapt to the existing pattern. The key is calling `linkWidget` from `useBentoLayout` with the right IDs.

- [ ] **Step 2: Type-check and verify**

```bash
npx tsc --noEmit
```

Add two Tasks widgets → link one to the other → confirm linked widget shows same data → editing data in source widget updates linked widget → linked widget shows "Linked" badge in edit mode.

- [ ] **Step 3: Commit**

```bash
git add src/components/bento/WidgetPicker.tsx
git commit -m "feat(widget-picker): add link/unlink UI for widget alias system"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Phase 0 (isEditing wire-up), Phase 1 (8 widgets), Phase 2 (Tracker views + Calendar widget), Phase 3 (Scratchpad), Phase 4 (Habit model + widget), Phase 5 (3 analytics), Phase 6 (link system) — all spec sections covered.
- [x] **No placeholders:** All tasks have real code or explicit file-read instructions before adaptation steps.
- [x] **Type consistency:** `HabitFrequency` defined in Task 4.1, used in `habitScheduledForDate` (Task 4.2) and `HabitWidget` (Task 4.3). `sourceWidgetId` defined in Task 6.1, used in Tasks 6.2–6.4. `BentoLayoutItem.data` typed as `any` throughout per existing convention.
- [x] **Recharts:** Already in `package.json` — no install needed.
- [x] **react-day-picker + date-fns:** Already in `package.json` — no install needed.
- [x] **No test framework:** Replaced TDD steps with `npx tsc --noEmit` + manual browser verification.
