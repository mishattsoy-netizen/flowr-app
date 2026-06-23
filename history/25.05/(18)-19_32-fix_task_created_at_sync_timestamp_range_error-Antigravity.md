User request: "Console Error: [Flowr sync] upsertTask: \"date/time field value out of range: \\\"1779730065890\\\"\""

### 0. Date and time of the request
2026-05-25 19:29:14 (Local time)

### 1. User request
"Console Error: [Flowr sync] upsertTask: \"date/time field value out of range: \\\"1779730065890\\\"\""

### 2. Objective Reconstruction
The user reported a console error thrown during `upsertTask` in `src/lib/sync.ts`. The database was rejecting the numeric Unix millisecond timestamp string `"1779730065890"` being upserted into the `created_at` field because the database column is defined as a `timestamp` or `timestamptz` date/time type rather than a `bigint`.

### 3. Strategic Reasoning
1. **Identify type mismatch**: The database's `created_at` column is configured as a `timestamp` or `timestamptz` type in PostgreSQL, but the application was trying to insert a raw numeric string representation of the milliseconds Unix timestamp `t.createdAt` (e.g. `1779730065890`). PostgreSQL expects standard ISO 8601 strings for date/time columns.
2. **Design safe mappings**:
   - When upserting a task to the database (`taskToRow`), serialize `t.createdAt` to an ISO string (`.toISOString()`).
   - When reading a task from the database (`rowToTask`), safely parse `row.created_at` back to a millisecond number, supporting strings, numbers, and ISO strings gracefully via a robust `parseTimestamp` helper to avoid breaking typescript types on the frontend state.
   - Apply `parseTimestamp` to `rowToWorkspace` as well for maximum robustness and schema consistency.
3. **Minimize changes**: Surgical edits to the mapper functions in `src/lib/sync.ts` completely resolve the error without altering any database schemas or app state models.

### 4. Detailed Blueprint
- **File modified**: [sync.ts](file:///Users/mktsoy/Dev/flowr-4-main/src/lib/sync.ts)
- **Functions added/updated**:
  - Add `parseTimestamp(val: any): number | undefined` helper right above `rowToWorkspace`.
  - Update `rowToWorkspace` to parse `row.created_at` using `parseTimestamp`.
  - Update `rowToTask` to parse `row.created_at` using `parseTimestamp`.
  - Update `taskToRow` to serialize `t.createdAt` as an ISO string (`new Date(t.createdAt).toISOString()`).

### 5. Operational Trace
- Added the `parseTimestamp` helper function.
- Modified `rowToWorkspace` at line 24.
- Modified `rowToTask` at line 102.
- Modified `taskToRow` at line 123.
- All modifications were made cleanly using the `multi_replace_file_content` tool.

### 6. Status Assessment
- **Status**: Completed.
- **Fixed**: The date/time field out of range error during `upsertTask` is fixed. Task serialization now correctly matches Postgres `timestamptz` specifications, and parsing is fully defensive against numeric and string formats alike.
- **Recommendations**: If the user encounters other date range errors in other modules, they should apply similar serialization mapping (number ↔ ISO string) in their sync logic.
