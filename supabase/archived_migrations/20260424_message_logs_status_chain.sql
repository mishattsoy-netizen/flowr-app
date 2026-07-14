-- Add status and model_chain columns to message_logs
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS model_chain TEXT;

COMMENT ON COLUMN message_logs.status IS 'success or error';
COMMENT ON COLUMN message_logs.model_chain IS 'Routing chain e.g. gemini-1.5-flash-lite → cloudflare-workers-ai';
