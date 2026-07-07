### 0. Date and time of the request
Date: 05.07.2026
Time: 05:15 (Start) - 05:15 (End)

### 1. User request
User request: "and put it an a small pill and make creation date a bit bigger"

### 2. Objective Reconstruction
- Change the presentation style of the sync status indicator (Saving, Saved, Error) to be nested inside a small rounded pill container (`rounded-full bg-[var(--bone-6)] px-2 py-0.5`).
- Increase the text size of the creation date to `text-xs font-semibold` to make it more legible.

### 3. Strategic Reasoning
- Wrapping indicators in capsule pills improves the visual hierarchy of the header bar.
- Increasing the creation timestamp text size to `text-xs` balances the relative weights of the text and action controls.

### 4. Detailed Blueprint
- `src/components/tracker/TaskInspectorPanel.tsx`:
  - Modify `formattedCreatedAt` style class.
  - Modify the class layouts for the three `syncState` conditional render branches.

### 5. Operational Trace
- Re-styled targets inside `TaskInspectorPanel.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. The layout changes match the requested design perfectly.
