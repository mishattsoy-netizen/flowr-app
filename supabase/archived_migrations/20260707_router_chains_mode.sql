-- Migration: 20260707_router_chains_mode.sql
-- Description: Add mode dimension to router_chains so Default/Pro chat modes
-- can route to different model chains per category. Existing rows become
-- mode='default'; unique key becomes (category, platform, mode).

ALTER TABLE router_chains ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'default';

-- Drop any stale unique constraint that only covered category (pre-platform-column era)
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'router_chains'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 1;
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE router_chains DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

-- Composite unique key: one row per category+platform+mode
CREATE UNIQUE INDEX IF NOT EXISTS router_chains_category_platform_mode_key
  ON router_chains (category, platform, mode);
