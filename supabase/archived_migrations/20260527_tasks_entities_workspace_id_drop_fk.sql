-- tasks.workspace_id and entities.workspace_id were declared as foreign keys
-- referencing the `workspaces` table, but the app uses these columns to hold
-- the id of a sidebar entity (folder/collection/workspace-entity), not a row
-- in the `workspaces` table. The mismatch caused every save to violate the FK;
-- the sync layer silently dropped the column on retry, persisting NULL and
-- making tasks reappear as "Unsorted".
--
-- Drop the FK constraints. The columns remain plain text references resolved
-- in application code.

alter table tasks    drop constraint if exists tasks_workspace_id_fkey;
alter table entities drop constraint if exists entities_workspace_id_fkey;
