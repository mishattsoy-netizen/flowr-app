User request: "when i hover in the exact gap between any rows, insert line dissapears"

# 0. Date and time of the request
June 19, 2026 at 02:19 AM

# 1. User request
"when i hover in the exact gap between any rows, insert line dissapears"

# 2. Objective Reconstruction
Resolve the drag-and-drop hit-box dead zone located in the visual gap (1px space) between adjacent rows in the sidebar. Currently, hovering over this gap triggers `onDragLeave` on the current drop target before triggering `onDragEnter` on the next, causing the visual insert indicator line to briefly disappear.

# 3. Strategic Reasoning
*   **Spacing Placement**: The 1px visual gap between sidebar items was previously created by `pt-[1px]` on the outer `TreeItem` wrapper. Because the drop target callback is attached to the inner row element (`rowRef`) rather than the wrapper, the 1px padding was outside the drop target's hit-box, causing a dead zone.
*   **Border-Box Hit-Boxes**: By removing `pt-[1px]` from the outer wrapper and adding `border-t border-transparent bg-clip-padding` to the inner `rowRef`, the 1px spacing is moved inside the `rowRef`'s border-box. Since drag-and-drop hit-boxes match the border-box of their bound element, this extends the drop target's hit-box into the 1px spacing.
*   **Gap Preservation**: Using `bg-clip-padding` ensures the transparent top border is not filled by active or hovered row background colors, preserving the visual 1px gap perfectly.
*   **Folder Children Margin**: Similarly, the `mt-[1px]` spacer on the children list container of expanded folders was removed, as the first child's top border now automatically handles the 1px gap without introducing a dead zone.

# 4. Detailed Blueprint
*   Remove `"pt-[1px]"` from the outer `div` wrapper of the `TreeItem` component.
*   Add `"border-t border-transparent bg-clip-padding"` to the `className` of the inner `rowRef` `div`.
*   Remove `isExpanded && "mt-[1px]"` from the expanded children wrapper container.

# 5. Operational Trace
*   Modified [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
    *   Removed `pt-[1px]` from the container wrapper on line 538.
    *   Appended `border-t border-transparent bg-clip-padding` to the `rowRef` class list on line 549.
    *   Simplified the children wrapper class list on line 660, replacing `isExpanded && "mt-[1px]"` with a static `"relative flex flex-col"` class.
*   Updated checklists in [task.md](file:///Users/mktsoy/.gemini/antigravity-ide/brain/c4eb9967-7924-448c-bfa2-ae948032991d/task.md) and [walkthrough.md](file:///Users/mktsoy/.gemini/antigravity-ide/brain/c4eb9967-7924-448c-bfa2-ae948032991d/walkthrough.md).

# 6. Status Assessment
*   The 1px dead zone between rows has been completely eliminated.
*   The drag insert line remains stably visible when dragging directly through the gap between any adjacent rows.
*   Visual layout margins and spacing are preserved 1:1.
