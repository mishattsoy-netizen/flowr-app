# Bento Dashboard — Edit Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing custom drag-grid in Dashboard and WorkspacePage with a `react-grid-layout`-powered Bento system that supports drag, resize, a widget picker, and per-user Supabase-persisted layouts.

**Architecture:** A shared `BentoDashboard` component wraps `react-grid-layout`. A `useBentoLayout` hook owns layout state, loads from Supabase on mount, and debounce-saves on change. Both Dashboard and WorkspacePage are refactored to render `BentoDashboard` with a scoped `contextId` instead of their current custom grid implementations.

**Tech Stack:** React 19, Next.js, TypeScript, Tailwind CSS v4, `react-grid-layout`, GSAP, Supabase, Zustand (for editMode only)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/components/bento/types.ts` | `BentoLayoutItem` type |
| Create | `src/components/bento/registry.tsx` | Widget type → component mapping |
| Create | `src/lib/bento-sync.ts` | Supabase fetch/upsert for `bento_layouts` |
| Create | `src/hooks/useBentoLayout.ts` | Layout state, edit mode, Supabase sync |
| Create | `src/components/bento/BentoWidget.tsx` | Per-widget wrapper (remove button, edit overlay) |
| Create | `src/components/bento/BentoDashboard.tsx` | `react-grid-layout` container + header |
| Create | `src/components/bento/WidgetPicker.tsx` | Slide-in panel with click-to-add and drag-to-place |
| Create | `supabase/migrations/20260420_bento_layouts.sql` | DB migration |
| Modify | `src/components/dashboard/Dashboard.tsx` | Replace custom grid with `BentoDashboard` |
| Modify | `src/components/workspace/WorkspacePage.tsx` | Replace custom grid with `BentoDashboard` |

---

## Task 1: Install `react-grid-layout`

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install the package**

```bash
npm install react-grid-layout
npm install --save-dev @types/react-grid-layout
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('react-grid-layout'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-grid-layout"
```

---

## Task 2: Supabase migration

**Files:**
- Create: `supabase/migrations/20260420_bento_layouts.sql`

- [ ] **Step 1: Create the SQL file**

Create `supabase/migrations/20260420_bento_layouts.sql` with:

```sql
create table if not exists public.bento_layouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  context_id  text not null,
  layout      jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

create unique index if not exists bento_layouts_user_context
  on public.bento_layouts(user_id, context_id);

alter table public.bento_layouts enable row level security;

create policy "Users manage own layouts"
  on public.bento_layouts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Run in Supabase SQL editor**

Open the Supabase dashboard → SQL editor → paste and run the file contents. Confirm the `bento_layouts` table appears in Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260420_bento_layouts.sql
git commit -m "feat: add bento_layouts table migration"
```

---

## Task 3: Types + Supabase sync helpers

**Files:**
- Create: `src/components/bento/types.ts`
- Create: `src/lib/bento-sync.ts`

- [ ] **Step 1: Create `src/components/bento/types.ts`**

```ts
export interface BentoLayoutItem {
  i: string;    // unique instance UUID
  type: string; // key in widget registry
  x: number;
  y: number;
  w: number;
  h: number;
}
```

- [ ] **Step 2: Create `src/lib/bento-sync.ts`**

```ts
import { supabase } from './supabase';
import type { BentoLayoutItem } from '@/components/bento/types';

export async function loadBentoLayout(contextId: string): Promise<BentoLayoutItem[] | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('bento_layouts')
    .select('layout')
    .eq('user_id', user.id)
    .eq('context_id', contextId)
    .maybeSingle();

  if (error || !data) return null;
  return data.layout as BentoLayoutItem[];
}

