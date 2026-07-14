-- Add auth_user_id to message_logs for web app conversation memory
ALTER TABLE message_logs
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS message_logs_auth_user_id_idx ON message_logs (auth_user_id, created_at DESC);
