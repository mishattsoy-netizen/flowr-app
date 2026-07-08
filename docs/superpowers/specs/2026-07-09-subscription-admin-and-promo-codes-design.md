# Subscription Admin Page, Promo Codes, and Settings Panel Enrichment

## Summary

The AI credit metering system (schema, ledger, `reserve_credit`/`reconcile_credit`, enforcement) shipped and is now live. In testing it, we discovered the `free` tier has $0 monthly credit by construction (`price_usd × credit_percent / 100 = 0`), which blocks every message for anyone on it — including the admin's own test account. There is currently no way to change a user's tier, grant bonus credit, or give a friend free access to a paid tier without hand-editing the database.

This spec adds three related pieces, all touching the same `user_subscriptions`/`subscription_tiers` data: an admin page to view and manage any user's subscription, a promo-code system so trial access can be granted to friends without manual DB edits, and an enriched version of the existing Settings usage panel (tier info, code redemption, spend history, self-service downgrade).

## Goals

- Admin can see, for any user: email, current tier, live 5h/weekly/monthly spend vs. cap, and edit their tier, subscription period dates, or add bonus credit — all from one page.
- Admin can generate a promo code (tier + duration + max uses) that a friend redeems themselves from Settings, without any admin per-user action at redemption time.
- A promo-granted tier automatically reverts to `free` once its granted period ends, with no scheduled job — piggybacking on the `reserve_credit` RPC that already runs on every chat request.
- Settings usage panel shows tier/price/renewal context, a redeem-code field, recent spend history, and a downgrade-only self-service tier control (upgrading to a paid tier requires a promo code or admin action, since there's no payment integration yet).

## Out of scope

- Any real payment integration (Stripe etc.) — tiers remain admin/promo-code assigned only.
- Changing how `reserve_credit`'s budget math works — this spec only adds an expiry-revert check at the top of that function, nothing else about window/cap logic changes.
- A scheduled/cron-based expiry mechanism — reversion only happens on the next `reserve_credit` call (i.e., the next time that user sends a chat message), not proactively.
- Telegram user management (`/admin/users`, `telegram_users` table) — unrelated table, unrelated page, not touched by this spec.

## 1. Schema

Order matters here since later statements have foreign keys into earlier tables — apply in this sequence.

**New `promo_codes` table (created first, since other objects reference it):**
```sql
CREATE TABLE promo_codes (
  code           TEXT PRIMARY KEY,          -- human-typeable, e.g. 'FRIEND2026'
  tier_id        TEXT NOT NULL REFERENCES subscription_tiers(id),
  duration_days  INTEGER NOT NULL,          -- how long the granted tier lasts once redeemed
  max_uses       INTEGER NOT NULL DEFAULT 1,
  uses_count     INTEGER NOT NULL DEFAULT 0,
  created_by     TEXT,                      -- admin email, for audit
  expires_at     TIMESTAMPTZ,               -- code's own validity window (nullable = never expires); distinct from duration_days, which is the grant length after redemption
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**New `promo_code_redemptions` table** (audit trail, supports multi-use codes):
```sql
CREATE TABLE promo_code_redemptions (
  id               BIGSERIAL PRIMARY KEY,
  promo_code       TEXT NOT NULL REFERENCES promo_codes(code),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_promo_redemptions_unique ON promo_code_redemptions (promo_code, user_id);
```
The unique index prevents the same user redeeming the same code twice (they'd just extend their own grant infinitely otherwise).

**`user_subscriptions` gains one column (after `promo_codes` exists):**
```sql
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS granted_by_promo_code TEXT REFERENCES promo_codes(code);
```
`NULL` means the current tier was set normally (admin action or the original free-tier default); non-null means it was granted by redeeming that specific code, and is subject to auto-revert once `period_end` passes.

**`credit_spend_events` gains one column:**
```sql
ALTER TABLE credit_spend_events ADD COLUMN IF NOT EXISTS note TEXT;
```
Nullable, populated only by admin bonus-credit grants (§3) for an audit trail of why a grant was made; unpopulated for normal request charges.

RLS: `promo_codes` and `promo_code_redemptions` are admin-write, no public read policy needed — all access goes through server actions/RPCs using `supabaseAdmin`, not direct client queries.

## 2. `reserve_credit` gains an expiry-revert check

At the very top of the function, immediately after resolving `v_sub` (the user's current subscription row) and before any budget math:

```sql
IF v_sub.tier_id != 'free' AND v_sub.granted_by_promo_code IS NOT NULL AND NOW() >= v_sub.period_end THEN
  UPDATE user_subscriptions
  SET tier_id = 'free', granted_by_promo_code = NULL, period_start = NOW(), period_end = NOW() + INTERVAL '30 days'
  WHERE user_id = v_user_id
  RETURNING * INTO v_sub;
END IF;
```
This re-fetches `v_sub` into the same variable already used by the rest of the function, so every downstream calculation (tier lookup, window anchors, caps) automatically uses the reverted-to-free state for this request — no other changes needed elsewhere in the function. A user whose promo grant expires simply gets `free`-tier limits starting on their very next message, with no visible transition step or notification (acceptable per the "no scheduled job" constraint — out of scope to add a proactive notification).

Note: this check only applies to promo-granted tiers. An admin-set tier (`granted_by_promo_code IS NULL`) never auto-reverts, regardless of `period_end` — admin changes are permanent until another admin change, consistent with there being no payment cycle driving them.

## 3. Admin page: `/admin/subscriptions`

New route, new nav entry in the admin sidebar (icon: `CreditCard` or similar, placed near "Costs"). Authorization: reuse the existing `admins` table email-check pattern already used by `/api/admin/beta`.

**Server actions** (`src/app/admin/subscriptions/actions.ts`):
- `getSubscriptions()`: joins `user_subscriptions` + `subscription_tiers`, resolves each `user_id`'s email via `supabaseAdmin.auth.admin.listUsers()` (paginated if needed), and computes each user's current 5h/weekly/monthly spend vs. cap using the same derivation already used in `/api/usage` (extract that math into a small shared helper rather than duplicating it — see §5).
- `updateUserTier(userId, tierId)`: sets `tier_id`, clears `granted_by_promo_code` (since this is now an admin-set tier, not promo-derived), and resets `period_start`/`period_end` to a fresh 30-day cycle from now.
- `updateUserPeriod(userId, periodStart, periodEnd)`: direct date override, for the rare case an admin needs to manually extend/shorten a cycle.
- `grantBonusCredit(userId, amountUsd, note)`: inserts one `credit_spend_events` row with `amount_usd = -amountUsd` (negative — reduces total recorded spend, which is mathematically equivalent to increasing available budget, since caps are checked as `spend > cap`), `is_reservation = false`, `mode = 'admin_grant'`. Requires a new nullable `note` column on `credit_spend_events` (`ALTER TABLE credit_spend_events ADD COLUMN IF NOT EXISTS note TEXT;`), used only for admin-grant annotations and otherwise unpopulated — add this column alongside the schema changes in §1.

**UI** (`SubscriptionsTable.tsx`, client component, following the existing `UsersTable.tsx` pattern): one row per user — email, tier (dropdown, calls `updateUserTier` on change), three small usage bars (reuse the `UsageBar` component from `UsagePanel.tsx`, extracted into a shared location — see §5), an "Add Credit" button opening a small inline form (amount + optional note), and editable period start/end date inputs with a save button.

**Promo code creation**, same page, separate section: a form (tier dropdown, duration-days number input, max-uses number input) calling a new `createPromoCode(tierId, durationDays, maxUses)` action that generates a random human-readable code (e.g. 8 uppercase alphanumeric characters) and inserts the row. Below the form, a list of existing codes with their tier, duration, uses/max_uses, and created date.

## 4. Promo code redemption (user-facing)

Following the same pattern already established by `reserve_credit`/`reconcile_credit`: a new Postgres RPC `redeem_promo_code(p_code TEXT)`, `SECURITY DEFINER` with a pinned `search_path` (matching the security fixes already applied to the other two RPCs), reading `auth.uid()` internally rather than trusting a caller-supplied user id — this is what actually guarantees a user can only ever redeem for themselves, not an RLS policy.

Logic: reject if `auth.uid()` is null; look up the code and reject if not found, `expires_at` has passed, or `uses_count >= max_uses`; attempt the `promo_code_redemptions` insert first (the unique index on `(promo_code, user_id)` naturally rejects a repeat redemption by the same user — catch this specific constraint violation and return a distinct `already_redeemed` result rather than a generic error); on success, update the caller's `user_subscriptions` row (`tier_id`, `period_start = NOW()`, `period_end = NOW() + duration_days`, `granted_by_promo_code = p_code`) and increment `promo_codes.uses_count`. Returns `TABLE(success BOOLEAN, error TEXT)` so the calling Next.js code (`redeemPromoCode(code: string)` in `src/app/settings/actions.ts` or colocated with `UsagePanel`, calling this RPC via the user's own authenticated Supabase client — not `supabaseAdmin`) can show the right message: invalid code, expired, max uses reached, or already redeemed.

## 5. Settings panel enrichment

`UsagePanel.tsx` gains, in this order:
1. **Header**: tier name, price, and `period_end` formatted as "renews Aug 8" (or "no renewal" for free tier).
2. **Existing three usage bars** (unchanged).
3. **Redeem code field**: text input + submit button, calling `redeemPromoCode`. Success re-fetches usage data (tier/bars update immediately); errors show inline (invalid code, expired, already redeemed, max uses reached).
4. **Recent spend list**: last 10 rows from `credit_spend_events` for the current user (timestamp + `$amount_usd`, formatted to the same precision as the existing bars), fetched via a small addition to `/api/usage`'s response (add a `recentSpend` array) rather than a separate endpoint.
5. **Downgrade button**: visible only when the user's current tier isn't already `free`; calls a new `downgradeToFree()` action that sets `tier_id = 'free'`, clears `granted_by_promo_code`, and resets the period — same shape as `updateUserTier` but self-service and hardcoded to the `free` target, with no ability to self-upgrade (enforced server-side in the action itself, not just hidden in the UI, so a direct API call can't bypass the restriction).

**Shared code extraction**: the usage-window-math (5h/weekly/monthly spend-vs-cap derivation currently inline in `/api/usage/route.ts`) is extracted into a small pure-ish helper function (e.g. `src/lib/bot/services/usageWindows.ts`, `computeUsageWindows(sub, tier, spendRows)`), used by both `/api/usage` (single user) and the new admin `getSubscriptions()` (many users) — avoiding duplicating that math in two places, per the existing codebase's file-structure conventions established elsewhere in this session's work.

## Testing

- Manual: admin changes a user's tier via `/admin/subscriptions`, confirms the user's next chat request uses the new tier's caps.
- Manual: admin creates a promo code, redeems it as a test user, confirms tier/period/`granted_by_promo_code` are set correctly and `uses_count` increments.
- Manual: attempt to redeem the same code twice as the same user, confirm the friendly "already redeemed" error (not a raw constraint violation).
- Manual: attempt to redeem a code past `max_uses`, confirm rejection.
- Manual: manually set a promo-granted subscription's `period_end` to the past via SQL, send a chat message, confirm `reserve_credit` reverts the tier to `free` before evaluating budget for that same request.
- Manual: use the Settings downgrade button, confirm it cannot be used to upgrade (test by inspecting the action's server-side code, and by attempting to call it with a non-`free` target if the action signature allowed one — it shouldn't, since the target tier isn't a parameter).
- Manual: admin grants bonus credit, confirms the user's monthly-window spend total decreases (or effective remaining budget increases) on their next usage check.
