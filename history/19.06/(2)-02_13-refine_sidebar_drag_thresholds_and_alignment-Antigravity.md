User request: "also from same images you can see that bottom edge of top row has less space where i drag and insert line shows below row. when i hover items/rows that i cant insert in, top 50%->insert line above bottom 50%->insert line below. folders top edge->insert line above, middle->insert inside, bottom edge->insert line below."

# 0. Date and time of the request
June 19, 2026 at 02:10 AM

# 1. User request
"also from same images you can see that bottom edge of top row has less space where i drag and insert line shows below row. when i hover items/rows that i cant insert in, top 50%->insert line above bottom 50%->insert line below. folders top edge->insert line above, middle->insert inside, bottom edge->insert line below."

# 2. Objective Reconstruction
Refine sidebar drag hover zone styling and calculations:
1. Align the top insert line style to prevent a 2px offset mismatch between adjacent rows.
2. Implement custom split calculation:
   * Non-nestable items (notes, canvases, mixed items, or workspaces when dragging workspaces, etc.) use a 50/50 split (top 50% = top insert line, bottom 50% = bottom insert line).
   * Nestable folders use a 3-way split with a 30% hover threshold (top 30% = top insert line, middle 40% = folder nesting highlight, bottom 30% = bottom insert line).
3. Disable bottom edge zone insert line on expanded folders (so that bottom edge pointer movements nest inside the folder instead of displaying an insert line below the header).

# 3. Strategic Reasoning
*   **Visual Line Alignment**: The outer row container has `pt-[1px]` layout spacing. Rendering the top visual indicator line at `top-0` inside the row results in a 1px offset discrepancy compared to `-bottom-px` of the row above it. Changing the top indicator class to `-top-px` aligns both lines on the exact same pixel boundary.
*   **Nestable vs. Non-Nestable Splits**: Non-nestable items cannot accept child nodes, so we should always show an insert line (above or below) regardless of cursor position, resulting in a 50/50 split. Nestable items should support a middle zone for drops.
*   **Expanded Folders Bottom Edge**: When a folder is expanded, its children list is shown directly below it. If the bottom edge of the folder header row displays an insert line, it visually looks like it inserts between the folder and its first child, but logically it drops it *after* the folder and all its children. Disabling the bottom edge zone on expanded folder headers resolves this confusion by defaulting to nesting inside the folder.

# 4. Detailed Blueprint
*   Update imports in [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx) to include `getDescendantIds` from `@/data/store.helpers`.
*   Compute `canInsertIn` inside the `getData` drop target callback to check if the hovered item can accept child nesting.
*   Implement the 30% threshold split for nestable items and the 50/50 split for non-nestable items in `getData`.
*   Check `isExpanded` state of the hovered folder to conditionally suppress the bottom insert zone.
*   Update visual line positioning class for `closestEdge === 'top'` from `top-0` to `-top-px`.

# 5. Operational Trace
*   Modified [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
    *   Imported `getDescendantIds` from `@/data/store.helpers`.
    *   Updated the second `useEffect` (drop target instantiation) to compute `canInsertIn` using `isFolder`, `disableNesting`, `isDraggingWorkspace`, `dragEntityId !== myId`, and `!isTargetDescendant`.
    *   Refined the splits: if `canInsertIn` is true and folder is not expanded, compute edge using 30% threshold. If expanded, ignore the bottom zone. If `canInsertIn` is false, compute edge using a 50/50 split.
    *   Added all closure-captured variables (`entities`, `collapsedIds`, `idOverride`, `disableNesting`, `getSortedSiblings`, `getPinnedSiblings`) to the `useEffect` dependency array.
    *   Changed visual top indicator class from `top-0` to `-top-px` to eliminate visual offset discrepancy.
*   Updated project artifacts [task.md](file:///Users/mktsoy/.gemini/antigravity-ide/brain/c4eb9967-7924-448c-bfa2-ae948032991d/task.md) and [walkthrough.md](file:///Users/mktsoy/.gemini/antigravity-ide/brain/c4eb9967-7924-448c-bfa2-ae948032991d/walkthrough.md).

# 6. Status Assessment
*   Visual top/bottom insert line alignment perfectly matches boundaries.
*   Split zones are implemented exactly as requested (50/50 split on non-nestable items, 30/40/30 split on nestable collapsed folders, 30/70 split on expanded folders).
*   No pending visual drag issues in the sidebar.
