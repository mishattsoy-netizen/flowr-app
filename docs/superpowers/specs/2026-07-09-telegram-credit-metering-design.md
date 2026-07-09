# Telegram Credit Metering

## Summary

The web app's chat route (`/api/ai/chat`) reserves and reconciles credit against a user's subscription tier on every message via the `reserve_credit`/`reconcile_credit` RPCs. The Telegram bot's webhook (`/api/telegram/webhook`) never adopted this — it only checks the old, effectively-unenforced `telegram_users.is_blocked` flag before calling `runChain`. Real AI cost is incurred on every Telegram message, but it's never recorded in `credit_spend_events` and never checked against the sender's tier budget. A user maxed out on their web-side 5h/weekly/monthly cap can keep chatting freely via Telegram with zero budget check.

This was discovered while reviewing the admin Subscriptions page (`docs/superpowers/specs/2026-07-09-subscription-admin-and-promo-codes-design.md`), whose usage numbers are currently incomplete because Telegram spend is invisible.

This spec wires Telegram into the same credit-metering system, reusing the existing budget/window logic rather than reimplementing it.

## Goals

- Every Telegram chat message from a linked user is reserved against their tier budget before the model call and reconciled to the real cost after, exactly like the web route.
- A Telegram user who hits their tier's budget cap gets blocked with the same message wording the web app already uses.
- No change to the actual budget math (window/weekly/monthly cap calculation, expiry-revert logic) — this is purely about calling the existing system from a second entry point.
- Remove now-purposeless legacy tracking (`messages_used_today`) that isn't actually enforced anywhere.

## Non-goals

- Unlinked-user gating — already handled. General chat in the webhook is already gated behind `if (!linkedAuthUserId)` (line 512 of `route.ts`), which blocks unlinked users from ever reaching `runChain`. No changes needed here.
- Desktop app — uses the same `/api/ai/chat` route as web (confirmed), already correctly wired. Out of scope.
- Changing `is_blocked` (admin kill-switch) — stays exactly as-is, already surfaced in the merged admin Subscriptions table's Telegram badge.
- Pricing for non-text-model costs (search, audio, image-gen) — separate known gap, unrelated to this fix.

## Design

### 1. New RPCs: `reserve_credit_for_user` / `reconcile_credit_for_user`

`reserve_credit`/`reconcile_credit` read `auth.uid()` internally — this works for the web route because the caller is an authenticated Supabase client acting as the signed-in user. The Telegram webhook has no user session; it runs server-to-server using `supabaseAdmin` (the service-role key), and resolves the acting user (`linkedAuthUserId`) itself from `telegram_users.auth_user_id` before ever touching the model pipeline.

New migration adds two RPCs with the same signatures and logic as the existing pair, except they take `p_user_id UUID` as an explicit parameter instead of calling `auth.uid()`:

```sql
reserve_credit_for_user(p_user_id UUID, p_request_id UUID, p_mode TEXT DEFAULT 'default')
  RETURNS TABLE(allowed BOOLEAN, blocked_window TEXT, resets_at TIMESTAMPTZ)

reconcile_credit_for_user(p_user_id UUID, p_request_id UUID, p_real_amount_usd NUMERIC)
  RETURNS void
```

Both remain `SECURITY DEFINER` with `SET search_path = public, pg_temp` (schema-hijack prevention, same as every other RPC in this system). Safety rationale: these RPCs trust their `p_user_id` argument instead of deriving it from a JWT — that's only safe because nothing outside the server ever calls them directly. They are invoked exclusively via `supabaseAdmin` from trusted server code (the Telegram webhook), never exposed to a browser or bot client. This mirrors how every other admin/webhook action in this codebase already uses `supabaseAdmin` with implicit trust in the calling server context (e.g. `grantBonusCredit` in the admin Subscriptions page trusts the caller's `userId` argument once `assertAdmin` has verified the caller is an admin — the same shape of trust boundary, just anchored to "this is our own webhook code" instead of "this caller passed an admin check").

