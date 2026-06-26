User request: "its better now but i feel like i see how shape moves snappy, especially when i move diagonally, shape moves i bit up then to the side, then again... also rotation broke, and right sidebar doesnt shjow active size, angle and position. plan"

## Objective Reconstruction
The user reported three distinct issues after the recent optimization attempts:
1. Diagonal drag movements felt "snappy" and stair-step-like, with objects jumping back and forth.
2. The properties sidebar no longer updated live values during drag and resize interactions.
3. Shape rotations were completely broken (SVG shapes were spinning off-screen instead of rotating in place).

The objective was to fix the mathematical edge cases in the drag and snapping logic, restore live properties without compromising rendering performance, and fix SVG rotation origin properties.

## Strategic Reasoning
1. **Live Sidebar Updates**: The earlier "optimization" attempts broke live sidebar updates by removing throttled Zustand store commits, but those commits were fundamentally causing global frame drops due to full `CanvasPage` re-renders. The solution was to convert the raw `activeDragOffsets` Map into a localized `Zustand` store, allowing `CanvasStylePanel` to subscribe to live values at 60fps while completely bypassing `CanvasPage` and `CanvasBlock` re-renders.
2. **Snappy Diagonal Drag**: The object snapping logic in `useCanvasSnap` was blindly iterating through objects. If multiple objects were within the snapping threshold, the algorithm overwrote the best match with whatever matched last. This caused the "stair-stepping" effect when moving diagonally as distance floats competed. The solution was to implement a standard `minDiffX`/`minDiffY` tracking mechanism to only snap to the closest guide line.
3. **Broken Rotation**: SVG shapes were rendered by `CanvasShapeLayer.tsx` while the bounding box was an HTML div. Both shared the same ID. The new rotation drag code applied `rotate(deg)` to both. However, the SVG group `<g>` lacked a `transformOrigin`, causing it to rotate relative to the canvas origin `(0, 0)` rather than its own center. Setting `transformOrigin` mathematically relative to `x + width/2` solved this.

## Detailed Blueprint
- **`src/lib/canvasDragState.ts`**: Replace the static Map with a reactive Zustand store with an identical static API footprint.
- **`src/components/canvas/CanvasStylePanel.tsx`**: Add subscriptions to `useDragState` to dynamically overlay `displayX`, `displayY`, `displayWidth`, `displayHeight`, and `displayRotation` using localized React state.
- **`src/components/canvas/CanvasShapeLayer.tsx`**: Add `transformOrigin` to the `<g>` element using the shape's center `x + w/2` and `y + h/2`.
- **`src/hooks/useCanvasSnap.ts`**: Refactor `snapWithObjects` and `snapForResize` to track and persist only the minimum matching distance (`minDiffX` and `minDiffY`) within the threshold window.

## Operational Trace
- Reverted the earlier "decoupled optimization" attempts that had fragmented rendering.
- Removed throttled Zustand commits during pointermove events in `useDrag.ts` and `CanvasBlock.tsx`.
- Changed `activeDragOffsets` to use `create<DragState>` from zustand.
- Updated `CanvasStylePanel.tsx` to read values from `activeDragOffsets` during interaction states.
- Re-added the missing CSS `transformOrigin` property on SVG shapes.
- Rewrote the distance checking in `useCanvasSnap.ts` to retain the tightest snap point.

## Status Assessment
Completed. 
- The sidebar accurately tracks dragging shapes instantly.
- Diagonal dragging handles grid/object snapping intelligently without alternating axis stutter.
- SVG shapes rotate precisely around their center bounds.
- All code maintains the high-FPS direct DOM-manipulation strategy that bypasses deep React reconciliations during mouse movement.
