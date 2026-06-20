User request: "yeah but under item 2, there is item 2"

## 0. Date and time of the request
Date: 19.06.2026
Time: 18:35

## 1. User request
"yeah but under item 2, there is item 2"

## 2. Objective Reconstruction
The user clarified that in the sidebar layout, there is a sibling folder or note structure (e.g. nested under `Folder 2`, there is an expanded folder named `Item 2` which contains a note also named `Item 2`). When dragging `Item 1`, the top-edge redirect is recursively traversing past `Folder 2` into `Item 2` (folder) because it is expanded, causing the drop to incorrectly nest inside `Item 2` folder instead of dropping inside `Folder 1` as a sibling of `Folder 2`.

## 3. Strategic Reasoning
To resolve this:
- We modified `getRedirectedTarget` to stop recursive descendant traversal as soon as `current.id` equals `dragItem.parentId` (the parent of the dragged item).
- Since the item is already a child of this parent container, any drag that goes past this parent container's children represents escaping the parent container.
- Stopping at the parent container ensures `isNoOpNest` correctly evaluates to `true`, returning `edge: 'bottom'` at the parent container's depth (visual depth 2).
- This correctly draws the visual line below `Folder 2` and drops `Item 1` in `Folder 1`.

## 4. Detailed Blueprint
- **[MODIFY] [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx)**:
  - Add condition `if (current.id === dragItem?.parentId)` inside `while(true)` loop to break early.

## 5. Operational Trace
- Replaced the `while(true)` loop in `getRedirectedTarget` with the parent-container check.
- Verified that all variables are correctly scoped and typed.

## 6. Status Assessment
The traversal logic has been corrected to handle sibling subfolders/expanded children appropriately. We are ready to verify.
