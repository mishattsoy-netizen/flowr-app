# Report: Enable Unsorted Section DND Insert Lines

## 0. Date and Time of the Request
Date: 2026-06-19
Time: 03:43 AM

## 1. User Request
User request: "unsorted section doesnt have insert lines"

## 2. Objective Reconstruction
- Enable drag-and-drop insert (top and bottom) indicator lines for top-level items in the "Unsorted" section of the sidebar.
- Maintain correct styling behavior so that top-level unsorted items are not treated or styled as workspaces.

## 3. Strategic Reasoning
- The drag-and-drop system determines whether to suppress insert lines for regular items dragged onto workspaces using the `isTargetWorkspace = depth === 0` check.
- Because items in the "Unsorted" section are rendered at `depth === 0` (top-level), this check incorrectly evaluated to `true` for all unsorted items.
- As a result, regular items dragged over other regular items in the Unsorted section had their drop indicators suppressed.
- By checking both `depth === 0` and `entity.type === 'workspace' || entity.type === 'collection'`, we limit workspace checks strictly to actual workspaces, allowing correct calculation of top/bottom edges for unsorted items.

## 4. Detailed Blueprint
- Modify `isTargetWorkspace` definition in the drop target `getData` function in [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx) to check for type `'workspace'` or `'collection'`.
- Modify `isWorkspace` styling check in the render section of [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx) to ensure consistent layout and rounded corners application.

## 5. Operational Trace
- Modified [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx) around line 293:
  ```diff
  -        const isTargetWorkspace = depth === 0;
  +        const isTargetWorkspace = depth === 0 && (entity.type === 'workspace' || entity.type === 'collection');
  ```
- Modified [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx) around line 561:
  ```diff
  -  const isWorkspace = depth === 0;
  +  const isWorkspace = depth === 0 && (entity.type === 'workspace' || entity.type === 'collection');
  ```

## 6. Status Assessment
- **Insert lines in Unsorted**: Dragging items within the Unsorted list now correctly shows insertion indicator lines.
- **Workspace reordering**: Dragging workspaces over workspaces continues to support insert lines.
- **Mixed drag suppression**: Dragging regular items over workspaces correctly suppresses inserting them between workspaces.
