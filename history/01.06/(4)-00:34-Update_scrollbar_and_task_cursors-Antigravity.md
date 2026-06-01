Date and time: 01.06.2026, 00:34

User request: "when i drag scrollbar or task change cursor to grab. and when hover change to pointer"

### Objective Reconstruction
Refine cursor feedback states for the custom scrollbar and task cards:
1. When hovering over the scrollbar thumb in idle state, the cursor should display as a `pointer` (hand finger).
2. When actively dragging the scrollbar thumb or a task, the cursor should display as `grabbing` (closed fist hand).

### Strategic Reasoning
- **Scrollbar Cursor States**: Originally, the custom overlay scrollbar thumb and its track container had `cursor-default` applied in all states, offering poor usability feedback. Changed the idle thumb cursor to `cursor-pointer` (which renders the interactive finger hand) and dynamically applied `cursor-grabbing` (closed fist grabbing hand) to both the track and thumb when `isDragging` is active.
- **Task Card Cursor States**: Verified that the draggable task cards (`TaskCardUI` in `src/components/tracker/TaskCard.tsx`) already implement `cursor-pointer` on idle hover (matching the "when hover change to pointer" directive) and dynamically switch to `cursor-grabbing` when `isDragging` is active (matching the "when i drag... change cursor to grab" directive).

### Detailed Blueprint
- Modify `/src/components/tracker/OverlayScrollbar.tsx`:
  - Bind custom conditional cursor styles to `isDragging`:
    - Track wrapper gets `isDragging ? "cursor-grabbing" : "cursor-default"`.
    - Thumb gets `isDragging ? "cursor-grabbing" : "cursor-pointer"`.

### Operational Trace
- Modified classes inside `/src/components/tracker/OverlayScrollbar.tsx` using `replace_file_content`.

### Status Assessment
- Scrollbar hover and drag cursor behaviors are fully implemented.
- Task card hover and drag cursor behaviors are fully checked, active, and verified.
