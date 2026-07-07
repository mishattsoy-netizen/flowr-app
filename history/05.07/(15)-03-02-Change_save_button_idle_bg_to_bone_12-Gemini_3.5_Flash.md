### 0. Date and time of the request
Date: 05.07.2026
Time: 03:02 (Start) - 03:02 (End)

### 1. User request
User request: "change idle bg to bone 12"

### 2. Objective Reconstruction
- Change the default (idle) background styling of the "Save" action button in the task inspector panel footer to `var(--bone-12)`.
- Adjust its default (idle) text color to `var(--bone-100)` to ensure readability on the dark/semi-transparent background.

### 3. Strategic Reasoning
- Styled the Save button to be monochromatic dark/semi-transparent by using `bg-[var(--bone-12)]` as the default state, keeping the layout clean and visually cohesive with the dark theme styles.

### 4. Detailed Blueprint
- `src/components/tracker/TaskInspectorPanel.tsx`: Update the Save button styling classes.

### 5. Operational Trace
- Modified the class list inside `TaskInspectorPanel.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. The Save button's idle background is now set to `var(--bone-12)`.
