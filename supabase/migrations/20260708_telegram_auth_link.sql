-- ============================================================
-- Telegram Bot Auth Link: connect telegram_id ↔ auth.users
-- ============================================================

ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) UNIQUE;
ALTER TABLE telegram_users ADD COLUMN IF NOT EXISTS active_chat_id TEXT;

CREATE INDEX IF NOT EXISTS idx_telegram_users_auth_user_id ON telegram_users(auth_user_id);
