User request: "fix popups iside panel"

### 0. Date and time of the request
Date: 26.06.2026
Time: 05:13

### 1. User request
"fix popups iside panel"

### 2. Objective Reconstruction
Prevent dropdown menu popups inside the canvas style panel (such as `ArrowheadDropdown`) from being clipped by the panel's `overflow-y-auto` container layout boundaries.

### 3. Strategic Reasoning
- The right sidebar style panel has an `overflow-y-auto` layout container which clips absolutely-positioned children when they overflow its height boundaries.
- Refactored `ArrowheadDropdown` to use React's `createPortal` to render its menu fixed to the body viewport level (just like `ExportSelect` does), completely resolving clipping or scrollbar issues.

### 4. Detailed Blueprint
- Modify `src/components/canvas/CanvasStylePanel.tsx`:
  - Update `ArrowheadDropdown` to store viewport positioning references (`getBoundingClientRect`) when opened.
  - Implement React `createPortal` to mount the dropdown popup options list inside `document.body` with `position: fixed`.

### 5. Operational Trace
- Modified `ArrowheadDropdown` inside `src/components/canvas/CanvasStylePanel.tsx` to use the portal implementation.
- Verified compilation by running `npx tsc --noEmit`.

### 6. Status Assessment
- Successfully resolved clipping/overlap issues for Arrowhead select dropdowns.
- TypeScript compiler output returned zero warnings.
