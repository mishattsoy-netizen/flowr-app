User request: "when i hide and show style and layer panels pills inside sliders inside panel resize on apearance fix it"

### 0. Date and time of the request
Date: 26.06.2026
Time: 05:24

### 1. User request
"when i hide and show style and layer panels pills inside sliders inside panel resize on apearance fix it"

### 2. Objective Reconstruction
Resolve the sliding selector pill sizing/positioning bugs inside the `SliderGroup` component that occur when the canvas style panel or layers panel is shown/hidden, preventing the sliding pill from getting stuck in incorrect or zero-width dimensions upon panel mounting or visibility transitions.

### 3. Strategic Reasoning
- Because the panels are dynamically mounted/unmounted (`showStylePanel && ...`), `useLayoutEffect` runs during the initial layout pass when the parent panel's dimensions may not be stabilized.
- Attaching a `ResizeObserver` to the `SliderGroup` container ensures that any size/layout changes (due to panel entry transitions or screen resizes) trigger an immediate re-evaluation of the active sliding pill's bounding rect, resolving visual bugs.

### 4. Detailed Blueprint
- Modify `src/components/canvas/CanvasStylePanel.tsx`:
  - Locate `SliderGroup`'s `useLayoutEffect` hook.
  - Implement a `ResizeObserver` instance observing `containerRef.current`.
  - Trigger `updatePill` whenever layout resizing events occur, and clean up the observer on component unmount.

### 5. Operational Trace
- Updated `useLayoutEffect` hook in `SliderGroup` inside `src/components/canvas/CanvasStylePanel.tsx` to use the observer.
- Verified compiler output via `npx tsc --noEmit`.

### 6. Status Assessment
- Successfully resolved slider pill layout bug using `ResizeObserver`.
- Checked project build integrity and all compilation validation checks succeeded.
