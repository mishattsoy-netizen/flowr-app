User request: "make all slider slide likenav slider"

## 0. Date and time of the request
Date: 26.06
Time: 05:42

## 1. User request
"make all slider slide likenav slider"

## 2. Objective Reconstruction
Align the sliding pill transition behavior of all options sliders (specifically `SliderGroup` components inside the Style Panel and tab switcher inside the Layers Panel) with the main navigation tabs slider, making them slide smoothly with pure CSS transitions (`transition-all duration-300 ease-out`), while eliminating complex Javascript-based rendering observers and resize measurements.

## 3. Strategic Reasoning
- The main navigation tab slider (dashboard, tasks, chat) in the sidebar utilizes a pure CSS grid/calc positioning system which computes position dynamically relative to the parent size (`width: calc(...)`, `left: calc(...)`). This means the browser engine layout performs immediately and correctly on initial draw (avoiding mount-animation or resizing lag when showing/hiding sidebars) but slides smoothly when the active index updates.
- By replacing JS measurement state (`tabContainerRef`, `ResizeObserver`, `useLayoutEffect`, `setTimeout` toggles) inside the dynamic canvas sliders with pure CSS calc offsets, we completely bypass the resizing/layout-invalidation problems while matching the navigation tabs' transition timing perfectly.

## 4. Detailed Blueprint
- **Modify** [CanvasLayersPanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasLayersPanel.tsx):
  - Remove imports of `useRef`, `useLayoutEffect`, and `useEffect`.
  - Remove all ref objects, state definitions for tab positions (`tabPillStyle`), and observers measuring bounding client rects.
  - Implement a pure CSS calculation: `width: 'calc((100% - 6px) / 2)'` and `left: calc(3px + idx * (100% - 6px) / 2)` using the active tab option index.
  - Set sliding transition to `transition-all duration-300 ease-out`.
- **Modify** [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx):
  - Clean up imports to remove `useLayoutEffect`.
  - Refactor `SliderGroup` component to compute layout using `options.length` and active value index.
  - Set styling to pure CSS calculation: `width: calc((100% - 6px) / numOptions)`, `left: calc(3px + idx * (100% - 6px) / numOptions)`.
  - Apply `transition-all duration-300 ease-out` transition.

## 5. Operational Trace
- Replaced JS hooks and effects inside `src/components/canvas/CanvasLayersPanel.tsx` and `src/components/canvas/CanvasStylePanel.tsx`.
- Applied transition updates to `duration-300 ease-out`.
- Confirmed project builds successfully with `npx tsc --noEmit`.

## 6. Status Assessment
- Optimized all slider components inside the canvas workspace panels to use pure CSS sliding calculations.
- Cleaned up obsolete code and eliminated ResizeObserver performance overhead.
- All code compilation tests passed successfully.
