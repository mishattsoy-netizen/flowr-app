Date: 27.05.2026, Time: 13:30

User request: "change drop preview style, remove border just bone 3 container"

### 2. Objective Reconstruction
Refactor the Kanban board card drag-and-drop placeholder (drop preview container) in `TaskCard.tsx` to be borderless and use a subtle, semi-transparent `bg-[var(--bone-3)]` background fill with the updated `rounded-[10px]` corner styling, replacing the dashed orange border placeholder template.

### 3. Strategic Reasoning
- **Premium Drag Aesthetics**: Heavy dashed orange borders around active drop previews clash with the flat, minimal, borderless task design we just introduced. Replacing them with a soft, solid, semi-transparent `bone-3` gray placeholder shape represents the slot cleanly and integrates beautifully.
- **Corner Syncing**: Maintaining 10px corners (`rounded-[10px]`) on the drop preview block keeps it completely in-sync with actual task cards.

### 4. Detailed Blueprint
- **TaskCard.tsx**:
  - Update `isDragging` placeholder div styling: remove `border-2 border-dashed border-[var(--accent)]/40 bg-[var(--accent)]/5` and replace with `bg-[var(--bone-3)]`.

### 5. Operational Trace
- Replaced the drag active placeholder container classes in `src/components/tracker/TaskCard.tsx` from `rounded-[10px] border-2 border-dashed border-[var(--accent)]/40 bg-[var(--accent)]/5 h-[88px]` to `rounded-[10px] bg-[var(--bone-3)] h-[88px]`.
- Verified TypeScript compilation using `npx tsc --noEmit` and confirmed 0 errors.

### 6. Status Assessment
- **Drop Preview Card**: Completed. Displays borderlessly with a subtle bone-3 dark glass slot shape.
- System is fully verified and compiles with 0 errors.
