### 0. Date and time of the request
Date: 04.07.2026
Time: 19:43 (Start) - 19:45 (End)

### 1. User request
User request: "add ability to attach media or files to tasks, and in collumns task cards show attachments count as pill next to priority and date(icon and count)"

### 2. Objective Reconstruction
Implement file and media attachment capabilities for Kanban tasks. Display attached files within the task inspector panel, support file uploading via `/api/ai/upload`, integrate attachments into database synchronization, and show an attachment count pill on the card component.

### 3. Strategic Reasoning
- Model Expansion: Expanded the `AppTask` type to hold a list of `TaskAttachment` elements.
- Database & Sync Compatibility: Added an `attachments` JSONB column to the database schema and updated the sync mapper logic.
- UI Consistency: Built a sleek attachments section inside the task sidebar matching the existing aesthetic and integrated it with the `mediaViewer` modal for immediate, native previewing.
- Card Footer Pill: Placed a subtle pill with a Paperclip icon and count next to priority in `TaskCard.tsx` to display file counts without cluttering cards.

### 4. Detailed Blueprint
- `src/data/store.types.ts`: Defined `TaskAttachment` type; added `attachments?: TaskAttachment[]` to `AppTask` and added `pdf` to `ModalType` `mediaViewer` options.
- `src/data/store.ts`: Re-exported and imported `TaskAttachment`.
- `src/lib/sync.ts`: Mapped `attachments` JSONB field in `rowToTask` and `taskToRow`.
- `supabase/migrations/20260704_tasks_attachments.sql`: Created DB migration.
- `supabase/schema.sql`: Updated DB schema.
- `src/components/tracker/TaskCard.tsx`: Rendered attachments count pill next to priority/date.
- `src/components/tracker/TaskInspectorPanel.tsx`: Added state, file processing, api uploading, and UI section for task attachments.

### 5. Operational Trace
- Created `supabase/migrations/20260704_tasks_attachments.sql`.
- Updated `supabase/schema.sql` tasks table columns definition.
- Modified `src/data/store.types.ts` `AppTask` and `ModalType` definitions.
- Updated `src/data/store.ts` exports.
- Updated `src/lib/sync.ts` row-to-task and task-to-row mapping.
- Modified `src/components/tracker/TaskCard.tsx` to add attachments count pill.
- Modified `src/components/tracker/TaskInspectorPanel.tsx` to implement attachments section UI, upload processing, previewing via media viewer, and deletion.
- Ran `npx tsc --noEmit` to verify type-checking and compiled successfully with 0 errors.

### 6. Status Assessment
Completed successfully. Ready for verification in dev server environment.
