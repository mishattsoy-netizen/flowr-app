-- Migration: Allow users to claim orphaned entities, tasks, workspaces, and settings during UPSERT
-- Date: 2026-07-06

-- When UPSERTing an existing row that currently has owner_id = NULL, the database attempts an UPDATE.
-- The previous policy `USING (owner_id = auth.uid())` blocked this because NULL != auth.uid(), resulting in an RLS violation.
-- By adding `OR owner_id IS NULL` to the USING clause, we allow the UPDATE to proceed on orphan rows.
-- The `WITH CHECK (owner_id = auth.uid())` still guarantees the resulting row belongs to the user.

DROP POLICY IF EXISTS "entities_update_own" ON entities;
CREATE POLICY "entities_update_own" ON entities
  FOR UPDATE USING (owner_id = auth.uid() OR owner_id IS NULL) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "tasks_update_own" ON tasks;
CREATE POLICY "tasks_update_own" ON tasks
  FOR UPDATE USING (owner_id = auth.uid() OR owner_id IS NULL) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "workspaces_update_own" ON workspaces;
CREATE POLICY "workspaces_update_own" ON workspaces
  FOR UPDATE USING (owner_id = auth.uid() OR owner_id IS NULL) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "settings_update_own" ON settings;
CREATE POLICY "settings_update_own" ON settings
  FOR UPDATE USING (owner_id = auth.uid() OR owner_id IS NULL) WITH CHECK (owner_id = auth.uid());
