# AI Credit Metering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Meter real dollar cost of every chat request (model tokens, cache tokens, web search calls, compaction calls) against a per-user monthly credit pool that's paced via fixed 5-hour and weekly windows, replacing the flat 1000-messages/day counter with cost-based limits that scale fairly across cheap and expensive models.

**Architecture:** A per-request cost accumulator threaded through `runChain`'s 7 return paths sums every billable step (model tokens via a corrected cache-aware formula, web search flat-rate calls, compaction model calls). Before the pipeline runs, an atomic Postgres RPC (`reserve_credit`) checks all three fixed-window budgets and reserves a flat estimate; after the pipeline completes (success, error, or abort), a second RPC (`reconcile_credit`) corrects that reservation to the real accumulated cost. Shipped in two halves: first the cost-accounting foundation in logging-only mode (safe to deploy, changes nothing user-visible), then enforcement turned on once pricing data is verified non-zero.

**Tech Stack:** Next.js server actions/API routes, Supabase (Postgres RPCs, SECURITY DEFINER functions), Vitest.

---

## Reference: current state

- `chainRouter.ts`'s `runChain` has **7 return points** (verified by direct inspection): lines 248 (advisor planning — before any provider call, correctly $0), 453 & 506 (vision success paths — after a vision provider call, must include `visionCost`), 557 (vision failed — may follow an attempted-but-failed vision call), 611 (classifier failed — before any paid provider call, correctly $0), 1282 (main success path), 1355 (final catch-all failure, correctly $0 since no model in the loop succeeded).
- Cost is computed at two sites today, both uncharged to any user budget: [chainRouter.ts:379-380](../../../src/lib/bot/chainRouter.ts#L379) (`visionCost`) and [chainRouter.ts:1096-1097](../../../src/lib/bot/chainRouter.ts#L1096) (`actualCost`), both feeding `logCost()` → `cost_log` table (admin-only bookkeeping, not a user budget).
- `cache_read_input_tokens`/`cache_creation_input_tokens` are only ever populated by the OpenRouter adapter ([openrouter.ts:397-398](../../../src/lib/bot/providers/openrouter.ts#L397)); Google/Groq/NVIDIA adapters never set them.
- `models` table: `id, provider, input_modalities, output_modalities, max_rpd, is_favorite, usage_today, last_reset_date, sort_order, is_paid, prompt_cost, completion_cost` ([20260425_models_table.sql](../../../supabase/migrations/20260425_models_table.sql), [20260509_paid_models.sql](../../../supabase/migrations/20260509_paid_models.sql)). No `context_window`, `max_output_tokens`, `cache_read_cost`, `cache_write_cost` yet.
- `src/app/admin/models/actions.ts`: `getModels`, `updateModel`, `addModel`, `logModelCost` — the pattern to extend for new pricing columns.
- Chat route: [src/app/api/ai/chat/route.ts](../../../src/app/api/ai/chat/route.ts) — `activeMode = (mode === 'pro') ? mode : 'default'` at line 41; `userId = user?.id || 'anonymous'` at line 50; existing (to-be-removed) `checkAndIncrementQuota` at lines 11-20; stream lifecycle with `clientDisconnected`/`finally` block at lines 65, 228.
- `increment_my_quota` RPC + `user_quotas` table ([20260701_secure_quota_rpc.sql](../../../supabase/migrations/20260701_secure_quota_rpc.sql)) — superseded and removed by this plan.
- `sync-quotas` route ([route.ts](../../../src/app/api/sync-quotas/route.ts)) — dead scaffolding, removed by this plan.
- Search providers: `searchTavily` ([tavily.ts:45](../../../src/lib/bot/providers/tavily.ts#L45), internal fallback retry at line 69), `searchExa`/`extractExaUrls` ([exa.ts:5](../../../src/lib/bot/providers/exa.ts#L5), [exa.ts:56](../../../src/lib/bot/providers/exa.ts#L56)) — currently zero cost tracking.
- Compaction: `compactSession` ([compaction.ts:73](../../../src/lib/bot/compaction.ts#L73)) makes a real model call via `runCompactionModel` ([compaction.ts:39](../../../src/lib/bot/compaction.ts#L39)), untracked. Trigger logic at [chainRouter.ts:1222-1232](../../../src/lib/bot/chainRouter.ts#L1222).
- Full design rationale: [docs/superpowers/specs/2026-07-07-ai-credit-metering-design.md](../specs/2026-07-07-ai-credit-metering-design.md).

## Dependency on the other plan

This plan references `mode` (`'default' | 'pro'`) purely as a string tag on `credit_spend_events` rows and as an input to `subscription_tiers.router_mode` — it does **not** require [2026-07-07-mode-based-router-chains.md](2026-07-07-mode-based-router-chains.md) to be implemented first. They can ship in either order or in parallel.

## Sequencing principle: foundation first, inert; enforcement last

Most models in this codebase are currently `is_paid: false` / `prompt_cost: null` (dev-phase subsidized models — see conversation context: this will change once the app is public and all models carry real cost). If enforcement ships before pricing is populated, every cost computes to $0 and no limit will ever fire — silently defeating the entire point, and untestable. So: **Tasks 1-6 build and wire the full cost-accounting pipeline in logging-only mode** (every request still computes and stores its real cost, but `reserve_credit` always returns `allowed: true` — a feature-flagged bypass). **Task 7 seeds real pricing data. Task 8 flips enforcement on** and is the only task that changes user-visible behavior. This means Tasks 1-6 are safe to deploy independently and verify against real traffic before the enforcement switch is thrown.

## Out of scope (per spec)

- Payment integration (Stripe) — tiers/subscriptions set manually via admin for now.
- Storage quotas, cloud-sync gating — separate future design.
- `mode=max` as a distinct routing tier — schema supports it, not built now.
- Runtime enforcement of `context_window`/`max_output_tokens` (truncating over-long prompts) — this plan only makes those columns data-complete.
- Per-model/chain-aware compaction sizing — flat 32k ceiling only (see spec §4).

---

## Task 1: Schema — tiers, subscriptions, ledger, search provider pricing

**Files:**
- Create: `supabase/migrations/20260707_credit_metering_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply the migration**

Apply via the project's Supabase migration workflow. Verify:

```sql
SELECT id, name, price_usd, credit_percent, router_mode FROM subscription_tiers;
SELECT id, cost_per_call FROM search_providers;
```

Expected: 3 tier rows (free/pro/max), 3 search provider rows, all `cost_per_call = 0`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260707_credit_metering_schema.sql
git commit -m "feat(credits): add subscription tier, ledger, and search pricing schema"
```

---

## Task 2: Atomic reserve/reconcile RPCs (feature-flagged bypass)

**Files:**
- Create: `supabase/migrations/20260707_credit_rpcs.sql`

Both RPCs run `SECURITY DEFINER` so they execute with elevated privileges regardless of caller RLS, matching the existing `increment_my_quota` pattern. A `settings` row `credit_enforcement_enabled` (boolean, default `false`) gates real enforcement — while `false`, `reserve_credit` always returns `allowed: true` but still performs the window-anchor bookkeeping and writes the reservation row, so the ledger fills with real data before enforcement is switched on in Task 8.

- [ ] **Step 1: Write the migration**

```sql
-- Migration: 20260707_credit_rpcs.sql
-- Description: Atomic reserve/reconcile RPCs for credit metering.
-- reserve_credit runs BEFORE the model pipeline (estimate); reconcile_credit
-- runs AFTER (real cost). See spec §3 for the race-condition rationale.

CREATE OR REPLACE FUNCTION reserve_credit(
  p_request_id UUID,
  p_mode TEXT DEFAULT 'default',
  p_reservation_usd NUMERIC DEFAULT 0.02
)
RETURNS TABLE(allowed BOOLEAN, blocked_window TEXT, resets_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'auth'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT (value = 'true') INTO v_enforcement_enabled
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

  IF v_enforcement_enabled AND (v_5h_spend + p_reservation_usd) > v_window_cap THEN
    RETURN QUERY SELECT false, '5h'::TEXT, v_5h_anchor + (v_tier.window_hours || ' hours')::INTERVAL;
    RETURN;
  END IF;
  IF v_enforcement_enabled AND (v_week_spend + p_reservation_usd) > v_weekly_cap THEN
    RETURN QUERY SELECT false, 'week'::TEXT, v_week_anchor + INTERVAL '7 days';
    RETURN;
  END IF;
  IF v_enforcement_enabled AND (v_month_spend + p_reservation_usd) > v_monthly_credit THEN
    RETURN QUERY SELECT false, 'month'::TEXT, v_sub.period_end;
    RETURN;
  END IF;

  INSERT INTO credit_spend_events (user_id, request_id, amount_usd, mode, is_reservation)
  VALUES (v_user_id, p_request_id, p_reservation_usd, p_mode, true);

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
AS $$
BEGIN
  UPDATE credit_spend_events
  SET amount_usd = p_real_amount_usd, is_reservation = false
  WHERE request_id = p_request_id AND is_reservation = true;
END;
$$;
```

- [ ] **Step 2: Apply the migration**

Verify the RPCs exist:

```sql
SELECT proname FROM pg_proc WHERE proname IN ('reserve_credit', 'reconcile_credit');
```

Expected: both function names returned.

- [ ] **Step 3: Manually verify reserve/reconcile round-trip via SQL** (requires a real authenticated session in the SQL editor, or run as a superuser and pass a test UUID by temporarily replacing `auth.uid()` with a literal for this check only — do not ship that substitution)

```sql
-- As an authenticated test user (auth.uid() resolves automatically in Supabase's SQL editor "run as user" mode):
SELECT * FROM reserve_credit(gen_random_uuid(), 'default', 0.02);
-- Expected: allowed = true, blocked_window = null (enforcement is off by default)

SELECT amount_usd, is_reservation FROM credit_spend_events ORDER BY created_at DESC LIMIT 1;
-- Expected: amount_usd = 0.02, is_reservation = true

SELECT reconcile_credit('<the request_id from above>', 0.0034);
SELECT amount_usd, is_reservation FROM credit_spend_events ORDER BY created_at DESC LIMIT 1;
-- Expected: amount_usd = 0.0034, is_reservation = false
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260707_credit_rpcs.sql
git commit -m "feat(credits): reserve_credit/reconcile_credit atomic RPCs (enforcement OFF by default)"
```

---

## Task 3: Cache-aware cost formula (pure function, unit tested)

**Files:**
- Create: `src/lib/bot/services/costFormula.ts`
- Test: `src/lib/bot/services/costFormula.test.ts`

Extracted as a standalone pure function so it's unit-testable without touching `chainRouter.ts`'s Supabase/provider dependencies, per the "extract genuinely unit-testable cores" principle — the formula itself is what carries correctness risk, not its call sites.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/bot/services/costFormula.test.ts
import { describe, it, expect } from 'vitest'
import { computeModelCost } from './costFormula'

describe('computeModelCost', () => {
  it('computes plain cost with no cache tokens', () => {
    const cost = computeModelCost({
      prompt_tokens: 1000,
      completion_tokens: 500,
      prompt_cost: 0.000001,
      completion_cost: 0.000002,
    })
    expect(cost).toBeCloseTo(1000 * 0.000001 + 500 * 0.000002, 10)
  })

  it('discounts cache_read_tokens at cache_read_cost when configured', () => {
    const cost = computeModelCost({
      prompt_tokens: 1000,
      completion_tokens: 0,
      cache_read_tokens: 800,
      prompt_cost: 0.000001,
      completion_cost: 0.000002,
      cache_read_cost: 0.0000001,
    })
    // (1000 - 800) fresh tokens at full price + 800 cache-read tokens at discount
    expect(cost).toBeCloseTo(200 * 0.000001 + 800 * 0.0000001, 10)
  })

  it('falls back to full prompt_cost for cache_read_tokens when cache_read_cost is not configured', () => {
    const cost = computeModelCost({
      prompt_tokens: 1000,
      completion_tokens: 0,
      cache_read_tokens: 800,
      prompt_cost: 0.000001,
      completion_cost: 0.000002,
    })
    // No discount configured -> behaves like today (no regression)
    expect(cost).toBeCloseTo(1000 * 0.000001, 10)
  })

  it('applies cache_write_cost to cache_creation_tokens when configured', () => {
    const cost = computeModelCost({
      prompt_tokens: 1000,
      completion_tokens: 0,
      cache_creation_tokens: 300,
      prompt_cost: 0.000001,
      completion_cost: 0.000002,
      cache_write_cost: 0.0000005,
    })
    expect(cost).toBeCloseTo(1000 * 0.000001 + 300 * 0.0000005, 10)
  })

  it('treats missing prompt_cost/completion_cost as zero (dev-phase free models)', () => {
    const cost = computeModelCost({ prompt_tokens: 1000, completion_tokens: 500 })
    expect(cost).toBe(0)
  })

  it('never returns a negative cost even if cache_read_tokens exceeds prompt_tokens', () => {
    const cost = computeModelCost({
      prompt_tokens: 100,
      completion_tokens: 0,
      cache_read_tokens: 500,
      prompt_cost: 0.000001,
      cache_read_cost: 0.0000001,
    })
    expect(cost).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bot/services/costFormula.test.ts`
Expected: FAIL — `computeModelCost` is not defined (module doesn't exist yet).

- [ ] **Step 3: Implement `computeModelCost`**

```typescript
// src/lib/bot/services/costFormula.ts

export interface ModelCostInput {
  prompt_tokens: number
  completion_tokens: number
  cache_read_tokens?: number
  cache_creation_tokens?: number
  prompt_cost?: number | null
  completion_cost?: number | null
  cache_read_cost?: number | null
  cache_write_cost?: number | null
}

export function computeModelCost(input: ModelCostInput): number {
  const promptCost = input.prompt_cost ?? 0
  const completionCost = input.completion_cost ?? 0
  const cacheReadCost = input.cache_read_cost ?? promptCost
  const cacheWriteCost = input.cache_write_cost ?? promptCost

  const cacheReadTokens = Math.min(input.cache_read_tokens ?? 0, input.prompt_tokens)
  const freshPromptTokens = Math.max(0, input.prompt_tokens - cacheReadTokens)
  const cacheCreationTokens = input.cache_creation_tokens ?? 0

  return freshPromptTokens * promptCost
    + cacheReadTokens * cacheReadCost
    + cacheCreationTokens * cacheWriteCost
    + input.completion_tokens * completionCost
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bot/services/costFormula.test.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Wire `computeModelCost` into the two existing cost sites in `chainRouter.ts`**

At [chainRouter.ts:379-380](../../../src/lib/bot/chainRouter.ts#L379):

```typescript
// Before:
const visionCost = (visionUsage?.prompt_tokens ?? 0) * (modelConfig.prompt_cost ?? 0)
  + (visionUsage?.completion_tokens ?? 0) * (modelConfig.completion_cost ?? 0)

// After (add import at top of file: import { computeModelCost } from './services/costFormula'):
const visionCost = computeModelCost({
  prompt_tokens: visionUsage?.prompt_tokens ?? 0,
  completion_tokens: visionUsage?.completion_tokens ?? 0,
  cache_read_tokens: visionUsage?.cache_read_input_tokens,
  cache_creation_tokens: visionUsage?.cache_creation_input_tokens,
  prompt_cost: modelConfig.prompt_cost,
  completion_cost: modelConfig.completion_cost,
  cache_read_cost: (modelConfig as any).cache_read_cost,
  cache_write_cost: (modelConfig as any).cache_write_cost,
})
```

At [chainRouter.ts:1096-1097](../../../src/lib/bot/chainRouter.ts#L1096):

```typescript
// Before:
const actualCost = (providerUsage?.prompt_tokens ?? 0) * (modelConfig.prompt_cost ?? 0)
  + (providerUsage?.completion_tokens ?? 0) * (modelConfig.completion_cost ?? 0)

// After:
const actualCost = computeModelCost({
  prompt_tokens: providerUsage?.prompt_tokens ?? 0,
  completion_tokens: providerUsage?.completion_tokens ?? 0,
  cache_read_tokens: providerUsage?.cache_read_input_tokens,
  cache_creation_tokens: providerUsage?.cache_creation_input_tokens,
  prompt_cost: modelConfig.prompt_cost,
  completion_cost: modelConfig.completion_cost,
  cache_read_cost: (modelConfig as any).cache_read_cost,
  cache_write_cost: (modelConfig as any).cache_write_cost,
})
```

(`RouterModel` doesn't have `cache_read_cost`/`cache_write_cost` typed yet — Task 4 adds them; the `as any` cast is temporary and removed in Task 4 Step 3.)

- [ ] **Step 6: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: all existing tests still pass (this change is formula-equivalent when cache fields are absent — see Step 3 unit test "falls back to full prompt_cost... no regression").

- [ ] **Step 7: Commit**

```bash
git add src/lib/bot/services/costFormula.ts src/lib/bot/services/costFormula.test.ts src/lib/bot/chainRouter.ts
git commit -m "fix(credits): cache-aware cost formula, fixes silent overcharge on OpenRouter cache hits"
```

---

## Task 4: Extend `RouterModel`/`models` table with cache pricing and context limits

**Files:**
- Modify: `src/lib/router-config.ts:5-13`
- Modify: `src/app/admin/models/actions.ts:29-131`

- [ ] **Step 1: Add fields to `RouterModel` interface**

At [router-config.ts:5-13](../../../src/lib/router-config.ts#L5):

```typescript
export interface RouterModel {
  id: string
  provider: 'google' | 'gemini' | 'huggingface' | 'cloudflare' | 'groq' | 'local' | 'core' | 'tavily' | 'exa' | 'pollinations' | 'ollama' | 'ollama(my pc)' | 'openrouter' | 'siliconflow' | 'nvidia'
  is_enabled: boolean
  openrouter_provider?: string
  is_paid?: boolean
  prompt_cost?: number
  completion_cost?: number
  cache_read_cost?: number
  cache_write_cost?: number
  context_window?: number
  max_output_tokens?: number
}
```

- [ ] **Step 2: Include the new columns in the pricing enrichment map**

In `fetchRouterChainFromDb` (modified in the mode-based-router-chains plan, or at the original location if that plan hasn't run yet — find the `modelsResult` query and `pricingMap`):

```typescript
// Update the models query select list to include the new columns:
supabase
  .from('models')
  .select('id, is_paid, prompt_cost, completion_cost, cache_read_cost, cache_write_cost, context_window, max_output_tokens')

// Update pricingMap type and population:
const pricingMap = new Map<string, {
  is_paid?: boolean
  prompt_cost?: number
  completion_cost?: number
  cache_read_cost?: number
  cache_write_cost?: number
  context_window?: number
  max_output_tokens?: number
}>()
if (modelsResult.data) {
  modelsResult.data.forEach((m: any) => {
    pricingMap.set(m.id, {
      is_paid: m.is_paid,
      prompt_cost: m.prompt_cost,
      completion_cost: m.completion_cost,
      cache_read_cost: m.cache_read_cost,
      cache_write_cost: m.cache_write_cost,
      context_window: m.context_window,
      max_output_tokens: m.max_output_tokens,
    })
  })
}

// Update enrichedChain mapping:
const enrichedChain = rawChain.map(m => {
  const price = pricingMap.get(m.id)
  if (!price) return m
  return {
    ...m,
    is_paid: price.is_paid,
    prompt_cost: price.prompt_cost,
    completion_cost: price.completion_cost,
    cache_read_cost: price.cache_read_cost,
    cache_write_cost: price.cache_write_cost,
    context_window: price.context_window,
    max_output_tokens: price.max_output_tokens,
  }
})
```

- [ ] **Step 3: Remove the temporary `as any` casts from Task 3**

In [chainRouter.ts](../../../src/lib/bot/chainRouter.ts), both `computeModelCost` call sites from Task 3:

```typescript
// Before:
cache_read_cost: (modelConfig as any).cache_read_cost,
cache_write_cost: (modelConfig as any).cache_write_cost,

// After:
cache_read_cost: modelConfig.cache_read_cost,
cache_write_cost: modelConfig.cache_write_cost,
```

- [ ] **Step 4: Extend `updateModel`/`addModel` in the admin actions**

At [src/app/admin/models/actions.ts:29-131](../../../src/app/admin/models/actions.ts#L29):

```typescript
export async function updateModel(id: string, updates: {
  id?: string
  input_modalities?: string[]
  output_modalities?: string[]
  max_rpd?: number | null
  is_favorite?: boolean
  sort_order?: number
  provider?: string
  is_paid?: boolean
  prompt_cost?: number | null
  completion_cost?: number | null
  cache_read_cost?: number | null
  cache_write_cost?: number | null
  context_window?: number | null
  max_output_tokens?: number | null
}) {
  // ...unchanged body, updates object already spreads through
```

```typescript
export async function addModel(model: {
  id: string
  provider: string
  input_modalities: string[]
  output_modalities: string[]
  max_rpd?: number | null
  is_paid?: boolean
  prompt_cost?: number | null
  completion_cost?: number | null
  cache_read_cost?: number | null
  cache_write_cost?: number | null
  context_window?: number | null
  max_output_tokens?: number | null
}) {
  const { error } = await supabaseAdmin
    .from('models')
    .insert({
      ...model,
      id: model.id.trim(),
      is_paid: model.is_paid ?? false,
      prompt_cost: model.prompt_cost ?? null,
      completion_cost: model.completion_cost ?? null,
      cache_read_cost: model.cache_read_cost ?? null,
      cache_write_cost: model.cache_write_cost ?? null,
      context_window: model.context_window ?? null,
      max_output_tokens: model.max_output_tokens ?? null,
      usage_today: 0,
      last_reset_date: new Date().toISOString().split('T')[0]
    })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/models')
}
```

- [ ] **Step 5: Populate `context_window`/`max_output_tokens` from the Discover flow**

`DiscoveredModel` ([discover/actions.ts:7-12](../../../src/app/admin/discover/actions.ts#L7)) already carries `contextWindow`/`maxOutputTokens` fetched from each provider's API, but the "Add to registry" handler in [DiscoverClient.tsx:339-362](../../../src/app/admin/discover/DiscoverClient.tsx#L339) drops them when calling `updateModel`/`addModel`. Add them through:

```typescript
// Before:
if (model.inRegistry) {
  await updateModel(model.id, {
    input_modalities: model.modalities.input,
    output_modalities: model.modalities.output,
    max_rpd: model.rpd,
    provider: model.provider,
    is_paid: model.isPaid ?? false,
    prompt_cost: model.promptCost ?? null,
    completion_cost: model.completionCost ?? null,
  })
} else {
  await addModel({
    id: model.id,
    provider: model.provider,
    input_modalities: model.modalities.input,
    output_modalities: model.modalities.output,
    max_rpd: model.rpd,
    is_paid: model.isPaid ?? false,
    prompt_cost: model.promptCost ?? null,
    completion_cost: model.completionCost ?? null,
  })
}

// After:
if (model.inRegistry) {
  await updateModel(model.id, {
    input_modalities: model.modalities.input,
    output_modalities: model.modalities.output,
    max_rpd: model.rpd,
    provider: model.provider,
    is_paid: model.isPaid ?? false,
    prompt_cost: model.promptCost ?? null,
    completion_cost: model.completionCost ?? null,
    context_window: model.contextWindow ?? null,
    max_output_tokens: model.maxOutputTokens ?? null,
  })
} else {
  await addModel({
    id: model.id,
    provider: model.provider,
    input_modalities: model.modalities.input,
    output_modalities: model.modalities.output,
    max_rpd: model.rpd,
    is_paid: model.isPaid ?? false,
    prompt_cost: model.promptCost ?? null,
    completion_cost: model.completionCost ?? null,
    context_window: model.contextWindow ?? null,
    max_output_tokens: model.maxOutputTokens ?? null,
  })
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/router-config.ts src/app/admin/models/actions.ts src/app/admin/discover/actions.ts
git commit -m "feat(credits): extend models table/RouterModel with cache pricing and context limits"
```

---

## Task 5: Per-request cost accumulator threaded through `runChain`

**Files:**
- Modify: `src/lib/bot/chainRouter.ts`

This is the task most at risk of a silent miss — **every one of the 7 return points must include the accumulated total**, or some request outcomes charge $0 for real spend.

- [ ] **Step 1: Declare the accumulator near the top of `runChain`, after the tracer is created**

At [chainRouter.ts:189](../../../src/lib/bot/chainRouter.ts#L189) (right after `const tracer = new TraceCollector()`):

```typescript
const tracer = new TraceCollector()
let totalCostUsd = 0
```

- [ ] **Step 2: Add to the accumulator at both `computeModelCost` call sites**

At the vision cost site ([chainRouter.ts:379](../../../src/lib/bot/chainRouter.ts#L379), after Task 3's edit):

```typescript
const visionCost = computeModelCost({ /* ...as in Task 3... */ })
totalCostUsd += visionCost
```

At the main routing cost site ([chainRouter.ts:1096](../../../src/lib/bot/chainRouter.ts#L1096), after Task 3's edit):

```typescript
const actualCost = computeModelCost({ /* ...as in Task 3... */ })
totalCostUsd += actualCost
```

- [ ] **Step 3: Add `total_cost_usd` to the `ChainResponse` interface**

At [chainRouter.ts:133-154](../../../src/lib/bot/chainRouter.ts#L133):

```typescript
export interface ChainResponse {
  type: 'text' | 'photo'
  content: string | Buffer
  usage_type?: 'chat' | 'tool' | 'search' | 'vision' | 'image'
  model?: string
  model_chain?: string
  status?: 'success' | 'error'
  classification_trace?: any[]
  routing_trace?: RoutingTrace[]
  citations?: string[]
  tokens_used?: number
  pipeline_steps?: PipelineStep[]
  advisor_questions?: string
  advisor_state?: string
  text_content?: string
  image_description?: string
  image_prompt?: string
  trace?: any[]
  step_traces?: import('./tracing').StepTrace[]
  transcript_md?: string
  captured_tool_calls?: any[]
  total_cost_usd: number
}
```

(Made non-optional deliberately — every return path must supply it, and TypeScript will now error on any return object missing the field, catching a missed early-return at compile time rather than silently shipping a $0 charge.)

- [ ] **Step 4: Add `total_cost_usd: totalCostUsd` to all 7 return statements**

Return 1, advisor planning ([chainRouter.ts:248](../../../src/lib/bot/chainRouter.ts#L248)) — genuinely $0 at this point (before any provider call):
```typescript
return {
  type: 'text',
  content: advisorResult.questions || '',
  usage_type: 'chat',
  model_chain: 'advisor → (awaiting user response)',
  status: 'success',
  advisor_questions: advisorResult.questions || '',
  // ...existing fields...
  total_cost_usd: totalCostUsd,
}
```

Return 2, vision FAST_SIMPLE early exit ([chainRouter.ts:453](../../../src/lib/bot/chainRouter.ts#L453)) — occurs after `visionCost` was added to the accumulator above it in the same code path:
```typescript
return {
  type: 'text',
  content: sanitizedInstructions,
  // ...existing fields...
  total_cost_usd: totalCostUsd,
} as any
```

Return 3, vision success ([chainRouter.ts:506](../../../src/lib/bot/chainRouter.ts#L506)):
```typescript
return {
  type: 'text',
  content: sanitizedContent,
  // ...existing fields...
  total_cost_usd: totalCostUsd,
}
```

Return 4, vision failed ([chainRouter.ts:557](../../../src/lib/bot/chainRouter.ts#L557)) — may be non-zero if a vision call was attempted and its cost already accumulated before the failure branch:
```typescript
return {
  type: 'text',
  content: "⚡ *Vision Analysis Failed* — Check your model IDs and API keys in the Router.",
  // ...existing fields...
  total_cost_usd: totalCostUsd,
}
```

Return 5, classifier failed ([chainRouter.ts:611](../../../src/lib/bot/chainRouter.ts#L611)) — genuinely $0, before any paid provider call:
```typescript
return {
  type: 'text',
  content: "*System Overload*",
  // ...existing fields...
  total_cost_usd: totalCostUsd,
} as any
```

Return 6, main success path ([chainRouter.ts:1282](../../../src/lib/bot/chainRouter.ts#L1282)) — occurs after `actualCost` was added to the accumulator:
```typescript
return {
  type: category === 'IMAGE_GEN' ? 'photo' : 'text',
  content: finalContent as any,
  // ...existing fields...
  total_cost_usd: totalCostUsd,
}
```

Return 7, final catch-all failure ([chainRouter.ts:1355](../../../src/lib/bot/chainRouter.ts#L1355)) — may be non-zero if earlier fallback attempts in the loop incurred cost before ultimately all failing:
```typescript
return {
  type: 'text',
  content: "*System Overload*",
  // ...existing fields...
  total_cost_usd: totalCostUsd,
}
```

- [ ] **Step 5: Typecheck to confirm all 7 return sites were updated**

Run: `npx tsc --noEmit`
Expected: **zero errors related to `ChainResponse`/`total_cost_usd`.** If any return site is missing the field, TypeScript reports `Property 'total_cost_usd' is missing in type '...' but required in type 'ChainResponse'` at that exact line — fix it before proceeding.

**Caveat: this compile-time check does not cover Returns 2 and 5**, since both use `as any` (pre-existing in the codebase, not introduced by this task), which suppresses all type checking on that object including the required-field check. For those two sites specifically, manually re-read the diff to confirm `total_cost_usd: totalCostUsd` is actually present — the compiler will not catch its absence there. This is a real, narrow gap in an otherwise-compiler-enforced task; if a future refactor touches Return 2 or 5 and drops the field, nothing will fail until someone notices $0 charges in `credit_spend_events` for vision-FAST_SIMPLE or classifier-failure responses.

- [ ] **Step 6: Commit**

```bash
git add src/lib/bot/chainRouter.ts
git commit -m "feat(credits): accumulate total_cost_usd across all runChain return paths"
```

---

## Task 6: Web search and compaction cost added to the accumulator

**Files:**
- Modify: `src/lib/bot/services/providerExecution.ts`
- Modify: `src/lib/bot/chainRouter.ts`
- Modify: `src/lib/bot/compaction.ts`
- Modify: `src/lib/bot/context.ts`
- Modify: `src/lib/bot/services/memoryManager.ts`

`runWebSearchChain`/`runExaSearchChain` are called from **two independent places**: `src/lib/bot/services/providerExecution.ts` (the real path used by `chainRouter.ts`'s main pipeline, inside `executeProvider`, with **4 call sites** — an initial call plus a retry loop for each of Tavily and Exa, [providerExecution.ts:152-170](../../../src/lib/bot/services/providerExecution.ts#L152)) and a separate, unrelated `src/lib/bot/roadmapRouter.ts` ([roadmapRouter.ts:130-132](../../../src/lib/bot/roadmapRouter.ts#L130), a different feature, not part of the chat request pipeline this plan meters). Changing `runWebSearchChain`/`runExaSearchChain`'s return types would break `roadmapRouter.ts`'s call sites too, so instead: **keep their return type as a plain string** (no change to `tavily.ts`/`exa.ts` function signatures) and track call counts inside `executeProvider`, which is the actual integration point read by `chainRouter.ts`.

- [ ] **Step 1: `executeProvider` fetches search pricing and counts real calls, returning cost alongside its existing response**

At [providerExecution.ts:99-181](../../../src/lib/bot/services/providerExecution.ts#L99), change `executeProvider`'s return type to include `searchCostUsd`, and track how many real Tavily/Exa calls happen across the initial attempt and the retry loop:

```typescript
export async function executeProvider(
  modelConfig: any,
  category: IntentCategory,
  activePromptForGen: string,
  system_prompt: string,
  historyForChain: any[],
  activeKey: string | undefined,
  providerKeys: string[],
  context: any,
  routeContext: any,
  temperature: number | undefined,
  originalPrompt: string,
  augmentSearchQuery: (query: string, history: any[]) => string
): Promise<{ response: any; searchResult?: string; searchFailed?: boolean; searchCostUsd: number }> {
  let response: any = null
  let searchCostUsd = 0

  const getSearchCostPerCall = async (providerId: 'tavily_search' | 'exa_search'): Promise<number> => {
    const { data } = await supabaseAdmin.from('search_providers').select('cost_per_call').eq('id', providerId).maybeSingle()
    return data?.cost_per_call ?? 0
  }

  switch (modelConfig.provider.toLowerCase()) {
    case 'google':
    case 'gemini':
      response = await runGoogle(modelConfig.id, activePromptForGen, system_prompt, undefined, routeContext, historyForChain)
      break
    case 'groq':
      response = await runGroq(modelConfig.id, activePromptForGen, system_prompt, activeKey || context?.aiApiKey, routeContext, historyForChain)
      break
    case 'huggingface':
      if (category === 'IMAGE_GEN') {
        response = await runHuggingFace(modelConfig.id, activePromptForGen, activeKey || context?.aiApiKey)
      } else {
        response = await runHuggingFaceText(modelConfig.id, activePromptForGen, system_prompt, historyForChain, activeKey || context?.aiApiKey, routeContext)
      }
      break
    case 'cloudflare':
      response = await runCloudflare(modelConfig.id, activePromptForGen, activeKey || context?.aiApiKey, system_prompt, historyForChain, category, routeContext)
      break
    case 'core':
    case 'exa':
    case 'tavily': {
      const hasSearchData =
        system_prompt.includes('[SEARCH DATA:') ||
        system_prompt.includes('[SEARCH DATA]\n') ||
        system_prompt.includes('[SEARCH RESULTS') ||
        system_prompt.includes('RESEARCH FINDINGS:') ||
        activePromptForGen.includes('RESEARCH FINDINGS:')

      if (hasSearchData) {
        logger.info(`Skipping redundant search for ${modelConfig.id} - data already present from prior pass.`)
        return { response: null, searchCostUsd: 0 } // Indicates to skip/continue
      }

      const SEARCH_FAILURE_STRINGS = ['search failed', 'unavailable', 'could not retrieve', 'failed to retrieve', 'unable to find', 'no results']
      let searchResult: string | null = null
      const searchQuery = augmentSearchQuery(originalPrompt, historyForChain)

      if (modelConfig.id.includes('tavily') || modelConfig.provider === 'tavily') {
        searchResult = await runWebSearchChain(searchQuery, routeContext, system_prompt)
        searchCostUsd += await getSearchCostPerCall('tavily_search')
      } else if (modelConfig.id.includes('duckduckgo')) {
        searchResult = await runDuckDuckGoSearchChain(searchQuery, routeContext, system_prompt)
      } else if (modelConfig.id.includes('exa') || modelConfig.provider === 'exa') {
        searchResult = await runExaSearchChain(searchQuery, routeContext, system_prompt)
        searchCostUsd += await getSearchCostPerCall('exa_search')
      }

      let isSearchFailure = !searchResult || SEARCH_FAILURE_STRINGS.some(f => searchResult!.toLowerCase().includes(f))

      if (isSearchFailure) {
        const altQueries = generateOptimizedQuery(searchQuery)
        for (const altQuery of altQueries) {
          if (altQuery === searchQuery) continue
          logger.info(`Retrying ${modelConfig.id} with optimized query: "${altQuery}"`)
          let retryResult: string | null = null
          if (modelConfig.id.includes('tavily')) {
            retryResult = await runWebSearchChain(altQuery, routeContext, system_prompt)
            searchCostUsd += await getSearchCostPerCall('tavily_search')
          } else if (modelConfig.id.includes('duckduckgo')) {
            retryResult = await runDuckDuckGoSearchChain(altQuery, routeContext, system_prompt)
          } else if (modelConfig.id.includes('exa')) {
            retryResult = await runExaSearchChain(altQuery, routeContext, system_prompt)
            searchCostUsd += await getSearchCostPerCall('exa_search')
          }

          const retryFailed = !retryResult || SEARCH_FAILURE_STRINGS.some(f => retryResult!.toLowerCase().includes(f))
          if (!retryFailed) {
            searchResult = retryResult
            isSearchFailure = false
            logger.info(`Retry succeeded for ${modelConfig.id} with query: "${altQuery}"`)
            break
          }
        }
      }

      if (isSearchFailure) {
        return { response: null, searchFailed: true, searchCostUsd }
      }

      return { response: null, searchResult: searchResult ?? undefined, searchCostUsd }
    }
    // ...remaining existing cases (openrouter, ollama, pollinations, siliconflow, nvidia) unchanged...
  }

  return { response, searchCostUsd }
}
```

(The exact body of the remaining provider cases and the function's tail after the `switch` — for non-search providers — is unchanged from the current file; only the `core`/`exa`/`tavily` branch and the final return(s) gain `searchCostUsd`. Read the full current file before editing to preserve every other branch verbatim — this snippet only shows the branches that change.)

`getSearchCostPerCall` does a small DB read per call; since Tavily/Exa searches already involve a network round-trip an order of magnitude slower than one indexed Postgres lookup, this doesn't materially change request latency. `supabaseAdmin` is already imported in this file ([providerExecution.ts:1](../../../src/lib/bot/services/providerExecution.ts#L1)).

- [ ] **Step 2: `chainRouter.ts` reads `searchCostUsd` from `executeProvider`'s result and adds it to the accumulator**

At [chainRouter.ts:984-1012](../../../src/lib/bot/chainRouter.ts#L984):

```typescript
// Before:
const result = await executeProvider(
  modelConfig,
  category,
  finalUserPrompt,
  system_prompt,
  historyForChain,
  activeKey,
  providerKeys,
  context,
  routeContext,
  temperature,
  prompt,
  augmentSearchQuery
)

if (result.searchFailed) {
  const displayKey = routeContext.usedKeyIndex ? `${key} ${routeContext.usedKeyIndex}` : `${key} 1`
  routingTrace.push({ model: modelConfig.id, category, key: displayKey, success: false, status: 'empty' })
  tracer.recordFailed({ ...traceMeta, error: 'search failed to retrieve results' }, Date.now() - t0)
  break
}
if (result.searchResult) {
  system_prompt = `${system_prompt}\n\n[SEARCH DATA: ${modelConfig.id}]\n${result.searchResult}\n\n`
}

// After:
const result = await executeProvider(
  modelConfig,
  category,
  finalUserPrompt,
  system_prompt,
  historyForChain,
  activeKey,
  providerKeys,
  context,
  routeContext,
  temperature,
  prompt,
  augmentSearchQuery
)

totalCostUsd += result.searchCostUsd

if (result.searchFailed) {
  const displayKey = routeContext.usedKeyIndex ? `${key} ${routeContext.usedKeyIndex}` : `${key} 1`
  routingTrace.push({ model: modelConfig.id, category, key: displayKey, success: false, status: 'empty' })
  tracer.recordFailed({ ...traceMeta, error: 'search failed to retrieve results' }, Date.now() - t0)
  break
}
if (result.searchResult) {
  system_prompt = `${system_prompt}\n\n[SEARCH DATA: ${modelConfig.id}]\n${result.searchResult}\n\n`
}
```

- [ ] **Step 3: `exa_extract` cost, if `extractExaUrls` is called anywhere in the request pipeline**

`extractExaUrls` ([exa.ts:56](../../../src/lib/bot/providers/exa.ts#L56)) is not called from `chainRouter.ts` or `providerExecution.ts` directly — its only current caller is inside `deepResearch.ts`'s research pipeline (verified via `grep -rn "extractExaUrls" src/lib/bot/`, which returns only its definition in `exa.ts` and no call sites as of this plan's writing — meaning it's currently dead code, not yet wired into any live pipeline). No cost integration is needed for it now; if a future change starts calling it, that call site should fetch `exa_extract.cost_per_call` from `search_providers` the same way Step 1 does for `tavily_search`/`exa_search`, and add it to whichever cost total is in scope at that call site.

- [ ] **Step 4: Add compaction's own model call cost to the triggering request's accumulator**

`compactSession` ([compaction.ts:73](../../../src/lib/bot/compaction.ts#L73)) doesn't currently return usage/cost info since `runCompactionModel` discards the provider's usage object. Update `runCompactionModel` to return usage alongside content:

```typescript
// compaction.ts — update runCompactionModel's return type and body
async function runCompactionModel(
  modelConfig: RouterModel,
  systemPrompt: string,
  userMessage: string,
  sessionId?: string
): Promise<{ content: string; cost: number } | null> {
  const provider = modelConfig.provider.toLowerCase()
  try {
    let response: any = null
    switch (provider) {
      case 'google':
      case 'gemini':
        response = await runGoogle(modelConfig.id, userMessage, systemPrompt)
        break
      case 'groq':
        response = await runGroq(modelConfig.id, userMessage, systemPrompt)
        break
      case 'openrouter': {
        response = await runOpenRouter(modelConfig.id, userMessage, systemPrompt, [], undefined, { openrouterProvider: modelConfig.openrouter_provider, sessionId })
        break
      }
      default:
        logger.warn(`Compaction provider ${provider} not supported — trying Google fallback`)
        response = await runGoogle(modelConfig.id, userMessage, systemPrompt)
    }
    if (response) {
      const content = typeof response === 'object' ? response.content : response
      const usage = typeof response === 'object' ? response.usage : undefined
      const cost = computeModelCost({
        prompt_tokens: usage?.prompt_tokens ?? 0,
        completion_tokens: usage?.completion_tokens ?? 0,
        cache_read_tokens: usage?.cache_read_input_tokens,
        cache_creation_tokens: usage?.cache_creation_input_tokens,
        prompt_cost: modelConfig.prompt_cost,
        completion_cost: modelConfig.completion_cost,
        cache_read_cost: modelConfig.cache_read_cost,
        cache_write_cost: modelConfig.cache_write_cost,
      })
      return { content, cost }
    }
  } catch (e: any) {
    logger.warn(`Compaction model ${modelConfig.id} failed: ${e.message}`)
  }
  return null
}
```

Add the import at the top of `compaction.ts`: `import { computeModelCost } from './services/costFormula'`.

Update `compactSession` to return the cost alongside the summary:

```typescript
export async function compactSession(
  chatId: string,
  history: any[],
  currentSummary: string | null
): Promise<{ summary: string | null; cost: number }> {
  const { chain } = await getRouterChain('COMPACTION', 'default').catch(() => ({ chain: [] as RouterModel[] }))
  const compactionPrompt = getChainPrompt('compaction')

  const historyText = history
    .map(h => `${h.role}: ${h.parts?.[0]?.text || h.content}`)
    .join('\n\n')

  const userMessage = [
    currentSummary ? `[EXISTING SESSION SUMMARY]\n${currentSummary}` : null,
    `[RAW HISTORY]\n${historyText}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const enabledModels = (chain || []).filter(m => m.is_enabled)

  for (const modelConfig of enabledModels) {
    const result = await runCompactionModel(modelConfig, compactionPrompt, userMessage, chatId)
    if (result) {
      return { summary: result.content, cost: result.cost }
    }
  }

  logger.warn(`Compaction failed for ${chatId}: all models failed, keeping old summary`)
  return { summary: currentSummary, cost: 0 }
}
```

This changes `compactSession`'s return shape from `Promise<string | null>` to `Promise<{ summary: string | null; cost: number }>`, which in turn changes `summarizeSession` (its only caller, in `context.ts`) to also return `{ summary, cost }` instead of `string | null`, with no side-effect logging inside `summarizeSession` itself — each of its two call sites decides what to do with the returned cost, since they have different needs:

**`context.ts` — `summarizeSession` now returns cost alongside the summary:**

```typescript
// context.ts
export async function summarizeSession(
  chatId: string,
  history: any[],
  currentSummary: string | null
): Promise<{ summary: string | null; cost: number }> {
  try {
    const { summary: newSummary, cost } = await compactSession(chatId, history, currentSummary)
    if (newSummary) {
      if (!(chatId === 'temp' || chatId.startsWith('temp:') || chatId.startsWith('temp'))) {
        await updateSessionState(chatId, {
          distilled_summary: newSummary,
          last_summarized_at: new Date().toISOString(),
          token_usage_total: estimateTokens(newSummary),
        })
      }
      return { summary: newSummary, cost }
    }
    return { summary: null, cost }
  } catch (error) {
    logger.error(`Summarization failed for session ${chatId}:`, error)
    return { summary: null, cost: 0 }
  }
}
```

**Caller A — `manageSessionCompaction`** ([memoryManager.ts:32-55](../../../src/lib/bot/services/memoryManager.ts#L32)) awaits `summarizeSession` and runs *before* the pipeline, so its cost belongs in the current request's `totalCostUsd`. Update its return shape to include `cost`:

```typescript
// memoryManager.ts
export async function manageSessionCompaction(
  sessionId: string,
  history: any[],
  sessionState: any
): Promise<{ currentSummary: string | null; updatedSessionState: any; cost: number }> {
  let currentSummary = sessionState?.distilled_summary || null
  let cost = 0

  if (sessionState && !currentSummary && history.length >= 5
    && sessionState.token_usage_total > sessionState.context_limit * sessionState.compaction_threshold) {

    logger.info(`Pre-request compaction for ${sessionId} (${sessionState.token_usage_total}/${sessionState.context_limit})`)

    const result = await summarizeSession(sessionId, history, null)
    cost = result.cost
    const updated = await getSessionState(sessionId)

    if (updated?.distilled_summary) {
      currentSummary = updated.distilled_summary
      sessionState.distilled_summary = updated.distilled_summary
      sessionState.token_usage_total = updated.token_usage_total ?? sessionState.token_usage_total
    }
  }

  return { currentSummary, updatedSessionState: sessionState, cost }
}
```

Then in `chainRouter.ts`, at the call site ([chainRouter.ts:220-224](../../../src/lib/bot/chainRouter.ts#L220)), add the returned cost to the accumulator (already declared above this line per Task 5 Step 1, which places it at line 189-190):

```typescript
// Before:
const compactionResult = await manageSessionCompaction(sessionId, history, sessionState)
currentSummary = compactionResult.currentSummary
if (sessionState) {
  Object.assign(sessionState, compactionResult.updatedSessionState)
}
// After:
const compactionResult = await manageSessionCompaction(sessionId, history, sessionState)
currentSummary = compactionResult.currentSummary
totalCostUsd += compactionResult.cost
if (sessionState) {
  Object.assign(sessionState, compactionResult.updatedSessionState)
}
```

**Caller B — the fire-and-forget trigger** ([chainRouter.ts:1229](../../../src/lib/bot/chainRouter.ts#L1229)) calls `summarizeSession` **without `await`** (verified by direct inspection), running *after* the response is already sent — its cost cannot go into `totalCostUsd` since that value has already been read into the response object by the time this resolves. It logs its own standalone ledger row directly, using `supabaseAdmin` (already imported in `chainRouter.ts` — confirm via `grep -n "import.*supabaseAdmin" src/lib/bot/chainRouter.ts`) since there's no user JWT available in this background continuation to satisfy RLS:

```typescript
// Before:
summarizeSession(sid, history, currentSummary)
// After:
summarizeSession(sid, history, currentSummary).then(({ cost }) => {
  if (cost > 0 && context?.userId && context.userId !== 'anonymous') {
    supabaseAdmin.from('credit_spend_events').insert({
      user_id: context.userId,
      request_id: crypto.randomUUID(),
      amount_usd: cost,
      mode: 'default',
      is_reservation: false,
    }).then(({ error }: any) => {
      if (error) logger.error(`Failed to log standalone compaction cost for session ${sid}:`, error)
    })
  }
}).catch((e) => logger.error(`Background compaction failed for ${sid}:`, e))
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors; fix any call sites of `executeProvider` (should only be the one in `chainRouter.ts`, updated in Step 2) or `compactSession`/`summarizeSession`/`manageSessionCompaction` that weren't updated for the new return shapes — the compiler surfaces every one since `compactSession`'s return type changed from `string | null` to `{ summary, cost }`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/bot/services/providerExecution.ts src/lib/bot/chainRouter.ts src/lib/bot/compaction.ts src/lib/bot/context.ts src/lib/bot/services/memoryManager.ts
git commit -m "feat(credits): meter web search (Tavily/Exa) and compaction model costs"
```

---

## Task 7: Wire reserve/reconcile into the chat route

**Files:**
- Modify: `src/app/api/ai/chat/route.ts`
- Delete: `src/app/api/sync-quotas/route.ts`
- Create: `supabase/migrations/20260707_drop_legacy_quota.sql`

- [ ] **Step 1: Remove the legacy quota check and `sync-quotas` dead code**

At [route.ts:1-20](../../../src/app/api/ai/chat/route.ts#L1), remove `checkAndIncrementQuota` and `DEFAULT_DAILY_LIMIT`; remove the call at [route.ts:52-60](../../../src/app/api/ai/chat/route.ts#L52).

Delete the file:
```bash
git rm src/app/api/sync-quotas/route.ts
```

- [ ] **Step 2: Write the migration to drop legacy quota objects**

```sql
-- Migration: 20260707_drop_legacy_quota.sql
-- Description: Removes the flat daily-message-count quota, superseded by
-- cost-based credit_spend_events metering.
DROP FUNCTION IF EXISTS increment_my_quota();
DROP TABLE IF EXISTS user_quotas;
```

- [ ] **Step 3: Add the anonymous-Pro gate and reserve/reconcile calls to the route**

Modify [route.ts:22-60](../../../src/app/api/ai/chat/route.ts#L22):

```typescript
export async function POST(req: NextRequest) {
  let user = null;
  let supabaseClient = null;

  if (isSupabaseEnabled) {
    const supabase = createClient(
      supabaseUrl!,
      supabaseAnonKey!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )
    const { data, error: authError } = await supabase.auth.getUser()
    if (authError) {
      console.error('[AI Chat Auth] auth.getUser() error:', authError)
    }
    user = data.user
    supabaseClient = supabase;
  }

  const { prompt, buffer, images, aiApiKey, activeEntityId, activeChatId, activeSpaceId, classificationModelId, mode, intentTag, replyContext, thinkingEnabled, advisorEnabled, pendingAdvisorState, isTempChat, clientHistory, pageContext, clientTime } = await req.json()
  const activeMode = (mode === 'pro') ? mode : 'default'

  if (!prompt && !buffer) {
    return NextResponse.json({ error: 'prompt or image is required', model: 'system' }, { status: 400 })
  }
  if (prompt && typeof prompt !== 'string') {
    return NextResponse.json({ error: 'prompt must be a string', model: 'system' }, { status: 400 })
  }

  const userId = user?.id || 'anonymous'

  // Pro/Max are gated entirely behind login — not a metering decision.
  if (userId === 'anonymous' && activeMode === 'pro') {
    return NextResponse.json(
      { error: 'Sign in to use Pro features.', model: 'system' },
      { status: 401 }
    )
  }

  const requestId = crypto.randomUUID()

  if (user && supabaseClient) {
    const { data: reserveResult, error: reserveError } = await supabaseClient
      .rpc('reserve_credit', { p_request_id: requestId, p_mode: activeMode, p_reservation_usd: 0.02 })
      .single()

    if (reserveError) {
      console.error('[reserve_credit] error:', reserveError)
      // Fail open on infra errors — don't block chat because of a metering hiccup
    } else if (reserveResult && !(reserveResult as any).allowed) {
      const { blocked_window, resets_at } = reserveResult as any
      return NextResponse.json(
        {
          error: `You've hit your ${blocked_window} limit. Resets ${resets_at ? new Date(resets_at).toLocaleString() : 'soon'}.`,
          model: 'system',
          blocked_window,
          resets_at,
        },
        { status: 429 }
      )
    }
  }
```

- [ ] **Step 4: Reconcile in the stream's `finally` block**

At [route.ts:225-231](../../../src/app/api/ai/chat/route.ts#L225-231):

```typescript
      } catch (e: any) {
        console.error('[AI API Error]', e)
        send({ error: e.message || 'AI request failed.', model: 'system' })
      } finally {
        if (user && supabaseClient) {
          const finalCost = (typeof result! !== 'undefined' && result.total_cost_usd) || 0
          await supabaseClient.rpc('reconcile_credit', { p_request_id: requestId, p_real_amount_usd: finalCost }).catch((e: any) => {
            console.error('[reconcile_credit] error:', e)
          })
        }
        controller.close()
      }
```

(`result` is already declared via `const result = await runChain(...)` earlier in the `try` block — verify its scope extends into `finally` by checking it's declared with `let` at the top of the stream callback rather than `const` inside `try`, since `finally` needs to read it even when `try` throws before assignment completes. If it's currently `const result = await runChain(...)` inside `try`, change the declaration to `let result: ChainResponse | undefined` before the `try` block and assign inside, so `finally` can safely check `result?.total_cost_usd`.)

- [ ] **Step 5: Manually verify end-to-end**

Run: `npm run dev`, send a chat message as a logged-in user.

Expected: request succeeds as before (enforcement is still OFF from Task 2's default), and a new row appears in `credit_spend_events` with `is_reservation = false` and a real `amount_usd` reflecting actual token cost (verify via Supabase SQL editor: `SELECT * FROM credit_spend_events ORDER BY created_at DESC LIMIT 5;`).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/ai/chat/route.ts supabase/migrations/20260707_drop_legacy_quota.sql
git rm src/app/api/sync-quotas/route.ts
git commit -m "feat(credits): wire reserve/reconcile into chat route, gate anonymous Pro access, drop legacy quota"
```

---

## Task 8: Usage settings panel

**Files:**
- Create: `src/app/api/usage/route.ts`
- Create: `src/components/settings/UsagePanel.tsx`
- Modify: wherever the Settings page assembles its sections (locate via `grep -rn "AISettingsSection" src/components/settings/` — add `UsagePanel` alongside it)

- [ ] **Step 1: Create the read-only usage endpoint**

```typescript
// src/app/api/usage/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin, isSupabaseEnabled, supabaseUrl, supabaseAnonKey } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
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
  const monthlyCredit = tier.price_usd * tier.credit_percent / 100
  const weeklyCap = monthlyCredit * tier.weekly_tightness / 4.33
  const windowCap = weeklyCap / Math.max(tier.sessions_per_week, 1)

  const now = new Date()
  const window5hAnchor = sub.window_5h_anchor ? new Date(sub.window_5h_anchor) : now
  const windowWeekAnchor = sub.window_week_anchor ? new Date(sub.window_week_anchor) : now

  const [{ data: spend5h }, { data: spendWeek }, { data: spendMonth }] = await Promise.all([
    supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', user.id).gte('created_at', window5hAnchor.toISOString()),
    supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', user.id).gte('created_at', windowWeekAnchor.toISOString()),
    supabaseAdmin.from('credit_spend_events').select('amount_usd').eq('user_id', user.id).gte('created_at', sub.period_start),
  ])

  const sum = (rows: any[] | null) => (rows ?? []).reduce((acc, r) => acc + Number(r.amount_usd), 0)

  return NextResponse.json({
    tier: { id: tier.id, name: tier.name },
    window: {
      spent: sum(spend5h),
      cap: windowCap,
      resets_at: new Date(window5hAnchor.getTime() + tier.window_hours * 3600_000).toISOString(),
    },
    weekly: {
      spent: sum(spendWeek),
      cap: weeklyCap,
      resets_at: new Date(windowWeekAnchor.getTime() + 7 * 24 * 3600_000).toISOString(),
    },
    monthly: {
      spent: sum(spendMonth),
      cap: monthlyCredit,
      resets_at: sub.period_end,
    },
  })
}
```

- [ ] **Step 2: Build the UsagePanel component**

```tsx
// src/components/settings/UsagePanel.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface UsageWindow { spent: number; cap: number; resets_at: string }
interface UsageData {
  tier: { id: string; name: string }
  window: UsageWindow
  weekly: UsageWindow
  monthly: UsageWindow
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
        <span>{label}</span>
        <span className="text-muted-foreground">Resets in {formatResetCountdown(usage.resets_at)}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function UsagePanel() {
  const [data, setData] = useState<UsageData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) return
      const res = await fetch('/api/usage', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        if (!cancelled) setError('Usage data unavailable')
        return
      }
      const json = await res.json()
      if (!cancelled) setData(json)
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (error) return <p className="text-sm text-muted-foreground">{error}</p>
  if (!data) return <p className="text-sm text-muted-foreground">Loading usage…</p>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Usage</h3>
        <span className="text-xs text-muted-foreground">{data.tier.name} plan</span>
      </div>
      <UsageBar label="5-hour limit" usage={data.window} />
      <UsageBar label="Weekly limit" usage={data.weekly} />
      <UsageBar label="Monthly credit" usage={data.monthly} />
    </div>
  )
}
```

This matches the existing pattern used in [AISettingsSection.tsx:5](../../../src/components/settings/AISettingsSection.tsx#L5) (`import { supabase } from '@/lib/supabase'`) and [AIAssistant.tsx:24,469](../../../src/components/assistant/AIAssistant.tsx#L24) (`supabase.auth.getSession()`), so no import path guessing is needed.

- [ ] **Step 3: Add `UsagePanel` to the Settings page**

`AISettingsSection` is rendered at [SettingsPage.tsx:285](../../../src/components/settings/SettingsPage.tsx#L285) (`{activeTab === 'ai' && <AISettingsSection />}`). Add `UsagePanel` alongside it in the same `ai` tab:

```typescript
// SettingsPage.tsx — add the import near the existing AISettingsSection import (line 12)
import UsagePanel from '@/components/settings/UsagePanel';

// Before (line 285):
{activeTab === 'ai' && <AISettingsSection />}

// After:
{activeTab === 'ai' && (
  <>
    <AISettingsSection />
    <UsagePanel />
  </>
)}
```

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, log in, open Settings.

Expected: three progress bars render with real spend/cap numbers matching what Task 7's manual verification produced in `credit_spend_events`, and countdown times count down correctly on repeated page loads.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/usage/route.ts src/components/settings/UsagePanel.tsx
git commit -m "feat(credits): usage settings panel with 5h/weekly/monthly progress bars"
```

---

## Task 9: Seed real pricing data

**Files:**
- No code changes — admin data entry task, documented here so it isn't skipped.

Metering is inert (all costs compute to real numbers, but `credit_enforcement_enabled` is still `false`, and most models still have `prompt_cost: null` from the dev-subsidy era) until this task runs.

- [ ] **Step 1: Populate `search_providers.cost_per_call` with real Tavily/Exa pricing**

Via Supabase SQL editor or the admin UI (if Task 1-8 didn't add a dedicated UI for this table, use direct SQL for now — a dedicated admin page for `search_providers` is a reasonable follow-up but not required by this plan):

```sql
UPDATE search_providers SET cost_per_call = 0.001 WHERE id = 'tavily_search'; -- replace with real per-call cost from your Tavily plan
UPDATE search_providers SET cost_per_call = 0.005 WHERE id = 'exa_search';    -- replace with real per-call cost from your Exa plan
UPDATE search_providers SET cost_per_call = 0.001 WHERE id = 'exa_extract';   -- replace with real per-call cost from your Exa plan
```

- [ ] **Step 2: Confirm every model actually used in production chains has non-null `prompt_cost`/`completion_cost`**

```sql
SELECT m.id, m.prompt_cost, m.completion_cost
FROM models m
WHERE m.id IN (
  SELECT jsonb_array_elements(rc.model_list)->>'id'
  FROM router_chains rc
)
AND (m.prompt_cost IS NULL OR m.completion_cost IS NULL);
```

Expected: empty result once pricing is filled in via the admin Models page for every model returned by this query before Task 10 is run. If this returns rows, fill in their pricing first — those models will otherwise charge $0 once enforcement is on, silently defeating the limit for anyone routed to them.

- [ ] **Step 3: No commit** (data-only task; if pricing was entered via a migration instead of the admin UI for reproducibility, commit that migration)

---

## Task 10: Enable enforcement

**Files:**
- No code changes — flips the feature flag written in Task 2.

- [ ] **Step 1: Verify Task 9 is complete**

Re-run the query from Task 9 Step 2. Must return zero rows before proceeding.

- [ ] **Step 2: Flip the flag**

```sql
INSERT INTO settings (key, value) VALUES ('credit_enforcement_enabled', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb;
```

- [ ] **Step 3: Manually verify enforcement actually blocks**

As a test user with a `free` tier and near-zero remaining budget (temporarily set via SQL: `UPDATE user_subscriptions SET tier_id = 'free' WHERE user_id = '<test-user-id>';` and insert a large `credit_spend_events` row to simulate exhausted budget), send a chat message.

Expected: `429` response with a message naming the blocked window and reset time, matching the format built in Task 7 Step 3. Reset the test user's ledger afterward (`DELETE FROM credit_spend_events WHERE user_id = '<test-user-id>' AND request_id = '<the test row's request_id>';`) so real testing isn't left in a polluted state.

- [ ] **Step 4: No commit** (runtime config change, not code — document the flip in a release note if this project tracks those)

---

## Self-Review Notes

- **Spec coverage:** §1 (cost formula fix, Task 3), §2 (schema, Task 1 + Task 4), §3 (reserve/reconcile + anonymous gate, Task 2 + Task 7), §3 web search (Task 6), §4 (compaction cost + meter — compaction cost covered in Task 6 Step 5; the "resent content only" meter display itself was scoped as a UI-only percentage display change with no schema dependency, and is small enough to fold into Task 8's settings panel work if not already present — flag for a follow-up task if the existing `totalUsage` percentage isn't already surfaced anywhere in the UI, since this plan's Task 8 only builds the credit usage panel, not the context-size meter), §5 (usage panel, Task 8) are all covered. Enforcement sequencing (Tasks 9-10) directly implements the "seed pricing before enforcing" concern raised during design.
- **Type consistency:** `total_cost_usd` on `ChainResponse` (Task 5) is read at the chat route (Task 7) as `result.total_cost_usd` — consistent name throughout. `computeModelCost`'s `ModelCostInput` fields (`cache_read_tokens`, `cache_creation_tokens`) match what `providerUsage`/`visionUsage` expose (`cache_read_input_tokens`, `cache_creation_input_tokens`) — the call sites in Task 3 map the provider's field names to the formula's parameter names explicitly, not relying on name matching.
- **Known follow-up not built here:** the §4 context-size percentage meter (excluding system prompt, counting only resent history) is a UI/display feature on top of the *existing* `totalUsage` calculation in `chainRouter.ts` — it doesn't require new schema or the credit ledger, so it can be its own small follow-up task or folded into Task 8 if convenient; flagged rather than silently dropped.
