-- Track when a user last cleared their chat memory.
-- Used to filter message_logs for AI context without deleting log rows.
ALTER TABLE user_quotas
  ADD COLUMN IF NOT EXISTS memory_cleared_at TIMESTAMPTZ;
