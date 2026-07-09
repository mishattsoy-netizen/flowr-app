# Telegram Credit Metering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Telegram webhook into the same credit-metering system the web chat route already uses, so Telegram messages reserve/reconcile against a user's tier budget and show up in `credit_spend_events`, instead of bypassing metering entirely.

**Architecture:** Two new Postgres RPCs (`reserve_credit_for_user`, `reconcile_credit_for_user`) that take an explicit `p_user_id` instead of reading `auth.uid()`, since the Telegram webhook has no user session — only `supabaseAdmin` (service role). Both share their budget-calculation body with the existing `reserve_credit`/`reconcile_credit` via new internal `_reserve_credit_core`/`_reconcile_credit_core` functions, to avoid duplicating the ~70-line cap/window math a second time. The webhook itself gets a `reserve` call inserted before `runChain` and a `reconcile` call added in a `finally` block wrapping the existing try/catch, mirroring the web route's placement. A now-dead daily-message counter is removed.

**Tech Stack:** Supabase Postgres (SECURITY DEFINER RPCs), Next.js API route (TypeScript).

---

## Reference: current state (verified by direct inspection during planning)

- `supabase/migrations/20260709_promo_redeem_rpc.sql` — contains the current, authoritative `reserve_credit`/`reconcile_credit` bodies (this is the latest migration that touched them; it fully re-defines both functions). This plan's Task 1 supersedes them again with the refactored core-function version — copy the body from this file exactly, don't guess.
- `src/app/api/telegram/webhook/route.ts` — the webhook. Key line numbers as of this plan's writing (re-verify with `grep -n` before editing, since other work may shift them):
  - Line 126: outer `try` for the whole request handler (unrelated to this plan, don't touch).
  - Line 239: `try {` — start of the message-handling block. `const user = await checkUserAndLimits(chatId)` is the first statement inside it.
  - Lines 243–245: `let linkedAuthUserId`, `let activeChatId`, `let botMode` — currently declared INSIDE the try block starting at 239. These must move to before line 239 so a `finally` clause (which needs `linkedAuthUserId` and a hoisted `result`) can read them, since `let`/`const` declared inside a `try {}` is not visible in a sibling `finally {}` in JavaScript.
  - Line 511: `// ── Auth gate ──` comment, followed by the `if (!linkedAuthUserId)` block at line 512.
  - Line 541: `const requestId = crypto.randomUUID()` — currently declared here, right before `logWebInteraction`. This plan moves it earlier (right after the auth gate) so the new reserve call can use it too, and removes the now-duplicate declaration at this later point.
  - Line 546–547: `const { runChain } = await import(...)` then `const result = await runChain(...)`. This plan changes `const result` to an assignment to a `let result` hoisted above the try block.
  - Line 562: `incrementUsage(user.telegram_id, 'image')` — KEEP, unrelated to this plan.
  - Line 583: `incrementUsage(user.telegram_id, 'message')` — REMOVE (Task 3).
  - Line 587: `} catch (err: any) {` — end of the try block that needs a `finally` appended after its closing `}` (currently at line 595).
- `src/lib/bot/usageGuard.ts` — `incrementUsage(telegramId, type: 'message' | 'image')`. Only the `'message'` call site in the webhook is removed by this plan; the function itself and its `'image'` usage stay untouched.
- Full design rationale: [docs/superpowers/specs/2026-07-09-telegram-credit-metering-design.md](../specs/2026-07-09-telegram-credit-metering-design.md).

## Out of scope (per spec)

- Any change to unlinked-user gating (already correctly blocks at line 512).
- Desktop app (uses the same already-correct `/api/ai/chat` route).
- Changing `is_blocked` behavior.
- Removing the `messages_used_today` column or `UserStatus.messages_used_today` field/type — only the webhook's write-site for the `'message'` counter is removed, per the spec's explicit scoping.
- Pricing for search/audio/image-gen costs.

---

## Task 1: `reserve_credit_for_user` / `reconcile_credit_for_user` RPCs, refactored to share logic with the existing pair

**Files:**
- Create: `supabase/migrations/20260710_credit_rpcs_for_user.sql`

- [ ] **Step 1: Read the current authoritative RPC bodies**

Run: `grep -n "CREATE OR REPLACE FUNCTION" -A 5 supabase/migrations/20260709_promo_redeem_rpc.sql`

Confirm the file contains `reserve_credit` and (if present) `reconcile_credit`. If `reconcile_credit` isn't in this file, it's still the version from `supabase/migrations/20260707_credit_rpcs.sql` (unmodified since) — read that file too and use its `reconcile_credit` body as the authoritative source. Do not proceed to Step 2 without having read the real, current bodies of both functions — the versions embedded below in this plan are believed accurate as of plan-writing time but MUST be checked against the actual files first, since other work may have touched them since.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260710_credit_rpcs_for_user.sql`. This factors the shared budget-calculation body of `reserve_credit` into an internal `_reserve_credit_core` function taking `p_user_id` directly, then rewrites `reserve_credit` (`auth.uid()`-based, for user-facing callers) and adds `reserve_credit_for_user` (explicit `p_user_id`, for trusted server-side callers) as thin wrappers around it. Same pattern for `reconcile_credit`/`reconcile_credit_for_user` via `_reconcile_credit_core`.

```sql
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
```

- [ ] **Step 3: Apply the migration**

This project has no linked Supabase CLI (confirmed during the prior subscription-admin plan's execution — `npx supabase migration list` fails with `LegacyProjectNotLinkedError`). Do NOT attempt to apply it programmatically. Just create the file; it needs manual application via the Supabase dashboard SQL editor afterward.

After manual application, this verification SQL confirms all four functions exist with the right signatures:

```sql
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname IN ('reserve_credit', 'reconcile_credit', 'reserve_credit_for_user', 'reconcile_credit_for_user', '_reserve_credit_core', '_reconcile_credit_core')
ORDER BY proname;
```

Expected: 6 rows. `reserve_credit` and `reconcile_credit` keep their original signatures (`p_request_id uuid, p_mode text DEFAULT 'default'::text` / `p_request_id uuid, p_real_amount_usd numeric`). The two `_for_user` variants and the two `_core` functions additionally take `p_user_id uuid` as their first argument.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260710_credit_rpcs_for_user.sql
git commit -m "feat(credits): add reserve_credit_for_user/reconcile_credit_for_user for server-side callers"
```

Before committing, run `git status` and confirm ONLY this one file is staged — this repo frequently has unrelated pre-existing uncommitted work in the tree; do not stage anything else, do not run `git add -A`/`git add .`.

---

## Task 2: Wire reserve/reconcile into the Telegram webhook

**Files:**
- Modify: `src/app/api/telegram/webhook/route.ts`

- [ ] **Step 1: Re-verify current line numbers**

Run: `grep -n "^    try {\|let linkedAuthUserId\|const requestId = crypto.randomUUID\|const { runChain }\|const result = await runChain\|^    } catch (err: any) {\|Auth gate" src/app/api/telegram/webhook/route.ts`

Compare against the "Reference: current state" section at the top of this plan. If line numbers or surrounding code have drifted (e.g. from other concurrent work touching this file), read the actual current content around each hit before proceeding — the structural edit described below (hoisting three declarations above a `try` block, adding a `finally`) must be applied to the file's REAL current shape, not blindly pattern-matched against stale line numbers.

- [ ] **Step 2: Hoist `linkedAuthUserId` (and its sibling declarations) above the `try` block**

Find this (currently around line 239-245):

```typescript
    try {
      const user = await checkUserAndLimits(chatId)

      // Fetch linked auth info + bot mode
      let linkedAuthUserId: string | null = null
      let activeChatId: string | null = null
      let botMode: string = 'default'
      try {
```

Replace with:

```typescript
    let linkedAuthUserId: string | null = null
    let activeChatId: string | null = null
    let botMode: string = 'default'
    let requestId: string | null = null
    let result: any = null

    try {
      const user = await checkUserAndLimits(chatId)

      // Fetch linked auth info + bot mode
      try {
```

(The three `let`/declarations move above the try; `requestId` and `result` are new hoisted declarations needed for the `finally` block added in Step 4. The inner `try { const { data: tgUser } = ... } catch (e) { ... }` block that follows is unchanged — only the three `let` lines move out of the OUTER try, the inner try/catch for the `telegram_users` lookup stays exactly where it is and keeps assigning to the now-hoisted variables.)

- [ ] **Step 3: Move `requestId` declaration earlier, add the reserve call right after the auth gate**

Find this (currently around lines 511-515):

```typescript
      // ── Auth gate ──
      if (!linkedAuthUserId) {
        await telegram.sendMessage(chatId, '🔒 Please /login first to use the bot.')
        return NextResponse.json({ ok: true })
      }
```

Replace with:

```typescript
      // ── Auth gate ──
      if (!linkedAuthUserId) {
        await telegram.sendMessage(chatId, '🔒 Please /login first to use the bot.')
        return NextResponse.json({ ok: true })
      }

      // ── Reserve credit against tier budget before any model cost is incurred ──
      requestId = crypto.randomUUID()
      const { data: reserveResult, error: reserveError } = await supabaseAdmin!
        .rpc('reserve_credit_for_user', { p_user_id: linkedAuthUserId, p_request_id: requestId, p_mode: botMode })
        .single()

      if (reserveError) {
        logger.error('[reserve_credit_for_user] error:', reserveError)
        // Fail open on infra errors — same policy as the web route
      } else if (reserveResult && !(reserveResult as any).allowed) {
        const { blocked_window, resets_at } = reserveResult as any
        await telegram.sendMessage(chatId, `You've hit your ${blocked_window} limit. Resets ${resets_at ? new Date(resets_at).toLocaleString() : 'soon'}.`)
        return NextResponse.json({ ok: true })
      }
