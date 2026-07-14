-- Migration: 20260710_credit_rpcs_for_user.sql
-- Description: Adds reserve_credit_for_user / reconcile_credit_for_user —
-- service-role-only variants of reserve_credit/reconcile_credit that take
-- an explicit p_user_id instead of reading auth.uid(), for callers with no
-- user session (the Telegram webhook, which resolves the acting user from
-- telegram_users.auth_user_id server-side before calling this).
--
-- Both existing auth.uid()-based RPCs are refactored to delegate to shared
-- internal _reserve_credit_core / _reconcile_credit_core functions so the
-- budget-calculation logic isn't duplicated between the two call shapes.
--
-- SECURITY: _for_user variants trust their p_user_id argument instead of
-- deriving it from a JWT. This is safe ONLY because they are SECURITY
-- DEFINER functions never exposed to any client — they are called
-- exclusively via supabaseAdmin (service role key) from trusted server
-- code (the Telegram webhook), which has already resolved the correct
-- user server-side. See docs/superpowers/specs/2026-07-09-telegram-credit-metering-design.md §1.

CREATE OR REPLACE FUNCTION _reserve_credit_core(
  p_user_id UUID,
  p_request_id UUID,
  p_mode TEXT DEFAULT 'default'
)
RETURNS TABLE(allowed BOOLEAN, blocked_window TEXT, resets_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := p_user_id;
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

CREATE OR REPLACE FUNCTION _reconcile_credit_core(
  p_user_id UUID,
  p_request_id UUID,
  p_real_amount_usd NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;
  IF p_real_amount_usd IS NULL OR p_real_amount_usd < 0 THEN
    RETURN;
  END IF;

  UPDATE credit_spend_events
  SET amount_usd = p_real_amount_usd, is_reservation = false
  WHERE request_id = p_request_id AND is_reservation = true AND user_id = p_user_id;
END;
$$;

-- Public, auth.uid()-based entry points (used by the web/desktop chat route
-- via an authenticated client) — now thin wrappers around the shared core.
CREATE OR REPLACE FUNCTION reserve_credit(
  p_request_id UUID,
  p_mode TEXT DEFAULT 'default'
)
RETURNS TABLE(allowed BOOLEAN, blocked_window TEXT, resets_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY SELECT * FROM _reserve_credit_core(auth.uid(), p_request_id, p_mode);
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
BEGIN
  PERFORM _reconcile_credit_core(auth.uid(), p_request_id, p_real_amount_usd);
END;
$$;

-- Service-role-only entry points (used by the Telegram webhook via
-- supabaseAdmin, which has already resolved the linked user server-side).
CREATE OR REPLACE FUNCTION reserve_credit_for_user(
  p_user_id UUID,
  p_request_id UUID,
  p_mode TEXT DEFAULT 'default'
)
RETURNS TABLE(allowed BOOLEAN, blocked_window TEXT, resets_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY SELECT * FROM _reserve_credit_core(p_user_id, p_request_id, p_mode);
END;
$$;

CREATE OR REPLACE FUNCTION reconcile_credit_for_user(
  p_user_id UUID,
  p_request_id UUID,
  p_real_amount_usd NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM _reconcile_credit_core(p_user_id, p_request_id, p_real_amount_usd);
END;
$$;

-- ── Privilege hardening ──
-- The four functions above (_reserve_credit_core, _reconcile_credit_core,
-- reserve_credit_for_user, reconcile_credit_for_user) take an explicit,
-- caller-supplied p_user_id and run as SECURITY DEFINER. Without these
-- revokes they'd be callable by any anon/authenticated client via
-- PostgREST with an arbitrary p_user_id (privilege escalation / IDOR).
-- Revoke PUBLIC execute so they are no longer exposed over the API, then
-- re-grant execute on the two _for_user RPCs to the service_role only
-- (the Telegram webhook calls them via supabaseAdmin). The two internal
-- _core functions stay callable only by their owner (postgres), which is
-- all the SECURITY DEFINER _for_user wrappers need to invoke them.
-- The auth.uid()-based reserve_credit / reconcile_credit above are left
-- untouched so authenticated web/desktop clients can still call them.
REVOKE EXECUTE ON FUNCTION _reserve_credit_core(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION _reconcile_credit_core(UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION reserve_credit_for_user(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION reconcile_credit_for_user(UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION reserve_credit_for_user(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION reconcile_credit_for_user(UUID, UUID, NUMERIC) TO service_role;
