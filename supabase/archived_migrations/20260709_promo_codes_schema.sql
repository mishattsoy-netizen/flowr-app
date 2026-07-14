-- Migration: 20260709_promo_codes_schema.sql
-- Description: Promo code system for granting trial subscription tiers,
-- plus supporting columns on user_subscriptions and credit_spend_events.
-- See docs/superpowers/specs/2026-07-09-subscription-admin-and-promo-codes-design.md

-- Created first: other new objects reference it.
CREATE TABLE IF NOT EXISTS promo_codes (
  code           TEXT PRIMARY KEY,
  tier_id        TEXT NOT NULL REFERENCES subscription_tiers(id),
  duration_days  INTEGER NOT NULL,
  max_uses       INTEGER NOT NULL DEFAULT 1,
  uses_count     INTEGER NOT NULL DEFAULT 0,
  created_by     TEXT,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_code_redemptions (
  id           BIGSERIAL PRIMARY KEY,
  promo_code   TEXT NOT NULL REFERENCES promo_codes(code),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_redemptions_unique
  ON promo_code_redemptions (promo_code, user_id);

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS granted_by_promo_code TEXT REFERENCES promo_codes(code);

ALTER TABLE credit_spend_events
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Admin-write only; no client-facing RLS policy is needed since all access
-- goes through server actions using supabaseAdmin, or the redeem_promo_code
-- RPC (Task 3), which is SECURITY DEFINER and reads auth.uid() itself.
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_redemptions ENABLE ROW LEVEL SECURITY;
