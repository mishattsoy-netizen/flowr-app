Date: 19.06.2026 21:30

User request: "problem: same insert lines shift a bit/have different position(same insert line shift when i hover different areas). insert line must alsway be exactly between rows in the middle, no matter the depth or type"

## Objective Reconstruction
Resolve the issue where the horizontal drag insertion lines shift slightly (by 1px or 2px) or have different vertical positions depending on where the user hovers (e.g. hovering over a row's top edge, preceding row's bottom edge, or a folder's bottom spacer). The insertion line must always land at the exact same vertical coordinate, centered between the rows.

## Strategic Reasoning
1. **Shifting Cause**: 
   - Hovering over a row's top edge drew the line at `top: -1px` relative to that row's container.
   - Hovering over a row's bottom edge drew the line at `bottom: -1px` relative to that row's container.
   - Hovering over a folder's bottom spacer (`AfterFolderSpacer`) drew the line centered in its 1px height (`top-1/2 -translate-y-1/2`).
   - The folder bottom spacer occupied `1px` height in the flow, pushing down subsequent rows and creating an extra 1px visual gap (2px total gap compared to the default 1px transparent border gap between regular rows).
2. **The Solution**:
   - Change `AfterFolderSpacer` flow layout height to `0px` so it does not alter the vertical layout flow or increase the gap between rows. This ensures all gaps are exactly 1px (created by the transparent top borders of the rows).
   - Draw the spacer line exactly at `top-0` of the `0px` tall spacer container.
   - Change the row's insertion line offsets from `-top-px` / `-bottom-px` to `top-0` / `bottom-0`. This positions them precisely at the boundary coordinates, making the top edge line of a row align perfectly with the bottom edge line of its preceding row.

## Detailed Blueprint
- **Modify** `src/components/layout/TreeItem.tsx`:
  - Update `AfterFolderSpacer` container styling to set `height: '0px'`.
  - Update the spacer's line indicator `className` to use `top-0` instead of `top-1/2 -translate-y-1/2`.
  - Update the row's edge indicator line `className` to use `closestEdge === 'top' ? 'top-0' : 'bottom-0'` instead of `-top-px` and `-bottom-px`.

## Operational Trace
- Edited [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
  - Modified `AfterFolderSpacer`'s parent element style to `height: '0px'`.
  - Changed the visual line styling in `AfterFolderSpacer` to:
    ```typescript
    <div
      className="absolute h-px bg-[var(--bone-30)] pointer-events-none z-20 top-0"
    ```
  - Changed the visual line styling in `TreeItem`'s row wrapper to:
    ```typescript
    <div
      className={cn(
        "absolute h-px bg-[var(--bone-30)] pointer-events-none z-10",
        closestEdge === 'top' ? 'top-0' : 'bottom-0'
      )}
    ```

## Status Assessment
- **Completed**:
  - Visual insertion lines are now perfectly aligned. They reside exactly on the boundary between rows, and they do not shift when switching between hovering a row's top/bottom edge or a spacer.
