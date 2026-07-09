# Subscription Admin Page, Promo Codes, and Settings Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin a working page to view/edit any user's subscription tier, period, and bonus credit; let the admin generate promo codes that grant a friend a paid tier for a fixed duration (auto-reverting to free with no cron job); and enrich the existing Settings usage panel with tier context, code redemption, spend history, and a downgrade-only self-service control.

**Architecture:** Two new Postgres tables (`promo_codes`, `promo_code_redemptions`) plus two new columns on existing tables. A new `redeem_promo_code` RPC follows the exact `SECURITY DEFINER` + pinned `search_path` + `auth.uid()`-scoped pattern already used by `reserve_credit`/`reconcile_credit`. `reserve_credit` itself gains a small expiry-revert check at the top. A new `/admin/subscriptions` admin page (protected automatically by the existing `/admin/*` layout auth gate) lists every user's subscription with live usage bars and edit controls, reusing the existing `UsageBar` component and the window-math formula already duplicated once in `/api/usage/route.ts` — this plan extracts that formula into a shared helper the first time it's needed twice. `UsagePanel` is already correctly wired into `SettingsModal.tsx` (the standalone `SettingsPage.tsx` this plan was originally drafted against has since been dropped from the codebase) — Task 1 is a quick confirmation of that current state rather than a fix, so later tasks can safely build on top of it.

**Tech Stack:** Next.js server actions, Supabase (Postgres RPCs, SECURITY DEFINER functions, RLS), React client components, Vitest.

---

## Reference: current state (verified by direct inspection during planning)

- **`UsagePanel` is currently wired into `src/components/modals/SettingsModal.tsx`**, under a dedicated `activeTab === 'usage'` tab (`<UsagePanel />` at ~line 345). The standalone `SettingsPage.tsx` this plan was originally drafted against has since been dropped from the codebase entirely — `SettingsModal.tsx` is the live settings surface. Task 1 just confirms this current state before later tasks build on it.
- `src/app/api/usage/route.ts` — existing read-only endpoint; the exact window-math formula this plan needs to share with the new admin page.
- `src/components/settings/UsagePanel.tsx` — existing three-bar panel; this plan extends it in Task 8.
- `supabase/migrations/20260707_credit_metering_schema.sql` — defines `subscription_tiers`, `user_subscriptions`, `credit_spend_events`, `search_providers`.
- `supabase/migrations/20260707_credit_rpcs.sql` — defines `reserve_credit`/`reconcile_credit`, both `SECURITY DEFINER` with `SET search_path = public, pg_temp` and `auth.uid()`-scoped — the exact pattern `redeem_promo_code` (Task 3) must follow.
- `src/app/admin/layout.tsx` — already gates the entire `/admin/*` tree on `isAdmin` from `useAuth()`; a new page under `/admin/subscriptions` needs NO additional per-page auth code.
- `src/app/admin/presets/page.tsx` / `PresetsList.tsx` / `PresetForm.tsx` — the cleanest existing template for "server component fetches data, passes to a client list/table, a separate form component creates new rows." This plan's admin page follows this same three-file split.
- `src/components/admin/Sidebar.tsx` — `NavLink`/`PlatformSection` components; Task 6 adds one new `NavLink` here.
- Full design rationale: [docs/superpowers/specs/2026-07-09-subscription-admin-and-promo-codes-design.md](../specs/2026-07-09-subscription-admin-and-promo-codes-design.md).

## Out of scope (per spec)

- Any real payment integration (Stripe etc.).
- Changing `reserve_credit`'s budget math beyond the new expiry-revert check.
- A scheduled/cron-based expiry mechanism — reversion only happens on the user's next `reserve_credit` call.
- Telegram user management (`/admin/users`) — untouched.

---

## Task 1: Confirm `UsagePanel` is live in `SettingsModal.tsx`

**Files:**
- None modified — verification only.

- [ ] **Step 1: Confirm the wiring**

Run: `grep -n "UsagePanel" src/components/modals/SettingsModal.tsx`

Expected: one import line (`import UsagePanel from '@/components/settings/UsagePanel';`) and one usage site inside an `activeTab === 'usage'` block rendering `<UsagePanel />`. This confirms the panel is already live and Task 8 can safely extend `UsagePanel.tsx` without any wiring step of its own.

If this grep comes back empty or the structure looks materially different (e.g. no `usage` tab, or `UsagePanel` genuinely not rendered), STOP and report back — the rest of this plan (particularly Task 8) assumes this wiring already exists, and if it doesn't, that gap needs to be re-planned rather than silently patched.

No commit for this task — nothing changes.

---

## Task 2: Schema — promo codes, redemptions, and the two new columns

**Files:**
- Create: `supabase/migrations/20260709_promo_codes_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply the migration**

Apply via the Supabase SQL editor. Verify:

```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'promo_codes' ORDER BY ordinal_position;
SELECT column_name FROM information_schema.columns WHERE table_name = 'user_subscriptions' AND column_name = 'granted_by_promo_code';
SELECT column_name FROM information_schema.columns WHERE table_name = 'credit_spend_events' AND column_name = 'note';
```

Expected: `promo_codes` has all 8 declared columns; the other two queries each return exactly one row confirming the new column exists.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260709_promo_codes_schema.sql
git commit -m "feat(credits): add promo_codes schema and supporting columns"
```

---

## Task 3: `redeem_promo_code` RPC and the `reserve_credit` expiry-revert check

