-- Add status TEXT column to tasks table to support granular status tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('todo', 'in-progress', 'done'));
