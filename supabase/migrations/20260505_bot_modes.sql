-- Add mode column to bot_settings
ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'default';

-- Seed think and pro rows by copying existing default rows
INSERT INTO bot_settings (category, content, is_active, mode, updated_at)
SELECT category, content, is_active, 'think', NOW()
FROM bot_settings
WHERE mode = 'default'
  AND category IN ('core_rules', 'personality', 'answer_style', 'thinking_pattern', 'restrictions')
ON CONFLICT DO NOTHING;

INSERT INTO bot_settings (category, content, is_active, mode, updated_at)
SELECT category, content, is_active, 'pro', NOW()
FROM bot_settings
WHERE mode = 'default'
  AND category IN ('core_rules', 'personality', 'answer_style', 'thinking_pattern', 'restrictions')
ON CONFLICT DO NOTHING;

-- Add mode column to bot_compiled_prompt (one row per mode)
ALTER TABLE bot_compiled_prompt ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'default';

-- Seed think and pro compiled_prompt rows
INSERT INTO bot_compiled_prompt (content, compiled_at, entry_count, global_enabled, ollama_enabled, backend_model, mode)
SELECT content, compiled_at, entry_count, global_enabled, ollama_enabled, backend_model, 'think'
FROM bot_compiled_prompt WHERE mode = 'default'
ON CONFLICT DO NOTHING;

INSERT INTO bot_compiled_prompt (content, compiled_at, entry_count, global_enabled, ollama_enabled, backend_model, mode)
SELECT content, compiled_at, entry_count, global_enabled, ollama_enabled, backend_model, 'pro'
FROM bot_compiled_prompt WHERE mode = 'default'
ON CONFLICT DO NOTHING;

-- Seed mode-specific classifier config by copying default rows
INSERT INTO bot_settings (category, content, is_active, mode, updated_at)
SELECT category, content, is_active, 'think', NOW()
FROM bot_settings
WHERE mode = 'default'
  AND category IN ('classifier_prompt', 'classifier_keywords')
ON CONFLICT DO NOTHING;

INSERT INTO bot_settings (category, content, is_active, mode, updated_at)
SELECT category, content, is_active, 'pro', NOW()
FROM bot_settings
WHERE mode = 'default'
  AND category IN ('classifier_prompt', 'classifier_keywords')
ON CONFLICT DO NOTHING;

-- Create bot_compaction_config singleton table
CREATE TABLE IF NOT EXISTS bot_compaction_config (
  id INT PRIMARY KEY DEFAULT 1,
  draft_primary_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  draft_fallback_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash-lite',
  refine_primary_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  refine_fallback_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash-lite',
  context_limit INT NOT NULL DEFAULT 32000,
  compaction_threshold FLOAT NOT NULL DEFAULT 0.8,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed singleton row if not exists
INSERT INTO bot_compaction_config (id) VALUES (1) ON CONFLICT DO NOTHING;
