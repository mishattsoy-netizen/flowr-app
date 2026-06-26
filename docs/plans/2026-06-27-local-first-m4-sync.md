# Flowr Local-First M4: Sync Modes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `cloudSyncEnabled` with `syncMode` (`cloud-only`, `local-only`, `full-sync`). Implement conflict resolution and cloud-to-local migration.

**Architecture:** Update Store types, migration scripts, persistence routing.

**Tech Stack:** TypeScript, React, SQL

---

### Task 1: Type & Store Migration

**Files:**
- Modify: `src/data/store.types.ts`
- Modify: `src/data/store.ts`

**Step 1: Update Types**

In `src/data/store.types.ts`, add the SyncMode type and modify interfaces:

```typescript
export type SyncMode = 'cloud-only' | 'local-only' | 'full-sync';

// In Entity interface:
// - cloudSyncEnabled?: boolean;
// + syncMode: SyncMode;

// In AppTask interface:
// + syncMode: SyncMode;

// In AppState interface:
// - cloudSyncEnabled: boolean;
// - setCloudSyncEnabled: (enabled: boolean) => void;
// - setWorkspaceCloudSync: (rootEntityId: string, enabled: boolean) => Promise<void>;
// + setSyncMode: (entityId: string, mode: SyncMode) => void;
```

**Step 2: Update Store (Version 18)**

In `src/data/store.ts`:
Change `version: 17` to `version: 18`.

In the migrate function (around line 2227):
```typescript
        if (version < 18) {
          state.entities = state.entities.map(e => {
            const { cloudSyncEnabled, ...rest } = e as any;
            return {
              ...rest,
              syncMode: cloudSyncEnabled === false ? 'local-only' : 'cloud-only'
            };
          });
          state.tasks = state.tasks.map(t => ({ ...t, syncMode: 'cloud-only' }));
          state.workspaces = state.workspaces.map(w => {
            const { cloudSyncEnabled, ...rest } = w as any;
            return rest;
          });
          delete (state as any).cloudSyncEnabled;
        }
```

Remove implementations of `setCloudSyncEnabled` and `setWorkspaceCloudSync`.
Implement `setSyncMode`:
```typescript
      setSyncMode: (entityId, mode) => set(s => ({
        entities: s.entities.map(e => e.id === entityId ? { ...e, syncMode: mode, lastModified: Date.now() } : e)
      })),
```

**Step 3: Fix Store Upserts**

In `src/data/store.ts`, replace all checks for `cloudSyncEnabled` (e.g. `if (entity.cloudSyncEnabled) upsertEntity(entity)`) with:

```typescript
if (entity.syncMode !== 'local-only') upsertEntity(entity);
```

**Step 4: Commit**

```bash
git add src/data/store.types.ts src/data/store.ts
git commit -m "feat: migrate store to version 18 with syncMode"
```

---

### Task 2: Supabase Schema Migration

**Files:**
- Create: `supabase/migrations/20260627_sync_mode.sql`

**Step 1: Write Migration SQL**

Create `supabase/migrations/20260627_sync_mode.sql`:

```sql
-- Add sync_mode
ALTER TABLE entities ADD COLUMN IF NOT EXISTS sync_mode text DEFAULT 'cloud-only';
UPDATE entities SET sync_mode = 'cloud-only' WHERE sync_mode IS NULL;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sync_mode text DEFAULT 'cloud-only';
UPDATE tasks SET sync_mode = 'cloud-only' WHERE sync_mode IS NULL;

-- Backfill missing columns to schema if not present in migration history
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subtasks jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at bigint;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_due_date text;
```

**Step 2: Commit**

```bash
git add supabase/migrations/
git commit -m "chore: add sync_mode migration script"
```

---

### Task 3: Sync Routing Update

**Files:**
- Modify: `src/lib/sync.ts`
- Modify: `src/lib/canvasSync.ts`
- Modify: `src/lib/persistence.ts`

**Step 1: Update Mappers**

In `src/lib/sync.ts`:

```typescript
// Update rowToEntity (line ~124):
// - cloudSyncEnabled: true,
// + syncMode: row.sync_mode ?? 'cloud-only',

// Update entityToRow (line ~142):
// + row.sync_mode = e.syncMode;

// Update taskToRow (line ~195):
// + row.sync_mode = t.syncMode;
```

**Step 2: Update Persistence Routing**

In `src/lib/persistence.ts`:

```typescript
export async function saveEntity(entity: Entity): Promise<void> {
  if (entity.syncMode === 'cloud-only' || entity.syncMode === 'full-sync') {
     const { upsertEntity } = await import('@/lib/sync'); // Avoid circular dep
     await upsertEntity(entity);
  }
  if (isDesktop() && (entity.syncMode === 'local-only' || entity.syncMode === 'full-sync')) {
     await saveEntityToFile(entity, []); // Hook up proper blocks later
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/sync.ts src/lib/canvasSync.ts src/lib/persistence.ts
git commit -m "feat: route persistence based on syncMode"
```

---

### Task 4: UI Updates & Bot Adaptation

**Files:**
- Modify: `src/components/workspace/WorkspacePage.tsx`
- Modify: `src/lib/bot/tools/definitions.ts`
- Modify: `src/lib/bot/tools/handlers.ts`

**Step 1: Fix WorkspacePage UI**

In `src/components/workspace/WorkspacePage.tsx`:

```tsx
// Replace: const cloudSyncOn = !!entity.cloudSyncEnabled;
// With: const cloudSyncOn = entity.syncMode !== 'local-only';
```

**Step 2: Update Bot Handlers**

In `src/lib/bot/tools/definitions.ts`, add:

```typescript
{
  name: "set_sync_mode",
  description: "Changes the sync mode of a note or folder.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Entity ID" },
      mode: { type: "string", enum: ["cloud-only", "local-only", "full-sync"] }
    },
    required: ["id", "mode"]
  }
}
```

In `src/lib/bot/tools/handlers.ts`, implement `set_sync_mode`:

```typescript
case 'set_sync_mode': {
  const { id, mode } = args;
  useStore.getState().setSyncMode(id, mode as SyncMode);
  return { success: true, message: `Sync mode set to ${mode}` };
}
```

**Step 3: Commit**

```bash
git add src/components/ src/lib/bot/
git commit -m "feat: add sync mode UI and update bot handlers"
```

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-06-27-local-first-m4-sync.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
