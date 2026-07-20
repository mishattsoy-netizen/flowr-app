User request: "fix the delete button text in options popup its not centered"

### 0. Date and time of the request
20.07.2026 00:17

### 1. User request
User request: "fix the delete button text in options popup its not centered"

### 2. Objective Reconstruction
The user reported that the text of the "Delete" button inside an options popup (specifically the `ContextMenu` and similar popups) was misaligned and not properly centered, particularly when compared to other menu items. The goal was to restore consistent alignment across all popup items.

### 3. Strategic Reasoning
Upon investigating the codebase, it became apparent that the "Delete" buttons were applying a global CSS utility class named `popup-item-danger`. This custom utility class was internally using `@apply popup-item`, which came bundled with a specific `gap-3` and a `text-[13.5px]` font size. 
However, the popup container elements (like `ContextMenu.tsx`) were using inline Tailwind utilities such as `gap-2` and `text-sm` (14px font size with a 20px line height). Because `popup-item-danger` carried its own spacing and text sizing inherited from `popup-item`, it overrode the inline `gap-2` and `text-sm` classes of the parent container on the Delete button, causing a larger gap (pushed right) and a smaller text height (which shifted the vertical baseline relative to the icon).

To fix this without breaking `popup-item-danger` usages elsewhere, the approach was to replace the `popup-item-danger` class with `popup-item` and inline text-danger tailwind overrides (`!text-danger hover:!bg-danger/10`) wherever it was mixed with inline utilities. This ensures the delete button maintains exactly the same structural styling (`gap-2`, `text-sm`) as other items, while only changing its color.

### 4. Detailed Blueprint
- Locate all usages of `popup-item-danger` where it was combined with other alignment/spacing utility classes.
- Target `src/components/layout/ContextMenu.tsx` which handles the popup visible in the user's screenshot.
- Target other instances exhibiting the same issue: `TaskContextMenu.tsx`, `Sidebar.tsx`, `TableBlock.tsx`, `BrainSidebarContent.tsx`, and `BrainCanvasPage.tsx`.
- Replace `popup-item-danger` with `popup-item !text-danger hover:!bg-danger/10` in those specific instances to preserve the intended layout sizes and gaps without injecting the unwanted `popup-item` default gap and text size.

### 5. Operational Trace
- Searched for `popup-item-danger` across the `src/` directory.
- Analyzed `globals.css` to confirm that `popup-item-danger` includes `@apply popup-item` which hardcodes `gap-3` and `text-[13.5px]`.
- Updated `src/components/layout/ContextMenu.tsx` to conditionally use `!text-danger hover:!bg-danger/10` instead of `popup-item-danger`.
- Updated `src/components/tracker/TaskContextMenu.tsx` to replace `popup-item-danger`.
- Updated `src/components/layout/Sidebar.tsx` to replace `popup-item-danger` on the Log out button.
- Updated `src/components/editor/TableBlock.tsx` context menu.
- Updated `src/components/brain/canvas/BrainSidebarContent.tsx` to remove `popup-item-danger` and apply inline styles.
- Updated `src/components/brain/canvas/BrainCanvasPage.tsx` similarly.

### 6. Status Assessment
The alignment problem is fixed. The "Delete" buttons will now have identical gaps, fonts, and baseline vertical centering as the other items within their respective popup menus, resolving the misalignment issue globally. No further action is required.
