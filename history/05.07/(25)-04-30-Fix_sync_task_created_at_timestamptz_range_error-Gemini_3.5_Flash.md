### 0. Date and time of the request
Date: 05.07.2026
Time: 04:30 (Start) - 04:30 (End)

### 1. User request
User request:
"## Error Type
Console Error

## Error Message
[Flowr sync] upsertTask: \"date/time field value out of range: \\\"1782872261727\\\"\""

### 2. Objective Reconstruction
- Fix a console error where the task database synchronization failed because the `created_at` field (which is a `timestamptz`/`timestamp` in the database, even though it was originally defined as `bigint` in the offline schema) received a numeric millisecond string (like `"1782872261727"`) instead of a valid ISO date/time string.

### 3. Strategic Reasoning
- The active database columns have mismatched data types: `created_at` on the `tasks` table is a date/time type (`timestamp`/`timestamptz`), while `completed_at` is a `bigint` integer.
- Therefore, `created_at` must be serialized to an ISO string (`toISOString()`) so PostgreSQL can parse it successfully. `completed_at` must remain numeric to avoid the `bigint` input syntax error fixed in a previous task.
- Additionally, fixed a compile check warning in `blocksToExportHtml.ts` by defining the missing `escapeAttr` helper.

### 4. Detailed Blueprint
- `src/lib/sync.ts`:
  - Update `taskToRow` to serialize `createdAt` using `new Date(t.createdAt).toISOString()`.
- `src/lib/editor/blocksToExportHtml.ts`:
  - Define `escapeAttr` as an alias of the existing `escapeHtml` function.

### 5. Operational Trace
- Adjusted serialization behaviors in `sync.ts` and `blocksToExportHtml.ts`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Timestamps are correctly serialized for both columns according to their real database types, and the project builds cleanly.