```

- [ ] **Step 4: Remove the now-duplicate `requestId` declaration, change `const result` to an assignment**

Find this (currently around lines 540-547):

```typescript
      // ── Log incoming user message ──
      const requestId = crypto.randomUUID()
      const usageType = photo ? 'vision' : 'chat'
      logWebInteraction(linkedAuthUserId, activePrompt, 'user', usageType, 'success', undefined, requestId, undefined, undefined, activeChatId)
        .catch(e => logger.error('User web log failed', e))

      const { runChain } = await import('@/lib/bot/chainRouter')
      const result = await runChain(activePrompt, photoBuffer, {
```

Replace with:

```typescript
      // ── Log incoming user message ──
      const usageType = photo ? 'vision' : 'chat'
      logWebInteraction(linkedAuthUserId, activePrompt, 'user', usageType, 'success', undefined, requestId, undefined, undefined, activeChatId)
        .catch(e => logger.error('User web log failed', e))

      const { runChain } = await import('@/lib/bot/chainRouter')
      result = await runChain(activePrompt, photoBuffer, {
```

(The `const requestId = crypto.randomUUID()` line is deleted entirely — `requestId` is now set once, earlier, in Step 3, and reused here. `const result` becomes a plain assignment to the hoisted `let result` from Step 2.)

- [ ] **Step 5: Add the reconcile call in a `finally` block**

Find the end of the try/catch (currently around lines 587-595):

```typescript
    } catch (err: any) {
      if (err.message === 'USER_BLOCKED') {
        await telegram.sendMessage(chatId, '🚫 Suspended.')
      } else {
        logger.error('Flow error:', err)
        logInteraction(chatId, err.message || 'Engine error', 'model', 'text', 'chat', 'error').catch(() => {})
        await telegram.sendMessage(chatId, '❌ *Engine Error*')
      }
    }
```

Replace with:

```typescript
    } catch (err: any) {
      if (err.message === 'USER_BLOCKED') {
        await telegram.sendMessage(chatId, '🚫 Suspended.')
      } else {
        logger.error('Flow error:', err)
        logInteraction(chatId, err.message || 'Engine error', 'model', 'text', 'chat', 'error').catch(() => {})
        await telegram.sendMessage(chatId, '❌ *Engine Error*')
      }
    } finally {
      if (linkedAuthUserId && requestId) {
        const finalCost = (result && typeof result.total_cost_usd === 'number') ? result.total_cost_usd : 0
        try {
          await supabaseAdmin!.rpc('reconcile_credit_for_user', { p_user_id: linkedAuthUserId, p_request_id: requestId, p_real_amount_usd: finalCost })
        } catch (e: any) {
          logger.error('[reconcile_credit_for_user] error:', e)
        }
      }
    }
```

(The `if (linkedAuthUserId && requestId)` guard ensures this only reconciles when a reservation was actually attempted — e.g. skips cleanly for unlinked users who never reached the reserve call, or for any early-return path where `requestId` is still `null`.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (Any pre-existing unrelated errors elsewhere in the repo are not your concern — confirm you introduced none in `route.ts`.)

- [ ] **Step 7: Manually verify (best-effort, non-blocking)**

If you can safely start a dev server without conflicting with another running instance, and a Telegram bot token is configured for local testing, send a test message from a linked account and confirm no runtime errors in the logs. If this isn't feasible in your environment (no bot token, or a dev server may already be running elsewhere), skip this step and rely on the typecheck plus a careful re-read of the diff — note explicitly in your report that live verification wasn't performed.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/telegram/webhook/route.ts
git commit -m "feat(credits): reserve/reconcile Telegram messages against tier budget"
```

Before committing, run `git status` and confirm ONLY this one file is staged.

---

## Task 3: Remove unenforced daily-message counter

**Files:**
- Modify: `src/app/api/telegram/webhook/route.ts`

- [ ] **Step 1: Confirm the counter is genuinely unenforced**

Run: `grep -n "daily_msg_limit" src/app/api/telegram/webhook/route.ts src/lib/bot/usageGuard.ts`

Expected: `daily_msg_limit` appears in `usageGuard.ts`'s `UserStatus` interface and `formatUser()` mapping, and possibly in a `/status` or `/help` display string in the webhook, but is NEVER compared against `messages_used_today` anywhere (no `if (messages_used_today >= daily_msg_limit)` or similar). This confirms the counter genuinely isn't a gate before removing its write site. If this grep reveals an actual enforcement check somewhere, STOP — the spec's assumption doesn't hold, and this task needs to be re-scoped rather than silently proceeding.

- [ ] **Step 2: Remove the `'message'` increment call site**

Find (the exact line depends on Task 2's edits already having landed — search for it fresh rather than assuming a line number):

```typescript
        incrementUsage(user.telegram_id, 'message').catch(e => logger.error('Increment message usage failed', e))
```

Delete this line entirely. Do NOT touch the sibling line a few lines up in the `if (result.type === 'photo')` branch:

```typescript
        incrementUsage(user.telegram_id, 'image').catch(e => logger.error('Increment image usage failed', e))
```

That one stays — it drives the 90%-image-limit admin alert, unrelated to this task.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/telegram/webhook/route.ts
git commit -m "chore(bot): remove unenforced daily-message counter, superseded by tier budget"
```

Before committing, run `git status` and confirm ONLY this one file is staged. If Task 2 and Task 3 are executed back-to-back without an intervening commit boundary being enforced, it's fine for both sets of edits to land in the same file — just ensure each task's own commit only includes the diff for that task's specific change (this may mean Task 3's commit is small/incremental on top of Task 2's already-committed state, which is the expected flow).

---

## Self-Review Notes

- **Spec coverage:** §1 (new RPCs, shared core) → Task 1. §2 (webhook wiring: reserve before `runChain`, reconcile in `finally`) → Task 2. §3 (remove dead counter) → Task 3.
- **Placeholder scan:** none found — every step has complete, exact code, not descriptions of code.
- **Type consistency:** `reserve_credit_for_user`'s TypeScript call site (Task 2, Step 3) destructures `{ allowed, blocked_window, resets_at }` matching the RPC's `RETURNS TABLE(allowed BOOLEAN, blocked_window TEXT, resets_at TIMESTAMPTZ)` (Task 1) exactly — same shape the existing web route already consumes from `reserve_credit`. `reconcile_credit_for_user`'s call site (Task 2, Step 5) passes `p_user_id`/`p_request_id`/`p_real_amount_usd` matching the RPC's declared parameters exactly.
- **Scoping correction caught during planning:** the original spec said "add a `finally` around that block," but didn't flag that `linkedAuthUserId`/`requestId`/`result` are currently declared INSIDE the try block they'd need to be read from in a sibling `finally` — which doesn't work in JavaScript (block scoping). Task 2 Step 2 explicitly hoists these three declarations above the try block before the reserve/reconcile calls are added, which the spec's code sketch didn't show. This plan's version is the corrected, actually-compilable one.
- **Sequencing:** Task 1 (RPCs) has no code dependency on Task 2, but Task 2's reserve/reconcile calls will fail at runtime (not at typecheck) until the Task 1 migration is manually applied — call this out explicitly to whoever executes this plan, since `npx tsc --noEmit` won't catch a missing RPC. Task 3 depends on Task 2 having landed first (its line-number search assumes Task 2's hoisting/reserve-call edits are already in the file), so tasks must execute in order: 1, 2, 3.
