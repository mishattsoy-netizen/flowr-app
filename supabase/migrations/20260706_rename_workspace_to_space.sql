ALTER TABLE entities RENAME COLUMN workspace_id TO space_id;
ALTER TABLE tasks RENAME COLUMN workspace_id TO space_id;

ALTER TABLE canvas_blocks RENAME COLUMN workspace_id TO space_id;
ALTER TABLE workspaces RENAME TO spaces;
DROP POLICY IF EXISTS "workspaces_select_own" ON spaces;
CREATE POLICY "spaces_select_own" ON spaces FOR SELECT USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "workspaces_insert_own" ON spaces;
CREATE POLICY "spaces_insert_own" ON spaces FOR INSERT WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "workspaces_update_own" ON spaces;
CREATE POLICY "spaces_update_own" ON spaces FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "workspaces_delete_own" ON spaces;
CREATE POLICY "spaces_delete_own" ON spaces FOR DELETE USING (owner_id = auth.uid());
