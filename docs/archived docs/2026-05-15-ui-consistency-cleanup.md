# UI Consistency Cleanup Implementation Plan

> **For agentic workers:** RECOMMENDED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up 5 safe, non-breaking consistency issues in the app UI: standardize `cn()` usage, unify CSS token references, define a shared `WidgetProps` interface, handle 10 unused widget files, and fix a CSS syntax error.

**Architecture:** All changes are purely cosmetic/structural — no visual output, UX, or layout changes. Each task is independent and can be executed in any order.

**Tech Stack:** Tailwind CSS v4, Next.js 16, React 19, TypeScript, Zustand

**No visual/UX impact.** Bento custom drag-and-drop is untouched.

---

### Task 1: Fix `--: 0` syntax error in `globals.css`

**Files:**
- Modify: `src/app/globals.css:76`

**Issue:** Line 76 reads `--: 0;` — a CSS variable with an empty name. This is a no-op syntax error that can trip parser warnings.

- [ ] **Step 1: Remove the invalid line**

```css
  --brand-blue: #2A78D6;
  /* remove next line: --: 0; */
  color-scheme: dark;
```

Edit `src/app/globals.css:76` — delete the line `  --: 0;`.

- [ ] **Step 2: Verify the file parses**

Run: `npx tailwindcss --input src/app/globals.css --output /dev/null`
Expected: No errors (or errors unrelated to the deletion)

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "fix: remove invalid empty CSS variable --: 0"
```

---

### Task 2: Remove duplicate `--radius-8` CSS variable

**Files:**
- Modify: `src/app/globals.css:72`

**Issue:** `--radius-8: 8px` at line 72 is a duplicate of `--radius-medium: 8px`. Both exist in `:root`. The `@theme inline` block also maps both `--radius-8` and `--radius-medium`. This causes confusion — developers reference either token interchangeably.

**Plan:** Remove `--radius-8` from `:root` and `@theme inline`, but keep the `@theme inline --radius-8` alias pointing to `--radius-medium` (backward compatibility for existing `rounded-[var(--radius-8)]` references).

- [ ] **Step 1: Remove declaration from `:root` block**

Edit `src/app/globals.css` — delete line 72: `  --radius-8: 8px;`

- [ ] **Step 2: Update `@theme inline` to alias `--radius-8` → `--radius-medium`**

Change line 144 from:
```css
  --radius-8: var(--radius-8);
```
to:
```css
  --radius-8: var(--radius-medium);
```

- [ ] **Step 3: Verify no broken references**

Run: `rg "var\(--radius-8\)" src/`
Expected: Multiple matches (all still valid since the token still exists in `@theme`)

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "refactor: remove duplicate --radius-8, alias to --radius-medium"
```

---

### Task 3: Standardize `cn()` usage across app UI components

**Files:**
- Modify: All app UI `.tsx` files (non-admin) that import `clsx` directly instead of using `cn`
- Modify: `src/lib/utils.ts` — already has `cn()` defined

**Issue:** UI primitives (`button.tsx`, `input.tsx`, etc.) use `cn()` (which wraps `clsx` + `tailwind-merge` for deduplication). All other app components use `clsx` directly — meaning conflicting Tailwind classes won't be deduplicated, potentially causing subtle style bugs.

**Scope:** Only non-admin app UI components. Admin components can be migrated separately.

**Detection:**

- [ ] **Step 1: Find all non-admin components importing `clsx` without `cn`**

Run: `rg "import.*clsx" src/components/ --include "*.tsx" --no-filename | sort -u`

Expected output includes (example):
```
import clsx from 'clsx';
import { clsx } from 'clsx';
```

Also check `src/app/app/` if any app page files import clsx.

- [ ] **Step 2: For each file, rename the import:**

Change:
```ts
import clsx from 'clsx';
```
To:
```ts
import { cn } from '@/lib/utils';
```

Then replace all usages of `clsx(` with `cn(` in that file.

**Exceptions (keep `clsx`):**
- Files in `src/components/admin/` — admin uses a different styling convention
- Files in `src/components/ui/` — these already use `cn()`, no change needed
- Files where `clsx` is used only as a type import or for non-className purposes

