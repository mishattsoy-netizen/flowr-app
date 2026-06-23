# History Report — Subtask Delete Button Hover Fix

### 0. Date and Time
May 28, 2026 at 01:33

### 1. User Request
User request: "fix delete button in subtasks doesnt disspaear"

### 2. Objective Reconstruction
In the task creation/details popup drawer (`NewTaskModal.tsx`), subtask delete (trash can) buttons were appearing persistently on some rows even when they were not hovered. A previous attempt to fix this via React hover states was failing due to missed `onMouseLeave` events during fast mouse movements or DOM re-renders, causing multiple trash cans to remain visible.

### 3. Strategic Reasoning
React-based state tracking (`hoveredSubtaskId` via `onMouseEnter`/`onMouseLeave`) is inherently susceptible to cursor tracking drops if the user moves the mouse rapidly, if a re-render occurs mid-movement, or if the cursor leaves the window. 

The ideal, bulletproof approach is to offload hover state logic entirely to the browser's native CSS engine using standard Tailwind `group` and `group-hover:opacity-100` classes:
1. It is 100% reliable and handled natively by the browser.
2. It completely eliminates React state management and re-renders for hover tracking.
3. We implement a double-layered protection (defense-in-depth): by default, the delete button is hidden via `opacity-0 invisible` (making it both fully transparent and unclickable/unfocusable), and when hovering the row, it transitions to `group-hover:opacity-100 group-hover:visible`. This guarantees it is absolutely hidden when not hovered.

### 4. Detailed Blueprint
- **File**: `src/components/modals/NewTaskModal.tsx`
- **Modifications**:
  1. Remove React `hoveredSubtaskId` state definition.
  2. Remove `onMouseEnter` and `onMouseLeave` event handlers from each subtask row container `div`.
  3. Add `group` class to each subtask row container `div`.
  4. Replace conditional state-based classes on the delete button with pure CSS utility classes (`opacity-0 group-hover:opacity-100 invisible group-hover:visible`).

### 5. Operational Trace
- Edited `src/components/modals/NewTaskModal.tsx`:
  - Removed state: `const [hoveredSubtaskId, setHoveredSubtaskId] = useState<string | null>(null);`
  - Replaced subtask row:
    ```tsx
    <div key={sub.id} className="flex items-center gap-3" onMouseEnter={() => setHoveredSubtaskId(sub.id)} onMouseLeave={() => setHoveredSubtaskId(null)}>
    ```
    with:
    ```tsx
    <div key={sub.id} className="flex items-center gap-3 group">
    ```
  - Replaced delete button classes:
    ```tsx
    className={cn("p-1 text-[var(--bone-30)] hover:text-red-400 transition-all cursor-pointer", hoveredSubtaskId === sub.id ? "opacity-100" : "opacity-0")}
    ```
    with:
    ```tsx
    className="p-1 text-[var(--bone-30)] hover:text-red-400 transition-all cursor-pointer opacity-0 group-hover:opacity-100 invisible group-hover:visible"
    ```
- Validated build integrity using `npx tsc --noEmit`. No errors.

### 6. Status Assessment
Fixed. Subtask delete buttons now rely purely on CSS hover logic, guaranteeing they are completely hidden and un-clickable when not hovered, and animate in perfectly when the cursor enters their row.
