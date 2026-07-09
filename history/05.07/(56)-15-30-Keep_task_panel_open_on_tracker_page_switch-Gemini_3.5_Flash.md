User request: "when i click it, dont close task panel, just swtich pages"

### 0. Date and time of the request
July 5, 2026, 15:30 PM (Local Time)

### 1. User request
"when i click it, dont close task panel, just swtich pages"

### 2. Objective Reconstruction
Modify the page-switch listener inside the `TaskInspectorPanel` to prevent closing the panel when the user clicks the "Open in tracker" button to navigate to the Tracker page.

### 3. Strategic Reasoning
- The page-switch logic closes the task panel when `activeEntityId` changes to ensure clean transition boundaries.
- To bypass this auto-close behavior specifically when clicking the "Open in tracker" header button, we introduced a mutable ref flag `isTransitioningToTrackerRef`.
- On button click, the flag is set to `true` before navigating.
- Inside the auto-close `useEffect` check, if the flag is `true`, we reset it to `false` and return early, thereby preserving the open task panel state on the tracker page.

### 4. Detailed Blueprint
- **Files involved**:
  - [TaskInspectorPanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/tracker/TaskInspectorPanel.tsx)
- **Modifications**:
  - Add `isTransitioningToTrackerRef` ref inside `TaskInspectorPanel`.
  - Check `isTransitioningToTrackerRef.current` inside the `useEffect` that monitors `activeEntityId`. If true, set it to false and skip calling `closeTaskPanel()`.
  - Set `isTransitioningToTrackerRef.current` to true on "Open in tracker" button click.

### 5. Operational Trace
- Added the reference `isTransitioningToTrackerRef` inside `TaskInspectorPanel`.
- Updated the auto-close effect to bypass closing when the reference is flag-active.
- Modified the click handler of the header button to set the reference.

### 6. Status Assessment
- Successfully implemented the persistence feature for the task panel when switching to the tracker page.
