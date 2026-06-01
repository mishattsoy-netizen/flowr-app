Date and time: 31.05.2026, 23:42

User request: "idle unsorted text to bone 60 and bone 100 on hver, smooth transition"

### Objective Reconstruction
Update the "Unsorted" placeholder styling for the workspace selection button to have `var(--bone-60)` as the idle text color, `var(--bone-100)` as the hover text color, and a smooth `duration-200` color transition.

### Strategic Reasoning
- Adjusted the text color to `text-[var(--bone-60)]` for higher legibility in the idle state while keeping it styled as a placeholder.
- Brightened hover text color to `hover:text-[var(--bone-100)]` for dynamic visual feedback.
- Used a smooth color transition (`transition-colors duration-200`) as requested by the user, providing a pleasant, high-fidelity micro-animation on hover.

### Detailed Blueprint
- Update `/src/components/modals/NewTaskModal.tsx`:
  - Change classes on the `!workspaceId` (Unsorted) fallback button trigger to use `text-[var(--bone-60)]`, `hover:text-[var(--bone-100)]`, and `transition-colors duration-200`.

### Operational Trace
- Swapped background, text color, and transition classes in `/src/components/modals/NewTaskModal.tsx`.

### Status Assessment
- Colors and smooth transition updated successfully according to preferences and explicit user commands.
- Verified file builds successfully.
