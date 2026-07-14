-- Backend model used for admin backend actions (routine, brain sync, etc.)
ALTER TABLE bot_compiled_prompt ADD COLUMN IF NOT EXISTS backend_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash';
