User request: "change this to one dropdown pill"

### 0. Date and time of the request
- **Date**: 28 May 2026
- **Time**: 02:30 local time

### 1. User request
`User request: "change this to one dropdown pill"`

### 2. Objective Reconstruction
Refactor the **Status** selector inside the task details drawer (`NewTaskModal.tsx`) from an inline, three-pill button group (To Do, In Progress, Completed) to a single premium interactive **dropdown pill** utilizing the `<Popover>` UI primitive, matching the existing workspace dropdown selector layout and adjacent field width constraints.

### 3. Strategic Reasoning
- **UI Consistency**: Aligning with the adjacent Due Date picker and Workspace selector, we set the new Status dropdown to `w-[180px]`. This yields a perfectly aligned, clean visual layout down the drawer properties column.
- **Premium Aesthetics**: Replacing the wide button group with a single semantic color-coded pill matching the current active status keeps the drawer looking spacious and uncluttered.
- **Instant Response**: Configured with `transition-none` classes to obey the universal 0ms mandate, keeping hover states and selection menus extremely sharp and instantaneous.
- **Selection Indicators**: Leveraged subtle color-matching checks (`Check` icon from `lucide-react`) on the far right of the selected popup item to match established menu spec preferences.

### 4. Detailed Blueprint
- **Files Involved**:
  - `src/components/modals/NewTaskModal.tsx`
- **Imports**: Add `ChevronDown` from `lucide-react`.
- **Replacement**: Swap lines 282–322 (triple buttons container) with a single `Popover` containing three action buttons with instant selection responses.

### 5. Operational Trace
- **Import Update**: Expanded `lucide-react` import statement to include `ChevronDown`.
- **Selector Swap**:
  - Created a `w-[180px]` container block.
  - Implemented Popover Trigger displaying current status label (To Do, In Progress, or Completed), using its respective semantic background/text colors (Blue, Amber, Emerald), and an matching colored dropdown chevron.
  - Built Popover Content options (To Do, In Progress, Completed) with selection checkmark icons and visual active background fills (`bg-[var(--bone-6)]`).
  - Added instant responsiveness with `transition-none` classes.
- **Type Checking**: Validated structural type-safety using `npx tsc --noEmit`. The codebase builds clean with 0 warnings.

### 6. Status Assessment
- **Status**: 100% Completed.
- **Next Recommendation**: Recommend refreshing the browser to enjoy the premium status selector in action inside the task drawer.
