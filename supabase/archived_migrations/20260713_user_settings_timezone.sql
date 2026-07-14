-- User-level settings that must persist across devices/surfaces (web, desktop,
-- Telegram). First field: IANA timezone, so date/time math (reminders, due
-- dates, "today"/"overdue" filters) is correct regardless of which surface a
-- request comes from. Previously this lived only in browser Zustand state
-- (manualTimezone), which wasn't even persisted to localStorage and never
-- reached Telegram at all.
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  timezone text,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_settings_select_own" ON user_settings;
CREATE POLICY "user_settings_select_own" ON user_settings
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_settings_insert_own" ON user_settings;
CREATE POLICY "user_settings_insert_own" ON user_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_settings_update_own" ON user_settings;
CREATE POLICY "user_settings_update_own" ON user_settings
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
