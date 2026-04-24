# Widget Ecosystem Design — Flowr-4

**Date:** 2026-04-24  
**Status:** Approved  
**Scope:** New widgets (Calendar, Notes Scratchpad, Habit Tracker, Analytics ×3), improvements to all 8 existing widgets, widget link/alias system

---

## Section 1 — Data Architecture

### Widget Instance Model

Every widget placed on a dashboard or workspace page is a `WidgetInstance`:

```ts
interface WidgetInstance {
  id: string;
  type: string;                  // key in widgetRegistry
  pageId: string;                // 'dashboard' | workspaceId
  dataConfig: {
    sourceWidgetId?: string;     // set = this is a linked (read-only) instance
    workspaceId?: string;        // explicit scope override
    timeRange?: '7d' | '30d' | '90d';
    // widget-specific data config fields
  };
  displayConfig: {
    // bento layout
    row: number;
    order: number;
    w: number;
    h: number;
    // widget-specific display config fields (sort, viewStyle, etc.)
  };
}
```

### Data Scoping Rules

| Page | Widget data scope | Override |
|------|------------------|----------|
| Dashboard | Global (all workspaces) | `dataConfig.workspaceId` to pin to one |
| Workspace | That workspace only | `dataConfig.workspaceId` to pin to another |

Tasks widget on dashboard is the canonical exception — always global.

### Widget Link / Alias System (Phase 6)

A linked widget sets `dataConfig.sourceWidgetId` to the source widget's `id`. Linked instances:
- **Share** all data reads from the source widget's `dataConfig`
- **Cannot** create, edit, or delete data (all write operations blocked)
- **Have independent** `displayConfig` — size, position, sort, view style, time range are their own

Linked widgets are visually marked with a small chain icon. Unlinking removes `sourceWidgetId` and the widget becomes independent (no data is copied — it just reads from its own scope going forward).

---

## Section 2 — Phase 1: Existing Widget Improvements

### Clock (`clock`)
- Current: static time display
- Improved: time + date on separate lines, timezone selector in settings, optional 12/24h toggle, seconds display toggle
- Size: minW=2 minH=1, comfortable at 2×1

### Timer (`timer`)
- Current: basic countdown
- Improved: Pomodoro preset (25/5), custom duration input, sound notification on completion, session counter ("3rd pomodoro today"), pause/resume/reset controls always visible
- Size: minW=2 minH=1, comfortable at 2×2 with progress ring

### Stacked Widget (`stacked-widgets`)
- Current: combine up to 3 widgets in one cell
- Improved: tab switcher at top (icon + label), drag-to-reorder tabs, each tab has independent display config (its own view style, sort, etc.), dwell-on-edge to drag widget into/out of stack
- Size: inherits from inner widgets, minW=2 minH=2

### Shortcuts (`shortcuts`)
- Current: app-like shortcuts grid
- Improved: add shortcut via URL or internal page path, custom icon (emoji or uploaded), drag-to-reorder, open in new tab toggle, grouping by label, click opens URL or navigates internally
- Size: minW=2 minH=2

### Recent (`recent`)
- Current: recently opened pages list
- Improved: shows last-opened timestamp ("2h ago"), workspace badge, click navigates to page, filter toggle (notes / databases / all), pinned items at top
- Size: minW=2 minH=2

### All Files (`all-files`)
- Current: flat file list
- Improved: tree view toggle (flat | nested by workspace), search/filter bar, file type icons, right-click context menu (open, rename, delete), sort by (name | modified | created)
- Size: minW=2 minH=2

### Tasks (`tasks`)
- Current: global task list (basic)
- Improved: view toggle (list | grouped by workspace | grouped by status), inline task create (press Enter to add), checkbox to complete, due date chip, filter bar (status, workspace, priority), click task opens detail drawer
- Dashboard scope: all workspaces. Workspace scope: that workspace only.
- Size: minW=2 minH=2

### Quick Links (`quick-links`)
- Current: bookmark shortcuts
- Improved: add link via URL with auto-fetch title + favicon, drag-to-reorder, compact (icon only) vs expanded (icon + title) display toggle, click opens in new tab or same tab (configurable)
- Size: minW=2 minH=1 (compact row), comfortable at 4×1

---

## Section 3 — Phase 2: Tracker Calendar View + Calendar Widget

### Tracker View Switcher

The TrackerPage header gets a 3-tab toggle: `Kanban | List | Calendar`. Active view is persisted per-workspace in workspace `displayConfig.trackerView`. Kanban is unchanged.

**List view**: flat sortable table — columns: title, status, due date, priority, workspace. Click row opens task detail. Inline create at bottom.

**Calendar view**: month grid (7 columns × ~5 rows). Tasks with a `dueDate` appear as chips on their date cell.

### Calendar Interactions

| Action | Result |
|--------|--------|
| Click empty date | Inline task-create popover (title + Enter), pre-fills `dueDate` |
| Click task chip | Opens task detail drawer (same as Kanban) |
| Drag chip to new date | Updates `dueDate`, undoable |
| Prev/Next arrows | Navigate months |
| "Today" button | Jump to current month, highlight today |
| Tasks without dueDate | Appear in "Unscheduled" swimlane below grid |

### Calendar Widget (dashboard / workspace)

Compact month-grid widget. Shows colored dots on dates that have tasks (one dot per task, up to 3 then "+N").

| Action | Result |
|--------|--------|
| Click widget header | Navigate to `/tracker?view=calendar` |
| Click a date cell | Navigate to `/tracker?view=calendar&date=YYYY-MM-DD` |

Widget is view-only — no task creation inside widget.

Data scope: dashboard = all workspaces, workspace = that workspace only.

