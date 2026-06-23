User request: "continue"

### 0. Date and Time of the Request
Date: 2026-06-07  
Time: 04:18 CEST  

### 1. User Request
"continue"

### 2. Objective Reconstruction
The goal was to resume and complete the migration of the drag-and-drop primitives from `@dnd-kit` to `@atlaskit/pragmatic-drag-and-drop` in `flowr-app`. Specifically, we needed to:
- Finish migrating all remaining block renderers in [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx) (Task 6).
- Migrate row reordering in [TableBlock.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/TableBlock.tsx) (Task 7).
- Clean up any type-checking errors and verify via vitest.

### 3. Strategic Reasoning
- **Text Selection Safety:** Passing a custom `dragHandleRef` to the row control buttons instead of making the entire block container draggable ensures text editing, focus states, and selection ranges are not interrupted.
- **Direct Element Refs:** Replaced `@dnd-kit`'s context-bound `setNodeRef` with standard React `elementRef` and `dragHandleRef`.
- **Table Block Scope Isolation:** Passed `blockId` to row drag data to prevent dragging a row from one table block into another table block.
- **Tailwind Border Indicators:** Used `[&>td]:border-t-2 [&>td]:border-t-[var(--bone-35)]` on `tr` elements to draw sibling drop borders without running into table row border-collapse quirks.

### 4. Detailed Blueprint
- **[BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx):** Replace `setNodeRef` with `elementRef` across `embed`, `link`, `column`, `columns`, list/checklist, and default text blocks. Add drop indicator borders using `closestEdge` state. Remove unused props `listeners` and `attributes` from block wrapper components and controls.
- **[TableBlock.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/TableBlock.tsx):** Remove `@dnd-kit` core and sortable imports, clean up context providers, add local `arrayMove` helper, implement custom table row `draggable` and `dropTargetForElements` inside `SortableRow`, and register a table-scoped drop monitor.

### 5. Operational Trace
1. **BlockRenderer.tsx Updates:**
   - Modified `embed`, `link`, `column`, `columns`, lists, and text blocks to use `ref={elementRef}`.
   - Appended `{closestEdge && ...}` drop indicators inside each block.
   - Cleared `listeners` and `attributes` from `BlockControls` parameters and function calls.
2. **TableBlock.tsx Updates:**
   - Removed imports from `@dnd-kit`.
   - Updated `SortableRow` and `RowHandle` to attach pragmatic-dnd hooks.
   - Added drop indicator styles using `closestEdge` and Tailwind child selectors.
   - Implemented `monitorForElements` drop handler inside `TableBlock`.
3. **Verification:**
   - Executed `npx tsc --noEmit` which completed successfully with no errors.
   - Ran automated tests with `npx vitest run ...` and got a 100% pass rate (99/99 tests).
   - Committed changes using `/usr/bin/git`.

### 6. Status Assessment
- **Completed:** Migrations for `BlockRenderer.tsx` and `TableBlock.tsx`.
- **Compilation Check:** 100% clean.
- **Test Suite:** 100% pass.
- **Next Recommendation:** Regular cache clearing and dev server restarts to ensure Next.js dev bundles are fresh.
