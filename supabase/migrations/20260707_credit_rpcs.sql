-- Migration: 20260707_credit_rpcs.sql
-- Description: Atomic reserve/reconcile RPCs for credit metering.
-- reserve_credit runs BEFORE the model pipeline (estimate); reconcile_credit
-- runs AFTER (real cost). See spec §3 for the race-condition rationale.

CREATE OR REPLACE FUNCTION reserve_credit(
  p_request_id UUID,
  p_mode TEXT DEFAULT 'default'
)
RETURNS TABLE(allowed BOOLEAN, blocked_window TEXT, resets_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_tier subscription_tiers%ROWTYPE;
  v_sub user_subscriptions%ROWTYPE;
  v_enforcement_enabled BOOLEAN;
  v_monthly_credit NUMERIC;
  v_weekly_cap NUMERIC;
  v_window_cap NUMERIC;
  v_5h_spend NUMERIC;
  v_week_spend NUMERIC;
  v_month_spend NUMERIC;
  v_5h_anchor TIMESTAMPTZ;
  v_week_anchor TIMESTAMPTZ;
  -- Fixed server-side constant, NOT caller-controllable — a client-supplied
  -- reservation amount would let a malicious caller pass p_reservation_usd=0
  -- to always clear the cap checks below, then reconcile to an understated
  -- real amount, defeating enforcement entirely.
  v_reservation_usd CONSTANT NUMERIC := 0.02;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'auth'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT (value = 'true'::jsonb) INTO v_enforcement_enabled
  FROM settings WHERE key = 'credit_enforcement_enabled';
  v_enforcement_enabled := COALESCE(v_enforcement_enabled, false);

  SELECT * INTO v_sub FROM user_subscriptions WHERE user_id = v_user_id;
  IF NOT FOUND THEN
    INSERT INTO user_subscriptions (user_id, tier_id, window_5h_anchor, window_week_anchor)
    VALUES (v_user_id, 'free', NOW(), NOW())
    RETURNING * INTO v_sub;
  END IF;

  SELECT * INTO v_tier FROM subscription_tiers WHERE id = v_sub.tier_id;

  -- Roll forward expired window anchors
  v_5h_anchor := v_sub.window_5h_anchor;
  IF v_5h_anchor IS NULL OR NOW() >= v_5h_anchor + (v_tier.window_hours || ' hours')::INTERVAL THEN
    v_5h_anchor := NOW();
  END IF;
  v_week_anchor := v_sub.window_week_anchor;
  IF v_week_anchor IS NULL OR NOW() >= v_week_anchor + INTERVAL '7 days' THEN
    v_week_anchor := NOW();
  END IF;

  UPDATE user_subscriptions
  SET window_5h_anchor = v_5h_anchor, window_week_anchor = v_week_anchor, updated_at = NOW()
  WHERE user_id = v_user_id;

  v_monthly_credit := v_tier.price_usd * v_tier.credit_percent / 100;
  v_weekly_cap := v_monthly_credit * v_tier.weekly_tightness / 4.33;
  v_window_cap := v_weekly_cap / GREATEST(v_tier.sessions_per_week, 1);

  SELECT COALESCE(SUM(amount_usd), 0) INTO v_5h_spend
  FROM credit_spend_events WHERE user_id = v_user_id AND created_at >= v_5h_anchor;

  SELECT COALESCE(SUM(amount_usd), 0) INTO v_week_spend
  FROM credit_spend_events WHERE user_id = v_user_id AND created_at >= v_week_anchor;

  SELECT COALESCE(SUM(amount_usd), 0) INTO v_month_spend
  FROM credit_spend_events WHERE user_id = v_user_id AND created_at >= v_sub.period_start;

  IF v_enforcement_enabled AND (v_5h_spend + v_reservation_usd) > v_window_cap THEN
    RETURN QUERY SELECT false, '5h'::TEXT, v_5h_anchor + (v_tier.window_hours || ' hours')::INTERVAL;
    RETURN;
  END IF;
  IF v_enforcement_enabled AND (v_week_spend + v_reservation_usd) > v_weekly_cap THEN
    RETURN QUERY SELECT false, 'week'::TEXT, v_week_anchor + INTERVAL '7 days';
    RETURN;
  END IF;
  IF v_enforcement_enabled AND (v_month_spend + v_reservation_usd) > v_monthly_credit THEN
    RETURN QUERY SELECT false, 'month'::TEXT, v_sub.period_end;
    RETURN;
  END IF;

  INSERT INTO credit_spend_events (user_id, request_id, amount_usd, mode, is_reservation)
  VALUES (v_user_id, p_request_id, v_reservation_usd, p_mode, true);

  RETURN QUERY SELECT true, NULL::TEXT, NULL::TIMESTAMPTZ;
END;
$$;

CREATE OR REPLACE FUNCTION reconcile_credit(
  p_request_id UUID,
  p_real_amount_usd NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;
  IF p_real_amount_usd IS NULL OR p_real_amount_usd < 0 THEN
    RETURN;
  END IF;

  UPDATE credit_spend_events
  SET amount_usd = p_real_amount_usd, is_reservation = false
  WHERE request_id = p_request_id AND is_reservation = true AND user_id = v_user_id;
END;
$$;

