User request: "in boxes dont show text like None or Filled, just icon, in popups show"

### 0. Date and time of the request
Date: 26.06.2026
Time: 05:17

### 1. User request
"in boxes dont show text like None or Filled, just icon, in popups show"

### 2. Objective Reconstruction
Modify `ArrowheadDropdown` selection boxes (trigger buttons) to display only the centered endpoint SVG icon and the chevron arrow, while retaining both the icon and text label inside the portal dropdown menu items list.

### 3. Strategic Reasoning
- Removing text labels from the compact 3-column arrowhead selector boxes prevents horizontal overcrowding and text clipping within the style sidebar.
- Placing only the centered icon and chevron in the box creates a clean, visual representation identical to Figma.
- The dropdown popup list still retains full text labels (e.g. None, Triangle, Filled, Circle, Bar, Diamond) and icons for descriptive selection.

### 4. Detailed Blueprint
- Modify `src/components/canvas/CanvasStylePanel.tsx`:
  - Locate `ArrowheadDropdown`'s trigger button structure.
  - Remove the text label span containing `labels[value]`.
  - Apply center flex-alignment to the icon wrapper (`flex justify-center flex-1`).

### 5. Operational Trace
- Edited the layout of `ArrowheadDropdown` trigger button in `src/components/canvas/CanvasStylePanel.tsx`.
- Confirmed project code builds successfully with `npx tsc --noEmit`.

### 6. Status Assessment
- Successfully hid text labels inside the Arrowheads selection trigger boxes.
- Compilation checked clean.
