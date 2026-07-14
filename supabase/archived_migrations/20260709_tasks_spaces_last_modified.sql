-- Add last_modified column to tasks and spaces for correct LWW merge
ALTER TABLE tasks  ADD COLUMN IF NOT EXISTS last_modified bigint NOT NULL DEFAULT 0;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS last_modified bigint NOT NULL DEFAULT 0;
