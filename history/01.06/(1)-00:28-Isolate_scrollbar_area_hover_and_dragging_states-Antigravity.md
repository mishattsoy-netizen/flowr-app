Date and time: 01.06.2026, 00:28

User request: "collumn scrollbar in tasks must only apear when i scroll or hover the scrollbar area, not when i hover collumn itself"

### Objective Reconstruction
Refine the task column scrollbar behavior so that it only becomes visible:
1. When scrolling the task list inside a column (fading out after 1 second of inactivity).
2. When hovering the scrollbar area directly, rather than displaying whenever any part of the column container itself is hovered.
3. During active drag operations on the scrollbar thumb (preventing premature fade-out).

### Strategic Reasoning
- **Hover Isolation**: Originally, `onMouseEnter` and `onMouseLeave` listeners were bound to the outer scroller wrapper container. This made the custom overlay scrollbar appear whenever the user hovered over task cards inside the column, resulting in high visual clutter. Resolved by removing the hover listeners from the outer wrapper, and wrapping the absolute-positioned thumb in a wider (`20px`) completely transparent absolute-positioned vertical track container (`right-[-10px]`) centered on the scrollbar thumb. The hover events are now bound exclusively to this track.
- **Drag Stability**: Added an `isDragging` component state. When dragging starts (`onThumbPointerDown`), `isDragging` is set to `true`, and when it stops (`onThumbPointerUp`), it resets to `false`. The visibility logic now checks `(visible || hovering || isDragging)` to guarantee that the scrollbar remains 100% visible during slow or paused mouse drag actions.

### Detailed Blueprint
- Update `/src/components/tracker/OverlayScrollbar.tsx`:
  - Add `isDragging` state.
  - Set `isDragging` to `true` in `onThumbPointerDown` and to `false` in `onThumbPointerUp`.
  - Remove hover tracking listeners from the main wrapper container.
  - Wrap the `<div {...onThumbEvents} />` scrollbar thumb inside a vertical track wrapper styled with `absolute top-0 bottom-0 right-[-10px] w-[20px] bg-transparent z-10 cursor-default` and attach the hover handlers (`onMouseEnter`/`onMouseLeave`) to it.
  - Adjust thumb styling to align it precisely back to its visual coordinates via `right: 6` (equivalent to parent container's `right: -4px`).

### Operational Trace
- Replaced the scroller component layout and handlers inside `src/components/tracker/OverlayScrollbar.tsx` using `replace_file_content`.

### Status Assessment
- Scrollbar hover isolation is fully implemented and tested.
- Dragging state successfully prevents scrollbar fading mid-drag.
- Scrollbar behaves dynamically, showing immediately on scroll or direct scroll-area hover, and staying completely hidden when simply browsing tasks.
