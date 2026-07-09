### 0. Date and time of the request
Date: 04.07.2026
Time: 20:00 (Start) - 20:01 (End)

### 1. User request
User request: "zoom on click is too close, also add ability to zoom on scroll or ctrl and scroll"

### 2. Objective Reconstruction
Refine the zoom behavior inside the image preview modal:
1. Reduce the toggle-zoom scale on click to a gentle `1.3x` instead of `1.5x`.
2. Implement mouse-wheel/trackpad scroll-to-zoom (up to `3.5x` scale).
3. Implement click-and-drag panning behavior when zoomed.
4. Filter click toggling to prevent it from firing during or at the end of a drag-pan gesture.

### 3. Strategic Reasoning
Instead of a simple boolean state (`isZoomed`), we introduced custom numeric zoom states (`scale` and `offset` for translation).
- Panning is managed using client coordinates calculated on drag start relative to offset. We track `mouseDownPos` to ensure clicking only toggles zoom if the mouse moved less than 5px (preventing drag-releases from triggering zoom-reset).
- Scrolling zoom leverages a passive wheel event handler bound to the modal container, updating scale in bounds of `1x` to `3.5x`.
- Transitions are enabled on click or zoom change, but dynamically bypassed during dragging/panning to ensure latency-free track panning.

### 4. Detailed Blueprint
- `src/components/modals/MediaViewerModal.tsx`:
  - Add `scale`, `offset`, `isDragging`, `dragStart`, `mouseDownPos` state hooks and refs.
  - Implement a wheel event listener inside a `useEffect` on the background container.
  - Add window event listeners for `mousemove` and `mouseup` to handle dragging across boundaries.
  - Modify `<img>` styling to use `transform: translate(...) scale(...)` and dynamic cursor/transitions.
  - Add click-drag-filtering to the image's `onClick` and `onMouseDown`.

### 5. Operational Trace
- Replaced simple `isZoomed` logic with custom zoom, pan, and scroll wheel math in `src/components/modals/MediaViewerModal.tsx`.
- Ensured no duplicate declarations of `url` and `mediaType` variable parameters.
- Validated build integrity using `npx tsc --noEmit`.

### 6. Status Assessment
Completed successfully. Scroll zoom (including pinch-to-zoom trackpad events) and smooth drag-to-pan are now fully integrated, with click zoom softened to `1.3x`.
