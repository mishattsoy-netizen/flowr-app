-- Add conversation context snapshot to message_feedback
ALTER TABLE message_feedback
  ADD COLUMN IF NOT EXISTS context_messages JSONB;
