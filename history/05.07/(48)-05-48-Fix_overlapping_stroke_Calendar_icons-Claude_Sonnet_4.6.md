### 0. Date and time of the request
Date: 05.07.2026
Time: 05:49

### 1. User request
User request: "@FIX-overlapping-stroke.md in widget's calendar icons in tasks date and in task cards in kanban"

### 2. Root Cause
Calendar icons were using semi-transparent colors like `text-[var(--bone-30)]`. On SVGs this causes alpha compositing artifacts — adjacent stroke edges partially overlap and blend, making the icon look like it has a doubled/stacked stroke.

### 3. Fix (per FIX-overlapping-stroke.md Cause 1)
Replaced `text-[var(--bone-30)]` with `text-[var(--bone-100)] opacity-30` on the Calendar icon in both files. SVG renders at full solid color internally, then opacity is applied after — no alpha stacking, crisp single stroke.

### 5. Files Changed
- `src/components/tracker/TaskCard.tsx`
- `src/components/workspace/widgets/SmartTaskStackWidget.tsx`

### 6. Status
Completed.
