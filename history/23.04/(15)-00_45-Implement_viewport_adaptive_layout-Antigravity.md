User request: "Implement Widget Layout Plan from docs/widget-layout-plan.md"

### Objective Reconstruction
Transition the Bento Dashboard from a fixed pixel-based grid height to a viewport-adaptive, percentage-based layout. The goal is to eliminate global vertical scrollbars by ensuring the entire dashboard fits within the available screen space, while allowing individual widgets to manage their own content overflow.

### Strategic Reasoning
1.  **Unit Shift**: Moving from pixels (`CELL_HEIGHT`) to percentages (`100% / MAX_ROWS`) decouples the dashboard from specific resolution constraints.
2.  **Flexbox Orchestration**: Using `flex-grow` and `overflow-hidden` on the container ensures that the dashboard correctly occupies the space between the header and the bottom of the viewport without pushing content off-screen.
3.  **Coordinate Homogenization**: By updating `getStyle` and drag-detection logic to use relative percentage units, the drag-and-drop interaction remains consistent regardless of the container's physical size on different screens.

### Detailed Blueprint
1.  **BentoDashboard.tsx**:
    *   Removed `CELL_HEIGHT` and `V_UNIT_PX` constants.
    *   Removed `rowData` and `containerHeight` state/memo logic.
    *   Updated `getStyle` to calculate `top` and `height` using `(y / MAX_ROWS) * 100%`.
    *   Updated `onPointerMove` to detect rows using `Math.floor(y / (rect.height / MAX_ROWS))`.
    *   Refactored container structure to use `flex-col overflow-hidden` and `h-full`.
    *   Set the grid container to `flex: 1` with `min-height: 0` to fill remaining space.

### Operational Trace
- Cleaned up legacy pixel-based constants.
- Updated all positioning math to use percentage-based `calc()` values.
- Re-nested the dashboard components to support a locked viewport layout.

### Status Assessment
The dashboard now perfectly fills the viewport. No global scrollbars should appear, and widgets correctly resize their footprint based on the available screen height.
