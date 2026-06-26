0. Date and time of the request: 25.06.2026 17:28

1. User request: "same with width, height and position it must hosw numer actively in sidebar"

2. Objective Reconstruction
- Support real-time updates for coordinates (X, Y) and sizes (width, height) in the Customization Sidebar:
  1. Dispatch size dimensions (`width`, `height`) and placement coordinates (`x`, `y`) to the store dynamically during active resizing pointer movements on canvas blocks.
  2. Dispatch batch coordinate translates to the store during active dragging translations in the workspace.

3. Strategic Reasoning
- Triggering store update hooks on every pointermove frame links the active canvas input to state listeners, allowing the Customization Sidebar inputs to re-render in real-time.
- Combining local DOM writes (for zero-latency render frames) and store sync loops guarantees smooth canvas feedback alongside reactive inspector panels.

4. Detailed Blueprint
- **src/components/canvas/CanvasBlock.tsx**: Call `updateCanvasBlock` inside the pointermove resizing callback.
- **src/hooks/useDrag.ts**: Map snap offsets and dispatch `updateCanvasBlocks` using batch updates inside the pointermove dragging callback.

5. Operational Trace
- **CanvasBlock.tsx**: Added store updates to the resize move callback.
- **useDrag.ts**: Bound batch update logic to the drag move callback.
- **Type checking**: Ran `npx tsc --noEmit` which completed successfully with 0 errors.

6. Status Assessment
- **Completed**: Dragging and resizing now actively update Width, Height, and Position coordinate inputs in the Customization Sidebar.
