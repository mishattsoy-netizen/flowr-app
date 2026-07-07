### 0. Date and time of the request
Date: 05.07.2026
Time: 03:55 (Start) - 03:55 (End)

### 1. User request
User request: "use circle-dashed icon in the task panel when there is no color"

### 2. Objective Reconstruction
- Update the default color dot picker trigger button in the task inspector panel so that when no color is selected/set on a task, it renders the Lucide `CircleDashed` icon instead of a custom CSS dashed-border circle.

### 3. Strategic Reasoning
- Swapped the customized CSS dashed circle styling with a native SVG icon from Lucide for improved visual accuracy and cleaner component layout logic.

### 4. Detailed Blueprint
- `src/components/tracker/TaskInspectorPanel.tsx`:
  - Import `CircleDashed` from `lucide-react`.
  - Update the trigger button so that when `!color` is true, it displays `<CircleDashed className="w-4 h-4 shrink-0" />` with `text-[var(--bone-30)]`.

### 5. Operational Trace
- Added the `CircleDashed` import and updated the SVG rendering path.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Colorless tasks now display the circle-dashed icon in the inspector header.
