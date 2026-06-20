Date: 19.06.2026 21:18

User request: "when i grag item 1 by top edge, i pickup folder 2 instead, fix it"

## Objective Reconstruction
Resolve the issue where trying to click and drag `Item 1` near its top edge accidentally picks up and drags `Folder 2` instead.

## Strategic Reasoning
1. **Accidental pickup cause**: The `AfterFolderSpacer` below `Folder 2` is rendered immediately above `Item 1`. Its invisible drag hit target has a height of `h-5` (20px) and a offset of `-top-2` (-8px). This means it extends 12px below the spacer line, overlapping the top edge of `Item 1`.
2. **Event bubbling**: The spacer is rendered inside the DOM subtree of `Folder 2`'s `TreeItem`. Because `TreeItem` is registered as a draggable element, any mousedown/dragstart events that bubble up from the spacer's hit target to `TreeItem` trigger the drag operation for `Folder 2` instead of `Item 1`.
3. **The Solution**: The spacer's hit target only needs to capture events *during* a drag operation (for detecting drop target regions). It does not need to accept any pointer events when the user is not dragging. By adding `pointer-events-none` when no drag is active, normal clicks and drag starts pass through the overlay to hit `Item 1` directly. As soon as a drag operation begins anywhere in the sidebar, we activate the spacer's hit targets by removing `pointer-events-none`.

## Detailed Blueprint
- **Modify** `src/components/layout/TreeItem.tsx`:
  - Import `monitorForElements` from `@atlaskit/pragmatic-drag-and-drop/element/adapter`.
  - Create a custom react hook `useIsDragging` that listens to global drag starts and drops.
  - Apply `useIsDragging` inside `AfterFolderSpacer`.
  - Conditionalize the `className` of the invisible hit target to add `pointer-events-none` when `isDragging` is false.

## Operational Trace
- Edited [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
  - Added `monitorForElements` import.
  - Added the `useIsDragging` hook:
    ```typescript
    function useIsDragging() {
      const [isDragging, setIsDragging] = useState(false);
      useEffect(() => {
        return monitorForElements({
          onDragStart: () => setIsDragging(true),
          onDrop: () => setIsDragging(false),
        });
      }, []);
      return isDragging;
    }
    ```
  - Inside `AfterFolderSpacer`, called `const isDragging = useIsDragging();`.
  - Conditionalized the hit target:
    ```typescript
    <div 
      className={cn(
        "absolute right-0 h-5 -top-2 bg-transparent z-10",
        !isDragging && "pointer-events-none"
      )} 
      style={{ left: `${8 + depth * 18}px` }}
    />
    ```

## Status Assessment
- **Completed**:
  - The invisible hit targets of folder spacers are now completely inert to normal clicks, preventing accidental pickup of parents when dragging child items by their top edges.
  - When dragging is active, the spacer pointer-events are enabled, preserving correct dragover/dragenter behavior and rendering insert lines.
