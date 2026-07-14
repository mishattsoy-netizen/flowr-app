-- ─────────────────────────────────────────────────────────────
-- Cleanup: remove DB-backed settings that are now hardcoded
-- ─────────────────────────────────────────────────────────────

-- 1. Drop bot_compiled_prompt table (fully replaced by settings
--    table + filesystem prompts in src/lib/bot/prompts/)
DROP TABLE IF EXISTS bot_compiled_prompt;

-- 2. Remove router_temperatures from settings (hardcoded at 0.7
--    via DEFAULT_TEMPERATURE in src/lib/router-config.ts)
DELETE FROM settings WHERE key = 'router_temperatures';

-- 3. Remove pipeline_status_messages from settings (now hardcoded
--    via DEFAULT_STATUS_MESSAGES in src/lib/router-config.ts)
DELETE FROM settings WHERE key = 'pipeline_status_messages';
