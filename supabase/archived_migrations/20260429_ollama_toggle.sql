ALTER TABLE bot_compiled_prompt
  ADD COLUMN IF NOT EXISTS ollama_enabled BOOLEAN NOT NULL DEFAULT false;
