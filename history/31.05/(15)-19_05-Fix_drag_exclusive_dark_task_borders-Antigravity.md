# History Report

### 0. Date and time of the request
Date: 31.05.2026
Time: 19:05

### 1. User request
User request: "i dont see borders in tasks at all. i only dont want borders when i drag task in dark mode"

### 2. Objective Reconstruction
The user clarified their design intent: they want task cards in dark mode to retain their borders under normal conditions (idle and hover). They ONLY want borders to be hidden (transparent) when a task card is actively being dragged in dark mode. In light mode, the border should remain visible in all states including dragging.

### 3. Strategic Reasoning
- **Precise Targeting:** By moving the Tailwind selector override `[.dark_&]:border-transparent` out of the base task card classes and placing it exclusively inside the `isDragging` conditional block of `TaskCardUI`, we restrict the borderless state exactly as desired:
  - Normal state (idle and hover) in both light and dark themes: standard `border-[var(--bone-10)]` applies.
  - Active drag state in light mode: retains `border-[var(--bone-10)]` (since `.dark` ancestor doesn't match).
  - Active drag state in dark mode: `[.dark_&]:border-transparent` fires and overrides the border color to transparent.

### 4. Detailed Blueprint
- **Files Modified:**
  - `src/components/tracker/TaskCard.tsx`
- **Modifications:**
  - In `TaskCardUI` outer className definition, remove `[.dark_&]:border-transparent` from the base classes.
  - Append `[.dark_&]:border-transparent` to the class string returned when `isDragging` is true.

### 5. Operational Trace
- Repositioned theme-based border classes:
```diff
       className={cn(
-        "group relative p-3 rounded-[10px] border border-[var(--bone-10)] [.dark_&]:border-transparent shrink-0 touch-none select-none flex flex-col gap-2 transition-colors duration-200 ease-in-out",
+        "group relative p-3 rounded-[10px] border border-[var(--bone-10)] shrink-0 touch-none select-none flex flex-col gap-2 transition-colors duration-200 ease-in-out",
         isDragging
-          ? "bg-[var(--app-dark)] cursor-grabbing"
+          ? "bg-[var(--app-dark)] [.dark_&]:border-transparent cursor-grabbing"
           : "bg-[var(--bone-6)] cursor-pointer active:cursor-grabbing hover:bg-[var(--app-dark)]",
```
- Ran `npm run test` using `vitest` to verify TypeScript types, compilation, and layout assertions. All 73 tests completed successfully.

### 6. Status Assessment
- **Completed:** Configured task cards to only hide borders when actively being dragged under dark mode, preserving card borders in all other states.
- **Verification:** Verified passing unit tests. 73 green tests.
