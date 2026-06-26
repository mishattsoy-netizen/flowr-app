# Implementation Plan — Task Realtime & Position Syncing

Resolve real-time synchronization between browsers and enable persisted vertical positioning of tasks inside Kanban columns in the Flowr application.

## User Review Required

> [!IMPORTANT]
> **Database Schema Updates Needed**
> This change requires executing SQL queries in your Supabase Dashboard SQL Editor (or using `npx supabase db push` if Supabase CLI is connected). We will write a formal migration script in the repository under `supabase/migrations/` to keep local schemas and remote databases aligned.

## Open Questions

None. The requirements and mechanics are fully mapped out.

## Proposed Changes

We will introduce a double-precision float `position` column to tasks, add the `tasks` and `entities` tables to Supabase's `supabase_realtime` publication, update the sync logic on the client, and rewrite the drag-and-drop handler to perform fractional indexing calculations.

---

### Supabase Database Layer

We will write a SQL migration to add the missing column and update the realtime publication.

#### [NEW] [20260531_sync_and_position.sql](file:///Users/mktsoy/Dev/flowr-app/supabase/migrations/20260531_sync_and_position.sql)
- Add double precision `position` column to `tasks`.
- Add `tasks` and `entities` to the `supabase_realtime` publication.

#### [MODIFY] [schema.sql](file:///Users/mktsoy/Dev/flowr-app/supabase/schema.sql)
- Reflect changes to `tasks` table schema and publication configs.

---

### Frontend Core State Layer

We will update TypeScript interfaces and the Supabase row mappers.

#### [MODIFY] [store.types.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.types.ts)
- Add `position?: number | null;` attribute to the `AppTask` interface.

#### [MODIFY] [sync.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/sync.ts)
- Map `position: row.position ?? null` in `rowToTask`.
- Map `row.position = t.position ?? null` in `taskToRow`.

---

### Kanban UI Layer

We will add a double-precision fractional position generator, update columns sorting, and make vertical drops persist to the database.

#### [MODIFY] [dragLogic.ts](file:///Users/mktsoy/Dev/flowr-app/src/components/tracker/dragLogic.ts)
- Implement `getTaskImplicitPosition(task: AppTask): number` to yield:
  - `-completedAt` (or `-createdAt`) for completed tasks (so they sort descending by default).
  - `createdAt` for other tasks.
  - The manual `position` if set.
- Implement `getOrGeneratePositions(tasks: AppTask[]): number[]` to safely interpolate or extrapolate missing/undefined positions in a column using implicit coordinates.

#### [MODIFY] [TrackerPage.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/tracker/TrackerPage.tsx)
- Sort all columns in `buildColumns` using `getTaskImplicitPosition` ascending.
- Update `commitDrop` to:
  - Generate the new fractional position using `getOrGeneratePositions`.
  - Always call `updateTask(activeItemId, { position: newPosition, ...updates })` to persist the update in Zustand and save to Supabase.

---

## Verification Plan

### Automated/Manual Testing
1. **Real-time Synchronization test**:
   - Open Flowr in two separate browser sessions (e.g., Safari and Chrome) under the same account.
   - Modify a task (change title, toggle checkmark, move column).
   - Observe that the task instantly syncs in both windows.
2. **Vertical Ordering test**:
   - Drag a task vertically within a column (e.g. "To Do") and drop it at a specific place.
   - Reload the browser.
   - Verify that the vertical position remains exactly where it was dropped.
   - Check that dragging vertically in browser A instantly reorders the list in browser B.
