-- Add subtasks JSONB column to tasks table to persist subtask arrays
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subtasks jsonb DEFAULT '[]'::jsonb;
