ALTER TABLE cost_log ADD COLUMN IF NOT EXISTS chain TEXT;
CREATE INDEX IF NOT EXISTS idx_cost_log_chain ON cost_log(chain);
