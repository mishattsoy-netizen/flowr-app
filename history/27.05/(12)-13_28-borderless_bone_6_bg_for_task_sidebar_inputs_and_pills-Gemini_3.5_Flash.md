Date: 27.05.2026, Time: 13:28

User request: "same here in the pills/containers, bone 6 bg and no borders"

### 2. Objective Reconstruction
Unify the styling of all input containers, selection buttons, priority pills, date picker triggers, description fields, and subtask composer tools inside the task details sidebar drawer (`NewTaskModal.tsx` and `date-time-picker.tsx`) to use borderless layouts with a cohesive `bg-[var(--bone-6)]` background.

### 3. Strategic Reasoning
- **Visual Harmony**: Heavy borders on metadata controls in the properties grid add visual weight. Transitioning to borderless shapes with a subtle `bone-6` background (6% opacity dark glass) matches the card board updates, keeping the layout airy, flat, premium, and unified.
- **Consistent Corner Language**: Polishing the description container corners to 10px unifies its visual language with the task card cells.
- **DatePicker Overrides**: Overriding trigger layout properties within the reusable `DatePickerTime` module creates a consistent compact scale in the grid.

### 4. Detailed Blueprint
- **NewTaskModal.tsx**:
  - **Status Pill**: Remove borders; change idle background to `bg-[var(--bone-6)]` and completed background to `bg-emerald-500/10`.
  - **Priority Segmented Buttons**: Remove borders; set inactive button backgrounds to `bg-[var(--bone-6)]` and active colors to borderless tinted states.
  - **Workspace Popover Trigger**: Remove borders and change background to `bg-[var(--bone-6)]`.
  - **Description Container**: Remove borders, change background to `bg-[var(--bone-6)]`, and corners to `rounded-[10px]`.
  - **Subtask Composer**: Remove borders from input fields and add buttons, changing backgrounds to `bg-[var(--bone-6)]`.
- **date-time-picker.tsx**:
  - Update `DatePickerTime` date and time button triggers to a compact `h-8 rounded-[6px] px-3 border-none bg-[var(--bone-6)] hover:bg-[var(--bone-10)]` layout.

### 5. Operational Trace
- Modified button trigger styles inside [date-time-picker.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/ui/date-time-picker.tsx).
- Polished all grid buttons, popover triggers, textarea containers, and subtask composer inputs inside [NewTaskModal.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/modals/NewTaskModal.tsx) to be borderless with `bone-6` fills.
- Verified TypeScript compilation using `npx tsc --noEmit` and confirmed 0 errors.

### 6. Status Assessment
- **Property Pills**: Completed. Borderless `bone-6` status, priority, workspace, and date pickers.
- **Textarea & Input Fields**: Completed. Borderless `bone-6` description box and subtask inputs.
- All styles compiled perfectly.
