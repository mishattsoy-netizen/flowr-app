# Widget Min/Max Size Constraints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce `minH: 2` and `maxW: 4` for all non-clock widgets to prevent overlapping layouts, and migrate existing saved layouts to clamp to new bounds.

**Architecture:** Two targeted changes — (1) update registry constraints for non-clock widgets, (2) promote `recoverLayout` to a first-pass in the load effect and fix the workspace default layout. No engine changes needed; the engine already reads all constraints from the registry.

**Tech Stack:** TypeScript, Next.js (App Router), React

---

### Task 1: Update widget registry constraints

**Files:**
- Modify: `src/components/bento/registry.tsx`

- [ ] **Step 1: Open the file and locate the registry object**

Open `src/components/bento/registry.tsx`. The `widgetRegistry` object starts at line 36. Each entry has `minW`, `minH`, `maxW`, `maxH` fields.

- [ ] **Step 2: Update all non-clock entries**

Replace the entire `widgetRegistry` object with the following (clock is unchanged, all others get `minH: 2, maxW: 4`):

```ts
export const widgetRegistry: Record<string, WidgetRegistryEntry> = {
  // w2 = 1 col, w4 = 2 col, w6 = full width; h in rows
  'clock':            { label: 'Clock',           description: 'Live clock',                    component: ClockWidget,           defaultW: 2, defaultH: 1, minW: 2, minH: 1, maxW: 4, maxH: 2,  category: 'General' },
  'timer':            { label: 'Timer',            description: 'Focus timer',                   component: TimerWidget,           defaultW: 2, defaultH: 2, minW: 2, minH: 2, maxW: 4, maxH: 4,  category: 'General' },
  'all-files':        { label: 'All Files',        description: 'Quick access to all files',     component: AllFilesWidget,        defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 4, maxH: 4,  category: 'Organization' },
  'tasks':            { label: 'Tasks',            description: 'Global task list',              component: TasksWidget,           defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 4, maxH: 4,  category: 'Organization' },
  'quick-links':      { label: 'Quick Links',      description: 'Bookmark shortcuts',            component: QuickLinksWidget,      defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 4, maxH: 4,  category: 'Organization' },
  'smart-tasks':      { label: 'Smart Tasks',      description: 'Stacked task views',            component: SmartTaskStackWidget,  defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 4, maxH: 4,  category: 'Organization' },
  'stacked-widgets':  { label: 'Stacked Widgets',  description: 'Combine up to 3 widgets',      component: GenericStackedWidget,  defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 4, maxH: 4,  category: 'General' },
  'shortcuts':        { label: 'Shortcuts',        description: 'App-like shortcuts',            component: ShortcutsWidget,       defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 4, maxH: 4,  category: 'General' },
  'recent':           { label: 'Recent',           description: 'Recently opened pages',         component: RecentWidget,          defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 4, maxH: 4,  category: 'General' },
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "c:\Users\misha\Documents\Vibe Coding\flowr-4-main" && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors related to `registry.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/bento/registry.tsx
git commit -m "feat(registry): enforce minH=2 maxW=4 for all non-clock widgets"
```

---

### Task 2: Fix workspace default layout + promote recoverLayout in load effect

**Files:**
- Modify: `src/hooks/useBentoLayout.ts`

- [ ] **Step 1: Fix the workspace default layout**

In `src/hooks/useBentoLayout.ts`, the `DEFAULT_LAYOUTS` object starts at line 19. The `workspace` default has `shortcuts` at `h: 1` and `w: 6` — both violate the new constraints when there are neighbors. Fix `shortcuts` to `h: 2`:

Replace:
```ts
  workspace: [
    { i: 'ws-tasks',     type: 'smart-tasks', row: 0, order: 0, w: 4, h: 2 },
    { i: 'ws-all-files', type: 'all-files',   row: 0, order: 1, w: 2, h: 2 }, 
    { i: 'ws-shortcuts', type: 'shortcuts',   row: 1, order: 0, w: 6, h: 1 },
  ],