**Files:**
- Create: `supabase/migrations/20260709_promo_redeem_rpc.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Add the expiry-revert check to `reserve_credit`**

`CREATE OR REPLACE FUNCTION` on the existing `reserve_credit` (this migration re-defines the whole function — copy the current body from `supabase/migrations/20260707_credit_rpcs.sql` and insert one new block):

```sql
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
```

- [ ] **Step 3: Apply the migration**

Verify both functions exist and the new one has the right signature:

```sql
SELECT proname, pg_get_function_arguments(oid) FROM pg_proc WHERE proname IN ('reserve_credit', 'redeem_promo_code');
```

Expected: `reserve_credit` shows `p_request_id uuid, p_mode text DEFAULT 'default'::text` (unchanged signature); `redeem_promo_code` shows `p_code text`.

- [ ] **Step 4: Manually verify the expiry-revert behavior**

Requires a real authenticated test user. As that user (or via the SQL editor's "run as user" mode):

```sql
-- Simulate an expired promo grant:
UPDATE user_subscriptions SET tier_id = 'pro', granted_by_promo_code = 'TESTCODE', period_end = NOW() - INTERVAL '1 day' WHERE user_id = auth.uid();
-- (TESTCODE doesn't need to exist in promo_codes for this check — the FK
-- constraint requires it to, so first insert a throwaway row: )
INSERT INTO promo_codes (code, tier_id, duration_days) VALUES ('TESTCODE', 'pro', 30) ON CONFLICT DO NOTHING;
UPDATE user_subscriptions SET tier_id = 'pro', granted_by_promo_code = 'TESTCODE', period_end = NOW() - INTERVAL '1 day' WHERE user_id = auth.uid();

SELECT * FROM reserve_credit(gen_random_uuid(), 'default');

SELECT tier_id, granted_by_promo_code, period_end FROM user_subscriptions WHERE user_id = auth.uid();
-- Expected: tier_id = 'free', granted_by_promo_code = NULL, period_end reset to ~30 days from now
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260709_promo_redeem_rpc.sql
git commit -m "feat(credits): redeem_promo_code RPC and reserve_credit expiry-revert check"
```

---

## Task 4: Extract shared usage-window-math helper

**Files:**
- Create: `src/lib/bot/services/usageWindows.ts`
- Test: `src/lib/bot/services/usageWindows.test.ts`
- Modify: `src/app/api/usage/route.ts`

This helper is needed by both the existing `/api/usage` route and the new admin subscriptions page (Task 5) — extracting it now, before Task 5 needs it, avoids duplicating the formula a second time.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/bot/services/usageWindows.test.ts
import { describe, it, expect } from 'vitest'
import { computeUsageWindows } from './usageWindows'

describe('computeUsageWindows', () => {
  const tier = {
    price_usd: 20,
    credit_percent: 70,
    weekly_tightness: 1.0,
    sessions_per_week: 14,
    window_hours: 5,
  }
  const sub = {
    window_5h_anchor: '2026-07-09T10:00:00.000Z',
    window_week_anchor: '2026-07-09T10:00:00.000Z',
    period_start: '2026-07-01T00:00:00.000Z',
    period_end: '2026-08-01T00:00:00.000Z',
  }

  it('computes monthly credit as price_usd * credit_percent / 100', () => {
    const result = computeUsageWindows(sub, tier, { spend5h: 0, spendWeek: 0, spendMonth: 0 })
    expect(result.monthly.cap).toBeCloseTo(20 * 70 / 100, 10)
  })

  it('computes weekly cap as monthlyCredit * weeklyTightness / 4.33', () => {
    const result = computeUsageWindows(sub, tier, { spend5h: 0, spendWeek: 0, spendMonth: 0 })
    const monthlyCredit = 20 * 70 / 100
    expect(result.weekly.cap).toBeCloseTo(monthlyCredit * 1.0 / 4.33, 10)
  })

  it('computes window cap as weeklyCap / sessionsPerWeek', () => {
    const result = computeUsageWindows(sub, tier, { spend5h: 0, spendWeek: 0, spendMonth: 0 })
    const monthlyCredit = 20 * 70 / 100
    const weeklyCap = monthlyCredit * 1.0 / 4.33
    expect(result.window.cap).toBeCloseTo(weeklyCap / 14, 10)
  })

  it('passes through spend amounts unchanged', () => {
    const result = computeUsageWindows(sub, tier, { spend5h: 0.05, spendWeek: 0.3, spendMonth: 1.2 })
    expect(result.window.spent).toBe(0.05)
    expect(result.weekly.spent).toBe(0.3)
    expect(result.monthly.spent).toBe(1.2)
  })

  it('computes resets_at for the 5h window as anchor + window_hours', () => {
    const result = computeUsageWindows(sub, tier, { spend5h: 0, spendWeek: 0, spendMonth: 0 })
    const expected = new Date('2026-07-09T10:00:00.000Z').getTime() + 5 * 3600_000
    expect(new Date(result.window.resets_at).getTime()).toBe(expected)
  })

  it('computes resets_at for the weekly window as anchor + 7 days', () => {
    const result = computeUsageWindows(sub, tier, { spend5h: 0, spendWeek: 0, spendMonth: 0 })
    const expected = new Date('2026-07-09T10:00:00.000Z').getTime() + 7 * 24 * 3600_000
    expect(new Date(result.weekly.resets_at).getTime()).toBe(expected)
  })

  it('uses sub.period_end directly as the monthly resets_at', () => {
    const result = computeUsageWindows(sub, tier, { spend5h: 0, spendWeek: 0, spendMonth: 0 })
    expect(result.monthly.resets_at).toBe('2026-08-01T00:00:00.000Z')
  })

  it('falls back to now for missing window anchors', () => {
    const subNoAnchors = { ...sub, window_5h_anchor: null, window_week_anchor: null }
    const before = Date.now()
    const result = computeUsageWindows(subNoAnchors, tier, { spend5h: 0, spendWeek: 0, spendMonth: 0 })
    const after = Date.now()
    const resetsAtMs = new Date(result.window.resets_at).getTime() - 5 * 3600_000
    expect(resetsAtMs).toBeGreaterThanOrEqual(before)
    expect(resetsAtMs).toBeLessThanOrEqual(after)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bot/services/usageWindows.test.ts`
