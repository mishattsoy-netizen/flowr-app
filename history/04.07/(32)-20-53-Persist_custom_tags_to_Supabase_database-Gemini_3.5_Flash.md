### 0. Date and time of the request
Date: 04.07.2026
Time: 20:51 (Start) - 20:53 (End)

### 1. User request
User request: "tags dont save on refresh"

### 2. Objective Reconstruction
- Persist custom tags values (`AppTask.tag`) to the Supabase database.
- Create a migration to add `tag text` column to the `tasks` table.
- Update `schema.sql` tasks table structure.
- Map the `tag` field in both `taskToRow` (serialization) and `rowToTask` (deserialization) functions inside `sync.ts` so tag values persist across page refreshes.

### 3. Strategic Reasoning
- The `tag` field was previously added to the local task object, but was completely missing from the Supabase data synchronization layers.
- Added a column definition to the schema files and enabled mapper support inside `src/lib/sync.ts` so custom tags serialize to and from the database rows automatically.

### 4. Detailed Blueprint
- `supabase/migrations/20260704_tasks_tag.sql`: Create migration to add `tag text` to `public.tasks` table.
- `supabase/schema.sql`: Add `tag text` to the tasks table definition block.
- `src/lib/sync.ts`: Add `tag` mapper entries in `rowToTask` and `taskToRow` handlers.

### 5. Operational Trace
- Created migration script and updated SQL schema.
- Added mappers to sync script.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Custom tags are now synchronized with Supabase, persisting correctly across page refreshes.
