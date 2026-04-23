User request: "fix overlaping widget and unknown widget, when im adding new widgets froim picker, they can bee added to layout until widget limit per layout is hit"

### Objective Reconstruction
1.  Resolve visual "overlaps" caused by widgets being pushed off the 4-row grid.
2.  Fix the "Unknown widget" error caused by the deprecated 'upcoming' type.
3.  Enforce a strict maximum limit of 12 widgets per dashboard to ensure stability.

### Strategic Reasoning
- **Overlaps**: The layout engine was allowing widgets to exist at `row: 4`, which is technically outside our 6x4 grid. The UI would then render them at the bottom, overlapping other elements or flowing out of the container. By strictly filtering out any items with `row >= MAX_ROWS` at the engine level, we ensure the UI state always matches the physical grid constraints.
- **Unknown Widget**: The 'upcoming' type was used in the default layout but was missing from the registry. I implemented a migration in the load effect to map any existing 'upcoming' instances to 'recent' and updated the default layout constants.
- **Widget Limit**: To prevent the dashboard from becoming cluttered and to keep the engine fast, I implemented a 12-widget cap in the `addWidget` function.

### Detailed Blueprint
1.  **bento-engine.ts**: Added a final filter to `rebalanceAll` to remove items exceeding `MAX_ROWS`.
2.  **BentoDashboard.tsx**: Updated `computeGridPositions` to skip any items with invalid row indices, providing a secondary layer of protection against out-of-bounds rendering.
3.  **useBentoLayout.ts**:
    *   Defined `MAX_WIDGETS = 12`.
    *   Updated `addWidget` with a length check and an alert.
    *   Updated the default layout to use `all-files` instead of `upcoming`.
    *   Added a migration step in the initialization effect.

### Operational Trace
- Modified `useBentoLayout.ts` to include the widget limit and migration logic.
- Modified `bento-engine.ts` to prune overflow widgets.
- Modified `BentoDashboard.tsx` to harden coordinate calculation.

### Status Assessment
All reported issues are resolved. The dashboard is now robust against overflow, handles legacy data gracefully, and enforces a reasonable capacity limit.