To avoid duplicating the ~70-line budget calculation (window anchors, cap math, expiry-revert check) three times across `reserve_credit`, `reserve_credit_for_user`, and any future caller, the migration factors the shared body into one internal `plpgsql` function, `_reserve_credit_core(p_user_id UUID, p_request_id UUID, p_mode TEXT)`, that both `reserve_credit` (wrapping `auth.uid()`) and `reserve_credit_for_user` (passing through their own parameter) call. Same pattern for reconcile via `_reconcile_credit_core`.

### 2. Webhook wiring

In `src/app/api/telegram/webhook/route.ts`, immediately after the existing `if (!linkedAuthUserId) { ...; return }` gate (line 512) and before the `runChain` call (line 546):

```typescript
const requestId = crypto.randomUUID()
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

Note: this `requestId` declaration replaces the one currently at line 541 (`const requestId = crypto.randomUUID()`, used for `logWebInteraction`) — since the reserve call now needs a `requestId` earlier in the flow (before `runChain`, not right before it), the existing declaration moves up to this point and is reused by both the reserve call and the later `logWebInteraction`/`logModelWebMessage`/reconcile calls, rather than declaring it twice.

After `runChain` resolves — whether it succeeds or throws — `reconcile_credit_for_user` must run with the real cost. The existing code has a single `try { ...runChain + send response... } catch (err) { ... }` block (lines ~511–595). Reconcile needs to run in both the success path and the catch path, so it's added as a `finally` around that block (or duplicated at the end of both the success flow and the catch block — `finally` is simpler and avoids drift):

```typescript
let result: any = null
try {
  // ...existing runChain + response-sending code (unchanged)...
} catch (err: any) {
  // ...existing error handling (unchanged)...
} finally {
  const finalCost = (result && typeof result.total_cost_usd === 'number') ? result.total_cost_usd : 0
  try {
    await supabaseAdmin!.rpc('reconcile_credit_for_user', { p_user_id: linkedAuthUserId, p_request_id: requestId, p_real_amount_usd: finalCost })
  } catch (e: any) {
    logger.error('[reconcile_credit_for_user] error:', e)
  }
}
```

(`result` must be hoisted above the `try` and assigned inside it, since the existing code currently declares `const result = await runChain(...)` inline — this becomes `let result` assigned inside the block so the `finally` can read it.)

The reserve call only happens once linking is confirmed and before any model cost is incurred, matching the web route's placement (reserve before the stream starts, reconcile after it ends).

### 3. Remove unenforced daily-message tracking

`messages_used_today` and the `incrementUsage(user.telegram_id, 'message')` calls (lines 583) are removed — this counter is currently written but never read/enforced anywhere in the webhook (confirmed by inspection: `checkUserAndLimits` fetches `daily_msg_limit` but never compares it against `messages_used_today`). Tier budget enforcement (this spec) supersedes it as the real gate.

`incrementUsage(user.telegram_id, 'image')` (line 562) is kept — it drives the 90%-image-limit admin alert in `sendAdminAlert`, which is still a useful signal independent of chat-message budget.

`usageGuard.ts`'s `incrementUsage` function itself stays (still used for images); only its `'message'` call site in the webhook is removed. The `messages_used_today` column, `UserStatus.messages_used_today` field, and `formatUser`'s mapping of it are left in the schema/types as dead-but-harmless — removing the column itself is a separate, riskier migration not needed to fix the actual bug.

## Testing

- Manual: link a Telegram account to a web account already at (or near) its 5h budget cap on web. Send a Telegram message. Confirm it's blocked with the same wording the web app shows, and confirm no new `credit_spend_events` reservation row for that user beyond what web already created.
- Manual: link a fresh account with budget remaining. Send a Telegram message. Confirm a `credit_spend_events` row appears with `mode` matching the account's `bot_mode`, `is_reservation: true` immediately, flipping to `false` with a real `amount_usd` after the response completes.
- Manual: confirm the admin Subscriptions page's usage bars for that user now move after a Telegram-only message, matching what previously only happened after web messages.
- Manual: confirm sending a Telegram message from an *unlinked* account is still blocked by the pre-existing `/login` gate (regression check — this spec doesn't touch that gate, just confirming it still exists after the surrounding code changes).
