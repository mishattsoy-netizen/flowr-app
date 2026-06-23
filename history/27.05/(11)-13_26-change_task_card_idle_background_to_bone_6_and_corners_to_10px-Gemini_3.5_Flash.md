Date: 27.05.2026, Time: 13:26

User request: "use bone 6 as bg idle and use 10px corners"

### 2. Objective Reconstruction
1. Update the background color of task cards on the board from `bg-[var(--bone-2)]` to `bg-[var(--bone-6)]` on idle.
2. Refactor the border-radius corners of the task cards (including the active dragging placeholder shadow) from 12px (`rounded-[12px]`) to 10px (`rounded-[10px]`) for a more compact and visual flow.

### 3. Strategic Reasoning
- **Premium Background Harmonization**: Changing the card idle background to `bone-6` raises the visual priority of the cards, making them blend naturally with the board panel container's dark glass appearance.
- **Tighter Corner Alignment**: 10px corners look tighter and fit standard UI layouts more elegantly, providing a great, balanced flow between the widgets and board cells.

### 4. Detailed Blueprint
- **TaskCard.tsx**:
  - Update `bg-[var(--bone-2)]` to `bg-[var(--bone-6)]` in `TaskCardUI` outer layout container.
  - Change `rounded-[12px]` to `rounded-[10px]` on the `TaskCardUI` outer container classes.
  - Update `rounded-[12px]` to `rounded-[10px]` on the sortable `isDragging` placeholder block.

### 5. Operational Trace
- Replaced card background style to `bg-[var(--bone-6)]` inside `TaskCardUI`.
- Adjusted all `rounded-[12px]` card wrappers to `rounded-[10px]` inside `TaskCard.tsx`.
- Ran type-checks using `npx tsc --noEmit` and confirmed 0 errors.

### 6. Status Assessment
- **Task Card Background**: Changed to `bone-6` on idle.
- **Task Card Corners**: Unified to 10px radius.
- Codes compiled perfectly.
