User request: "change checkbox style everywhere(notes, chat, tasks widget). noe scale or transform effect on hover. border idle: bone 30 and bone 70 on hover. completed checkmark always bone 100. bone 6 always as checkbpx bg"

### 0. Date and Time of the Request
- **Date**: 19.05.2026
- **Time**: 00:10

### 1. User Request
User request: "change checkbox style everywhere(notes, chat, tasks widget). noe scale or transform effect on hover. border idle: bone 30 and bone 70 on hover. completed checkmark always bone 100. bone 6 always as checkbpx bg"

### 2. Objective Reconstruction
- Harmonize and unify checkbox controls across all application interfaces: Notes (documents checklists), Chat (assistant task lists), and the Tasks Widget (today/upcoming task lists).
- Remove all hover-based scaling, zooming, or translation transforms.
- Standardize the border color to `var(--bone-30)` when idle, transitioning smoothly to `var(--bone-70)` on hover.
- Set the checkmark icon (`Check`) color to always render in rich opaque `var(--bone-100)` when completed.
- Ensure the background fill of the checkbox is always locked to `var(--bone-6)` under all states (both idle and checked).

### 3. Strategic Reasoning
- Tying the checkboxes to a uniform design language creates a high-fidelity "Digital Instrument" feel where every interaction is identical, predictable, and solid.
- Eliminating active scale transformations (`hover:scale-105 active:scale-95`) provides an immediate, snappy desktop-like click sensation rather than bouncy mobile physics.
- Applying `--bone-6` (a warm, dark transparent overlay) as a permanent checkbox background alongside `--bone-30` (idle border) and `--bone-70` (hover border) keeps the inputs light but grounded in the dark environment, while the pure `--bone-100` checkmark offers high-fidelity contrast when marked.

### 4. Detailed Blueprint
- Files to modify:
  1. `src/components/editor/ListBlock.tsx` (Notes Checklist)
  2. `src/components/assistant/components/ChatMessage.tsx` (Chat Checklist)
  3. `src/components/workspace/widgets/SmartTaskStackWidget.tsx` (Tasks Widget List)
- Styling adjustments (Tailwind):
  - Change classes on checkbox containers to `border-[var(--bone-30)] hover:border-[var(--bone-70)] bg-[var(--bone-6)] transition-colors`.
  - Replace Checkmark class to use `text-[var(--bone-100)]` or `text-[var(--bone-100)] stroke-[3px]` explicitly.
  - Purge scaling animations (`hover:scale-*`, `active:scale-*`, etc.).

### 5. Operational Trace
- Scanned all three source files to target checkbox markup structures.
- Updated `ListBlock.tsx`:
  - Replaced border overlays and `text-bone-100` class in `RowEl` with `--bone-30`/`--bone-70`/`--bone-6` classes and `--bone-100` checkmark styling.
- Updated `ChatMessage.tsx`:
  - Adjusted the markdown custom task list item (`li` render block) wrapper to use constant `--bone-6` background, `--bone-30` idle border, `--bone-70` hover border, and `--bone-100` checkmark.
- Updated `SmartTaskStackWidget.tsx`:
  - Surgically purged scaling classes (`hover:scale-105 active:scale-95`) and converted the accent-focused toggle states (`bg-accent border-accent text-accent-foreground`) to use the same uniform `--bone-30`/`--bone-70`/`--bone-6` with `--bone-100` checkmark styling.

### 6. Status Assessment
- **Status**: Completed successfully.
- **Verification**: Toggling checkboxes anywhere in the app displays an identical, static, high-contrast, premium checkmark feeling with beautiful, scale-free hovering.
