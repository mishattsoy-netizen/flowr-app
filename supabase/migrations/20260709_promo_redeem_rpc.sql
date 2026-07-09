-- Migration: 20260709_promo_redeem_rpc.sql
-- Description: redeem_promo_code RPC (SECURITY DEFINER, auth.uid()-scoped,
-- matching the reserve_credit/reconcile_credit pattern in
-- 20260707_credit_rpcs.sql), plus an expiry-revert check added to
-- reserve_credit so promo-granted tiers automatically fall back to free
-- once their granted period ends, with no scheduled job.

CREATE OR REPLACE FUNCTION redeem_promo_code(p_code TEXT)
RETURNS TABLE(success BOOLEAN, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_promo promo_codes%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'not_authenticated'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_promo FROM promo_codes WHERE code = p_code;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'invalid_code'::TEXT;
    RETURN;
  END IF;

  IF v_promo.expires_at IS NOT NULL AND NOW() >= v_promo.expires_at THEN
    RETURN QUERY SELECT false, 'code_expired'::TEXT;
    RETURN;
  END IF;

  IF v_promo.uses_count >= v_promo.max_uses THEN
    RETURN QUERY SELECT false, 'max_uses_reached'::TEXT;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO promo_code_redemptions (promo_code, user_id) VALUES (p_code, v_user_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT false, 'already_redeemed'::TEXT;
    RETURN;
  END;

  INSERT INTO user_subscriptions (user_id, tier_id, period_start, period_end, granted_by_promo_code, window_5h_anchor, window_week_anchor)
  VALUES (v_user_id, v_promo.tier_id, NOW(), NOW() + (v_promo.duration_days || ' days')::INTERVAL, p_code, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    tier_id = v_promo.tier_id,
    period_start = NOW(),
    period_end = NOW() + (v_promo.duration_days || ' days')::INTERVAL,
    granted_by_promo_code = p_code,
    updated_at = NOW();

  UPDATE promo_codes SET uses_count = uses_count + 1 WHERE code = p_code;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

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

  -- NEW: revert an expired promo-granted tier back to free before any
  -- budget math runs, so this same request is evaluated against free-tier
  -- limits. Admin-set tiers (granted_by_promo_code IS NULL) never revert.
  IF v_sub.tier_id != 'free' AND v_sub.granted_by_promo_code IS NOT NULL AND NOW() >= v_sub.period_end THEN
    UPDATE user_subscriptions
    SET tier_id = 'free', granted_by_promo_code = NULL, period_start = NOW(), period_end = NOW() + INTERVAL '30 days', updated_at = NOW()
    WHERE user_id = v_user_id
    RETURNING * INTO v_sub;
  END IF;

  SELECT * INTO v_tier FROM subscription_tiers WHERE id = v_sub.tier_id;

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
