-- is_active already exists on bot_settings from the first migration.
-- Add global kill switch to bot_compiled_prompt.
ALTER TABLE bot_compiled_prompt ADD COLUMN IF NOT EXISTS global_enabled BOOLEAN NOT NULL DEFAULT true;

-- Add per-entry toggle to brain entries.
ALTER TABLE bot_brain_entries ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
