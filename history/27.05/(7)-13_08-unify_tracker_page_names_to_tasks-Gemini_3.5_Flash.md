User request: "unify Tasks page to Tasks, not calendar or tracker"

# History Report: Unify Tasks Page Names to Tasks

### 0. Date and Time of the Request
- Date: May 27, 2026
- Completion Time: 1:08 PM

### 1. User Request
User request: "unify Tasks page to Tasks, not calendar or tracker"

### 2. Objective Reconstruction
- Unify all visual references of the task manager page to **"Tasks"** instead of "Tracker" or "Calendar".
- Update the page header title inside `TrackerPage.tsx` from "Tracker" to "Tasks".
- Update the navigation breadcrumbs, page path resolver, tab icons, and tab labels inside `HeaderBar.tsx` to read "Tasks" and use the `ListTodo` icon (matching the sidebar).

### 3. Strategic Reasoning
- The page was visually fragmented: labeled "Tasks" in the sidebar, but "Calendar" in the top tabs, and "Tracker" in the page header.
- Unifying all labels and icons to "Tasks" and `ListTodo` provides a perfectly consistent visual experience that matches intuitive user navigation.

### 4. Detailed Blueprint
- **`src/components/layout/HeaderBar.tsx`**:
  - Import `ListTodo` from `lucide-react`.
  - Update path generator title for `'tracker'` to `'Tasks'` and icon to `'ListTodo'`.
  - Update tab renderer for `'tracker'` to set `title = 'Tasks'` and `Icon = ListTodo`.
  - Update hover portal renderer for `'tracker'` to map the page icon to `ListTodo` instead of `Calendar`.
- **`src/components/tracker/TrackerPage.tsx`**:
  - Change the page `h1` header content from "Tracker" to "Tasks".

### 5. Operational Trace
1. **Refactored HeaderBar Tab & Breadcrumbs**:
   Updated the tab build definitions and path logic inside `HeaderBar.tsx` to reference "Tasks" and the `ListTodo` icon.
2. **Refactored Page Title**:
   Changed the page title from "Tracker" to "Tasks" in `TrackerPage.tsx`.
3. **Type Checking Verification**:
   Ran `npx tsc --noEmit` and confirmed compiling is 100% clear.

### 6. Status Assessment
- **Status**: Completed. All task manager page components are fully unified as "Tasks" with the list check icon, resulting in a cohesive experience.
