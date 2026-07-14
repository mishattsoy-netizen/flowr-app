-- ============================================================
-- Flowr — Chain Rename Migration
-- 
-- Renames:  FAST_SIMPLE → REGULAR
--           COMPLEX_THINKING → COMPLEX
--           TOOL_CALLING → TOOLS
--           AUDIO_VOICE → AUDIO
--           DEEP_RESEARCH → RESEARCH
-- Removes:  MEDIUM_THINKING, ORCHESTRATOR
-- ============================================================

-- ─── router_chains ───────────────────────────────────────────

UPDATE router_chains SET category = 'REGULAR'  WHERE category = 'FAST_SIMPLE';
UPDATE router_chains SET category = 'COMPLEX'  WHERE category = 'COMPLEX_THINKING';
UPDATE router_chains SET category = 'TOOLS'    WHERE category = 'TOOL_CALLING';
UPDATE router_chains SET category = 'AUDIO'    WHERE category = 'AUDIO_VOICE';
UPDATE router_chains SET category = 'RESEARCH' WHERE category = 'DEEP_RESEARCH';

DELETE FROM router_chains WHERE category = 'MEDIUM_THINKING';
DELETE FROM router_chains WHERE category = 'ORCHESTRATOR';

-- ─── settings: pipeline_internal_prompts ─────────────────────

UPDATE settings
SET value = jsonb_set(value, '{REGULAR}', value->'MEDIUM_THINKING')
WHERE key = 'pipeline_internal_prompts' AND value ? 'MEDIUM_THINKING';

UPDATE settings
SET value = value - 'MEDIUM_THINKING'
WHERE key = 'pipeline_internal_prompts';

-- ─── settings: pipeline_status_messages ──────────────────────

UPDATE settings
SET value = jsonb_set(value, '{REGULAR}', value->'MEDIUM_THINKING')
WHERE key = 'pipeline_status_messages' AND value ? 'MEDIUM_THINKING';

UPDATE settings
SET value = value - 'MEDIUM_THINKING'
WHERE key = 'pipeline_status_messages';

-- ─── settings: pipeline_settings (category arrays) ────────────

UPDATE settings
SET value = jsonb_set(
  value,
  '{history_enabled_categories}',
  (SELECT jsonb_agg(
    CASE
      WHEN elem = 'MEDIUM_THINKING'   THEN 'REGULAR'
      WHEN elem = 'FAST_SIMPLE'       THEN 'REGULAR'
      WHEN elem = 'DEEP_RESEARCH'     THEN 'RESEARCH'
      WHEN elem = 'TOOL_CALLING'      THEN 'TOOLS'
      WHEN elem = 'COMPLEX_THINKING'  THEN 'COMPLEX'
      WHEN elem = 'AUDIO_VOICE'       THEN 'AUDIO'
      ELSE elem
    END)
    FROM jsonb_array_elements_text(value->'history_enabled_categories') AS elem
  )
)
WHERE key = 'pipeline_settings' AND value ? 'history_enabled_categories';

UPDATE settings
SET value = jsonb_set(
  value,
  '{global_prompt_enabled_categories}',
  (SELECT jsonb_agg(
    CASE
      WHEN elem = 'MEDIUM_THINKING'   THEN 'REGULAR'
      WHEN elem = 'FAST_SIMPLE'       THEN 'REGULAR'
      WHEN elem = 'DEEP_RESEARCH'     THEN 'RESEARCH'
      WHEN elem = 'TOOL_CALLING'      THEN 'TOOLS'
      WHEN elem = 'COMPLEX_THINKING'  THEN 'COMPLEX'
      WHEN elem = 'AUDIO_VOICE'       THEN 'AUDIO'
      ELSE elem
    END)
    FROM jsonb_array_elements_text(value->'global_prompt_enabled_categories') AS elem
  )
)
WHERE key = 'pipeline_settings' AND value ? 'global_prompt_enabled_categories';

UPDATE settings
SET value = jsonb_set(
  value,
  '{token_limit_enabled_categories}',
  (SELECT jsonb_agg(
    CASE
      WHEN elem = 'MEDIUM_THINKING'   THEN 'REGULAR'
      WHEN elem = 'FAST_SIMPLE'       THEN 'REGULAR'
      WHEN elem = 'DEEP_RESEARCH'     THEN 'RESEARCH'
      WHEN elem = 'TOOL_CALLING'      THEN 'TOOLS'
      WHEN elem = 'COMPLEX_THINKING'  THEN 'COMPLEX'
      WHEN elem = 'AUDIO_VOICE'       THEN 'AUDIO'
      ELSE elem
    END)
    FROM jsonb_array_elements_text(value->'token_limit_enabled_categories') AS elem
  )
)
WHERE key = 'pipeline_settings' AND value ? 'token_limit_enabled_categories';

-- ─── settings: router_temperatures ───────────────────────────

UPDATE settings
SET value = jsonb_set(value, '{REGULAR}', value->'MEDIUM_THINKING')
WHERE key = 'router_temperatures' AND value ? 'MEDIUM_THINKING';

UPDATE settings
SET value = value - 'FAST_SIMPLE'
WHERE key = 'router_temperatures' AND value ? 'FAST_SIMPLE';

UPDATE settings
SET value = value - 'MEDIUM_THINKING'
WHERE key = 'router_temperatures' AND value ? 'MEDIUM_THINKING';

-- ─── settings: router_fallback_modes ─────────────────────────

UPDATE settings
SET value = jsonb_set(value, '{REGULAR}', value->'MEDIUM_THINKING')
WHERE key = 'router_fallback_modes' AND value ? 'MEDIUM_THINKING';

UPDATE settings
SET value = value - 'FAST_SIMPLE'
WHERE key = 'router_fallback_modes' AND value ? 'FAST_SIMPLE';

UPDATE settings
SET value = value - 'MEDIUM_THINKING'
WHERE key = 'router_fallback_modes' AND value ? 'MEDIUM_THINKING';

-- ─── bot_settings: classifier_keywords (clear + migrate) ──────

-- Clear old keywords so admin can re-enter with new category names.
-- After this migration, visit /admin/bot/keywords to set fresh keywords.
UPDATE bot_settings
SET content = '{}'::jsonb
WHERE category = 'classifier_keywords';

-- Also migrate bot_settings category names if any reference old keys
UPDATE bot_settings
SET content = jsonb_set(
  content::jsonb,
  '{REGULAR}',
  COALESCE(content::jsonb->'FAST_SIMPLE', '[]'::jsonb) || COALESCE(content::jsonb->'MEDIUM_THINKING', '[]'::jsonb)
)
WHERE category = 'classifier_keywords' AND content IS NOT NULL AND content != '';

UPDATE bot_settings
SET content = content::jsonb - 'FAST_SIMPLE' - 'MEDIUM_THINKING' - 'COMPLEX_THINKING' - 'TOOL_CALLING' - 'AUDIO_VOICE' - 'DEEP_RESEARCH'
WHERE category = 'classifier_keywords';

-- Switch keywords to shared mode='global' instead of per-mode 'default'
UPDATE bot_settings
SET mode = 'global'
WHERE category = 'classifier_keywords' AND mode = 'default';

UPDATE bot_settings
SET mode = 'global'
WHERE category = 'classifier_keywords_enabled' AND mode = 'default';

-- Re-enable keyword classifier (in case it was disabled)
UPDATE bot_settings
SET is_active = true
WHERE category = 'classifier_keywords_enabled' AND mode = 'global';
