User request: "remove borders from all boxes"

## Date and Time
25.06.2026 19:57

## Objective Reconstruction
Remove all outer borders from input boxes, coordinate fields, button groups, switcher capsules, and interactive widgets in the right properties sidebar (`CanvasStylePanel.tsx`) to achieve a clean, borderless style layout.

## Strategic Reasoning
To deliver a sleek, borderless, glassmorphism-inspired appearance:
- Changed the visible outline border `border-[var(--bone-12)]` on `SidebarInput`, `PillInput`, Alignment buttons, Rotation presets, and Border style switcher to `border-transparent`.
- Retained the `focus-within:border-[var(--brand-blue)]` highlights on inputs to ensure that active focus remains visually indicated.
- Kept the underlying `border border-transparent` settings on interactive wrappers to maintain layout size consistency and prevent layout shifts on focus/active transitions.
- Set container dividers inside button grids to transparent.

## Detailed Blueprint
- **`src/components/canvas/CanvasStylePanel.tsx`**:
  - Update `SidebarInput` and `PillInput` borders to `border-transparent`.
  - Update Alignment containers (Horiz and Vert groups) and internal separators to `border-transparent`.
  - Update Rotation preset button wrappers and dividers to `border-transparent`.
  - Update Constrain proportions button border to `border-transparent` in both locked/unlocked states.
  - Update Stroke/Border style selector wrapper border to `border-transparent`.

## Operational Trace
- Edited `src/components/canvas/CanvasStylePanel.tsx` using `multi_replace_file_content` to apply the borderless design changes.
- Checked project build integrity via `npx tsc --noEmit`.
- Verified test suite passes successfully with `npm test`.

## Status Assessment
- Outer borders on all property sidebar input boxes and button wrappers are completely removed.
- Visual feedback on focused inputs is preserved.
