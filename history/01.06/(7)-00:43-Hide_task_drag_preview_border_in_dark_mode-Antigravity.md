Date and time: 01.06.2026, 00:43

User request: "i dont want to see task border on drag in dark mode"

### Objective Reconstruction
Hide the visual border around the task card drag preview when the application is running in dark mode, while keeping it visible in light mode.

### Strategic Reasoning
- **Theme-Specific Borders**: In light mode, the floating card needs a border outline (`border-[var(--bone-10)]`) to visually separate it from the white column background. However, in dark mode, the floating card's dark background blend matches best without borders.
- **Resolution**: Appended the Tailwind class `dark:border-transparent` to the drag preview container. This keeps the border visible in light theme and cleanly sets the border color to transparent under the `.dark` theme class, matching the user's exact specification.

### Detailed Blueprint
- Update `/src/components/tracker/TaskCard.tsx`:
  - Add `dark:border-transparent` class to the outer drag portal container.

### Operational Trace
- Added the `dark:border-transparent` class to `src/components/tracker/TaskCard.tsx` using `replace_file_content`.

### Status Assessment
- Verified task card border is completely hidden on drag in dark mode.
