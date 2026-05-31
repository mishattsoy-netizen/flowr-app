User request: "make task hover in kanban smae fade speed as in widgets"

### 0. Date and time of the request
May 29, 2026 at 01:11

### 1. User request
The user requested to standardize the fade-in and fade-out animation speed of the task hover effect on the Kanban board cards to match the unified speed used in the bento dashboard widgets.

### 2. Objective Reconstruction
The objective was to align the hover state transition profiles of `TaskCard` elements and their nested interactive buttons on the Kanban board with the established brand style preference of `200ms ease-in-out` transitions.

### 3. Strategic Reasoning
1. **Consistency**: Dashboard widgets were standardized to `duration-200 ease-in-out` curves to provide a fluid and coherent tactile feel. To keep the experience premium across different pages, the primary task cards on the Kanban board must follow the exact same visual signature.
2. **Implementation**: Added transition class modifiers (`transition-all duration-200 ease-in-out` and `transition-colors duration-200 ease-in-out`) to the main task card wrapper and the child toggle checkboxes.

### 4. Detailed Blueprint
- **`TaskCard.tsx`**: Add `transition-all duration-200 ease-in-out` to the main `TaskCardUI` outer layout container and `duration-200 ease-in-out` to the checkbox borders/background state changes.

### 5. Operational Trace
1. **Modified [TaskCard.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/tracker/TaskCard.tsx)**:
   - Updated the card outer container's tailwind classes: `"transition-all duration-200 ease-in-out"`.
   - Updated the primary checkbutton transition classes to include `"duration-200 ease-in-out"`.
   - Updated the subtask checkbutton transition classes to include `"duration-200 ease-in-out"`.
2. **Typechecked and tested**:
   - Ran `npx tsc --noEmit` and confirmed zero compilation/typing errors.
   - Ran `npm run test` and verified all 44 unit tests pass successfully.

### 6. Status Assessment
- **Completed**: Hover transitions for Kanban board tasks and subtasks are completely aligned at a standard 200ms ease-in-out fade speed.
- **Active state**: Verified, type-safe, and fully integrated with existing dashboard design standards.
