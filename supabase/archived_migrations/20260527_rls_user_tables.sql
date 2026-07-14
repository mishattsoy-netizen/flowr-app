-- Enable RLS on user-facing tables (column names verified against schema)

-- BENTO_LAYOUTS (user_id)
ALTER TABLE bento_layouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bento_layouts_own" ON bento_layouts;
CREATE POLICY "bento_layouts_own" ON bento_layouts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- CANVAS_BLOCKS (user_id)
ALTER TABLE canvas_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "canvas_blocks_own" ON canvas_blocks;
CREATE POLICY "canvas_blocks_own" ON canvas_blocks
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- CONVERSATIONS (user_id)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversations_own" ON conversations;
CREATE POLICY "conversations_own" ON conversations
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- MESSAGES (conversation_id → conversations.user_id)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_own" ON messages;
CREATE POLICY "messages_own" ON messages
  FOR ALL USING (
    conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
  ) WITH CHECK (
    conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
  );

-- MESSAGE_FEEDBACK (auth_user_id)
ALTER TABLE message_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "message_feedback_own" ON message_feedback;
CREATE POLICY "message_feedback_own" ON message_feedback
  FOR ALL USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

-- MESSAGE_LOGS (auth_user_id) — read-only for users; service role inserts
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "message_logs_own_read" ON message_logs;
CREATE POLICY "message_logs_own_read" ON message_logs
  FOR SELECT USING (auth_user_id = auth.uid());

-- USER_QUOTAS (auth_user_id) — read-only for users
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_quotas_own_read" ON user_quotas;
CREATE POLICY "user_quotas_own_read" ON user_quotas
  FOR SELECT USING (auth_user_id = auth.uid());
