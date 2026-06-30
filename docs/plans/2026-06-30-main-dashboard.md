# Main Dashboard Rework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the main dashboard page to use a clean, premium, fixed-widget layout featuring a Recents carousel card slider with note previews, a header search input, a quick-add dropdown, and matching widget styles.

**Architecture:** 
- Rework `Dashboard.tsx` to directly compose the layout (Header, Recents Slider, bottom widget grid).
- Embed existing `TasksWidget` and `ShortcutsWidget` components, wrapped in matching border overlay divs.
- Query documents from the Zustand store to extract real-time text previews for Note and Canvas entities inside the Recents slider.

**Tech Stack:** React, Tailwind CSS, Lucide icons, Zustand, GSAP (for welcome transition).

---

### Task 1: Rework Dashboard Header & Controls

**Files:**
- Modify: `src/components/dashboard/Dashboard.tsx`
- Test: Manual verify header actions

**Step 1: Write header layout & imports**
Update `Dashboard.tsx` to include the search input and a circular plus button. Load state triggers:
- `setCommandPaletteOpen` from the store (to trigger search on click).
- `openModal` from the store (to trigger newItem popup modals).

**Step 2: Implement New Item Dropdown**
Add a floating glassmorphism popup for creating new items:
- Note, Canvas, and Mixed items.
- Style dropdown container using standard options popup specs: padding `p-1`, spacing `gap-[2px]`, item padding `py-[4px]`, minimum width `180px`, hover background `hover:bg-[var(--bone-6)]`.

**Step 3: Commit**
```bash
git add src/components/dashboard/Dashboard.tsx
git commit -m "feat(dashboard): implement header search bar and quick-add dropdown"
```

---

### Task 2: Implement Recents Carousel Slider

**Files:**
- Modify: `src/components/dashboard/Dashboard.tsx`
- Test: Manual verify slider rendering

**Step 1: Extract Document Previews**
Write helper functions to extract the first 4 text/bullet points and the first paragraph from a Note block hierarchy (`entity.content`) to populate card text previews.

**Step 2: Construct Recents Cards**
Display recent Note/Canvas entities in a premium card layout:
- Card uses `bg-panel/40 backdrop-blur-xl border border-[var(--bone-5)] rounded-[var(--radius-big)] p-5 text-left`.
- Header: Type icon + relative time.
- Body: Crimson Pro title + bullet points + footer text preview.

**Step 3: Implement Horizontal Slider Container**
Add a horizontal scroll list:
- Use Tailwind classes: `flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pr-10 pb-2`.
- Add left/right chevron scrolling triggers overlayed on hover.

**Step 4: Commit**
```bash
git add src/components/dashboard/Dashboard.tsx
git commit -m "feat(dashboard): build premium horizontal recents slider with document previews"
```

---

### Task 3: Embed Tasks & Shortcuts Widgets with Same Border Style

**Files:**
- Modify: `src/components/dashboard/Dashboard.tsx`
- Test: Manual verify widget style integration

**Step 1: Embed Widgets**
Layout the bottom row:
- Grid layout: 2 columns on desktop (2/3 width for Tasks, 1/3 width for Shortcuts).
- Wrap widgets in wrappers that preserve the identical bento-widget border highlight styling:
```tsx
import { useTheme } from '@/components/ThemeProvider';
// Inside component
const { resolvedTheme } = useTheme();
// Render wrapper
<div className="relative rounded-[var(--radius-big)] overflow-hidden">
  <TasksWidget contextId="dashboard" />
  <div className="pointer-events-none absolute inset-0 rounded-[var(--radius-big)] border" style={{ borderColor: resolvedTheme === 'dark' ? 'var(--bone-3)' : 'var(--bone-6)' }} />
</div>
```

**Step 2: Sync Shortcuts Persistence**
Add logic to load layout configurations for the dashboard using `loadBentoLayout('dashboard')`, find the `'shortcuts'` item, and pass it to `<ShortcutsWidget />`. Update database configuration when changes occur via `saveBentoLayout`.

**Step 3: Commit**
```bash
git add src/components/dashboard/Dashboard.tsx
git commit -m "feat(dashboard): integrate tasks and shortcuts widgets with exact widget styles"
```

---

### Task 4: Run Baseline Verification & Build Tests

**Files:**
- Test: Run local vitest test suite.
- Test: Build check (`npm run build`).

**Step 1: Run Vitest Tests**
Run: `npm test`
Expected: PASS all 126 tests.

**Step 2: Run Production Build**
Run: `npm run build`
Expected: Successfully generates the production next.js output.

**Step 3: Commit**
```bash
git commit --allow-empty -m "chore(dashboard): complete dashboard layout rework verification"
```
