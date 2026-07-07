### 0. Date and time of the request
Date: 05.07.2026
Time: 04:35 (Start) - 04:35 (End)

### 1. User request
User request: "instantly hide task panel automatically when i switch between pages if opened"

### 2. Objective Reconstruction
- Automatically and instantly close the task inspector panel if it is currently open when the user navigates to a different page/entity in the app (e.g. switching between different notes, folders, chat, or workspaces).

### 3. Strategic Reasoning
- Page navigation is centrally driven by the `activeEntityId` store property.
- Added a `useEffect` hook in `TaskInspectorPanel` that compares `activeEntityId` against a cached `lastEntityIdRef.current`. When they differ (indicating a page switch), it immediately invokes the store action `closeTaskPanel()` to close/hide the inspector panel.

### 4. Detailed Blueprint
- `src/components/tracker/TaskInspectorPanel.tsx`:
  - Fetch `activeEntityId` from the store.
  - Implement a `lastEntityIdRef` to cache the initial page load ID.
  - Add a `useEffect` looking for changes in `activeEntityId` that fires `closeTaskPanel()` to instantly clear the active panel state.

### 5. Operational Trace
- Added the listener effect inside `TaskInspectorPanel`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. The task inspector panel now closes automatically and instantly when switching pages.