**Registry**: `defaultW:4 defaultH:2 minW:2 minH:2 maxW:6 maxH:4`  
At 2×2: condensed grid with dots. At 4×2+: task title chips visible on dates.

---

## Section 4 — Phase 3: Notes Scratchpad Widget

### What It Is

One persistent note per widget instance. On widget creation, a note is created in the current workspace (or a global scratchpad space for dashboard) with flags:

```ts
note.isDashboardScratchpad = true;
note.widgetInstanceId = widgetInstance.id;
```

Deleting the widget does NOT delete the note — it becomes a regular note in the sidebar.

### Interactions

| Action | Result |
|--------|--------|
| Click content area | Editor activates, cursor placed at click point |
| Type | Auto-saves with 500ms debounce, no save button |
| Click widget title | Inline rename (updates note title) |
| Click "open full" icon | Navigates to full note in editor |

Supported formatting: bold, italic, bullet list, numbered list, headings (H1–H3). No database blocks, no media — scratchpad only.

### Data Recovery

On widget first-mount, if `widgetInstanceId` matches no existing note (e.g. after import/wipe), a new blank note is auto-created and linked.

**Registry**: `defaultW:4 defaultH:2 minW:2 minH:2 maxW:6 maxH:4`  
At 2×2: ~6 lines visible. At 6×4: comfortable writing surface.

---

## Section 5 — Phase 4: Habit Tracker Widget

### Data Model Extension

Extend existing `Habit` type:

```ts
interface Habit {
  id: string;
  title: string;
  icon?: string;
  color?: string;
  workspaceId?: string;
  frequency: 'daily' | 'weekdays' | 'weekly' | 'xPerWeek';
  targetDays?: number[];   // 0=Sun…6=Sat; used by 'weekly', 'weekdays'
  targetCount?: number;    // used by 'xPerWeek' (e.g. 3 times per week)
}
```

`HabitCheck` is unchanged: `{ id, habitId, date, done }`.

### Widget Views

Toggled by a small icon in the widget header:

**Today view** (default): vertical list of today's scheduled habits. Each row: check circle + habit title + streak badge ("🔥 12"). Tap circle toggles `HabitCheck` for today.

**Week view**: 7-column mini-grid (Mon–Sun), habits as rows. Filled circle = completed, empty = missed, dash = not scheduled that day.

**Manage**: tapping navigates to dedicated Habits management page (not inline editing).

### Interactions

| Action | Result |
|--------|--------|
| Tap check circle | Toggle `HabitCheck` for today (optimistic update) |
| Long-press habit row | Quick options: skip today, view full history |
| "Add habit" link at bottom | Navigate to Habits page with new-habit dialog open |

Data scope: dashboard = all habits (all workspaces), workspace widget = that workspace's habits only.

**Registry**: `defaultW:4 defaultH:2 minW:2 minH:2 maxW:6 maxH:4`  
At 2×2: today-view for ~4 habits. At 4×3: comfortable week-view.

---

## Section 6 — Phase 5: Analytics Widgets

All analytics widgets share:
- `displayConfig.timeRange: '7d' | '30d' | '90d'` (settable via widget settings panel)
- `minW:4 minH:2` — need space to be readable
- Respect data scoping (dashboard = all workspaces, workspace = scoped)

### Task Productivity (`task-productivity`)

**Chart type**: vertical bar chart  
**X-axis**: days (last 7 or 30)  
**Y-axis**: completed task count  
**Bars**: stacked or grouped by workspace (color per workspace)  
**Hover/tap bar**: shows date + count breakdown by workspace  
**Click bar**: navigates to Tracker filtered by that date  

**Registry**: `defaultW:4 defaultH:2 minW:4 minH:2 maxW:6 maxH:3`

### Habit Consistency (`habit-consistency`)

**Chart type**: contribution heatmap (GitHub-style)  
**X-axis**: weeks (last 12 weeks default)  
**Y-axis**: days of week (Mon–Sun)  
**Cell color**: intensity = % of scheduled habits completed that day (0% = empty, 100% = full color)  
**Hover/tap cell**: shows date + "4/5 habits done"  
**Legend**: 0% → 100% color scale below grid  
**No navigation on click** — read-only display  

**Registry**: `defaultW:4 defaultH:2 minW:4 minH:2 maxW:6 maxH:3`

### Notes Activity (`notes-activity`)

**Chart type**: area chart (line + fill)  
**X-axis**: days (last 30 default)  
**Y-axis**: notes created + edited per day (combined total)  
**Hover/tap point**: shows date + count  
**Click point**: navigates to notes list filtered by that date  

**Registry**: `defaultW:4 defaultH:2 minW:4 minH:2 maxW:6 maxH:3`

---

## Delivery Phases

| Phase | Content | Key dependencies |
|-------|---------|-----------------|
| 0 | Bento engine audit | — (complete, no changes needed) |
| 1 | Improve 8 existing widgets | None |
| 2 | Tracker: List + Calendar views; Calendar widget | `dueDate` already on `AppTask` |
| 3 | Notes Scratchpad widget | Note model `isDashboardScratchpad` flag |
| 4 | Habit Tracker widget + Habits page | Extend `Habit` frequency model |
| 5 | Analytics widgets ×3 | Phases 2–4 data in place |
| 6 | Widget link / alias system | All widgets stable |

Phases are independent after Phase 1 and can be parallelized per engineer.

---

## Open Constraints

- Analytics charts use a lightweight charting library (Recharts preferred — already common in React ecosystems; confirm if already in package.json before adding).
- Database blocks in the editor are out of scope for this spec (noted as broken; separate work).
- Widget link/alias UI (chain icon, unlink flow) is designed in Phase 6 implementation plan, not here.
