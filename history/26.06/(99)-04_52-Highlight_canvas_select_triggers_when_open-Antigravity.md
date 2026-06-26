### 0. Date and Time of the Request
*   **Date:** June 26, 2026
*   **Time:** 04:52 AM (Local Time)

### 1. User Request
User request: "keep box highlighted when popup is opened, like box focus effect"

### 2. Objective Reconstruction
Implement a dynamic highlight state on the trigger input boxes for `ExportSelect` and `ArrowheadDropdown` when their dropdown menus are currently active/open.

### 3. Strategic Reasoning
*   When a dropdown menu is open, the trigger box should visually indicate focus or selection to tie the menu to its source.
*   By conditionally mapping the `open` state to classes (`bg-[var(--bone-10)] text-[var(--bone-100)] border border-[var(--bone-15)]`), the input box matches the standard focused text input style.
*   Keeping `border border-transparent` when closed ensures height dimensions stay consistent and do not cause elements to shift.

### 4. Detailed Blueprint
*   Modify `ExportSelect` in [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx):
    *   Add `cn` wrapper to conditionalize style based on `open`.
*   Modify `ArrowheadDropdown` in [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx):
    *   Add same conditional highlight styling logic.

### 5. Operational Trace
*   Updated [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx) with trigger element styling.
*   Tested compilation using `npx tsc --noEmit`.

### 6. Status Assessment
*   Trigger inputs now remain highlighted with border & lighter backgrounds when active.
*   Code compiled with no issues.
