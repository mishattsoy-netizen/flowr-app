-- Add updated_at column to bot_brain_entries table
ALTER TABLE bot_brain_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
