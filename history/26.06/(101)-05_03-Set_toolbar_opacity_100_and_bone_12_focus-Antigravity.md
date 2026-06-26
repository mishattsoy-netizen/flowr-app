User request: "set both to opacity 100 and bone 12 ficus"

### 0. Date and time of the request
Date: 26.06.2026
Time: 05:03

### 1. User request
"set both to opacity 100 and bone 12 ficus"

### 2. Objective Reconstruction
Align the container backgrounds of both the bottom floating toolbar (CanvasToolbar) and the top-right floating toolbar to have 100% opacity (`bg-sidebar`) and update active/selected highlight styles to use `bg-[var(--bone-12)]` (bone 12 focus).

### 3. Strategic Reasoning
- The user requested 100% opacity backgrounds for both toolbars to maintain high visual clarity and consistency across the canvas dashboard components.
- The active/focus state highlight was changed from `bg-[var(--bone-15)]` to `bg-[var(--bone-12)]` to create a subtler, premium dark mode selection effect.
- All styles comply with zero transitions and borderless designs as established.

### 4. Detailed Blueprint
- Modify `src/components/canvas/CanvasToolbar.tsx`:
  - Change floating container class from `bg-sidebar/98` to `bg-sidebar`.
  - Change active button highlights from `bg-[var(--bone-15)]` to `bg-[var(--bone-12)]`.
- Modify `src/components/canvas/CanvasPage.tsx`:
  - Change floating toolbar container class from `bg-sidebar/95` to `bg-sidebar`.
  - Change toggle style, layers, and snapping button active highlights from `bg-[var(--bone-15)]` to `bg-[var(--bone-12)]`.

### 5. Operational Trace
- Updated `src/components/canvas/CanvasToolbar.tsx` with clean component structure, using `bg-sidebar` and `bg-[var(--bone-12)]`.
- Updated `src/components/canvas/CanvasPage.tsx` container and button highlight Tailwind classes.
- Ran compiler checks using `npx tsc --noEmit` which succeeded with no errors.

### 6. Status Assessment
- Completed alignment of toolbar backgrounds (100% opacity) and selection highlights (`bg-[var(--bone-12)]`).
- Verified code compilation. All systems functional.
