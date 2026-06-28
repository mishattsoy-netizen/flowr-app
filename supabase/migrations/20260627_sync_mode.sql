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
