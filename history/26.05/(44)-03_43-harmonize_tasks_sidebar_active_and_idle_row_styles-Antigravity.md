### 0. Date and time of the request
Date: 2026-05-26
Time: 03:43

### 1. User request
User request: "in tasks rows and action buttons should have same hover and idle stlyes as in other pages"

### 2. Objective Reconstruction
Re-state the request clearly and professionally:
- Align the active, idle, and hover styles of the Tasks sidebar lists and action buttons in the layout drawer to match the rest of the application's branding design.
- Change the light active background styling (`!bg-[var(--bone-10)]`) of selected filter rows ("All tasks" and active workspace rows) to the standard premium active background style (`!bg-dark`).
- Add the standard smooth transitions class (`transition-all`) to all task rows and button selectors to prevent abrupt color changes.

### 3. Strategic Reasoning
- **Branding Uniformity**: Active navigation items in all other pages and sections of the Left Sidebar use `bg-dark` or `!bg-dark` (a deep, premium dark tone). The Tasks section previously had a much lighter active background color (`!bg-[var(--bone-10)]`), causing visual mismatch.
- **Visual Motion Standards**: Transition speed and color fade curves were missing on all task view rows, causing instant background and color shifts. Integrating the `transition-all` utility class creates a smooth hover experience.

### 4. Detailed Blueprint
- **Files Modified**:
  - `src/components/layout/Sidebar.tsx`
- **Changes Planned**:
  - Re-key active conditions `trackerFilterWorkspace === null` and `trackerFilterWorkspace === ws.id` to apply `!bg-dark` and `!text-[var(--bone-100)]`.
  - Append `transition-all` class to the container definitions for the `New Task` action button, the `All tasks` row, the workspace buttons, and default sidebar new-item/new-page button selectors.

### 5. Operational Trace
- **File Edited**: [Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/layout/Sidebar.tsx)
  - Updated Tasks view row class declarations to replace `!bg-[var(--bone-10)]` with `!bg-dark` and append `transition-all`:
    ```tsx
    // New Task Button
    className="sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)] transition-all"
    
    // All Tasks Button
    className={cn(
      "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)] transition-all",
      trackerFilterWorkspace === null && "!bg-dark !text-[var(--bone-100)]"
    )}

    // Workspace list buttons in tasks mode
    className={cn(
      "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)] transition-all",
      trackerFilterWorkspace === ws.id && "!bg-dark !text-[var(--bone-100)]"
    )}
    
    // Default action buttons
    className="sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent  text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)] transition-all"
    ```

### 6. Status Assessment
- **Completed**: Fully aligned the active, idle, and hover styles of Tasks navigation and buttons to use standard branding colors and transitions.
- **Verification**: Verified sidebar components compile successfully and all rows transition smoothly with proper active indicators.
