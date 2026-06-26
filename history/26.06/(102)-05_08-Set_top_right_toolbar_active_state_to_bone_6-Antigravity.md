User request: "change only these focus coor to bone 6"

### 0. Date and time of the request
Date: 26.06.2026
Time: 05:08

### 1. User request
"change only these focus coor to bone 6"

### 2. Objective Reconstruction
Change the active/selected focus background highlights for the top-right toolbar buttons (Toggle Style Panel, Toggle Layers Panel, Magnet Snapping) specifically to `bg-[var(--bone-6)]`.

### 3. Strategic Reasoning
- The user specified changing only the top-right floating toolbar buttons' focus background color to a lighter/softer highlight of `bg-[var(--bone-6)]` instead of `bg-[var(--bone-12)]` which is used on the bottom toolbar.
- Standard opacity/zero transition/borderless requirements remain fully preserved.

### 4. Detailed Blueprint
- Modify `src/components/canvas/CanvasPage.tsx`:
  - Change active highlights for `showStylePanel`, `showLayers`, and `snapEnabled` buttons from `bg-[var(--bone-12)]` to `bg-[var(--bone-6)]`.

### 5. Operational Trace
- Replaced the Tailwind classes in the buttons under the top-right floating toolbar inside `src/components/canvas/CanvasPage.tsx`.
- Ran compiler checks via `npx tsc --noEmit` to confirm success.

### 6. Status Assessment
- Successfully set the active focus color for the top-right floating toolbar buttons to `bg-[var(--bone-6)]`.
- Left the bottom toolbar using `bg-[var(--bone-12)]` as requested. All systems clean and compilation succeeded.
