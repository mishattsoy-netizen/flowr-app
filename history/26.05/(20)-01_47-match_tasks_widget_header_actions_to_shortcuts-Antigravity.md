### Date and time of the request
2026-05-26 at 01:47 AM

### 1. User request
User request: "fix plus and count in tasks style to same as in shortcuts"

### 2. Objective Reconstruction
The task was to align the right-side header controls of the task widget (`SmartTaskStackWidget.tsx`) with the quiet, minimalistic style of the shortcuts widget:
- Remove the dark capsule-style task count badge (`• 1`).
- Replace the dark circular `+` button with a simple, flat, naked `+` icon button that matches shortcuts exactly.

### 3. Strategic Reasoning
- **Premium Minimalism**: Stripping unnecessary capsule badges and borders reduces visual weight and focuses attention entirely on the widget contents.
- **Micro-Interaction Alignment**: Setting the flat button state triggers hover background highlights (`hover:bg-[var(--app-dark)]`) instantly (`transition-none`), keeping interactive feedback prompt and consistent.

### 4. Detailed Blueprint
The planned changes targeted:
- **Smart Task Stack Widget (`SmartTaskStackWidget.tsx`)**: Remove the `displayTasks.length > 0` condition block rendering the count pill and change class/icon parameters on the `+` button in the header's right container.

### 5. Operational Trace
- **Modified** [SmartTaskStackWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/SmartTaskStackWidget.tsx) to remove the count badge template and style the action trigger as a naked `Plus` element using `rounded-[var(--radius-small)] text-[var(--bone-30)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)]`.

### 6. Status Assessment
- **Completed**: The header buttons are now perfectly standardized.
- **Verification**: Compilation completed successfully. Visual alignment between the widgets is perfect.
