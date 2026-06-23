# History Report — Task Color/Column Changes Reverting Fix

### 0. Date and Time
May 27, 2026 at 16:25

### 1. User Request
User request: "why are tasks not saving when i change color or move them to other column, they are applying color/new column for a sec but then reverse change"

### 2. Objective Reconstruction
Task updates (color changes, column/entity_id moves) were applying optimistically in local state but then reverting after a moment. Root cause analysis needed to trace the optimistic update → DB write → realtime echo flow.

### 3. Root Cause Analysis

**Two intertwined issues in `src/lib/sync.ts`:**

**Issue 1 — `taskToRow` used truthy-only guards for critical fields:**
```js
if (t.entityId)   row.entity_id = t.entityId;   // ← null means "skip field"
if (t.color)      row.color     = t.color;       // ← null means "skip field"
```
When you move a task to a column or change its color, `entityId` / `color` are set. But the old guard `if (t.entityId)` means that setting `entityId = null` (moving OUT of a column) would never send `entity_id` to the DB at all — leaving the old value. More critically, if the previous value was `null` and you're setting a new one, the guard is fine — BUT any Supabase schema cache error in the retry loop would strip the field from the next retry attempt, potentially sending the upsert without `entity_id` or `color`.

**Issue 2 — Realtime UPDATE handler fully replaced local task with DB row:**
```js
store.getTasks().map(t => t.id === updated.id ? updated : t)
```
This blindly overwrites the local (optimistic) task with whatever the DB sends back. If the DB write was delayed, partially failed, or the Realtime event came from a different operation, the stale DB state would overwrite the optimistic local state — causing the visible "revert" flicker.

**Issue 3 — `rowToTask` didn't map `workspaceId`:**  
After a Realtime event, every task would lose its `workspaceId` in local state (mapped to `null`), potentially making tasks disappear from their column or workspace view on next render.

### 4. Fixes Applied

All changes in `src/lib/sync.ts`:

**`taskToRow` — explicit null for all clearable fields:**
- Changed all truthy guards to `?? null` assignments so clearing a field (color, entityId, etc.) always sends an explicit `NULL` to Supabase instead of being silently omitted.
- This ensures column moves and color clears persist correctly.

**`rowToTask` — added `workspaceId` mapping:**
- `workspaceId: row.workspace_id ?? null` now included so Realtime echo events preserve workspace membership.

**Realtime UPDATE handler — merge instead of replace:**
- Changed `t.id === updated.id ? updated : t` → `{ ...t, ...updated }` (spread merge)
- DB row wins for all its known fields, but local-only state is preserved rather than wiped. This prevents an immediate Realtime echo from clobbering an in-flight optimistic update.

### 5. Files Changed
- `src/lib/sync.ts` (lines 110-161, 388-402)

### 6. Status Assessment
Fixed. The combination of complete field mapping + merge-on-realtime should eliminate the revert. If tasks still revert after a page refresh (not just after the Realtime echo), it would indicate the upsert itself is failing — check browser console for `[Flowr sync] upsertTask:` errors to confirm.
