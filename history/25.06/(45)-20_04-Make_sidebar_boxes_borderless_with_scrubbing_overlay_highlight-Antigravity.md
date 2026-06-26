User request: "no borders, just small highlight overlay, same as on focus, also when i drah by icon to change value, use this highlight effect"

## Date and Time
25.06.2026 20:04

## Objective Reconstruction
1. Remove all visible outer borders (even during hover/focus/active states) from the input boxes, alignment panels, preset groups, and switchers in the right properties sidebar (`CanvasStylePanel.tsx`).
2. Implement a borderless styling where inputs use only a background overlay highlight (`bg-[var(--bone-10)]`) on hover and focus-within states.
3. Track value scrubbing/dragging interactions using local state (`isScrubbing`) in `SidebarInput` to keep this background overlay highlight active while dragging the pointer outside of the input box bounds.

## Strategic Reasoning
- **Pure Borderless Aesthetic**: Removed all `hover:border-[var(--bone-10)]` and `focus-within:border-[var(--brand-blue)]` visual indicators, creating a completely borderless glass/bone theme.
- **Unified Highlight State**: Unified hover, focus-within, and active states under a single highlight background overlay token `bg-[var(--bone-10)]`.
- **Persistent Drag/Scrub Highlight**: Added React state (`isScrubbing`) inside the `SidebarInput` component to programmatically retain the `bg-[var(--bone-10)]` overlay highlight throughout coordinate scrubbing operations, preventing the box from losing its active visual focus when the pointer moves outside the input box boundary.

## Detailed Blueprint
- **`src/components/canvas/CanvasStylePanel.tsx`**:
  - Add `useState` from React to track state changes.
  - Implement `isScrubbing` inside `SidebarInput` and set/unset it on `onPointerDown`/`onPointerUp` scrubbing handlers.
  - Remove all outline border styles from input components and interactive button wraps.
  - Set active overlay backgrounds on hover, focus, and scrubbing.

## Operational Trace
- Edited `src/components/canvas/CanvasStylePanel.tsx` using `multi_replace_file_content`.
- Ran project compile checks via `npx tsc --noEmit` (successful).
- Verified unit test suite passes successfully with `npm test`.

## Status Assessment
- Properties panel input boxes are completely borderless and utilize the background overlay highlight design on hover, focus, and drag-scrubbing.
