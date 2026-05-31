User request: "change New task button to dashboard in home page"

### 0. Date and Time of the Request
- Date: May 28, 2026
- Time: 22:39 (Local Time)

### 1. User Request
User request: "change New task button to dashboard in home page"

### 2. Objective Reconstruction
The user requested changing the "+ New Task" action button in the sidebar's default/home view layout to a navigatable "Dashboard" item. This element should:
- Use the `LayoutDashboard` icon instead of a generic action/creation plus icon.
- Navigate back to the default dashboard layout when clicked.
- Highlight as active whenever the current page is the dashboard (`activeEntityId === 'dashboard'`).

### 3. Strategic Reasoning
- **Component Isolation**: The modification is entirely visual and navigation-oriented, restricted to the sidebar component.
- **State Integration**: By utilizing existing Zustand store hooks like `setActiveEntityId` and `clearSelectedSidebarIds`, we ensure standard navigation behavior matches the application's top tab layout.
- **Aesthetic Consistency**: The active highlighting is implemented with existing `!bg-dark !text-[var(--bone-100)]` styles, standardizing it with other prominent non-tree sidebar buttons.

### 4. Detailed Blueprint
- **Files Involved**: `src/components/layout/Sidebar.tsx`
- **Logic Placement**: Inside the `else` (default home/workspace) navigation branch of the sidebar layout, replacing the secondary button "+ New Task" with a navigatable "Dashboard" row.

### 5. Operational Trace
- **Code Modification**:
  - Replaced the `openModal` onClick trigger on "+ New Task" button with `setActiveEntityId('dashboard')` and `clearSelectedSidebarIds()`.
  - Swapped the label to "Dashboard".
  - Swapped the `Plus` icon with the `LayoutDashboard` icon.
  - Added custom `cn()` classes to dynamically toggle active highlight matching state `activeEntityId === 'dashboard'`.
- **Validation**:
  - Executed `npx tsc --noEmit` to verify type safety and compilability of the whole workspace. All compiler checks passed with zero errors.

### 6. Status Assessment
- **Completed**: "+ New Task" button has successfully transitioned to an active-aware "Dashboard" button.
- **Fixed**: Enabled seamless navigation back to the dashboard from any note/canvas or collection.
- **Next Recommendations**: None, the implementation is fully complete and type-safe.
