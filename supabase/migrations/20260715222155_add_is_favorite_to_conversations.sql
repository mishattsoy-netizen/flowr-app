ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;
