# Report: Suppress Hover Effects During Row Drag

## 0. Date and Time of the Request
Date: 2026-06-19
Time: 04:14 AM

## 1. User Request
User request: "sometimes whe i pickup row, dimmed row's icon flicker"

## 2. Objective Reconstruction
- Fix icon and row hover state flickering on the source sidebar row when starting a drag operation or hovering over it while dragging.
- Ensure that when a row is dimmed during dragging (`isDraggingLocal === true`), its visual styles (such as background highlight, text color, and icon visibility) remain stable and ignore standard pointer hover triggers.

## 3. Strategic Reasoning
- When dragging begins, the row goes from a hovered state to a dragged/dimmed state, and the cursor eventually leaves the row boundary.
- This causes the row to exit the CSS `:hover` and Tailwind `group-hover` state, resulting in:
  - The revealable chevron button immediately hiding (opacity 0).
  - The main folder/workspace icon showing back up (opacity 1).
- This state change during the drag start causes the icon area to flicker between the chevron and folder icon.
- Additionally, if the user drags the mouse back over the source row while active, standard hover highlights would trigger on a dimmed row.
- Suppressing these hover classes when `isDraggingLocal` is `true` keeps the row styled statically and cleanly throughout the drag-and-drop session.

## 4. Detailed Blueprint
- Modify [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
  - In `getIcon()`, only apply `group-hover:opacity-0` to `mainIcon` and `group-hover:opacity-100` to the chevron button if `!isDraggingLocal` is true.
  - In the main row `div` return block, bypass row hover highlights and icon opacity changes when `isDraggingLocal` is active.

## 5. Operational Trace
- Updated [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx) around line 597:
  ```diff
              "flex items-center justify-center",
  -           isCollapsible && "group-hover:opacity-0"
  +           isCollapsible && !isDraggingLocal && "group-hover:opacity-0"
  ```
- Updated chevron button container class around line 612:
  ```diff
  -           className="sidebar-actions absolute btn-sidebar-utility opacity-0 group-hover:opacity-100"
  +           className={cn(
  +             "sidebar-actions absolute btn-sidebar-utility opacity-0",
  +             !isDraggingLocal && "group-hover:opacity-100"
  +           )}
  ```
- Updated row container class list around line 660 to disable hover backgrounds and workspace text color changes if `isDraggingLocal` is true.
- Updated row icon container opacity styling around line 676 to remain constant at `70%` instead of changing to `group-hover:opacity-100` when dragging.

## 6. Status Assessment
- **Flickering fixed**: Picking up a row dims it cleanly without triggering chevron/folder icon swap flickers.
- **Row stability**: Source rows remain visually stable and static during drag-and-drop operations.
