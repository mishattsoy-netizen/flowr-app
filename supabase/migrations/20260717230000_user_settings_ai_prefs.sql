-- User AI preferences: response style + default reply language.
-- Soft defaults injected into the system prompt; mid-session language switches
-- live in chat history and reset on a new session.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS response_style text DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS reply_language text DEFAULT 'auto';

COMMENT ON COLUMN user_settings.response_style IS 'concise | balanced | detailed — soft length/depth bias for AI replies';
COMMENT ON COLUMN user_settings.reply_language IS 'auto or language code (en, ru, uk, fr, …) — default reply language, overridable mid-session';
