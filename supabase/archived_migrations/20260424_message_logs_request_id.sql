ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS request_id UUID;
CREATE INDEX IF NOT EXISTS idx_message_logs_request_id ON message_logs(request_id);
