### 0. Date and time of the request
Date: 05.07.2026
Time: 00:57 (Start) - 00:58 (End)

### 1. User request
User request: "when i type in tag's field, dhow dropdown suggestions with matching tags title, or if i dont type aything show all tags in scrollable dropdown popup"

### 2. Objective Reconstruction
- Add a suggestions dropdown overlay to the "Custom Tag" input field in the task inspector panel.
- When focused and empty, the dropdown should show all existing unique tags used across other tasks in a scrollable list.
- When typing, it should filter the list to only show matching tags (case-insensitively).
- Selecting an item from the dropdown populates the input field and closes the suggestions popup.

### 3. Strategic Reasoning
- Extracted all unique tags currently in `tasks` using a dynamic `useStore(s => s.tasks)` map.
- Implemented an absolute positioned popup container nested inside a relative wrapper around the input.
- Added input handlers (`onFocus`, `onBlur`, `onChange`) to manage open states, and used a `onMouseDown` preventDefault override on suggestion items to handle clicks without losing input focus.

### 4. Detailed Blueprint
- `src/components/tracker/TaskInspectorPanel.tsx`:
  - Calculate `allTags` and filtered `filteredTags`.
  - Add dropdown visible state `isTagDropdownOpen`.
  - Replace custom tag input wrapper layout with relative container rendering the suggestions dropdown menu.

### 5. Operational Trace
- Added state hooks and suggestion list overlays inside `TaskInspectorPanel.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. The custom tag field in the task inspector now provides a fully scrollable, auto-filtering suggestions overlay matching all workspace tags.
