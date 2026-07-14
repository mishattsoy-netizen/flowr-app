-- Migration: 20260504_session_context_caching.sql
CREATE TABLE IF NOT EXISTS bot_session_states (
  chat_id TEXT PRIMARY KEY,
  distilled_summary TEXT,
  token_usage_total INTEGER DEFAULT 0,
  context_limit INTEGER DEFAULT 32000,
  last_summarized_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE bot_session_states ENABLE ROW LEVEL SECURITY;

-- Simple policy for session management
CREATE POLICY "Manage session states" ON bot_session_states
  FOR ALL USING (true);