Expected: FAIL — `computeUsageWindows` is not defined.

- [ ] **Step 3: Implement `computeUsageWindows`**

```typescript
// src/lib/bot/services/usageWindows.ts

export interface UsageWindowResult { spent: number; cap: number; resets_at: string }

export interface UsageWindowsResult {
  window: UsageWindowResult
  weekly: UsageWindowResult
  monthly: UsageWindowResult
}

export function computeUsageWindows(
  sub: {
    window_5h_anchor: string | null
    window_week_anchor: string | null
    period_start: string
    period_end: string
  },
  tier: {
    price_usd: number
    credit_percent: number
    weekly_tightness: number
    sessions_per_week: number
    window_hours: number
  },
  spend: { spend5h: number; spendWeek: number; spendMonth: number }
): UsageWindowsResult {
  const now = new Date()
  const window5hAnchor = sub.window_5h_anchor ? new Date(sub.window_5h_anchor) : now
  const windowWeekAnchor = sub.window_week_anchor ? new Date(sub.window_week_anchor) : now

  const monthlyCredit = tier.price_usd * tier.credit_percent / 100
  const weeklyCap = monthlyCredit * tier.weekly_tightness / 4.33
  const windowCap = weeklyCap / Math.max(tier.sessions_per_week, 1)

  return {
    window: {
      spent: spend.spend5h,
      cap: windowCap,
      resets_at: new Date(window5hAnchor.getTime() + tier.window_hours * 3600_000).toISOString(),
    },
    weekly: {
      spent: spend.spendWeek,
      cap: weeklyCap,
      resets_at: new Date(windowWeekAnchor.getTime() + 7 * 24 * 3600_000).toISOString(),
    },
    monthly: {
      spent: spend.spendMonth,
      cap: monthlyCredit,
      resets_at: sub.period_end,
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bot/services/usageWindows.test.ts`
Expected: PASS, all 8 tests green.

- [ ] **Step 5: Wire the helper into `/api/usage/route.ts`, replacing its inline formula**

```typescript
// src/app/api/usage/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin, isSupabaseEnabled, supabaseUrl, supabaseAnonKey } from '@/lib/supabase'
import { computeUsageWindows } from '@/lib/bot/services/usageWindows'

export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
  }

  const supabase = createClient(
    supabaseUrl!,
    supabaseAnonKey!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  )
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: sub } = await supabaseAdmin
    .from('user_subscriptions')
    .select('*, subscription_tiers(*)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!sub) {
    return NextResponse.json({ error: 'No subscription record' }, { status: 404 })
  }

  const tier = (sub as any).subscription_tiers
  if (!tier) {
    return NextResponse.json({ error: 'No subscription tier configured' }, { status: 404 })
  }

  const [{ data: spend5h }, { data: spendWeek }, { data: spendMonth }] = await Promise.all([
    supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', user.id).gte('created_at', sub.window_5h_anchor ?? sub.period_start),
    supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', user.id).gte('created_at', sub.window_week_anchor ?? sub.period_start),
    supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', user.id).gte('created_at', sub.period_start),
  ])

  const sum = (rows: any[] | null) => (rows ?? []).reduce((acc, r) => acc + Number(r.amount_usd), 0)

  const windows = computeUsageWindows(sub, tier, {
    spend5h: sum(spend5h),
    spendWeek: sum(spendWeek),
    spendMonth: sum(spendMonth),
  })

  return NextResponse.json({
    tier: { id: tier.id, name: tier.name, price_usd: tier.price_usd },
    ...windows,
  })
}
```

