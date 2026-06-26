User request: "yes" (confirming proposal to add soft hover highlights)

## Date and Time
25.06.2026 19:58

## Objective Reconstruction
Add soft hover highlight styles (`hover:bg-[var(--bone-8)]` and `hover:border-[var(--bone-10)]`) to the borderless input boxes, alignment wrappers, and button grids in the properties panel (`CanvasStylePanel.tsx`).

## Strategic Reasoning
To enhance the tactile feel and visual feedback of the borderless input controls:
- Injected hover states `hover:bg-[var(--bone-8)]` and `hover:border-[var(--bone-10)]` directly to `SidebarInput` and `PillInput` configurations.
- Appended `hover:border-[var(--bone-10)]` to Alignment grids, Rotation buttons, and Border style switcher wrappers to reveal a subtle outline when hovering interactive areas.
- Added hover backgrounds and border glow to the Constrain proportions button when in its unselected state.
- Allowed rapid/instant response transitions to align with the codebase design values.

## Detailed Blueprint
- **`src/components/canvas/CanvasStylePanel.tsx`**:
  - Add `hover:bg-[var(--bone-8)] hover:border-[var(--bone-10)]` styling to `SidebarInput` and `PillInput`.
  - Add `hover:border-[var(--bone-10)]` hover indicators to Alignment, Rotation, and Border style switcher button groups.
  - Apply unselected hover styling to the Constrain proportions button.

## Operational Trace
- Edited `src/components/canvas/CanvasStylePanel.tsx` using `multi_replace_file_content`.
- Ran `npx tsc --noEmit` and verified compilation check (successful).
- Verified unit tests pass successfully with `npm test`.

## Status Assessment
- Soft hover highlights have been successfully integrated on all input fields and interactive containers.
- Inputs remain borderless at rest, but gain a soft background tint and subtle border highlight on hover.
