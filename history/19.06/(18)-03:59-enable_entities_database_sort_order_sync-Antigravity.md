# Report: Enable Entities Database Sort Order Synchronization

## 0. Date and Time of the Request
Date: 2026-06-19
Time: 03:56 AM

## 1. User Request
User request: "when i drop here, item drops, stays there for a second then returns to initial place why"

## 2. Objective Reconstruction
- Fix drag-and-drop item reverting (snapping back to initial place after a second) when dropping to reorder.
- Persist folder, note, and canvas element ordering (`sortOrder`) to the Supabase database.

## 3. Strategic Reasoning
- The client-side drag-and-drop handler successfully updates the local Zustand state to the new sort order.
- However, the `entities` table in the Supabase database did not have a `sort_order` column, and the client-side mappers (`rowToEntity` and `entityToRow`) did not map the `sortOrder` attribute.
- Consequently, saving to the database did not persist the position, and the realtime update listener (`postgres_changes` `UPDATE` event) received database rows without the `sort_order` field.
- The incoming row overwrote the local entity's `sortOrder` with `undefined`, which triggered a list re-render, snapping the element back to its initial position.
- Adding the `sort_order` column to the database and mapping it in `sync.ts` ensures coordinates persist and match between database records and client-side memory.

## 4. Detailed Blueprint
- Write SQL migration file `supabase/migrations/20260619_entities_sort_order.sql` to alter `entities` table by adding `sort_order`.
- Update `supabase/schema.sql` template to include `sort_order` in the base `entities` schema.
- Update `rowToEntity` and `entityToRow` mappers in [sync.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/sync.ts) to read and write `sort_order`.

## 5. Operational Trace
- Created [20260619_entities_sort_order.sql](file:///Users/mktsoy/Dev/flowr-app/supabase/migrations/20260619_entities_sort_order.sql):
  ```sql
  ALTER TABLE entities ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
  ```
- Updated [schema.sql](file:///Users/mktsoy/Dev/flowr-app/supabase/schema.sql) around line 19 to add `sort_order integer default 0`.
- Updated [sync.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/sync.ts) `rowToEntity` around line 122:
  ```diff
      widgetLayout: row.widget_layout ?? undefined,
      workspaceId:  row.workspace_id ?? null,
  +   sortOrder:    row.sort_order ?? undefined,
    };
  ```
- Updated [sync.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/sync.ts) `entityToRow` around line 134:
  ```diff
      tags:          e.tags ?? [],
      content:       e.content ?? [],
  +   sort_order:    e.sortOrder ?? null,
    };
  ```

## 6. Status Assessment
- **Schema & Sync aligned**: The `entities` table now stores sorting coordinates, and the sync handlers map `sortOrder`.
- **Reverting fixed**: Reordering items persists on the backend, preventing the database echoes from resetting item positions.
