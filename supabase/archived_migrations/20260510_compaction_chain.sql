-- Migrate compaction from hardcoded draft/refine models to a router chain
--
-- Changes:
-- 1. Drop old draft_primary_model, draft_fallback_model, refine_primary_model, refine_fallback_model
--    from bot_compaction_config (models now live in router_chains as COMPACTION category)
-- 2. Add COMPACTION chain to router_chains for app platform

-- Drop old model columns — compaction now uses the router chain system
ALTER TABLE bot_compaction_config
  DROP COLUMN IF EXISTS draft_primary_model,
  DROP COLUMN IF EXISTS draft_fallback_model,
  DROP COLUMN IF EXISTS refine_primary_model,
  DROP COLUMN IF EXISTS refine_fallback_model;

-- Add platform column if not present (idempotent for older schemas)
ALTER TABLE router_chains ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'telegram';

-- Insert COMPACTION chain for app platform
INSERT INTO router_chains (platform, category, model_list, system_prompt)
SELECT 'app', 'COMPACTION', '[
  {"id":"gemini-2.0-flash","provider":"google","is_enabled":true}
]'::jsonb, 'Distill the conversation below into a dense, high-fidelity session summary. Cover: current status, key decisions, user preferences, and technical details. Output ONLY the summary text.'
WHERE NOT EXISTS (SELECT 1 FROM router_chains WHERE category = 'COMPACTION' AND platform = 'app');

-- Insert COMPACTION chain for telegram platform
INSERT INTO router_chains (platform, category, model_list, system_prompt)
SELECT 'telegram', 'COMPACTION', '[
  {"id":"gemini-2.0-flash","provider":"google","is_enabled":true}
]'::jsonb, 'Distill the conversation below into a dense, high-fidelity session summary. Cover: current status, key decisions, user preferences, and technical details. Output ONLY the summary text.'
WHERE NOT EXISTS (SELECT 1 FROM router_chains WHERE category = 'COMPACTION' AND platform = 'telegram');