- [ ] **Step 3: Batch apply changes per directory**

Process directories one at a time to keep commits focused:

```bash
# Example for one file — repeat for each file found in Step 1
# Edit: change import + replace clsx( → cn(
```

**File list to modify (expected, verify with Step 1):**
- `src/components/bento/BentoDashboard.tsx` — `clsx`
- `src/components/bento/BentoWidget.tsx` — `clsx`
- `src/components/bento/WidgetPicker.tsx` — `clsx`
- `src/components/layout/Sidebar.tsx` — `clsx`
- `src/components/layout/TreeItem.tsx` — `clsx`
- `src/components/layout/HeaderBar.tsx` — `clsx`
- `src/components/layout/Shell.tsx` — `clsx`
- `src/components/layout/CommandPalette.tsx` — `clsx`
- `src/components/layout/ContextMenu.tsx` — `clsx`
- `src/components/layout/IconPicker.tsx` — `clsx`
- `src/components/layout/PathPicker.tsx` — `clsx`
- `src/components/editor/BlockRenderer.tsx` — `clsx`
- `src/components/editor/NoteEditor.tsx` — `clsx`
- `src/components/editor/BlockOptionsMenu.tsx` — `clsx`
- `src/components/editor/SlashCommandMenu.tsx` — `clsx`
- `src/components/editor/EditorToolbar.tsx` — `clsx`
- `src/components/editor/DatabaseBlock.tsx` — `clsx`
- `src/components/editor/ListBlock.tsx` — `clsx`
- `src/components/editor/MixedPage.tsx` — `clsx`
- `src/components/canvas/CanvasPage.tsx` — `clsx`
- `src/components/canvas/CanvasBlock.tsx` — `clsx`
- `src/components/canvas/CanvasToolbar.tsx` — `clsx`
- `src/components/canvas/CanvasTextToolbar.tsx` — `clsx`
- `src/components/canvas/CanvasStylePanel.tsx` — `clsx`
- `src/components/canvas/CanvasLayersPanel.tsx` — `clsx`
- `src/components/canvas/LayersPanel.tsx` — `clsx`
- `src/components/chat/ChatPage.tsx` — `clsx`
- `src/components/chat/ChatConversation.tsx` — `clsx`
- `src/components/chat/ChatHistoryPanel.tsx` — `clsx`
- `src/components/chat/ChatPlusMenu.tsx` — `clsx`
- `src/components/tracker/TrackerPage.tsx` — `clsx`
- `src/components/tracker/KanbanColumn.tsx` — `clsx`
- `src/components/tracker/TaskCard.tsx` — `clsx`
- `src/components/tasks/TaskList.tsx` — `clsx`
- `src/components/tasks/TaskItem.tsx` — `clsx`
- `src/components/folder/FolderView.tsx` — `clsx`
- `src/components/dashboard/Dashboard.tsx` — `clsx`
- `src/components/modals/*.tsx` — each modal
- `src/components/assistant/AIAssistant.tsx` — `clsx`
- `src/components/assistant/components/ChatMessage.tsx` — `clsx`
- `src/components/workspace/WorkspacePage.tsx` — `clsx`
- `src/components/workspace/widgets/*.tsx` — each widget

- [ ] **Step 4: Verify build succeeds**

Run: `npm run build` (or `npx next build`) 
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/ (excluding admin/)
git commit -m "refactor: standardize cn() usage across app UI components"
```

---

### Task 4: Define shared `WidgetProps` interface

**Files:**
- Create: `src/components/workspace/widgets/types.ts`
- Modify: Each widget file that accepts props

**Issue:** BentoWidget passes `{ contextId, data, onUpdateData, isEditing }` to every widget (see `BentoWidget.tsx:63-68`). Registered widgets have inconsistent prop shapes. Some accept extra props (`entity`, `contextId`, `data`, `onUpdateData`, `isEditing`), some use different names. Unregistered widgets accept no props at all. There's no single source of truth for what a widget can receive.

- [ ] **Step 1: Create shared widget props type**

Write `src/components/workspace/widgets/types.ts`:

```ts
import type { Entity } from '@/data/store';

