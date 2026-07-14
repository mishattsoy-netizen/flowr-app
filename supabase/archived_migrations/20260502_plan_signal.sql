-- Add signal column to bot_improvement_plans

ALTER TABLE bot_improvement_plans
ADD COLUMN IF NOT EXISTS signal TEXT DEFAULT 'mixed' CHECK (signal IN ('explicit', 'implicit', 'log', 'mixed'));