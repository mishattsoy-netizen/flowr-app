-- User Data Isolation Migration
-- Adds owner_id to entities and tasks, backfills from workspace ownership,
-- and enables RLS so users can only access their own data.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add owner_id columns (nullable initially to allow backfill)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill owner_id from the parent workspace
-- ─────────────────────────────────────────────────────────────────────────────

-- Entities: inherit owner from their workspace
UPDATE entities e
SET owner_id = w.owner_id
FROM workspaces w
WHERE e.workspace_id = w.id
  AND e.owner_id IS NULL
  AND w.owner_id IS NOT NULL;

-- Tasks: inherit owner from their workspace (if it has one)
UPDATE tasks t
SET owner_id = w.owner_id
FROM workspaces w
WHERE t.workspace_id = w.id
  AND t.owner_id IS NULL
  AND w.owner_id IS NOT NULL;

-- Tasks attached to an entity (but no workspace): inherit from the entity's owner
UPDATE tasks t
SET owner_id = e.owner_id
FROM entities e
WHERE t.entity_id = e.id
  AND t.owner_id IS NULL
  AND e.owner_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Indexes for performance (RLS filters will hit owner_id frequently)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_entities_owner_id ON entities(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_id ON tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Enable Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE entities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS policies — users only see/modify their own rows
-- ─────────────────────────────────────────────────────────────────────────────

-- ENTITIES
DROP POLICY IF EXISTS "entities_select_own" ON entities;
CREATE POLICY "entities_select_own" ON entities
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "entities_insert_own" ON entities;
CREATE POLICY "entities_insert_own" ON entities
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "entities_update_own" ON entities;
CREATE POLICY "entities_update_own" ON entities
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "entities_delete_own" ON entities;
CREATE POLICY "entities_delete_own" ON entities
  FOR DELETE USING (owner_id = auth.uid());

-- TASKS
DROP POLICY IF EXISTS "tasks_select_own" ON tasks;
CREATE POLICY "tasks_select_own" ON tasks
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "tasks_insert_own" ON tasks;
CREATE POLICY "tasks_insert_own" ON tasks
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "tasks_update_own" ON tasks;
CREATE POLICY "tasks_update_own" ON tasks
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "tasks_delete_own" ON tasks;
CREATE POLICY "tasks_delete_own" ON tasks
  FOR DELETE USING (owner_id = auth.uid());

-- WORKSPACES
DROP POLICY IF EXISTS "workspaces_select_own" ON workspaces;
CREATE POLICY "workspaces_select_own" ON workspaces
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "workspaces_insert_own" ON workspaces;
CREATE POLICY "workspaces_insert_own" ON workspaces
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "workspaces_update_own" ON workspaces;
CREATE POLICY "workspaces_update_own" ON workspaces
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "workspaces_delete_own" ON workspaces;
CREATE POLICY "workspaces_delete_own" ON workspaces
  FOR DELETE USING (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Settings table — also needs user scoping
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_settings_owner_id ON settings(owner_id);

-- Replace the primary key / unique-on-key with a composite (owner_id, key)
-- so each user can have their own value for the same key.
DO $$
BEGIN
  -- Drop existing unique constraint on `key` if it exists (named varies by schema)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'settings'::regclass AND contype = 'u'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE settings DROP CONSTRAINT ' || conname
      FROM pg_constraint
      WHERE conrelid = 'settings'::regclass AND contype = 'u'
      LIMIT 1
    );
  END IF;
END $$;

-- Add composite unique constraint
ALTER TABLE settings
  DROP CONSTRAINT IF EXISTS settings_owner_key_unique;
ALTER TABLE settings
  ADD CONSTRAINT settings_owner_key_unique UNIQUE (owner_id, key);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select_own" ON settings;
CREATE POLICY "settings_select_own" ON settings
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "settings_insert_own" ON settings;
CREATE POLICY "settings_insert_own" ON settings
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "settings_update_own" ON settings;
CREATE POLICY "settings_update_own" ON settings
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "settings_delete_own" ON settings;
CREATE POLICY "settings_delete_own" ON settings
  FOR DELETE USING (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Verify backfill — report any orphaned rows
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  orphan_entities int;
  orphan_tasks int;
  orphan_workspaces int;
BEGIN
  SELECT count(*) INTO orphan_entities FROM entities WHERE owner_id IS NULL;
  SELECT count(*) INTO orphan_tasks FROM tasks WHERE owner_id IS NULL;
  SELECT count(*) INTO orphan_workspaces FROM workspaces WHERE owner_id IS NULL;

  RAISE NOTICE 'Backfill complete. Orphans (will be invisible due to RLS): entities=%, tasks=%, workspaces=%',
    orphan_entities, orphan_tasks, orphan_workspaces;
END $$;
