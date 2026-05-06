User request: "change sidebars drag and hover border effects to bone, not accent"

### 1. Objective Reconstruction
Update the visual styling of the sidebar resize handles (both left and right) to use the "bone" design system variables instead of the orange accent color.

### 2. Strategic Reasoning
Standardizing interactive frame elements (like resizers) to use neutral "bone" variables reduces visual clutter and maintains the minimalist aesthetic. Using `--bone-30` for hover and `--bone-60` for active dragging provides clear feedback without introducing a second primary color (accent) into the layout's structural components.

### 3. Detailed Blueprint
- Identify resizer handles in `Shell.tsx`.
- Replace `bg-accent/10` with `bg-[var(--bone-15)]` for the handle background during drag.
- Replace `bg-accent/30` with `bg-[var(--bone-30)]` for the line on hover.
- Replace `bg-accent` with `bg-[var(--bone-60)]` for the line during drag.

### 4. Operational Trace
- **Shell.tsx**: Updated both the left and right sidebar resizer handles to use bone-themed colors for hover and active states.

### 5. Status Assessment
- **Completed**: Sidebar resizers updated to bone color.
- **Result**: More cohesive, neutral structural layout.
