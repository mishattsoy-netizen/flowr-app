User request: "it must apear where i right clicked"

# Date and Time of the Request
May 26, 2026 at 01:01

# Objective Reconstruction
Ensure the shortcuts right-click context menu (options popup) opens precisely at the exact coordinates where the user clicked, bypassing coordinate offsets caused by containing transformed elements (e.g. bento grid item transform blocks).

# Strategic Reasoning
- CSS transforms (like those used on draggable bento widgets in `BentoDashboard`) establish a new containing block. Any descendant styled with `position: fixed` or `position: absolute` is positioned relative to that transformed ancestor, rather than the global viewport document.
- As a result, using pure fixed viewport-relative client coordinates (`e.clientX`, `e.clientY`) directly on elements nested inside a transformed bento card causes coordinate offsets (appearing shifted far away).
- **The Solution**: Render the context menu inside a React Portal bound directly to `document.body` (outside of the transformed bento containers).
- Portalling the element to `document.body` frees the popup from all transformed coordinates and parent container boundaries. The `fixed` positioning then aligns perfectly, pixel-for-pixel, with the mouse's true global cursor position (`e.clientX`, `e.clientY`).

# Detailed Blueprint
1. **React Portal Binding**:
   - Import `createPortal` from `react-dom` inside `ShortcutsWidget.tsx`.
   - Wrap the options dropdown `div` component with `createPortal(..., document.body)`.
2. **Coordinate Alignment**:
   - Maintain the dynamic client cursor `menuPos` position hooks (`clientX`, `clientY`) with screen edge safety checks.

# Operational Trace
- Edited [ShortcutsWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/ShortcutsWidget.tsx):
  - Added React `createPortal` import.
  - Line 270: Wrapped `showMenu` wrapper container within `createPortal(..., document.body)`.

# Status Assessment
- Portal-based context menu successfully implemented.
- The shortcuts dropdown now renders at the document body level, guaranteeing it opens exactly at the cursor coordinates when right-clicking a shortcut card, escaping all bento grid layout transforms.
