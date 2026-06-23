# History Report: Centered Tooltips Relative to Buttons

**Date:** 22.05.2026  
**Time:** 03:47  

User request: "tooltips should appear centered it one of the sides of the button above, below or next to"

---

## 2. Objective Reconstruction
To change the tooltip rendering logic from cursor tracking (following the mouse pointer dynamically) to centering relative to the targeted child button (above, below, or next to it). The position needs to be dynamically adjusted based on window resize and viewport scrolling, while also automatically falling back (e.g. from top to bottom) if the tooltip overflows screen boundaries.

---

## 3. Strategic Reasoning
- **Trigger-Relative Centering:** Centering relative to the button gives a much cleaner, consistent, and premium desktop application feel (mimicking systems like Cursor, Linear, or Tailwind UI).
- **Viewport Constraints:** Automatically calculating position boundaries (constraining `x` and `y` coordinates) keeps the tooltip within readable padding (8px from edges) and avoids clipping.
- **Dynamic Event Binding:** Attaching scroll and resize listeners ensures that the tooltip stays perfectly anchored to the button even if the viewport is manipulated while the tooltip is active.
- **Robust Wrapper Support:** Retaining `className="contents"` (display: contents) means zero layout shifting, and our logic falls back to measuring the trigger element's first child element natively.

---

## 4. Detailed Blueprint
- **`Tooltip.tsx`**:
  - Add a `position` prop to `TooltipProps` (defaulting to `'top'`).
  - Introduce `triggerRef` targeting the contents container.
  - In `useEffect`, compute exact trigger bounds and place tooltips precisely centered on the specified side (`top`, `bottom`, `left`, `right`) with a `6px` space gap.
  - Implement dynamic fallback if top or bottom borders are violated, and constrain `x` and `y` using bounds checking.
  - Remove all mouse-cursor track variables (`pos`, `handleMouseMove`).

---

## 5. Operational Trace
1. **Updated API and Props:** Modified `TooltipProps` and the functional signature in `Tooltip.tsx` to include `position?: 'top' | 'bottom' | 'left' | 'right'` with a default value of `'top'`.
2. **Positional Computations:** Replaced the mouse-tracking calculations in `useEffect` with dynamic trigger-bounding calculations (lines 64-121) centering the tooltip on the target.
3. **Resize & Scroll Listeners:** Configured passive event listeners for `scroll` (with viewport capture) and `resize` inside `Tooltip.tsx` to dynamically keep the tooltip anchored during viewport movement.
4. **Trigger Ref Attachment:** Bound `ref={triggerRef}` to the wrapping `div` (line 144) to enable coordinate-measuring.

---

## 6. Status Assessment
- **Button Centering:** Fully implemented. Tooltips are centered relative to their trigger element (defaults to `'top'`).
- **Layout Cohesion:** Completely consistent, elegant, and matches the premium, stable standards of modern interfaces.
- **Viewport Boundary Correction:** Prevents any clipping or offscreen rendering.