(Note: `tier.price_usd` is added to the response's `tier` object here — Task 8 Step 1 needs it for the Settings panel header. This is a small, additive, backward-compatible change to the response shape.)

- [ ] **Step 6: Typecheck and run the full test suite**

Run: `npx tsc --noEmit` — expect no new errors.
Run: `npx vitest run` — expect all tests pass (the 8 new ones plus no regressions).

- [ ] **Step 7: Commit**

```bash
git add src/lib/bot/services/usageWindows.ts src/lib/bot/services/usageWindows.test.ts src/app/api/usage/route.ts
git commit -m "refactor(credits): extract shared usage-window-math into computeUsageWindows"
```

---

## Task 5: Admin subscriptions page — data layer

**Files:**
- Create: `src/app/admin/subscriptions/actions.ts`

- [ ] **Step 1: Write `getSubscriptions`, `updateUserTier`, `updateUserPeriod`, `grantBonusCredit`**

```typescript
// src/app/admin/subscriptions/actions.ts
'use server'

import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { computeUsageWindows } from '@/lib/bot/services/usageWindows'

export interface SubscriptionRow {
  user_id: string
  email: string
  tier_id: string
  tier_name: string
  period_start: string
  period_end: string
  granted_by_promo_code: string | null
  window: { spent: number; cap: number; resets_at: string }
  weekly: { spent: number; cap: number; resets_at: string }
  monthly: { spent: number; cap: number; resets_at: string }
}

export async function getSubscriptions(): Promise<SubscriptionRow[]> {
  const { data: subs, error } = await supabaseAdmin
    .from('user_subscriptions')
    .select('*, subscription_tiers(*)')

  if (error || !subs) {
    console.error('[getSubscriptions] Failed to fetch subscriptions:', error)
    return []
  }

  const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  const emailByUserId = new Map((userList?.users ?? []).map((u: any) => [u.id, u.email as string]))

  const rows = await Promise.all(subs.map(async (sub: any) => {
    const tier = sub.subscription_tiers
    const [{ data: spend5h }, { data: spendWeek }, { data: spendMonth }] = await Promise.all([
      supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', sub.user_id).gte('created_at', sub.window_5h_anchor ?? sub.period_start),
      supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', sub.user_id).gte('created_at', sub.window_week_anchor ?? sub.period_start),
      supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', sub.user_id).gte('created_at', sub.period_start),
    ])
    const sum = (rows: any[] | null) => (rows ?? []).reduce((acc, r) => acc + Number(r.amount_usd), 0)
    const windows = computeUsageWindows(sub, tier, {
      spend5h: sum(spend5h),
      spendWeek: sum(spendWeek),
      spendMonth: sum(spendMonth),
    })

    return {
      user_id: sub.user_id,
      email: emailByUserId.get(sub.user_id) ?? '(unknown)',
      tier_id: sub.tier_id,
      tier_name: tier?.name ?? sub.tier_id,
      period_start: sub.period_start,
      period_end: sub.period_end,
      granted_by_promo_code: sub.granted_by_promo_code,
      ...windows,
    }
  }))

  return rows
}

export async function updateUserTier(userId: string, tierId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('user_subscriptions')
    .update({
      tier_id: tierId,
      granted_by_promo_code: null,
      period_start: new Date().toISOString(),
      period_end: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/subscriptions')
}

export async function updateUserPeriod(userId: string, periodStart: string, periodEnd: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('user_subscriptions')
    .update({ period_start: periodStart, period_end: periodEnd, updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/subscriptions')
}

export async function grantBonusCredit(userId: string, amountUsd: number, note: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('credit_spend_events')
    .insert({
      user_id: userId,
      request_id: crypto.randomUUID(),
      amount_usd: -Math.abs(amountUsd),
      mode: 'admin_grant',
      is_reservation: false,
      note: note || null,
    })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/subscriptions')
}

export async function getTierOptions(): Promise<Array<{ id: string; name: string }>> {
  const { data } = await supabaseAdmin.from('subscription_tiers').select('id, name').order('price_usd', { ascending: true })
  return data ?? []
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/subscriptions/actions.ts
git commit -m "feat(credits): admin subscription management server actions"
```

---

## Task 6: Admin subscriptions page — UI and nav entry

**Files:**
- Create: `src/app/admin/subscriptions/page.tsx`
- Create: `src/app/admin/subscriptions/SubscriptionsTable.tsx`
- Create: `src/app/admin/subscriptions/PromoCodeSection.tsx`
- Create: `src/app/admin/subscriptions/promoActions.ts`
- Modify: `src/components/admin/Sidebar.tsx`

- [ ] **Step 1: Write `promoActions.ts` (promo code create/list actions)**

```typescript
// src/app/admin/subscriptions/promoActions.ts
'use server'

import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export interface PromoCodeRow {
  code: string
  tier_id: string
  tier_name: string
  duration_days: number
  max_uses: number
  uses_count: number
  created_at: string
  expires_at: string | null
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // excludes ambiguous 0/O/1/I
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function listPromoCodes(): Promise<PromoCodeRow[]> {
  const { data, error } = await supabaseAdmin
    .from('promo_codes')
    .select('*, subscription_tiers(name)')
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('[listPromoCodes] Failed to fetch:', error)
    return []
  }

  return data.map((row: any) => ({
    code: row.code,
    tier_id: row.tier_id,
    tier_name: row.subscription_tiers?.name ?? row.tier_id,
    duration_days: row.duration_days,
    max_uses: row.max_uses,
    uses_count: row.uses_count,
    created_at: row.created_at,
    expires_at: row.expires_at,
  }))
}

export async function createPromoCode(tierId: string, durationDays: number, maxUses: number): Promise<{ code: string }> {
  const code = generateCode()
  const { error } = await supabaseAdmin
    .from('promo_codes')
    .insert({ code, tier_id: tierId, duration_days: durationDays, max_uses: maxUses })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/subscriptions')
  return { code }
}
```

- [ ] **Step 2: Write `SubscriptionsTable.tsx`**

```typescript
// src/app/admin/subscriptions/SubscriptionsTable.tsx
'use client'

import { useState } from 'react'
import { updateUserTier, updateUserPeriod, grantBonusCredit, type SubscriptionRow } from './actions'

function UsageBar({ label, usage }: { label: string; usage: { spent: number; cap: number } }) {
  const pct = usage.cap > 0 ? Math.min(100, (usage.spent / usage.cap) * 100) : 0
  return (
    <div className="space-y-0.5 min-w-[100px]">
      <div className="flex justify-between text-[10px] text-[var(--bone-70)]">
        <span>{label}</span>
        <span>${usage.spent.toFixed(4)} / ${usage.cap.toFixed(2)}</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-[var(--bone-10)] overflow-hidden">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function SubscriptionsTable({
  initialRows,
  tierOptions,
}: {
  initialRows: SubscriptionRow[]
  tierOptions: Array<{ id: string; name: string }>
}) {
  const [rows, setRows] = useState(initialRows)
  const [creditFormOpenFor, setCreditFormOpenFor] = useState<string | null>(null)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditNote, setCreditNote] = useState('')

  async function handleTierChange(userId: string, tierId: string) {
    await updateUserTier(userId, tierId)
    setRows(prev => prev.map(r => r.user_id === userId ? { ...r, tier_id: tierId, granted_by_promo_code: null } : r))
  }

  async function handlePeriodChange(userId: string, field: 'period_start' | 'period_end', value: string) {
    const row = rows.find(r => r.user_id === userId)
    if (!row) return
    const nextStart = field === 'period_start' ? value : row.period_start
    const nextEnd = field === 'period_end' ? value : row.period_end
    await updateUserPeriod(userId, new Date(nextStart).toISOString(), new Date(nextEnd).toISOString())
    setRows(prev => prev.map(r => r.user_id === userId ? { ...r, period_start: nextStart, period_end: nextEnd } : r))
  }

  async function handleGrantCredit(userId: string) {
    const amount = parseFloat(creditAmount)
    if (!Number.isFinite(amount) || amount <= 0) return
    await grantBonusCredit(userId, amount, creditNote)
    setCreditFormOpenFor(null)
    setCreditAmount('')
    setCreditNote('')
    setRows(prev => prev.map(r => r.user_id === userId
      ? { ...r, window: { ...r.window, spent: r.window.spent - amount }, weekly: { ...r.weekly, spent: r.weekly.spent - amount }, monthly: { ...r.monthly, spent: r.monthly.spent - amount } }
      : r))
  }

  if (rows.length === 0) {
    return (
      <div className="p-12 text-center text-bone-70">
        <p className="text-sm font-bold tracking-tight">No subscriptions yet.</p>
        <p className="text-[10px] mt-2 font-bold opacity-30 tracking-tight">Rows appear once a user sends their first chat message.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto bg-panel rounded-big border border-[var(--bone-6)]">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white/5 border-b border-[var(--bone-6)]">
            <th className="px-6 py-4 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">User</th>
            <th className="px-6 py-4 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">Tier</th>
            <th className="px-6 py-4 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">Usage</th>
            <th className="px-6 py-4 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">Period</th>
            <th className="px-6 py-4 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--bone-6)]">
          {rows.map(row => (
            <tr key={row.user_id} className="hover:bg-[var(--bone-6)] transition-all duration-200">
              <td className="px-6 py-4">
                <div className="text-[13px] font-medium text-muted-foreground">{row.email}</div>
                {row.granted_by_promo_code && (
                  <div className="text-[10px] text-accent font-mono mt-0.5">via {row.granted_by_promo_code}</div>
                )}
              </td>
              <td className="px-6 py-4">
                <select
                  value={row.tier_id}
                  onChange={e => handleTierChange(row.user_id, e.target.value)}
                  className="px-2 py-1 rounded-lg border border-[var(--bone-12)] bg-background text-[12px] text-foreground"
                >
                  {tierOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col gap-1.5">
                  <UsageBar label="5h" usage={row.window} />
                  <UsageBar label="Weekly" usage={row.weekly} />
                  <UsageBar label="Monthly" usage={row.monthly} />
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col gap-1 text-[11px]">
                  <input
                    type="date"
                    value={row.period_start.slice(0, 10)}
                    onChange={e => handlePeriodChange(row.user_id, 'period_start', e.target.value)}
                    className="px-2 py-1 rounded-lg border border-[var(--bone-12)] bg-background text-foreground"
                  />
                  <input
                    type="date"
                    value={row.period_end.slice(0, 10)}
                    onChange={e => handlePeriodChange(row.user_id, 'period_end', e.target.value)}
                    className="px-2 py-1 rounded-lg border border-[var(--bone-12)] bg-background text-foreground"
                  />
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                {creditFormOpenFor === row.user_id ? (
                  <div className="flex flex-col gap-1.5 items-end">
                    <input
                      type="number"
                      placeholder="Amount USD"
                      value={creditAmount}
                      onChange={e => setCreditAmount(e.target.value)}
                      className="px-2 py-1 rounded-lg border border-[var(--bone-12)] bg-background text-[11px] text-foreground w-28"
                    />
                    <input
                      type="text"
                      placeholder="Note (optional)"
                      value={creditNote}
                      onChange={e => setCreditNote(e.target.value)}
                      className="px-2 py-1 rounded-lg border border-[var(--bone-12)] bg-background text-[11px] text-foreground w-28"
                    />
                    <div className="flex gap-1">
                      <button onClick={() => handleGrantCredit(row.user_id)} className="px-2 py-1 rounded-lg bg-accent text-accent-foreground text-[10px] font-medium">Grant</button>
                      <button onClick={() => setCreditFormOpenFor(null)} className="px-2 py-1 rounded-lg bg-background border border-[var(--bone-12)] text-[10px] font-medium">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setCreditFormOpenFor(row.user_id)}
                    className="px-3 py-1.5 rounded-lg bg-background border border-[var(--bone-6)] text-[10px] font-bold text-muted-foreground hover:text-foreground transition-all"
                  >
                    + Add Credit
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Write `PromoCodeSection.tsx`**

```typescript
// src/app/admin/subscriptions/PromoCodeSection.tsx
'use client'

import { useState } from 'react'
import { createPromoCode, type PromoCodeRow } from './promoActions'

export default function PromoCodeSection({
  initialCodes,
  tierOptions,
}: {
  initialCodes: PromoCodeRow[]
  tierOptions: Array<{ id: string; name: string }>
}) {
  const [codes, setCodes] = useState(initialCodes)
  const [tierId, setTierId] = useState(tierOptions[0]?.id ?? '')
  const [durationDays, setDurationDays] = useState('30')
  const [maxUses, setMaxUses] = useState('1')
  const [creating, setCreating] = useState(false)
  const [newCode, setNewCode] = useState<string | null>(null)

  async function handleCreate() {
    const days = parseInt(durationDays, 10)
    const uses = parseInt(maxUses, 10)
    if (!tierId || !Number.isFinite(days) || days <= 0 || !Number.isFinite(uses) || uses <= 0) return
    setCreating(true)
    try {
      const { code } = await createPromoCode(tierId, days, uses)
      setNewCode(code)
      setCodes(prev => [{ code, tier_id: tierId, tier_name: tierOptions.find(t => t.id === tierId)?.name ?? tierId, duration_days: days, max_uses: uses, uses_count: 0, created_at: new Date().toISOString(), expires_at: null }, ...prev])
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="bg-panel border border-[var(--bone-6)] px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow space-y-4">
      <div className="text-[10px] font-bold text-bone-70 tracking-[0.1em] uppercase opacity-40">Promo Codes</div>

      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground">Tier</label>
          <select value={tierId} onChange={e => setTierId(e.target.value)} className="px-2 py-1.5 rounded-lg border border-[var(--bone-12)] bg-background text-sm text-foreground">
            {tierOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground">Duration (days)</label>
          <input type="number" value={durationDays} onChange={e => setDurationDays(e.target.value)} className="px-2 py-1.5 rounded-lg border border-[var(--bone-12)] bg-background text-sm text-foreground w-24" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground">Max uses</label>
          <input type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} className="px-2 py-1.5 rounded-lg border border-[var(--bone-12)] bg-background text-sm text-foreground w-20" />
        </div>
        <button onClick={handleCreate} disabled={creating} className="px-4 py-1.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50">
          {creating ? 'Creating...' : 'Generate'}
        </button>
      </div>

      {newCode && (
        <div className="px-3 py-2 rounded-lg bg-accent/10 border border-accent/20 text-sm font-mono text-foreground">
          New code: <strong>{newCode}</strong>
        </div>
      )}

      <div className="space-y-1.5">
        {codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No promo codes yet.</p>
        ) : codes.map(c => (
          <div key={c.code} className="flex items-center justify-between gap-4 py-2 border-b border-[var(--bone-6)] last:border-0 text-sm">
            <span className="font-mono text-foreground">{c.code}</span>
            <span className="text-muted-foreground text-xs">{c.tier_name} · {c.duration_days}d</span>
            <span className="text-muted-foreground text-xs">{c.uses_count} / {c.max_uses} used</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write `page.tsx`**

```typescript
// src/app/admin/subscriptions/page.tsx
import { getSubscriptions, getTierOptions } from './actions'
import { listPromoCodes } from './promoActions'
import SubscriptionsTable from './SubscriptionsTable'
import PromoCodeSection from './PromoCodeSection'

export default async function SubscriptionsPage() {
  const [rows, tierOptions, promoCodes] = await Promise.all([
    getSubscriptions(),
    getTierOptions(),
    listPromoCodes(),
  ])

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display font-medium text-foreground mb-1">Subscriptions</h1>
        <p className="text-muted-foreground text-sm font-medium">Manage user tiers, subscription periods, bonus credit, and promo codes.</p>
      </div>

      <PromoCodeSection initialCodes={promoCodes} tierOptions={tierOptions} />

      <SubscriptionsTable initialRows={rows} tierOptions={tierOptions} />
    </div>
  )
}
```

- [ ] **Step 5: Add the sidebar nav entry**

In `src/components/admin/Sidebar.tsx`, add `CreditCard` to the existing `lucide-react` import list (find the multi-line import near the top and add it to that same import statement), then add a new `NavLink` in the `"System"` `PlatformSection` (the one containing `/admin/users`), right after the existing `/admin/users` line:

```typescript
// Before (in the "System" PlatformSection):
<NavLink href="/admin/users" icon={Users}>Users</NavLink>
<NavLink href="/admin/admins" icon={UserCog}>Admins</NavLink>

// After:
<NavLink href="/admin/users" icon={Users}>Users</NavLink>
<NavLink href="/admin/subscriptions" icon={CreditCard}>Subscriptions</NavLink>
<NavLink href="/admin/admins" icon={UserCog}>Admins</NavLink>
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Manually verify in the browser**

Run: `npm run dev`, log in as an admin, navigate to `/admin/subscriptions` (or click the new "Subscriptions" sidebar link). Expected: the page loads, shows one row per existing `user_subscriptions` record with email, tier dropdown, usage bars, period date inputs, and an "Add Credit" button. Change a tier, confirm it persists on reload. Generate a promo code, confirm it appears in the list below the form.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/subscriptions/page.tsx src/app/admin/subscriptions/SubscriptionsTable.tsx src/app/admin/subscriptions/PromoCodeSection.tsx src/app/admin/subscriptions/promoActions.ts src/components/admin/Sidebar.tsx
git commit -m "feat(credits): admin subscriptions page with tier/period/credit management and promo codes"
```

---

## Task 7: User-facing promo code redemption action

**Files:**
- Create: `src/app/settings/actions.ts` (or, if a settings actions file already exists elsewhere, add to it — check `grep -rln "'use server'" src/app/settings/ src/components/settings/` first and place this alongside whatever's already there rather than creating a stray duplicate)

- [ ] **Step 1: Check for an existing settings actions file**

Run: `grep -rln "'use server'" src/app/settings/ src/components/settings/ 2>/dev/null`

If a file already exists, add the function below to it. If nothing exists, create `src/app/settings/actions.ts` with this content.

- [ ] **Step 2: Write `redeemPromoCode`**

```typescript
// src/app/settings/actions.ts (or appended to the existing settings actions file found in Step 1)
'use server'

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase'

export async function redeemPromoCode(code: string, accessToken: string): Promise<{ success: boolean; error?: string }> {
  if (!code.trim()) return { success: false, error: 'Enter a code' }

  const supabase = createClient(
    supabaseUrl!,
    supabaseAnonKey!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const { data, error } = await supabase.rpc('redeem_promo_code', { p_code: code.trim().toUpperCase() }).single()

  if (error) {
    console.error('[redeemPromoCode] RPC error:', error)
    return { success: false, error: 'Something went wrong. Try again.' }
  }

  const result = data as { success: boolean; error: string | null }
  if (!result.success) {
    const messages: Record<string, string> = {
      not_authenticated: 'You need to be signed in.',
      invalid_code: 'That code doesn\'t exist.',
      code_expired: 'That code has expired.',
      max_uses_reached: 'That code has already been fully redeemed.',
      already_redeemed: 'You\'ve already redeemed this code.',
    }
    return { success: false, error: messages[result.error ?? ''] ?? 'Invalid code.' }
  }

  return { success: true }
}
```

(This is a server action, but it needs the CALLING user's own access token — not `supabaseAdmin` — since `redeem_promo_code` reads `auth.uid()` from the JWT passed in the client it's called with. `accessToken` must be passed in from the client component calling this action, since Next.js server actions don't automatically have access to the browser's Supabase session.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/actions.ts
git commit -m "feat(credits): redeemPromoCode server action"
```

(If Step 1 found an existing file, adjust the `git add` path and commit message to reflect that you modified an existing file rather than creating a new one.)

---

## Task 8: Settings panel enrichment

**Files:**
- Modify: `src/components/settings/UsagePanel.tsx`

- [ ] **Step 1: Extend `UsagePanel` with tier header, redeem field, spend history, and downgrade button**

First, extend `/api/usage/route.ts`'s response to include `recentSpend` (Task 4 already added `price_usd` to the `tier` object — this step adds one more field). Re-open `src/app/api/usage/route.ts` and add a query + field:

```typescript
// Add this query to the existing Promise.all alongside spend5h/spendWeek/spendMonth in src/app/api/usage/route.ts:
const [{ data: spend5h }, { data: spendWeek }, { data: spendMonth }, { data: recentSpend }] = await Promise.all([
  supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', user.id).gte('created_at', sub.window_5h_anchor ?? sub.period_start),
  supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', user.id).gte('created_at', sub.window_week_anchor ?? sub.period_start),
  supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', user.id).gte('created_at', sub.period_start),
  supabaseAdmin.from('credit_spend_events').select('amount_usd, created_at, mode').eq('user_id', user.id).eq('is_reservation', false).order('created_at', { ascending: false }).limit(10),
])

// Add recentSpend to the final NextResponse.json(...) call:
return NextResponse.json({
  tier: { id: tier.id, name: tier.name, price_usd: tier.price_usd },
  ...windows,
  recentSpend: recentSpend ?? [],
})
```

Now rewrite `src/components/settings/UsagePanel.tsx` in full:

```typescript
"use client";

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { redeemPromoCode, downgradeToFree } from '@/app/settings/actions'

interface UsageWindow { spent: number; cap: number; resets_at: string }
interface RecentSpendRow { amount_usd: string; created_at: string; mode: string }
interface UsageData {
  tier: { id: string; name: string; price_usd: number }
  window: UsageWindow
  weekly: UsageWindow
  monthly: UsageWindow
  recentSpend: RecentSpendRow[]
}

function formatResetCountdown(resetsAt: string): string {
  const diffMs = new Date(resetsAt).getTime() - Date.now()
  if (diffMs <= 0) return 'now'
  const hours = Math.floor(diffMs / 3600_000)
  const minutes = Math.floor((diffMs % 3600_000) / 60_000)
  if (hours > 24) return `${Math.floor(hours / 24)}d`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function UsageBar({ label, usage }: { label: string; usage: UsageWindow }) {
  const pct = usage.cap > 0 ? Math.min(100, (usage.spent / usage.cap) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-[var(--bone-100)]">{label}</span>
        <span className="text-[var(--bone-40)] text-xs">Resets in {formatResetCountdown(usage.resets_at)}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-[var(--bone-10)] overflow-hidden">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function UsagePanel() {
  const [data, setData] = useState<UsageData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [promoInput, setPromoInput] = useState('')
  const [promoStatus, setPromoStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  const [downgrading, setDowngrading] = useState(false)

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return
    try {
      const res = await fetch('/api/usage', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        setError('Usage data unavailable')
        return
      }
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      console.error('[UsagePanel] Failed to load usage:', err)
      setError('Usage data unavailable')
    }
  }

  useEffect(() => {
    let cancelled = false
    load().catch(() => {})
    return () => { cancelled = true }
  }, [])

  async function handleRedeem() {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token || !promoInput.trim()) return
    setRedeeming(true)
    setPromoStatus(null)
    try {
      const result = await redeemPromoCode(promoInput, token)
      if (result.success) {
        setPromoStatus({ type: 'success', message: 'Code redeemed!' })
        setPromoInput('')
        await load()
      } else {
        setPromoStatus({ type: 'error', message: result.error ?? 'Invalid code.' })
      }
    } finally {
      setRedeeming(false)
    }
  }

  async function handleDowngrade() {
    if (!confirm('Downgrade to the free tier now?')) return
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return
    setDowngrading(true)
    try {
      await downgradeToFree(token)
      await load()
    } finally {
      setDowngrading(false)
    }
  }

  if (error) return <p className="text-sm text-[var(--bone-40)]">{error}</p>
  if (!data) return <p className="text-sm text-[var(--bone-40)]">Loading usage…</p>

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-sm font-semibold text-[var(--bone-100)]">{data.tier.name} plan</h4>
          <p className="text-xs text-[var(--bone-40)]">
            {data.tier.price_usd > 0 ? `$${data.tier.price_usd}/mo · ` : ''}
            renews {new Date(data.monthly.resets_at).toLocaleDateString()}
          </p>
        </div>
        {data.tier.id !== 'free' && (
          <button
            onClick={handleDowngrade}
            disabled={downgrading}
            className="px-3 py-1.5 rounded-lg bg-background border border-[var(--bone-12)] text-xs font-medium text-[var(--bone-70)] hover:text-[var(--bone-100)] disabled:opacity-50 transition-all"
          >
            {downgrading ? 'Downgrading...' : 'Downgrade to Free'}
          </button>
        )}
      </div>

      <div className="space-y-4">
        <UsageBar label="5-hour limit" usage={data.window} />
        <UsageBar label="Weekly limit" usage={data.weekly} />
        <UsageBar label="Monthly credit" usage={data.monthly} />
      </div>

      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <input
            value={promoInput}
            onChange={e => setPromoInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRedeem()}
            placeholder="Have a promo code?"
            className="w-full px-3 py-2 rounded-lg border border-[var(--bone-12)] bg-background text-sm text-foreground placeholder:text-[var(--bone-40)] focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {promoStatus && (
            <p className={`text-xs mt-1 ${promoStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
              {promoStatus.message}
            </p>
          )}
        </div>
        <button
          onClick={handleRedeem}
          disabled={redeeming || !promoInput.trim()}
          className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50 transition-all hover:opacity-90"
        >
          {redeeming ? 'Redeeming...' : 'Redeem'}
        </button>
      </div>

      {data.recentSpend.length > 0 && (
        <div className="space-y-1.5">
          <h5 className="text-xs font-semibold text-[var(--bone-70)] uppercase tracking-wide">Recent Activity</h5>
          {data.recentSpend.map((row, i) => (
            <div key={i} className="flex justify-between text-xs text-[var(--bone-40)] py-1 border-b border-[var(--bone-6)] last:border-0">
              <span>{new Date(row.created_at).toLocaleString()}</span>
              <span>${Number(row.amount_usd).toFixed(4)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add `downgradeToFree` to the settings actions file**

In the same file created/found in Task 7 (`src/app/settings/actions.ts` or the pre-existing file identified there), add:

```typescript
export async function downgradeToFree(accessToken: string): Promise<{ success: boolean }> {
  const supabase = createClient(
    supabaseUrl!,
    supabaseAnonKey!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return { success: false }

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      tier_id: 'free',
      granted_by_promo_code: null,
      period_start: new Date().toISOString(),
      period_end: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
    })
    .eq('user_id', user.id)

  return { success: !error }
}
```

Note: this is intentionally hardcoded to `'free'` with no tier parameter — there is no way to call this function and have it set any other tier, which is what makes it safe as a self-service action (no server-side branch could ever grant a paid tier through this path, since the literal string is baked into the function body).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, open Settings. Expected: tier name/price/renewal date shown above the bars; a "Downgrade to Free" button appears only if not already on free tier; a promo code field is present; redeeming a valid code (create one via `/admin/subscriptions` first) updates the tier/bars immediately; recent activity list shows past charges if any exist.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/UsagePanel.tsx src/app/api/usage/route.ts src/app/settings/actions.ts
git commit -m "feat(credits): enrich Settings usage panel with tier info, promo redemption, spend history, self-downgrade"
```

---

## Self-Review Notes

- **Spec coverage:** §1 schema → Task 2. §2 `reserve_credit` expiry-revert → Task 3. §3 admin page → Tasks 5-6. §4 redemption RPC/action → Tasks 3, 7. §5 Settings enrichment → Task 8. The spec's shared-helper note (§3/§5) → Task 4, done once and reused by both the existing `/api/usage` route and the new admin page's `getSubscriptions()`. The real regression found during planning (UsagePanel not actually wired in despite Task 8 of the prior plan reporting it was) is fixed first in Task 1, since Tasks 4 and 8 both assume it's live.
- **Type consistency:** `computeUsageWindows`'s input/output shapes (Task 4) are used identically by `/api/usage/route.ts` (Task 4 Step 5) and `getSubscriptions()` (Task 5) — same field names (`window`/`weekly`/`monthly`, each `{spent, cap, resets_at}`) in both call sites, no renaming drift. `redeem_promo_code`'s RPC return shape (`{success, error}`) matches exactly what `redeemPromoCode` (Task 7) destructures.
- **Sequencing:** Task 4 (shared helper) must precede Task 5 (admin page, which imports it) and must follow the existing `/api/usage` route it refactors — done in the same task to avoid a broken intermediate state. Task 7 (redemption action) must precede Task 8 (Settings panel, which imports `redeemPromoCode`/`downgradeToFree` from it).
