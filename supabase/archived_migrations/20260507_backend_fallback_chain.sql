-- Add fallback_chain to bot_compiled_prompt to allow dynamic chain selection for backend tasks
ALTER TABLE bot_compiled_prompt ADD COLUMN IF NOT EXISTS fallback_chain TEXT NOT NULL DEFAULT 'MEDIUM_THINKING';
