-- Add source classification and evidence quotes to improvement plans
ALTER TABLE bot_improvement_plans
  ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('feedback_explicit','feedback_implicit','log_pattern','mixed')),
  ADD COLUMN IF NOT EXISTS evidence JSONB;
