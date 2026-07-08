-- Migration: 20260707_credit_metering_schema.sql
-- Description: Schema foundation for cost-based credit metering.
-- See docs/superpowers/specs/2026-07-07-ai-credit-metering-design.md for rationale.

-- ─── Subscription tiers (admin-editable) ────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id                 TEXT PRIMARY KEY,             -- 'free', 'pro', 'max'
  name               TEXT NOT NULL,
  price_usd          NUMERIC(10,2) NOT NULL DEFAULT 0,
  credit_percent     NUMERIC(5,2) NOT NULL DEFAULT 70,
  weekly_tightness    NUMERIC(4,3) NOT NULL DEFAULT 1.0,
  sessions_per_week   NUMERIC(6,2) NOT NULL DEFAULT 14,
  window_hours        NUMERIC(5,2) NOT NULL DEFAULT 5,
  router_mode        TEXT NOT NULL DEFAULT 'default' CHECK (router_mode IN ('default', 'pro')),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO subscription_tiers (id, name, price_usd, credit_percent, router_mode) VALUES
  ('free', 'Free',     0,  0, 'default'),
  ('pro',  'Pro',      20, 70, 'pro'),
  ('max',  'Max',      50, 70, 'pro')
ON CONFLICT (id) DO NOTHING;

-- ─── Per-user subscription + window anchors ─────────────────────────────
CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id            TEXT NOT NULL REFERENCES subscription_tiers(id) DEFAULT 'free',
  period_start       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_end         TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  window_5h_anchor   TIMESTAMPTZ,
  window_week_anchor TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_subscriptions_own_read" ON user_subscriptions;
CREATE POLICY "user_subscriptions_own_read" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- ─── Spend ledger ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_spend_events (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id     UUID NOT NULL,
  amount_usd     NUMERIC(10,6) NOT NULL DEFAULT 0,
  mode           TEXT NOT NULL DEFAULT 'default',
  is_reservation BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_spend_events_user_created
  ON credit_spend_events (user_id, created_at);

ALTER TABLE credit_spend_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "credit_spend_events_own_read" ON credit_spend_events;
CREATE POLICY "credit_spend_events_own_read" ON credit_spend_events
  FOR SELECT USING (auth.uid() = user_id);

-- ─── Search provider flat-rate pricing (admin-editable) ─────────────────
CREATE TABLE IF NOT EXISTS search_providers (
  id            TEXT PRIMARY KEY,   -- 'tavily_search', 'exa_search', 'exa_extract'
  cost_per_call NUMERIC(10,6) NOT NULL DEFAULT 0,
  notes         TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO search_providers (id, cost_per_call, notes) VALUES
  ('tavily_search', 0, 'Set real cost_per_call once Tavily plan pricing is confirmed'),
  ('exa_search',    0, 'Set real cost_per_call once Exa plan pricing is confirmed'),
  ('exa_extract',   0, 'Set real cost_per_call once Exa plan pricing is confirmed')
ON CONFLICT (id) DO NOTHING;

-- ─── Model pricing/context completeness ─────────────────────────────────
ALTER TABLE models
  ADD COLUMN IF NOT EXISTS context_window    INTEGER,
  ADD COLUMN IF NOT EXISTS max_output_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS cache_read_cost   NUMERIC(10,8),
  ADD COLUMN IF NOT EXISTS cache_write_cost  NUMERIC(10,8);
