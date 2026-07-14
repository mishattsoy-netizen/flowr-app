-- Add context_messages column to message_logs to store step traces and outputs
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS context_messages JSONB;

COMMENT ON COLUMN message_logs.context_messages IS 'Detailed step-by-step trace and raw outputs of the AI routing pipeline';
