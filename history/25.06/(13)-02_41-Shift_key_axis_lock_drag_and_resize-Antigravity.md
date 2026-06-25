# History Report

## 0. Date and Time
Date: 25.06
Time: 02:41

## 1. User request
User request: "when i hold shift while dragging item or resizing, only move horizontally or vertically"

## 2. Objective Reconstruction
Implement axis locking constraints (constraining movement or resizing to purely horizontal or purely vertical) when holding the Shift key during block dragging or corner resize operations.

## 3. Strategic Reasoning
* **Dragging constraint**: If Shift is held during pointer movements, calculate the displacement from drag start (`deltaX` and `deltaY`). Compare their absolute values to determine the dominant axis (e.g. if `Math.abs(deltaX) > Math.abs(deltaY)`, the user is moving horizontally, so we lock vertical movement by setting `deltaY = 0`). Apply the same constraint in the release loop (`handlePointerUp`) to guarantee consistency.
* **Resizing constraint**: Resizing has multiple handles. For corner handles (`nw`, `ne`, `sw`, `se`), apply the same dominant-axis comparison on pointer displacement (`dx` and `dy`) and zero out the locked axis. Side handles (`n`, `s`, `e`, `w`) are inherently single-axis, so Shift constraint doesn't modify their behavior.
* **Snapping interaction**: Ensure that snapping behavior doesn't override the axis lock (e.g. if dragging is locked to the horizontal axis, snapping must not pull the block vertically, and we must filter out any horizontal snapping guidelines).

## 4. Detailed Blueprint
* **[useDrag.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/hooks/useDrag.ts)**
  * Modify `handlePointerMove` to calculate constrained `deltaX` and `deltaY` when `moveEvent.shiftKey` is true. Filter snapping guides and results accordingly.
  * Modify `handlePointerUp` to lock final coordinate positions when `upEvent.shiftKey` is true.
* **[CanvasBlock.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasBlock.tsx)**
  * Modify `handlePointerMove` inside the resize handler to lock pointer displacement `dx` or `dy` to `0` when `moveEvent.shiftKey` is true and a corner handle is used. Filter snapped output and guides.

## 5. Operational Trace
* Modified `useDrag.ts` to add Shift key axis-locking in `handlePointerMove` and `handlePointerUp`.
* Modified `CanvasBlock.tsx` to apply Shift key axis-locking on corner resizing in `handlePointerMove`.
* Ran type compilation validation `npx tsc --noEmit` and confirmed successful build.

## 6. Status Assessment
* **Completed**: Added Shift key axis constraints for both dragging and resizing.
* **Unresolved**: None.
* **Recommendations**: Perform manual verification of the dragging and resizing interactions while holding the Shift key to ensure it behaves correctly.
