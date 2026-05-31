User request: "yes" (remove unused task columns from Supabase sync)

### 0. Date and time of the request
May 29, 2026 at 02:00

### 1. User request
User confirmed to remove `description` and `difficulty` fields from the Supabase task sync payload to stop 400 Bad Request errors.

### 2. Objective Reconstruction
The Supabase `tasks` table does not have `description` or `difficulty` columns. Every task upsert was failing with a 400 error, and the retry logic was causing a noisy loop of warnings in the console. The fix is to stop sending those fields.

### 3. Strategic Reasoning
Since neither field is rendered anywhere in the UI and neither column exists in the database, the cleanest fix is to remove them from both the read mapper (`rowToTask`) and the write mapper (`taskToRow`) in `sync.ts`. This avoids the retry loop entirely without touching the DB schema.

### 4. Detailed Blueprint
- **`sync.ts`**: Remove `description` and `difficulty` from both `rowToTask` and `taskToRow`.

### 5. Operational Trace
1. **Modified [sync.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/sync.ts)**:
   - Removed `description: row.description ?? undefined` from `rowToTask`.
   - Removed `difficulty: row.difficulty ?? undefined` from `rowToTask`.
   - Removed `row.description = t.description ?? null` from `taskToRow`.
   - Removed `row.difficulty = t.difficulty ?? null` from `taskToRow`.

### 6. Status Assessment
- **Completed**: Task sync no longer sends `description` or `difficulty` to Supabase.
- The 400 Bad Request errors and retry loop warnings are eliminated.
