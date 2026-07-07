-- Migration: 20260708_drop_router_chains_platform.sql
-- Description: router_chains.platform was never read by the runtime routing
-- path (getRouterChain hardcodes platform='telegram' regardless of caller),
-- making every platform='app' row dead data. This migration removes the
-- column and collapses the unique key to (category, mode).
-- See docs/superpowers/specs/2026-07-08-remove-router-chains-platform-design.md

-- Sanity check before deleting: log how many 'app' rows exist and confirm
-- none have a non-empty model_list (i.e. confirm they're genuinely dead,
-- not silently-used real config). This raises a notice, does not abort —
-- reviewed manually before this migration is applied to production.
DO $$
DECLARE
  app_row_count INTEGER;
  app_rows_with_models INTEGER;
BEGIN
  SELECT COUNT(*) INTO app_row_count FROM router_chains WHERE platform = 'app';
  SELECT COUNT(*) INTO app_rows_with_models
    FROM router_chains
    WHERE platform = 'app' AND jsonb_array_length(model_list) > 0;
  RAISE NOTICE 'router_chains: % rows with platform=app, % of those have non-empty model_list', app_row_count, app_rows_with_models;
END $$;

DELETE FROM router_chains WHERE platform = 'app';

DROP INDEX IF EXISTS router_chains_category_platform_mode_key;

ALTER TABLE router_chains DROP COLUMN IF EXISTS platform;

CREATE UNIQUE INDEX IF NOT EXISTS router_chains_category_mode_key
  ON router_chains (category, mode);
