-- Local-only purge: rows marked local-only get a purge_at deadline;
-- an hourly pg_cron job hard-deletes them after the 48h grace window.

ALTER TABLE entities ADD COLUMN IF NOT EXISTS purge_at timestamptz;
ALTER TABLE tasks    ADD COLUMN IF NOT EXISTS purge_at timestamptz;
ALTER TABLE spaces   ADD COLUMN IF NOT EXISTS purge_at timestamptz;

CREATE INDEX IF NOT EXISTS entities_purge_at_idx ON entities(purge_at) WHERE purge_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_purge_at_idx    ON tasks(purge_at)    WHERE purge_at IS NOT NULL;

CREATE OR REPLACE FUNCTION purge_local_only_rows()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Tasks FIRST: tasks.entity_id is ON DELETE SET NULL, so they do NOT
  -- cascade when their entity is deleted. Deleting entities first would
  -- orphan the tasks instead of removing them.
  DELETE FROM tasks    WHERE purge_at IS NOT NULL AND purge_at < now();
  -- Entities: children cascade via parent_id ON DELETE CASCADE, so even a
  -- descendant that somehow missed its purge_at stamp is removed when the
  -- workspace root goes.
  DELETE FROM entities WHERE purge_at IS NOT NULL AND purge_at < now();
  DELETE FROM spaces   WHERE purge_at IS NOT NULL AND purge_at < now();
END;
$$;

-- Requires the pg_cron extension (Dashboard > Database > Extensions > enable "pg_cron").
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Hourly. Unschedule first so re-running the migration doesn't duplicate the job.
SELECT cron.unschedule('purge-local-only')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-local-only');

SELECT cron.schedule('purge-local-only', '0 * * * *', $$SELECT purge_local_only_rows()$$);
