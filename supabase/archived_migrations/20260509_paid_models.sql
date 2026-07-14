-- 20260509_paid_models.sql
-- Adds cost tracking to the models registry and creates a per-request cost log.

-- Add cost columns to existing models table
ALTER TABLE models 
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prompt_cost NUMERIC(10,8) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completion_cost NUMERIC(10,8) DEFAULT NULL;

-- Per-request cost log for auditing and billing awareness
CREATE TABLE IF NOT EXISTS cost_log (
  id BIGSERIAL PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES models(id),
  provider TEXT NOT NULL DEFAULT 'openrouter',
  prompt_cost NUMERIC(10,8) NOT NULL DEFAULT 0,
  completion_cost NUMERIC(10,8) NOT NULL DEFAULT 0,
  total_cost NUMERIC(10,8) NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for querying cost logs
CREATE INDEX IF NOT EXISTS idx_cost_log_model ON cost_log(model_id);
CREATE INDEX IF NOT EXISTS idx_cost_log_created ON cost_log(created_at);
