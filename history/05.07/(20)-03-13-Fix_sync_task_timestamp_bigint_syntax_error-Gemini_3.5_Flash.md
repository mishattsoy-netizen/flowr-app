### 0. Date and time of the request
Date: 05.07.2026
Time: 03:13 (Start) - 03:13 (End)

### 1. User request
User request:
"## Error Type
Console Error

## Error Message
[Flowr sync] upsertTask: \"invalid input syntax for type bigint: \\\"2026-07-05T00:12:41.091Z\\\"\""

### 2. Objective Reconstruction
- Fix a database synchronization syntax error where the tasks table `created_at` and `completed_at` columns (which are of type `bigint`) received formatted ISO string values instead of epoch numbers, resulting in a database write failure.

### 3. Strategic Reasoning
- The `tasks` table uses `bigint` for its epoch timestamps, unlike the `entities` table which uses `timestamptz` for `created_at`.
- Updated `taskToRow` in `src/lib/sync.ts` to output milliseconds epoch values (`number`/`bigint`) for the `created_at` and `completed_at` properties instead of calling `.toISOString()`.

### 4. Detailed Blueprint
- `src/lib/sync.ts`:
  - Modify `taskToRow` to write numeric milliseconds values for `row.created_at` and `row.completed_at` (utilizing `.getTime()` as a fallback if the input was formatted as a date/string).

### 5. Operational Trace
- Adjusted timestamp mapping in `sync.ts`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Timestamps are now written as valid numeric bigints, fixing the upsert syntax error.