export interface WidgetProps {
  contextId?: string;
  data?: any;
  onUpdateData?: (data: any) => void;
  isEditing?: boolean;
}
```

Note: `Entity` type import path may vary — verify with `rg "export.*Entity" src/data/` to confirm the correct export path.

- [ ] **Step 2: Add extended props type for task-aware widgets**

Write into the same file:

```ts
export interface WidgetPropsWithEntity extends WidgetProps {
  entity?: Entity;
}
```

- [ ] **Step 3: Apply `WidgetProps` to each registered widget that accepts props**

For each widget that currently accepts props, change its interface to extend `WidgetProps`:

**ClockWidget.tsx** — already has a clean `Props` interface. Replace with:
```ts
import type { WidgetProps } from './types';

interface ClockData {
  style?: ClockStyle;
  hour12?: boolean;
  timezone?: string;
}

interface ClockWidgetProps extends WidgetProps {
  data?: ClockData;
}
```

**TasksWidget.tsx** — currently destructures `{ entity, contextId, data, onUpdateData, isEditing }`. Replace with:
```ts
import type { WidgetPropsWithEntity } from './types';

// Remove inline type annotation, use:
export function TasksWidget({ entity, contextId, data, onUpdateData, isEditing }: WidgetPropsWithEntity & { data?: { view?: ViewMode } }) {
```

**AllFilesWidget.tsx** — check its props. If it accepts contextId/data/onUpdateData, change to use `WidgetProps`.

**ShortcutsWidget.tsx** — same pattern.

**RecentWidget.tsx** — same pattern.

**TimerWidget.tsx** — same pattern.

**SmartTaskStackWidget.tsx** — same pattern.

**GenericStackedWidget.tsx** — same pattern.

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit` (or `npm run typecheck`)
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/widgets/types.ts
git commit -m "refactor: add shared WidgetProps interface for bento widgets"
```

---

### Task 5: Handle 10 unused widget files

**Files:**
- Dead (unregistered, stubs): `TopicBrowserWidget.tsx`, `TodayOverviewWidget.tsx`, `TagIndexWidget.tsx`, `RoutinesWidget.tsx`, `PlannerWidget.tsx`, `MoodWidget.tsx`, `KnowledgeSearchWidget.tsx`, `JournalWidget.tsx`, `HeaderWidget.tsx`, `HabitGridWidget.tsx`, `GoalsWidget.tsx`, `FoldersWidget.tsx`

**Issue:** 18 widget files exist but only 8 are registered in `src/components/bento/registry.tsx`. 10 are unused dead code that increases maintenance surface. Some are placeholders (MoodWidget, JournalWidget, HabitGridWidget), others have more substance (TopicBrowserWidget, FoldersWidget).

**Plan:** 
- Keep files that have real implementation + could be registered later
- Remove pure placeholder stubs (MoodWidget, JournalWidget, HabitGridWidget)
- For the rest: either register them or keep with a clear `@deprecated` header

- [ ] **Step 1: Categorize each unregistered widget**

| File | Has real UI | Could register | Action |
|------|-----------|----------------|--------|
| `TopicBrowserWidget.tsx` | Yes | Yes | Move to `_archive/` with note |
| `TodayOverviewWidget.tsx` | Yes | Yes | Register in registry |
| `TagIndexWidget.tsx` | Yes | Yes | Register in registry |
| `RoutinesWidget.tsx` | Yes | Yes | Register in registry |
| `PlannerWidget.tsx` | Yes | Yes | Register in registry |
| `MoodWidget.tsx` | Placeholder | No | Remove |
| `KnowledgeSearchWidget.tsx` | Yes | Yes | Register in registry |
| `JournalWidget.tsx` | Placeholder | No | Remove |
| `HeaderWidget.tsx` | Yes | Yes | Register in registry |
| `HabitGridWidget.tsx` | Placeholder | No | Remove |
| `GoalsWidget.tsx` | Yes | Yes | Register in registry |
| `FoldersWidget.tsx` | Yes | Yes | Register in registry |

- [ ] **Step 2: Remove 3 pure placeholder widgets**

Delete files:
- `src/components/workspace/widgets/MoodWidget.tsx`
- `src/components/workspace/widgets/JournalWidget.tsx`
- `src/components/workspace/widgets/HabitGridWidget.tsx`

Each is a 15-line stub with no real implementation.

- [ ] **Step 3: Register the 9 widgets that have real UI**

Add imports and entries to `src/components/bento/registry.tsx`:

```ts
import { TopicBrowserWidget } from '@/components/workspace/widgets/TopicBrowserWidget';
import { TodayOverviewWidget } from '@/components/workspace/widgets/TodayOverviewWidget';
import { TagIndexWidget } from '@/components/workspace/widgets/TagIndexWidget';
import { RoutinesWidget } from '@/components/workspace/widgets/RoutinesWidget';
import { PlannerWidget } from '@/components/workspace/widgets/PlannerWidget';
import { KnowledgeSearchWidget } from '@/components/workspace/widgets/KnowledgeSearchWidget';
import { HeaderWidget } from '@/components/workspace/widgets/HeaderWidget';
import { GoalsWidget } from '@/components/workspace/widgets/GoalsWidget';
import { FoldersWidget } from '@/components/workspace/widgets/FoldersWidget';
```

Add entries to `widgetRegistry`:
```ts
'topic-browser':   { label: 'Topic Browser',    description: 'Browse topics and notes',        component: TopicBrowserWidget,   defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4, category: 'Organization' },
'today-overview':  { label: 'Today Overview',   description: 'Today\'s tasks and events',      component: TodayOverviewWidget,  defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4, category: 'General' },
'tag-index':       { label: 'Tag Index',        description: 'Browse all tags',                component: TagIndexWidget,       defaultW: 2, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4, category: 'Organization' },
'routines':        { label: 'Routines',         description: 'Daily routines',                 component: RoutinesWidget,       defaultW: 2, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4, category: 'General' },
'planner':         { label: 'Planner',          description: 'Plan your day',                  component: PlannerWidget,        defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4, category: 'General' },
'knowledge-search':{ label: 'Knowledge Search', description: 'Search knowledge items',         component: KnowledgeSearchWidget,defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4, category: 'Organization' },
'header':          { label: 'Header',           description: 'Custom header widget',           component: HeaderWidget,         defaultW: 6, defaultH: 1, minW: 2, minH: 1, maxW: 6, maxH: 2, category: 'General' },
'goals':           { label: 'Goals',            description: 'Track your goals',               component: GoalsWidget,          defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4, category: 'General' },
'folders':         { label: 'Folders',          description: 'Browse folder structure',        component: FoldersWidget,        defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4, category: 'Organization' },
```

- [ ] **Step 4: Verify build succeeds**

Run: `npx next build`
Expected: Build succeeds with no errors. Check for any import issues with the newly registered widgets.

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/widgets/ src/components/bento/registry.tsx
git commit -m "feat: register 9 existing widgets, remove 3 placeholder stubs"
```

---

## Risk Assessment Summary

| Task | Visual/UX Change | Break Risk | Safe? |
|------|-----------------|-----------|-------|
| 1. Fix `--: 0` | None | Near zero | ✅ |
| 2. Remove `--radius-8` | None (aliased) | Near zero | ✅ |
| 3. Standardize `cn()` | None | Low — dedup can theoretically change behavior if conflicting classes exist, but that's a pre-existing bug | ✅ |
| 4. WidgetProps interface | None | Low — TypeScript catches mismatches | ✅ |
| 5. Handle dead widgets | None (unused) | Low — check for any dynamic imports | ✅ |

## Execution Order

Any order works since tasks are independent. Recommended:
1. Task 1 (trivial, 2 min)
2. Task 2 (trivial, 2 min)
3. Task 5 (moderate — registering widgets may reveal prop mismatches)
4. Task 4 (define the type before widgets reference it — actually order doesn't matter since it's a new file)
5. Task 3 (largest scope, save for last)
