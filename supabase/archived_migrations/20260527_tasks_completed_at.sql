-- Add completed_at column to tasks table to support premium sorting on complete
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;