```

With:
```ts
  workspace: [
    { i: 'ws-tasks',     type: 'smart-tasks', row: 0, order: 0, w: 4, h: 2 },
    { i: 'ws-all-files', type: 'all-files',   row: 0, order: 1, w: 2, h: 2 },
    { i: 'ws-shortcuts', type: 'shortcuts',   row: 1, order: 0, w: 6, h: 2 },
  ],
```

Note: `w: 6` is fine here — `rebalanceRow` expands a single-item row to fill the full width regardless of `maxW`, which is correct (a lone widget must fill its row).

- [ ] **Step 2: Promote recoverLayout to first-pass in load effect**

In the same file, find the `loadBentoLayout` effect (starts around line 70). Replace the body where saved items are processed.

Replace:
```ts
        const items = saved.items.map(it => it.type === 'upcoming' ? { ...it, type: 'recent' } : it);
        const balanced = compactLayout(rebalanceAll(items));
        if (validateLayout(balanced).valid) {
          setLayout(balanced);
        } else {
          const recovered = recoverLayout(items);
          if (recovered) {
            console.warn("[useBentoLayout] Saved layout recovered after clamping invalid values.");
            setLayout(recovered);
          } else {
            console.error("[useBentoLayout] Saved layout is invalid and unrecoverable, using default.");
            const defaults = rebalanceAll(DEFAULT_LAYOUTS[contextId] ?? DEFAULT_LAYOUTS['workspace'] ?? []);
            setLayout(defaults);
          }
        }
```

With:
```ts
        const items = saved.items.map(it => it.type === 'upcoming' ? { ...it, type: 'recent' } : it);
        // Always run recoverLayout first — it clamps w/h to current registry bounds,
        // which migrates saved layouts when constraints change (e.g. minH 1→2).
        const recovered = recoverLayout(items) ?? compactLayout(rebalanceAll(items));
        if (validateLayout(recovered).valid) {
          setLayout(recovered);
        } else {
          console.error("[useBentoLayout] Saved layout is invalid and unrecoverable, using default.");
          const defaults = rebalanceAll(DEFAULT_LAYOUTS[contextId] ?? DEFAULT_LAYOUTS['workspace'] ?? []);
          setLayout(defaults);
        }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "c:\Users\misha\Documents\Vibe Coding\flowr-4-main" && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useBentoLayout.ts
git commit -m "feat(layout): fix workspace default h, migrate saved layouts via recoverLayout"
```

---

### Task 3: Manual verification in the browser

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

```bash
cd "c:\Users\misha\Documents\Vibe Coding\flowr-4-main" && npm run dev
```

- [ ] **Step 2: Open the dashboard and enter edit mode**

Navigate to the dashboard. Click "Edit Layout". Verify:
- All widgets are at least 2 rows tall (except clock which can be 1 row)
- No widgets overlap
- Divider handles appear between adjacent widgets

- [ ] **Step 3: Test horizontal divider drag**

Hover a widget to reveal the vertical divider handle between two side-by-side widgets. Drag it. Verify:
- Neither widget can be shrunk below h=2
- Neither widget can be expanded beyond w=4 (when it has a neighbor)
- No overlap occurs at any drag position

- [ ] **Step 4: Test vertical divider drag**

Hover a widget to reveal the horizontal divider handle between two vertically adjacent widgets. Drag it. Verify:
- Neither widget can be shrunk below h=2
- No overlap or gap at any drag position

- [ ] **Step 5: Test reset layout**

Click "Reset" in edit mode. Verify the default layout renders without overlap and all non-clock widgets are h≥2.

- [ ] **Step 6: Test adding a widget**

Open the Widget Picker and add a widget. Verify it appears at h≥2.

- [ ] **Step 7: Commit verification note (no code change needed)**

If everything looks correct, no commit needed. If you found a regression, fix it and commit with:
```bash
git commit -m "fix(layout): <describe what was wrong>"
```
