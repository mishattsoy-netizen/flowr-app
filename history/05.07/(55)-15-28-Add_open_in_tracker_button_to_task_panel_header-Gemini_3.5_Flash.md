User request: "when i have task panel opened in any other page besides tasks page, in the panel's header add open in tracker button"

### 0. Date and time of the request
July 5, 2026, 15:28 PM (Local Time)

### 1. User request
"when i have task panel opened in any other page besides tasks page, in the panel's header add open in tracker button"

### 2. Objective Reconstruction
Modify the `TaskInspectorPanel` component to include an "Open in tracker" button in its header. This button should only appear when the user is viewing a page other than the Tracker page (`tracker`), allowing them to quickly navigate to the full tasks/tracker view.

### 3. Strategic Reasoning
We want to provide quick access to the main tasks tracker board when users are managing a task from pages like the Dashboard or Chat.
- Detect whether the active page is not the tracker page using the `activeTabId` from the state store.
- If they are on another page (`activeTabId !== 'tracker'`), render a button in the right-side actions group of the panel header.
- The button uses the standard `ExternalLink` icon from `lucide-react`, matching the look, feel, hover states, and tooltip styling of other header buttons.
- Clicking the button calls `addTab('tracker')` to switch to or open the tracker tab.

### 4. Detailed Blueprint
- **Files involved**:
  - [TaskInspectorPanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/tracker/TaskInspectorPanel.tsx)
- **Modifications**:
  - Import `ExternalLink` from `lucide-react`.
  - Retrieve `activeTabId` and `addTab` from the Zustand store using the `useStore` hook.
  - Insert a `<Tooltip>` wrapped button using `ExternalLink` in the right actions section of the header.

### 5. Operational Trace
- Edited [TaskInspectorPanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/tracker/TaskInspectorPanel.tsx):
  - Added `ExternalLink` to the `lucide-react` import statement.
  - Retrieved `activeTabId` and `addTab` inside the `TaskInspectorPanel` function component.
  - Added the conditional check `{activeTabId !== 'tracker' && (...)}` to render the button before other action items in the header.

### 6. Status Assessment
- Completed the requested layout/behavior update successfully.
- Verified imports and code layout. No build errors expected.
