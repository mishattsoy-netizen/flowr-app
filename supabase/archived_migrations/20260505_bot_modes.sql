-- Update bot_settings to support multiple modes
ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'default';
ALTER TABLE bot_settings DROP CONSTRAINT IF EXISTS bot_settings_pkey;
ALTER TABLE bot_settings ADD PRIMARY KEY (category, mode);

-- Seed think and pro prompt rows from default
INSERT INTO bot_settings (category, content, is_active, mode, updated_at)
SELECT category, content, is_active, 'think', NOW()
FROM bot_settings
WHERE mode = 'default'
  AND category IN ('core_rules', 'personality', 'answer_style', 'thinking_pattern', 'restrictions')
ON CONFLICT (category, mode) DO NOTHING;

INSERT INTO bot_settings (category, content, is_active, mode, updated_at)
SELECT category, content, is_active, 'pro', NOW()
FROM bot_settings
WHERE mode = 'default'
  AND category IN ('core_rules', 'personality', 'answer_style', 'thinking_pattern', 'restrictions')
ON CONFLICT (category, mode) DO NOTHING;

-- Seed classifier config rows for think and pro
INSERT INTO bot_settings (category, content, is_active, mode, updated_at)
SELECT category, content, is_active, 'think', NOW()
FROM bot_settings
WHERE mode = 'default'
  AND category IN ('classifier_prompt', 'classifier_keywords')
ON CONFLICT (category, mode) DO NOTHING;

INSERT INTO bot_settings (category, content, is_active, mode, updated_at)
SELECT category, content, is_active, 'pro', NOW()
FROM bot_settings
WHERE mode = 'default'
  AND category IN ('classifier_prompt', 'classifier_keywords')
ON CONFLICT (category, mode) DO NOTHING;

-- Add mode column and set it as PRIMARY KEY for bot_compiled_prompt
ALTER TABLE bot_compiled_prompt ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'default';
ALTER TABLE bot_compiled_prompt DROP CONSTRAINT IF EXISTS bot_compiled_prompt_pkey;
-- Drop legacy id column if it was used for singleton enforcement
ALTER TABLE bot_compiled_prompt DROP COLUMN IF EXISTS id;
ALTER TABLE bot_compiled_prompt ADD PRIMARY KEY (mode);

-- Warn if no default compiled prompt row exists (think/pro seeds will be empty)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bot_compiled_prompt WHERE mode = 'default') THEN
    RAISE NOTICE 'bot_compiled_prompt has no default row — think/pro seed inserts will produce no rows. Run a prompt sync after applying this migration.';
  END IF;
END $$;

-- Seed think and pro compiled prompt rows from default
INSERT INTO bot_compiled_prompt (content, compiled_at, entry_count, global_enabled, ollama_enabled, backend_model, mode)
SELECT content, compiled_at, entry_count, global_enabled, ollama_enabled, backend_model, 'think'
FROM bot_compiled_prompt WHERE mode = 'default'
ON CONFLICT (mode) DO NOTHING;

INSERT INTO bot_compiled_prompt (content, compiled_at, entry_count, global_enabled, ollama_enabled, backend_model, mode)
SELECT content, compiled_at, entry_count, global_enabled, ollama_enabled, backend_model, 'pro'
FROM bot_compiled_prompt WHERE mode = 'default'
ON CONFLICT (mode) DO NOTHING;

-- Create bot_compaction_config singleton table
CREATE TABLE IF NOT EXISTS bot_compaction_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  draft_primary_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  draft_fallback_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash-lite',
  refine_primary_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  refine_fallback_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash-lite',
  context_limit INT NOT NULL DEFAULT 32000,
  compaction_threshold FLOAT NOT NULL DEFAULT 0.8,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed singleton row
INSERT INTO bot_compaction_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
