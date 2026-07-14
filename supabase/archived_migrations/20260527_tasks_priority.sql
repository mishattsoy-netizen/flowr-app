-- Add priority TEXT column to tasks table to persist task priorities
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority text CHECK (priority IN ('low', 'medium', 'high'));
