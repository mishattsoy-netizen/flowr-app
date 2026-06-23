User request: "widgets and containers/blocks are not panel"

### 0. Date and time
Date: 2026-05-21  
Time: 02:39 CET

### 1. User request
User request: "widgets and containers/blocks are not panel"

### 2. Objective Reconstruction
All bento/workspace widget components were using `bg-sidebar` (resolving to `--sys-color` #1E1E1D) as their background instead of `bg-panel` (#262626). This made widgets visually indistinct from the sidebar background.

### 3. Strategic Reasoning
Widgets should sit above the sidebar background layer — using `bg-panel` (#262626) creates proper visual depth hierarchy: sidebar (#1E1E1D) → widgets (#262626) → content. The previous `bg-sidebar` usage was incorrect for widget surfaces.

### 4. Detailed Blueprint
Used a single bulk `sed` command to replace `bg-sidebar group/widget` → `bg-panel group/widget` across all files in `src/`.

Files affected:
- `GoalsWidget.tsx`, `ClockWidget.tsx`, `TopicBrowserWidget.tsx`, `KnowledgeSearchWidget.tsx`
- `TodayOverviewWidget.tsx`, `TagIndexWidget.tsx`, `FoldersWidget.tsx`, `RoutinesWidget.tsx`
- `TimerWidget.tsx`, `HeaderWidget.tsx`, `PlannerWidget.tsx`, `TasksWidget.tsx`
- `SmartTaskStackWidget.tsx`, `ShortcutsWidget.tsx`, `AllFilesWidget.tsx`, `RecentWidget.tsx`
- `src/app/admin/presets/page.tsx`, `users/page.tsx`, `analytics/page.tsx`

### 5. Operational Trace
- Ran: `grep -rl "bg-sidebar group/widget" . | xargs sed -i '' 's/bg-sidebar group\/widget/bg-panel group\/widget/g'`
- Confirmed 0 remaining occurrences after replacement.

### 6. Status Assessment
All widgets now correctly use `bg-panel` (#262626) as background. Sidebars keep `bg-sidebar` (#1E1E1D). Proper depth hierarchy is restored.