export async function saveBentoLayout(contextId: string, layout: BentoLayoutItem[]): Promise<void> {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('bento_layouts')
    .upsert(
      { user_id: user.id, context_id: contextId, layout, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,context_id' }
    );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in the two new files.

- [ ] **Step 4: Commit**

```bash
git add src/components/bento/types.ts src/lib/bento-sync.ts
git commit -m "feat: bento types and supabase sync helpers"
```

---

## Task 4: Widget registry

**Files:**
- Create: `src/components/bento/registry.tsx`

- [ ] **Step 1: Create `src/components/bento/registry.tsx`**

```tsx
import { ComponentType } from 'react';

// Dashboard widgets
import { ClockWidget } from '@/components/workspace/widgets/ClockWidget';

// Workspace widgets
import { AllFilesWidget } from '@/components/workspace/widgets/AllFilesWidget';
import { TasksWidget } from '@/components/workspace/widgets/TasksWidget';
import { QuickLinksWidget } from '@/components/workspace/widgets/QuickLinksWidget';
import { TimerWidget } from '@/components/workspace/widgets/TimerWidget';

// Life mode widgets
import { HabitGridWidget } from '@/components/modes/life/widgets/HabitGridWidget';
import { MoodWidget } from '@/components/modes/life/widgets/MoodWidget';
import { JournalWidget } from '@/components/modes/life/widgets/JournalWidget';
import { GoalsWidget } from '@/components/modes/life/widgets/GoalsWidget';
import { RoutinesWidget } from '@/components/modes/life/widgets/RoutinesWidget';
import { PlannerWidget } from '@/components/modes/life/widgets/PlannerWidget';
import { TodayOverviewWidget } from '@/components/modes/life/widgets/TodayOverviewWidget';

// Knowledge widgets
import { TopicBrowserWidget } from '@/components/modes/knowledge/widgets/TopicBrowserWidget';
import { KnowledgeSearchWidget } from '@/components/modes/knowledge/widgets/KnowledgeSearchWidget';
import { TagIndexWidget } from '@/components/modes/knowledge/widgets/TagIndexWidget';

export interface WidgetRegistryEntry {
  label: string;
  description: string;
  component: ComponentType<any>;
  defaultW: number;
  defaultH: number;
}

export const widgetRegistry: Record<string, WidgetRegistryEntry> = {
  'clock':            { label: 'Clock',           description: 'Live clock',                    component: ClockWidget,           defaultW: 1, defaultH: 2 },
  'timer':            { label: 'Timer',            description: 'Focus timer',                   component: TimerWidget,           defaultW: 1, defaultH: 2 },
  'all-files':        { label: 'All Files',        description: 'Quick access to all files',     component: AllFilesWidget,        defaultW: 2, defaultH: 3 },
  'tasks':            { label: 'Tasks',            description: 'Global task list',              component: TasksWidget,           defaultW: 2, defaultH: 3 },
  'quick-links':      { label: 'Quick Links',      description: 'Bookmark shortcuts',            component: QuickLinksWidget,      defaultW: 1, defaultH: 2 },
  'habit-grid':       { label: 'Habit Grid',       description: 'Daily habit tracker',           component: HabitGridWidget,       defaultW: 2, defaultH: 3 },
  'mood':             { label: 'Mood',             description: 'Daily mood check-in',           component: MoodWidget,            defaultW: 1, defaultH: 2 },
  'journal':          { label: 'Journal',          description: 'Daily journal prompt',          component: JournalWidget,         defaultW: 2, defaultH: 3 },
  'goals':            { label: 'Goals',            description: 'Active goals',                  component: GoalsWidget,           defaultW: 2, defaultH: 3 },
  'routines':         { label: 'Routines',         description: 'Daily routine checklist',       component: RoutinesWidget,        defaultW: 2, defaultH: 2 },
  'planner':          { label: 'Planner',          description: 'Week planner',                  component: PlannerWidget,         defaultW: 3, defaultH: 3 },
  'today-overview':   { label: 'Today Overview',   description: 'Today at a glance',             component: TodayOverviewWidget,   defaultW: 2, defaultH: 2 },
  'topic-browser':    { label: 'Topic Browser',    description: 'Browse knowledge topics',       component: TopicBrowserWidget,    defaultW: 2, defaultH: 3 },
  'knowledge-search': { label: 'Knowledge Search', description: 'Search your knowledge base',   component: KnowledgeSearchWidget, defaultW: 2, defaultH: 2 },
  'tag-index':        { label: 'Tag Index',        description: 'Browse by tag',                 component: TagIndexWidget,        defaultW: 1, defaultH: 3 },
};
```

- [ ] **Step 2: Check for missing widget imports**

Run `npx tsc --noEmit`. If any widget import path doesn't exist, comment it out in the registry for now with a `// TODO: add when available` note.

- [ ] **Step 3: Commit**

```bash
git add src/components/bento/registry.tsx
git commit -m "feat: bento widget registry"
```

---

## Task 5: `useBentoLayout` hook

**Files:**
- Create: `src/hooks/useBentoLayout.ts`

- [ ] **Step 1: Create the hook**

```ts
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Layout } from 'react-grid-layout';
import type { BentoLayoutItem } from '@/components/bento/types';
import { widgetRegistry } from '@/components/bento/registry';
import { loadBentoLayout, saveBentoLayout } from '@/lib/bento-sync';

const DEFAULT_LAYOUTS: Record<string, BentoLayoutItem[]> = {
  dashboard: [
    { i: 'default-today',  type: 'today-overview', x: 0, y: 0, w: 2, h: 2 },
    { i: 'default-clock',  type: 'clock',           x: 2, y: 0, w: 1, h: 2 },
    { i: 'default-habits', type: 'habit-grid',      x: 0, y: 2, w: 2, h: 3 },
    { i: 'default-mood',   type: 'mood',            x: 2, y: 2, w: 1, h: 2 },
  ],
};

export function useBentoLayout(contextId: string) {
  const [layout, setLayout] = useState<BentoLayoutItem[]>(
    DEFAULT_LAYOUTS[contextId] ?? []
  );
  const [editMode, setEditMode] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    loadBentoLayout(contextId).then(saved => {
      if (saved && saved.length > 0) setLayout(saved);
    });
  }, [contextId]);

  const handleLayoutChange = useCallback((rglLayout: Layout[]) => {
    const merged: BentoLayoutItem[] = rglLayout.map(item => ({
      ...(layoutRef.current.find(l => l.i === item.i) ?? { i: item.i, type: 'unknown' }),
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    })).filter(item => item.type !== 'unknown');

    setLayout(merged);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveBentoLayout(contextId, merged);
    }, 800);
  }, [contextId]);

  const addWidget = useCallback((type: string, x?: number, y?: number) => {
    const entry = widgetRegistry[type];
    if (!entry) return;
    const newItem: BentoLayoutItem = {
      i: crypto.randomUUID(),
      type,
      x: x ?? 0,
      y: y ?? Infinity,
      w: entry.defaultW,
      h: entry.defaultH,
    };
    setLayout(prev => {
      const next = [...prev, newItem];
      saveBentoLayout(contextId, next);
      return next;
    });
  }, [contextId]);

  const removeWidget = useCallback((instanceId: string) => {
    setLayout(prev => {
      const next = prev.filter(item => item.i !== instanceId);
      saveBentoLayout(contextId, next);
      return next;
    });
  }, [contextId]);

  const toggleEditMode = useCallback(() => setEditMode(e => !e), []);

  return { layout, editMode, toggleEditMode, handleLayoutChange, addWidget, removeWidget };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useBentoLayout.ts
git commit -m "feat: useBentoLayout hook with supabase sync"
```

---

## Task 6: `BentoWidget` wrapper

**Files:**
- Create: `src/components/bento/BentoWidget.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import gsap from 'gsap';
import { widgetRegistry } from './registry';
import type { BentoLayoutItem } from './types';

interface BentoWidgetProps {
  item: BentoLayoutItem;
  editMode: boolean;
  onRemove: () => void;
}

export function BentoWidget({ item, editMode, onRemove }: BentoWidgetProps) {
  const entry = widgetRegistry[item.type];
  const ref = useRef<HTMLDivElement>(null);

  // Entrance animation when first mounted
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.2, ease: 'power2.out' });
  }, []);

  if (!entry) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground bg-white/5 rounded-xl border border-white/10">
        Unknown widget
      </div>
    );
  }

  const WidgetComponent = entry.component;

  return (
    <div
      ref={ref}
      className={clsx(
        'h-full relative group/bento-widget',
        editMode && 'cursor-grab active:cursor-grabbing ring-1 ring-border ring-offset-1 ring-offset-background rounded-xl'
      )}
    >
      <WidgetComponent />
      {editMode && (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="absolute top-2 right-2 z-30 opacity-0 group-hover/bento-widget:opacity-100 transition-opacity p-1.5 bg-background/80 backdrop-blur-sm border border-border rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bento/BentoWidget.tsx
git commit -m "feat: BentoWidget wrapper with entrance animation and remove button"
```

---

## Task 7: `WidgetPicker` panel

**Files:**
- Create: `src/components/bento/WidgetPicker.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import clsx from 'clsx';
import { widgetRegistry } from './registry';

interface WidgetPickerProps {
  open: boolean;
  onAdd: (type: string) => void;
  onDragStart: (type: string) => void;
  onDragEnd: () => void;
}

export function WidgetPicker({ open, onAdd, onDragStart, onDragEnd }: WidgetPickerProps) {
  return (
    <div
      className={clsx(
        'h-full bg-sidebar border-l border-border transition-[width] duration-300 overflow-hidden shrink-0',
        open ? 'w-[260px]' : 'w-0'
      )}
    >
      <div className="w-[260px] h-full flex flex-col p-4">
        <h3 className="text-[15px] font-semibold text-foreground mb-4">Add Widgets</h3>
        <div className="flex-1 overflow-y-auto space-y-2">
          {Object.entries(widgetRegistry).map(([type, entry]) => (
            <div
              key={type}
              draggable
              onDragStart={() => onDragStart(type)}
              onDragEnd={onDragEnd}
              onClick={() => onAdd(type)}
              className="w-full text-left p-3 rounded-lg border border-border/50 hover:border-border hover:bg-white/5 cursor-grab active:cursor-grabbing select-none"
            >
              <p className="text-sm font-medium text-foreground">{entry.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {entry.defaultW}×{entry.defaultH} default
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bento/WidgetPicker.tsx
git commit -m "feat: WidgetPicker panel with drag-to-place support"
```

---

## Task 8: `BentoDashboard` component

**Files:**
- Create: `src/components/bento/BentoDashboard.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import GridLayout, { WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { Settings2, Check } from 'lucide-react';
import clsx from 'clsx';
import gsap from 'gsap';
import { useBentoLayout } from '@/hooks/useBentoLayout';
import { widgetRegistry } from './registry';
import { BentoWidget } from './BentoWidget';
import { WidgetPicker } from './WidgetPicker';

const SizedGridLayout = WidthProvider(GridLayout);

interface BentoDashboardProps {
  contextId: string;
  header?: React.ReactNode;
}

export function BentoDashboard({ contextId, header }: BentoDashboardProps) {
  const { layout, editMode, toggleEditMode, handleLayoutChange, addWidget, removeWidget } = useBentoLayout(contextId);
  const [droppingType, setDroppingType] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Settle animation when exiting edit mode
  const prevEditMode = useRef(editMode);
  useEffect(() => {
    if (prevEditMode.current && !editMode && gridRef.current) {
      const widgets = gridRef.current.querySelectorAll<HTMLElement>('.react-grid-item');
      gsap.fromTo(widgets, { scale: 1.02 }, { scale: 1, duration: 0.15, ease: 'power2.out', stagger: 0.02 });
    }
    prevEditMode.current = editMode;
  }, [editMode]);

  const handleDrop = useCallback((_: unknown, item: { x: number; y: number; w: number; h: number }) => {
    if (!droppingType) return;
    addWidget(droppingType, item.x, item.y);
    setDroppingType(null);
  }, [droppingType, addWidget]);

  const droppingItem = droppingType
    ? { i: '__dropping__', w: widgetRegistry[droppingType]?.defaultW ?? 1, h: widgetRegistry[droppingType]?.defaultH ?? 2 }
    : undefined;

  return (
    <div className="flex-1 flex flex-row overflow-hidden h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="px-10 py-8 max-w-6xl mx-auto">
          <header className="flex items-center justify-between mb-8">
            <div className="flex-1">{header}</div>
            <button
              onClick={toggleEditMode}
              className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                editMode
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-sidebar border border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {editMode ? <><Check className="w-4 h-4" /> Done</> : <><Settings2 className="w-4 h-4" /> Edit Layout</>}
            </button>
          </header>

          {editMode && (
            <div className="mb-4 px-3 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground text-center">
              Drag widgets to rearrange · Resize from the corner · Drop from panel to place
            </div>
          )}

          <div ref={gridRef}>
            <SizedGridLayout
              layout={layout}
              cols={3}
              rowHeight={120}
              margin={[8, 8]}
              isDraggable={editMode}
              isResizable={editMode}
              isDroppable={editMode}
              droppingItem={droppingItem}
              onLayoutChange={handleLayoutChange}
              onDrop={handleDrop}
              resizeHandles={['se']}
              className={clsx(editMode && 'bento-edit-mode')}
            >
              {layout.map(item => (
                <div key={item.i}>
                  <BentoWidget
                    item={item}
                    editMode={editMode}
                    onRemove={() => removeWidget(item.i)}
                  />
                </div>
              ))}
            </SizedGridLayout>
          </div>
        </div>
      </div>

      <WidgetPicker
        open={editMode}
        onAdd={addWidget}
        onDragStart={setDroppingType}
        onDragEnd={() => setDroppingType(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add edit mode CSS to global styles**

Open the project's global CSS file (likely `src/app/globals.css`) and add at the bottom:

```css
/* Bento edit mode — dashed widget outlines */
.bento-edit-mode .react-grid-item {
  outline: 1px dashed hsl(var(--border));
  outline-offset: -1px;
}

/* Override react-grid-layout placeholder color */
.react-grid-item.react-grid-placeholder {
  background: hsl(var(--accent) / 0.15) !important;
  border: 1px dashed hsl(var(--accent)) !important;
  border-radius: 0.75rem !important;
  opacity: 1 !important;
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/bento/BentoDashboard.tsx src/app/globals.css
git commit -m "feat: BentoDashboard component with react-grid-layout"
```

---

## Task 9: Integrate into Dashboard

**Files:**
- Modify: `src/components/dashboard/Dashboard.tsx`

The goal is to replace the existing 12-column custom grid, `useWidgetDrag`, and picker sidebar with `BentoDashboard`. Keep the welcome header and the new-item/new-task buttons.

- [ ] **Step 1: Replace Dashboard grid section**

Open `src/components/dashboard/Dashboard.tsx`. Replace the entire file content with:

```tsx
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '@/data/store';
import { BentoDashboard } from '@/components/bento/BentoDashboard';

export function Dashboard() {
  const openModal = useStore(state => state.openModal);
  const now = new Date();

  const header = (
    <div className="flex items-end justify-between w-full">
      <div>
        <h1 className="text-4xl font-display text-foreground mb-1">Welcome back, Misha</h1>
        <p className="text-muted-foreground text-sm font-medium">
          {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(now)}
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={() => openModal({ kind: 'newItem' })} className="btn-accent">
          <Plus strokeWidth={2} className="w-4 h-4" /> New Item
        </button>
        <button onClick={() => openModal({ kind: 'newTask' })} className="btn-task">
          <Plus strokeWidth={2} className="w-4 h-4" /> New Task
        </button>
      </div>
    </div>
  );

  return <BentoDashboard contextId="dashboard" header={header} />;
}
```

- [ ] **Step 2: Start the dev server and open the dashboard**

```bash
npm run dev
```

Open `http://localhost:3000/app`. Verify:
- Dashboard renders without errors
- Default widgets appear in a 3-column grid
- "Edit Layout" button is visible top-right
- Clicking "Edit Layout" shows dashed widget outlines, "Done" button, and the picker panel slides in

- [ ] **Step 3: Test drag, resize, remove**

With Edit Mode ON:
- Drag a widget to a new position — it should snap to grid cells with a placeholder preview
- Drag a widget corner to resize — it should snap to row height increments
- Click × on a widget — it should disappear
- Drag a widget card from the picker panel onto the grid — it should appear at the drop position
- Click a widget card in the picker — it should appear at the bottom of the grid

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/Dashboard.tsx
git commit -m "feat: replace Dashboard custom grid with BentoDashboard"
```

---

## Task 10: Integrate into WorkspacePage

**Files:**
- Modify: `src/components/workspace/WorkspacePage.tsx`

- [ ] **Step 1: Find the grid section in WorkspacePage**

Open `src/components/workspace/WorkspacePage.tsx`. Locate the `return` statement. The structure mirrors `Dashboard.tsx` with a 12-col grid and `useWidgetDrag`. Replace the grid + sidebar section with `BentoDashboard`, keeping the workspace title/header and any workspace-specific controls (icon picker, rename, etc.).

The key change: add an import and replace the grid + picker sidebar with:

```tsx
import { BentoDashboard } from '@/components/bento/BentoDashboard';
```

In the render, after the workspace header (title, icon picker, etc.), replace the grid div and customize sidebar div with:

```tsx
<BentoDashboard contextId={entity.id} />
```

Remove imports that are no longer needed: `useWidgetDrag`, `packLayout`, `SIZE_SPANS`, `SIZE_CYCLE`, all widget imports (they're now in the registry), `WidgetConfig`, `WidgetType`, `WidgetSize`.

- [ ] **Step 2: Verify the workspace page**

Navigate to a workspace in the app. Verify:
- Widgets render in the 3-col bento grid
- Edit Layout button works independently from the dashboard
- Layouts for different workspaces are stored separately (different `contextId` = workspace entity id)

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/WorkspacePage.tsx
git commit -m "feat: replace WorkspacePage custom grid with BentoDashboard"
```

---

## Task 11: Supabase persistence verification

**Files:** no code changes — verification only

- [ ] **Step 1: Test save + reload**

1. Open the dashboard in Edit Mode
2. Drag a widget to a new position
3. Wait 1 second (debounce fires)
4. Hard-refresh the page (`Ctrl+Shift+R`)
5. Verify the widget is still in the new position

- [ ] **Step 2: Test cross-context isolation**

1. Move a widget on the dashboard
2. Navigate to a workspace
3. Verify the workspace has its own independent layout (not affected by dashboard changes)

- [ ] **Step 3: Test without Supabase (graceful fallback)**

Temporarily set `NEXT_PUBLIC_SUPABASE_URL=` to empty in `.env`. Reload the app. Verify the default layout renders without errors and Edit Mode still works (local state only, no crash).

Restore the env var afterward.

---

## Self-Review Checklist

- [x] **Supabase table** — Task 2
- [x] **Widget registry** — Task 4
- [x] **useBentoLayout hook** (load, save, editMode, add, remove) — Task 5
- [x] **BentoWidget wrapper** (edit overlay, remove button, entrance animation) — Task 6
- [x] **WidgetPicker** (click-to-add, drag-to-place) — Task 7
- [x] **BentoDashboard** (react-grid-layout, edit mode header, settle animation, droppingItem) — Task 8
- [x] **Dashboard integration** — Task 9
- [x] **WorkspacePage integration** — Task 10
- [x] **Persistence verification** — Task 11
- [x] **Duplicate widget instances** — covered by UUID-based `i` field in Task 3/5
- [x] **Global edit mode scope** (per-context, not global) — covered by `useBentoLayout(contextId)`
- [x] **GSAP entrance animation** (scale+fade) — Task 6
- [x] **GSAP settle animation on edit exit** — Task 8
- [x] **Drag from full widget surface** (no grip icon) — cursor-grab on the whole BentoWidget div
- [x] **3-col max grid** — `cols={3}` in BentoDashboard
- [x] **Supabase null-safe** — `if (!supabase) return null` in bento-sync.ts
