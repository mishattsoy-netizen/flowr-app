### 0. Date and time of the request
Date: 05.07.2026
Time: 02:59 (Start) - 02:59 (End)

### 1. User request
User request: "NO border, change idle text color to dark and bone 100 on hover and add icon"

### 2. Objective Reconstruction
- Refine the monochromatic "Done" button at the bottom of the task inspector panel:
  - Remove all borders (including the hover-state borders).
  - Explicitly set the idle text color to high-contrast dark (`text-black`).
  - Transition the text color to `text-[var(--bone-100)]` on hover.
  - Prefix the button label with a checkmark icon (`Check` from `lucide-react`).

### 3. Strategic Reasoning
- Removed the `border` and `hover:border` classes to keep the button's edges completely flat and seamless.
- Changed the text color to `text-black` to guarantee full readability on top of the default solid white/light `var(--bone-100)` background color.
- Inserted the `Check` icon to give the action a clear visual signifier.

### 4. Detailed Blueprint
- `src/components/tracker/TaskInspectorPanel.tsx`: Refactor Done button className and inner contents at line 737 to add the checkmark icon and remove the border classes.

### 5. Operational Trace
- Modifed the class list and element structure inside `TaskInspectorPanel.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. The Done button is now a borderless checkmark button with high-contrast color states.
