Date and time: 31.05.2026, 23:41

User request: "dont use dashed border for unsorted, just simple soft fill"

### Objective Reconstruction
Refine the "Unsorted" placeholder styling for the workspace selection button to use a simple, solid, soft transparent background fill instead of a dashed border outline.

### Strategic Reasoning
- Removed the dashed border classes (`border-dashed border-[var(--bone-15)]`) to give a smoother, cleaner, and less busy presentation that seamlessly fits into the workspace properties grid.
- Used a soft semi-transparent solid fill (`bg-[var(--bone-6)]/30` transitioning to `bg-[var(--bone-6)]/50` on hover) as a placeholder styling, maintaining the premium dark glassmorphic look.

### Detailed Blueprint
- Update `/src/components/modals/NewTaskModal.tsx`:
  - Swap the classes of the `!workspaceId` (Unsorted) fallback button trigger to use solid background opacity and transparent borders instead of dashed boundaries.

### Operational Trace
- Swapped background and border styles in `/src/components/modals/NewTaskModal.tsx`.
- Kept the transition class as `transition-none` to honor the 0ms instant-response requirement for interactive UI components.

### Status Assessment
- Dashed border completely replaced with a clean, soft background fill.
- Style is fully polished, consistent, and verified.
