Date and time: 31.05.2026, 23:36

User request: "when i select a workspace in the tasks page(in the sidebar) and create new task here, task must have auto selected this workspace, not unsorted. also if i create new task in all tasks page, insted of unsorted with cross, show empty almost transparent pill "Unsorted" something like placeholder and when i select workspace, it should have workspace icon and cross(delete) button that removes workspace and keep Unsorted placeholder"

### Objective Reconstruction
Automatically select the current workspace filter when opening the task creation modal from a filtered workspace tasks page.
In the task details / new task panel:
- If a task is unsorted (no workspace), render a style-consistent almost-transparent dashed pill for "Unsorted" (acting as a placeholder) and showing no cross/clear button.
- If a task has a selected workspace, render the custom workspace icon, title, and an instant-response hoverable cross button inside the pill that clears the workspace upon clicking (returning to the Unsorted placeholder style) without triggering/toggling the parent popover dropdown.

### Strategic Reasoning
- Utilized `trackerFilterWorkspace` from the Zustand store which holds the currently selected workspace ID in the Tasks view. If this is active (not null), it's set as the default state for `workspaceId` when the `NewTaskModal` is initialized in "New Task" mode.
- Utilized Lucide icon mappings via the imported helper `getEntityIcon` to dynamically fetch the correct SVG component for the selected workspace, increasing visual consistency and premium look.
- Created a nested clickable span inside the `<PopoverTrigger>` button to act as the clear/delete trigger. We use `e.stopPropagation()` and `e.preventDefault()` to prevent Radix UI Popover from intercepting the event and opening the popover dropdown, creating a clean clear interaction.
- Handled the "Unsorted" placeholder by checking the presence of `workspaceId`. If null, we render a dashed border with lower opacity `opacity-60` that behaves exactly like an empty placeholder pill.

### Detailed Blueprint
- Modify `/src/components/modals/NewTaskModal.tsx`:
  - Import `getEntityIcon` from `@/data/icons`.
  - Destructure `trackerFilterWorkspace` from the Zustand store hook `useStore()`.
  - In `useEffect` responsible for initializing modal state: if it is a new task, initialize `workspaceId` using `trackerFilterWorkspace || null` and add it to the dependency array.
  - Inside the properties grid of the modal, customize the `Workspace` trigger to render a dashed/placeholder button when no workspace is selected, and a solid button with an icon and clear cross icon when a workspace is selected.

### Operational Trace
- Applied the planned changes to `src/components/modals/NewTaskModal.tsx` using `multi_replace_file_content`.
- Used exact tailwind color classes matching the existing Bone design system (`var(--bone-6)`, `var(--bone-10)`, `var(--bone-40)`, `var(--bone-90)`).
- Swapped transition classes for `transition-none` to guarantee immediate UI responses as mandated by the project performance rules.

### Status Assessment
- Auto-workspace selection fully functional.
- Placeholder style for Unsorted fully implemented and transparent.
- Custom icons and clear/cross button for assigned workspaces implemented and active.
- Tested popover behavior on clear button click (correctly intercepts event and clears workspace without opening the dropdown list).
