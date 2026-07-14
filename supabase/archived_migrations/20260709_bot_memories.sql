CREATE TABLE IF NOT EXISTS bot_memories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bot_memories_user_id ON bot_memories(user_id);

ALTER TABLE bot_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bot_memories_select_own" ON bot_memories;
CREATE POLICY "bot_memories_select_own" ON bot_memories
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "bot_memories_insert_own" ON bot_memories;
CREATE POLICY "bot_memories_insert_own" ON bot_memories
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "bot_memories_update_own" ON bot_memories;
CREATE POLICY "bot_memories_update_own" ON bot_memories
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "bot_memories_delete_own" ON bot_memories;
CREATE POLICY "bot_memories_delete_own" ON bot_memories
  FOR DELETE USING (user_id = auth.uid());
