# History Report — Subtask Delete Button Always Visible Fix

### 0. Date and Time
May 27, 2026 at 16:17

### 1. User Request
User request: "delete button in subtasks doesn't disappear"

### 2. Objective Reconstruction
The trash/delete button on each subtask row was always visible at full opacity instead of appearing only on row hover.

### 3. Strategic Reasoning
The button had `opacity-0 group-hover/subtask:opacity-100` using a Tailwind named group variant. Named group variants (`group/subtask`) require Tailwind v3.2+ and the class names must be present in the build output — if the JIT compiler didn't pick them up (e.g. dynamic class generation edge case), the hover state never fires and the button stays visible at its inherited opacity.

Replaced with a React `hoveredSubtaskId` state tracked via `onMouseEnter`/`onMouseLeave` on each row, applying `opacity-100` or `opacity-0` conditionally. This is reliable and bypasses any Tailwind class generation issues.

### 4. Files Changed
- `src/components/modals/NewTaskModal.tsx`

### 5. Operational Trace
1. Added `const [hoveredSubtaskId, setHoveredSubtaskId] = useState<string | null>(null);`
2. Added `onMouseEnter={() => setHoveredSubtaskId(sub.id)}` / `onMouseLeave={() => setHoveredSubtaskId(null)}` on each subtask row `div`.
3. Replaced `opacity-0 group-hover/subtask:opacity-100` with `cn(..., hoveredSubtaskId === sub.id ? "opacity-100" : "opacity-0")`.
4. Removed `group/subtask` class from the row div.

### 6. Status Assessment
Completed. The delete button is now hidden by default and appears only when hovering the specific subtask row.
