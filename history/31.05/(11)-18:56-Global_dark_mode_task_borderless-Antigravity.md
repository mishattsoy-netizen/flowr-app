# History Report

### 0. Date and time of the request
Date: 31.05.2026
Time: 18:56

### 1. User request
User request: "no border in dark mode, keep border in light mode"

### 2. Objective Reconstruction
The user requested a global design adjustment:
1. Under dark mode, task cards must be completely borderless across all visual states (idle, hover, dragging).
2. Under light mode, task cards must keep their standard border across all visual states.

### 3. Strategic Reasoning
- **Global Border Style Shift:** Instead of conditionally altering only the drag state, the base border class for task cards is modified.
- **Tailwind Utility:** By adding `dark:border-transparent` directly to the `TaskCardUI` outer container base className, we achieve this globally:
  - Under light mode, `border border-[var(--bone-10)]` renders as a soft light border in all states.
  - Under dark mode, `dark:border-transparent` cleanly overrides the base border style to make it transparent, creating a borderless layout in all states (idle, hover, and drag).

### 4. Detailed Blueprint
- **Files Modified:**
  - `src/components/tracker/TaskCard.tsx`
- **Modifications:**
  - In `TaskCardUI` className string, append `dark:border-transparent` to the base class list.
  - Remove `dark:border-transparent` from the `isDragging` ternary block to let the base classes handle border states naturally.

### 5. Operational Trace
- Replaced card border styles:
```diff
       className={cn(
-        "group relative p-3 rounded-[10px] border border-[var(--bone-10)] shrink-0 touch-none select-none flex flex-col gap-2 transition-colors duration-200 ease-in-out",
+        "group relative p-3 rounded-[10px] border border-[var(--bone-10)] dark:border-transparent shrink-0 touch-none select-none flex flex-col gap-2 transition-colors duration-200 ease-in-out",
         isDragging
-          ? "bg-[var(--app-dark)] dark:border-transparent cursor-grabbing"
+          ? "bg-[var(--app-dark)] cursor-grabbing"
           : "bg-[var(--bone-6)] cursor-pointer active:cursor-grabbing hover:bg-[var(--app-dark)]",
```
- Ran `npm run test` using `vitest` to verify TypeScript type compliance, compilation, and layout assertions. All 73 tests completed successfully.

### 6. Status Assessment
- **Completed:** Configured task cards to be borderless under dark mode globally, while keeping their standard borders intact under light mode.
- **Verification:** Verified passing unit tests. 73 green tests.
