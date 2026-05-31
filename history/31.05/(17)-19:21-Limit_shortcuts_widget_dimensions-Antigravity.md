# History Report

### 0. Date and time of the request
Date: 31.05.2026
Time: 19:21

### 1. User request
User request: "fix shortcuts widget, max shorcut size is 2 out of 4 rows. and minimal layout zise is 2 collumns"

### 2. Objective Reconstruction
The user requested a design limit adjustment for the Shortcuts widget in the Bento grid dashboard:
1. Limit the maximum height to `2` rows (instead of 4).
2. Limit the minimum width to `2` full columns (which translates to `4` units on the half-column bento grid).

### 3. Strategic Reasoning
- **Central Registry Modification:** Sizing and layout limits (minW, minH, maxW, maxH) for all dashboard bento widgets are managed centrally within the `widgetRegistry` structure in `registry.tsx`.
- **Unit Conversions:** 
  - On the bento layout grid, width units are in half-columns (where `2` units = 1 column, and `4` units = 2 columns).
  - Enforcing a minimum layout size of 2 full columns means setting `minW` to `4`.
  - Enforcing a maximum layout size of 2 out of 4 rows means setting `maxH` to `2`.

### 4. Detailed Blueprint
- **Files Modified:**
  - `src/components/bento/registry.tsx`
- **Modifications:**
  - Locate the `'shortcuts'` widget entry inside `widgetRegistry`.
  - Change `minW` from `2` to `4` (2 full columns).
  - Change `maxH` from `4` to `2` (2 rows max height).

### 5. Operational Trace
- Adjusted limits in `registry.tsx`:
```diff
   'smart-tasks':      { label: 'Smart Tasks',      description: 'Stacked task views',            component: SmartTaskStackWidget,  defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'Organization' },
   'stacked-widgets':  { label: 'Stacked Widgets',  description: 'Combine up to 3 widgets',      component: GenericStackedWidget,  defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'General' },
-  'shortcuts':        { label: 'Shortcuts',        description: 'App-like shortcuts',            component: ShortcutsWidget,       defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'General' },
+  'shortcuts':        { label: 'Shortcuts',        description: 'App-like shortcuts',            component: ShortcutsWidget,       defaultW: 4, defaultH: 2, minW: 4, minH: 2, maxW: 6, maxH: 2,  category: 'General' },
   'recent':           { label: 'Recent',           description: 'Recently opened pages',         component: RecentWidget,          defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'General' },
```
- Ran `npm run test` using `vitest` to verify TypeScript types, compilation, and layout assertions. All 73 tests completed successfully.

### 6. Status Assessment
- **Completed:** Applied the dimension limits to the Shortcuts widget inside the bento grid registry, restricting it to 2 rows maximum height and 2 columns minimum width.
- **Verification:** Verified passing unit tests. 73 green tests.
