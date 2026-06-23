### 0. Date and time of the request
Date: 2026-05-26
Time: 03:37

### 1. User request
User request: "in home rows use same dark bg fill on hover" / "in left sidebar"

### 2. Objective Reconstruction
Re-state the request clearly and professionally:
- Harmonize the hover state and transitions of all entity list rows in the left sidebar (workspaces, collections, folders, notes, and canvases) to match the dashboard widget lists and chat history panel rows.
- Introduce the standard hover background color (`hover:bg-[var(--app-dark)]`) and smooth state transition rules (`transition-all`) to non-active tree row elements in the sidebar.

### 3. Strategic Reasoning
- **UI/UX Consistency**: Sidebar tree items (rendered via `TreeItem.tsx`) only transitioned their text color on hover. This was visually inconsistent with other rows inside the dashboard widgets (e.g. RecentWidget, FoldersWidget, TasksWidget) and the chat history section, which use a solid dark background fill (`hover:bg-[var(--app-dark)]`) to create a cohesive bounding box on interactive rows.
- **Harmonized Hover Styles**: By introducing `hover:bg-[var(--app-dark)]` and `transition-all` directly inside `TreeItem.tsx`, the row-based tree navigation now shares the premium look, feel, and motion standards as the rest of the workspace and dashboard layout.

### 4. Detailed Blueprint
- **Files Modified**:
  - `src/components/layout/TreeItem.tsx`
- **Changes Planned**:
  - Include the `transition-all` utility class inside the row component container of `<TreeItem>`.
  - Add `hover:bg-[var(--app-dark)]` to the default/non-active tree element state styling block.

### 5. Operational Trace
- **File Edited**: [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/layout/TreeItem.tsx)
  - Updated className mapping for active vs non-active states:
    ```tsx
    className={cn(
      "sidebar-item-row group relative flex w-full cursor-pointer select-none transition-all",
      isEditing ? "items-start pt-[5px]" : "items-center h-7",
      "px-3 rounded-[var(--radius-small)]",
      effectiveMultiSelected
        ? "bg-[var(--app-dark)] text-[var(--bone-70)] hover:text-[var(--bone-100)]"
        : (isActive || contextMenu?.entityId === entity.id)
          ? "!bg-dark text-[var(--bone-100)] font-normal tracking-wide" 
          : "text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)]",
      isWorkspace && !isActive && "group-hover/workspace:text-[var(--bone-100)]",
      isFolderDropTarget && "sidebar-folder-drop-target",
      "text-[14px]",
    )}
    ```

### 6. Status Assessment
- **Completed**: Standardized the hover styles across all tree entity rows in the Left Sidebar to align perfectly with the Home page dashboard.
- **Verification**: Confirmed all non-active workspaces, collections, folders, and note items highlight with a smooth, premium dark background bounding fill on hover.
