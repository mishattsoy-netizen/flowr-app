User request: "change kanban to To do, Today, In progress, Overdue, Done. image is reference"

### 0. Date and time of the request
May 22, 2026 at 14:56 (Local Time)

### 1. User request
User request: "change kanban to To do, Today, In progress, Overdue, Done. image is reference"

### 2. Objective Reconstruction
The user wants to update the Kanban columns in the task tracker dashboard.
1. Rename the 5 default Kanban columns to match:
   - "upcoming" -> "To do"
   - "today" -> "Today"
   - "inProgress" -> "In progress"
   - "overdue" -> "Overdue"
   - "completed" -> "Done"
2. Enhance the visual design of column headers to match a premium reference style:
   - Introduce a small colored dot on the left of each column title (Amber/Yellow for To do, Blue for Today and In progress, Red for Overdue, Fuchsia/Pink for Done).
   - Display a solid circular count badge next to the title (colored in Indigo blue with white text).
   - Include action buttons (Plus "+" for task creation, and ellipsis "..." for more actions) on the right side of the header.

### 3. Strategic Reasoning
- The task board columns are dynamically mapped in frontend code on top of standard task fields (`completed` boolean and `dueDate` string).
- To preserve high efficiency and compatibility, we maintain the existing model properties and mapping keys internally while mapping them to the premium custom titles requested by the user during rendering.
- Implementing these changes directly in the React components ensures instant, high-fidelity UI rendering following the exact design specification from the user's reference image.
- By adhering to the `PREFERENCES.md` guidelines, hover effects on column buttons react with `transition-none` to guarantee immediate mouse interactive states.

### 4. Detailed Blueprint
1. **Parent Mapping (`src/components/tracker/TrackerPage.tsx`)**:
   - Update the mapping block inside column keys iteration to map keys `upcoming`, `today`, `inProgress`, `overdue`, `completed` to their title-cased custom headers respectively.
   - Address the TypeScript narrowing error where literal narrowing of `id` yields type `never` in the default case, by casting `id as string`.
2. **Column Design (`src/components/tracker/KanbanColumn.tsx`)**:
   - Define a static `DOT_COLORS` constant mapping column keys to their respective premium hex colors.
   - Refactor the header row using a flex structure to group the colored dot, custom title, and circular count badge on the left, while aligning Lucide-react action buttons (`Plus` and `MoreHorizontal`) on the right.
   - Set interactive button transitions to `transition-none` for instant UI feedback.

### 5. Operational Trace
- **Modified**: [TrackerPage.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/tracker/TrackerPage.tsx)
  - Replaced the capitalized title mapping with a custom switch mapping key to `'To do'`, `'Today'`, `'In progress'`, `'Overdue'`, and `'Done'`.
  - Added casting `(id as string)` inside the default switch case block to bypass TypeScript compilation error TS2339.
- **Modified**: [KanbanColumn.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/tracker/KanbanColumn.tsx)
  - Imported `Plus` and `MoreHorizontal` Lucide icons and `useStore`.
  - Added a `DOT_COLORS` map for premium column status dots.
  - Redesigned the header structure to embed the circle status dot, customized title font weight (`font-semibold`), indigo task count circle, and instant-response hover buttons.

### 6. Status Assessment
- **Completed**: Fully updated the Kanban board columns layout and styling to perfectly reflect the reference design.
- **Verification**: Verified TypeScript compilation via `npx tsc --noEmit`. The codebase builds with zero type errors.
