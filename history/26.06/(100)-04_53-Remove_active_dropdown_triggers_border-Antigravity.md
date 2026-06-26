### 0. Date and Time of the Request
*   **Date:** June 26, 2026
*   **Time:** 04:53 AM (Local Time)

### 1. User Request
User request: "no border"

### 2. Objective Reconstruction
Remove active border/outline outlines from the dropdown trigger boxes (`ExportSelect` and `ArrowheadDropdown`) when they are open, relying purely on background and text highlights as per design preferences.

### 3. Strategic Reasoning
*   In Flowr's branding rules, the user specifically dislikes heavy borders or borders on selected states.
*   By setting the active state styles to use only background (`bg-[var(--bone-10)]`) and text color highlights (`text-[var(--bone-100)]`), we remain completely consistent with the rest of the application's clean flat panel visual theme.
*   Retaining `border-none outline-none` in both open and closed states keeps height rendering constant without using transparent layout margins.

### 4. Detailed Blueprint
*   Modify `ExportSelect` and `ArrowheadDropdown` in [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx):
    *   Change trigger button conditional open classes from `border border-[var(--bone-15)]` to `border-none outline-none`.

### 5. Operational Trace
*   Updated trigger classes in [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx).
*   Verified compiling status with `npx tsc --noEmit`.

### 6. Status Assessment
*   Trigger inputs are now borderless in both open and closed states, with visual feedback based entirely on background and text color shifts.
