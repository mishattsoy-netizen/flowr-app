-- Add sort_order column to entities table
ALTER TABLE entities ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
