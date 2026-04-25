User request: "remove this space button above searchbar in the sidabr and only leave ixon bar next to the settings button"

### 2. Objective Reconstruction
The user requested a UI simplification to remove the redundant workspace switcher button located above the search bar in the sidebar, centralizing the workspace switching functionality into the existing footer icon bar.

### 3. Strategic Reasoning
To clean up the sidebar layout and reduce visual clutter, I identified the `<WorkspaceSwitcher />` component call in `src/components/layout/Sidebar.tsx` and removed it. The footer already contains a "Spaces" trigger using the `ChevronsUpDown` icon which provides the same functionality via a context menu, fulfilling the requirement to keep only the icon bar version.

### 4. Detailed Blueprint
- Locate the top-level workspace switcher in `Sidebar.tsx`.
- Remove the conditional rendering of `<WorkspaceSwitcher />`.
- Verify that the footer switcher remains intact.
- Log the change.

### 5. Operational Trace
- Scanned `src/components/layout/Sidebar.tsx`.
- Removed line 299: `{!isSidebarCollapsed && <WorkspaceSwitcher />}`.

### 6. Status Assessment
The sidebar is now more minimal, with workspace management consolidated in the footer. The change is live in the development server.
