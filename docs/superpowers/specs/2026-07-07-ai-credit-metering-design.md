# AI Credit Metering & Mode-Based Model Routing

## Summary

Flowr AI chat currently has no real usage limiting. The only guard is `increment_my_quota` — a flat 1000-messages/day counter unrelated to actual API cost. Meanwhile per-call dollar cost is already computed correctly (`prompt_tokens`/`completion_tokens` × per-model `prompt_cost`/`completion_cost`) but only ever logged to `cost_log` for internal bookkeeping — never checked against any user-facing budget.

This design replaces raw-token/message counting with **cost-based metering**: every subscription tier buys a monthly dollar credit pool (a percentage of the subscription price), that pool is paced across the month via weekly and 5-hour rolling windows (Claude.ai-style), and requests are rejected once a window's budget is exhausted. Alongside this, chat `mode` (default/pro) becomes a first-class dimension of model routing, so Pro-tier users get access to stronger models without changing how routing works per category.

## Goals

- Meter real dollar cost, not raw tokens — fair across cheap and expensive models, maps directly to actual API spend and margin.
- Monthly credit pool per subscription tier, paced via weekly + 5-hour windows so heavy users hit friction before the month ends (upgrade incentive), without a hard "shut off day 3" cliff.
- `mode` (default/pro) becomes a routing dimension on `router_chains`, independent of and orthogonal to subscription tier — tier controls *budget size*, mode controls *which models are used*.
- Fix the existing cache-token cost bug (see below) as part of building the formula this system depends on.
- Settings page usage panel mirroring Claude.ai: two progress bars (5h, weekly), reset countdowns, plan name, upgrade CTA.

## Out of scope

- Payment integration (Stripe/etc.) — tiers and credit balances are set manually via admin for now.
- Storage quotas, cloud-sync gating, desktop-vs-web feature gating — separate future design.
- A third `mode=max` routing tier — Max and Pro subscribers share the same `mode=pro` chains today; only their budget size differs. Schema supports adding `mode=max` later without rework.
- Runtime enforcement of `context_window`/`max_output_tokens` (e.g. truncating an over-long prompt before sending). This design only makes those limits data-complete (stored per model, populated from Discover) so future work can enforce them; enforcement itself is a separate change.
- Per-model or per-chain-aware compaction sizing (dynamically choosing the compaction ceiling based on which model/chain is about to answer, accounting for router fallbacks). Considered and deferred in favor of one flat hardcoded ceiling (§4) — revisit only if real usage shows the flat number is wrong for actual routing patterns.

## 1. Cost accounting: dollars, not tokens

A Claude Sonnet 5 token costs roughly 100x a Gemini Flash Lite token. Counting raw tokens gives no meaningful, comparable limit across models — a limit sized for cheap models is meaningless the moment a mode routes to an expensive one. The unit that matters, and the one Flowr already computes per call, is **dollar cost**. All accounting in this design is in USD. The UI may still *display* a friendlier "credits" label if desired later, but internally everything is dollars.

### Fixing the cache-cost bug

`chainRouter.ts` currently computes cost as:

```
cost = prompt_tokens * prompt_cost + completion_tokens * completion_cost
```

But providers also report `cache_read_input_tokens` / `cache_creation_input_tokens` (captured in `providerUsage`, e.g. [chainRouter.ts:1104](../../../src/lib/bot/chainRouter.ts#L1104)) which are **never factored into the formula**. Cache reads are billed at a steep discount.

**Verified provider scope:** `cache_read_input_tokens`/`cache_creation_input_tokens` are only ever populated by the OpenRouter adapter ([openrouter.ts:397-398](../../../src/lib/bot/providers/openrouter.ts#L397)), which passes through OpenRouter's normalized `usage` object — Google/Groq/NVIDIA adapters never set these fields, so they're always `undefined`/0 for those paths and the formula below degrades to today's behavior automatically, no per-provider branching needed. OpenRouter's normalized format reports `prompt_tokens` as the *total* input including cached tokens (OpenAI-style additive accounting), so subtracting `cache_read_tokens` from it is correct for the one adapter this ever applies to. This has been silently overestimating `cost_log` figures for OpenRouter-routed calls with caching active; it becomes a real user-facing problem once balances are debited from this same number.

Fix: add `cache_read_cost` and `cache_write_cost` (nullable) to the `models` table. New formula:

```
cost = (prompt_tokens - cache_read_tokens) * prompt_cost
     + cache_read_tokens * (cache_read_cost ?? prompt_cost)
     + cache_creation_tokens * (cache_write_cost ?? prompt_cost)
     + completion_tokens * completion_cost
```

Models without cache pricing configured fall back to today's behavior (no regression) — cache pricing can be filled in per-model over time via the admin model registry/discover pages.

## 2. Schema

### `subscription_tiers` (new, admin-editable)

| column | type | notes |
|---|---|---|
| `id` | text pk | `free`, `pro`, `max`, ... |
| `name` | text | display name |
| `price_usd` | numeric | monthly price |
| `credit_percent` | numeric | % of price that becomes usable credit (e.g. 70) |
| `weekly_tightness` | numeric | default 1.0; <1.0 makes the weekly cap tighter than an even 1/4.33 split |
| `sessions_per_week` | numeric | default 14 (~2 five-hour windows/day); controls 5h window slice size |
| `window_hours` | numeric | default 5 |
| `router_mode` | text | `default` or `pro` — which router chain mode this tier uses |

`monthly_credit_usd = price_usd * credit_percent / 100` (computed, not stored).
`weekly_cap_usd = monthly_credit_usd * weekly_tightness / 4.33` (computed).
`window_cap_usd = weekly_cap_usd / sessions_per_week` (computed).

Free tier: `price_usd = 0`, but `credit_percent`/an admin-set override still yields a small trial pool.

### `user_subscriptions` (new)

| column | type | notes |
|---|---|---|
| `user_id` | uuid pk/fk | |
| `tier_id` | text fk → subscription_tiers | |
| `period_start` | timestamptz | current billing cycle start |
| `period_end` | timestamptz | current billing cycle end (monthly) |
| `window_5h_anchor` | timestamptz, nullable | when the current 5h window started; null = no window open |
| `window_week_anchor` | timestamptz, nullable | when the current weekly window started; null = no window open |

### `credit_spend_events` (new — the ledger)

| column | type | notes |
|---|---|---|
| `id` | bigserial pk | |
| `user_id` | uuid fk | |
| `request_id` | uuid | one row per chat request, reserved then reconciled in place (see §3) |
| `amount_usd` | numeric | reservation estimate until reconciled, then total accumulated cost across all pipeline steps; may be 0 |
| `mode` | text | default/pro, for reporting |
| `is_reservation` | boolean | true = still the flat reserve-phase estimate, not yet reconciled to real cost (should never be true after the request completes) |
| `created_at` | timestamptz | default now() |

Index: `(user_id, created_at)` — every window-sum query filters on both.

**Windows are fixed, not sliding**, to support a real "resets at HH:MM" countdown matching the Claude.ai UX (§5) — a sliding window has no single reset moment since old spend continuously ages out. The first charge in a new period starts the clock: `window_5h_anchor`/`window_week_anchor` on `user_subscriptions` mark when the current window began. A window's spend = `sum(amount_usd where created_at >= anchor)`; once `now() >= anchor + window_hours` (or `+ 7 days` for weekly), the next request starts a fresh window (new anchor = that request's timestamp) rather than continuing to sum against the stale one. Monthly uses `user_subscriptions.period_start`/`period_end` directly (already fixed, one cycle) — no separate anchor needed.

Balance for any window is otherwise **derived**, not stored as a running counter: `cap_for_window - sum(amount_usd where created_at >= anchor)`. This keeps the ledger auditable (a support dispute is answerable by reading rows, not trusting a mutable counter) and replaces `increment_my_quota` / `user_quotas` entirely — that RPC and table are removed once this ships.

### `router_chains` (existing — add `mode`)

Current unique key is `(category, platform)`. New unique key is `(category, platform, mode)`. Every category gets a `default` row; `pro` rows are optional overrides. `getRouterChain(category, mode)` looks up `category+mode`; if missing or `model_list` is empty, falls back to the `default` mode chain for that category. This means only categories where model quality visibly matters (REGULAR, CODING, COMPLEX, etc.) need an explicit Pro override on day one — utility categories (CLASSIFIER, COMPACTION) can stay on a single `default` chain indefinitely without any special-casing.

### `models` (existing — add columns)

`context_window` (int, max input tokens), `max_output_tokens` (int), `cache_read_cost` (numeric, nullable), `cache_write_cost` (numeric, nullable). Populated from the Discover flow (`contextWindow`/`maxOutputTokens` are already fetched there — [actions.ts:181](../../../src/app/admin/discover/actions.ts#L181) — but currently dropped instead of persisted when a model is added to the registry) plus manual entry for cache pricing.

### `search_providers` (new, admin-editable)

Tavily and Exa are billed per API call (a flat cost per search/fetch), not per token — an entirely different unit from LLM cost, so they don't belong on the `models` table. `search_providers` holds one row per billable operation:

| id | notes |
|---|---|
| `tavily_search` | flat cost per `client.search()` call |
| `exa_search` | flat cost per `searchExa()` call |
| `exa_extract` | flat cost per `extractExaUrls()` call (billed separately from search by Exa) |

Columns: `id` (pk), `cost_per_call` (numeric), `notes` (text, optional — e.g. "advanced search tier"). Editable via the same admin settings surface as other pricing, since provider pricing plans change independently of code.

## 3. Request flow: reserve → run → accumulate → reconcile

Dollar cost is only known *after* a model responds, so charging can't happen up front. But a plain "check balance, then charge later" (two separate steps) has a race: two near-simultaneous requests can both pass the check before either has charged, together exceeding the cap. Large providers close this gap with an atomic reserve step rather than per-user locking — same approach here, via a single Postgres RPC per phase so the check-and-write happens in one transaction.

**Phase 1 — reserve (before `runChain`):** `reserve_credit(user_id, mode)` RPC, in one transaction:
1. Sums `credit_spend_events` for the user across all three windows (5h, week, month) using the fixed-window anchors (§2), rolling a window's anchor forward first if it's expired.
2. If `spend + RESERVATION_ESTIMATE_USD` (a small flat constant, e.g. $0.02, admin-configurable via `settings`) would exceed any cap, returns `{ allowed: false, window: '5h'|'week'|'month', resets_at }`. No provider is called; route returns `429` with that info.
3. Otherwise inserts a `credit_spend_events` row with `amount_usd = RESERVATION_ESTIMATE_USD, is_reservation = true` and returns `{ allowed: true, reservation_id }`.

**Phase 2 — run + accumulate:** `runChain` executes its pipeline as today (classifier → vision → search → synthesis, etc.). Every step that currently calls `logCost` (e.g. [chainRouter.ts:397](../../../src/lib/bot/chainRouter.ts#L397), [chainRouter.ts:1117](../../../src/lib/bot/chainRouter.ts#L1117)), plus web search calls (§3 below) and compaction (§4), adds its cost to a running total carried on the shared pipeline context object already threaded through `runChain`.

**Phase 3 — reconcile (after `runChain` returns — success, error, or client abort):** `reconcile_credit(reservation_id, real_amount_usd)` RPC updates that same row: `amount_usd = real_amount_usd, is_reservation = false`. Runs in the route's `finally` block ([route.ts:228](../../../src/app/api/ai/chat/route.ts#L228)) so it fires on every exit path. If `real_amount_usd` was less than the reservation, the user's effective balance goes back up; if more, it goes down — either way the ledger ends up accurate, and the only value ever left inconsistent between phase 1 and phase 3 is bounded by `RESERVATION_ESTIMATE_USD`, not the full request cost.

### Anonymous / unauthenticated users

Pro and Max are gated entirely behind login — not a metering question, an auth gate checked before any credit logic runs. If `userId === 'anonymous'` (no Supabase session) and the resolved `mode` would be `'pro'`, reject with `401` before calling `reserve_credit` at all: *"Sign in to use Pro/Max features."* Anonymous users on `mode: 'default'` proceed through the normal default-tier flow as today (desktop-local free usage is explicitly allowed to be account-less per product design; only Pro/Max requires an account).

A multi-step pipeline can overshoot a cap slightly (checked once at start, charged once at end) — accepted trade-off; overage is at most a few cents given per-call costs at this scale, and re-checking after every step would add latency and complexity disproportionate to the risk.

### Abort / error / runaway-loop handling

- **Client stops the stream mid-generation** (`req.signal` abort, already wired via `clientDisconnected`): whatever cost was accumulated up to that point is still charged — the provider already generated and billed for those tokens regardless of whether the client kept reading the stream. No pipeline steps after the abort point run.
- **A step errors after reaching the provider**: cost already accumulated (including the failed step's, if the provider responded before the failure) is charged. **A step errors before reaching the provider** (auth/network failure): nothing accumulated for that step, so nothing charged for it.
- **Runaway loops**: two independent guardrails, since a user's remaining balance doesn't protect against a single request looping unboundedly:
  - `maxPipelineSteps` (already exists, [router-config.ts:161](../../../src/lib/router-config.ts#L161), default 20) must be enforced as a hard stop in the orchestrator, not a soft target — verify/fix this as part of implementation.
  - New **per-request cost ceiling** (e.g. $0.50, admin-configurable), independent of the user's remaining budget: if the running accumulated total for a single request exceeds this ceiling, the pipeline aborts immediately regardless of how much budget the user has left. This protects against a single pathological request draining an otherwise-healthy balance.

### Web search cost (Tavily / Exa)

`runWebSearchChain` and `runExaSearchChain` currently have **no cost tracking at all** — not even to `cost_log`, unlike model calls. A "web search" pipeline step actually contains two separately-billed things:

1. **The search/extract API call itself** — flat `cost_per_call` from `search_providers` (§2), independent of tokens.
2. **The synthesis model call** that reads the search results and writes the answer — already covered by the standard per-model token formula (§1), no change needed.

Both add into the same per-request running total from step 3 above — the accumulator doesn't care whether an addend came from token math or a flat per-call price.

Charge for **every actual API call made**, not one flat charge per "search step." `searchTavily` ([tavily.ts:61](../../../src/lib/bot/providers/tavily.ts#L61)) internally retries with a broader query on 0 results ([tavily.ts:69](../../../src/lib/bot/providers/tavily.ts#L69)) — if the fallback fires, that's 2 real Tavily API hits and 2× `tavily_search.cost_per_call` gets added to the request total, since that's what actually gets billed on your Tavily account. Similarly, a research pipeline that calls `searchExa` and then `extractExaUrls` on the results adds both `exa_search.cost_per_call` and `exa_extract.cost_per_call`.

### Caching's role in this system

Two unrelated things share the word "cache" in this codebase:
- `promptCache.ts` (in-memory compiled-prompt / prompt-hash caching) is a **server performance optimization only** — it has no effect on cost and is irrelevant to this design.
- Provider-side token caching (`cache_read_input_tokens`/`cache_creation_input_tokens`) directly affects real dollar cost and is handled by the formula fix in §1. A failed cache write/read is not a special case — the provider simply reports 0 cache tokens for that call (cache miss) and the formula naturally charges full price, exactly as if caching wasn't attempted.

## 4. Session context management (compaction)

Separate concern from budget metering: this is about fitting a conversation inside a model's context window, not about how much a user has spent. Kept as infinite, auto-compacting sessions — no visible per-session limit, no forced "start a new chat" wall. This matches how ChatGPT/Claude.ai behave and is the right UX; a hard token cutoff per session would be an abrupt, unexplainable wall to a user who doesn't think in tokens.

**What already exists and is being kept as-is:** `manageSessionCompaction` ([memoryManager](../../../src/lib/bot/services/memoryManager.ts), invoked at [chainRouter.ts:220](../../../src/lib/bot/chainRouter.ts#L220)) tracks a running `token_usage_total` per session and triggers `compactSession` ([compaction.ts:73](../../../src/lib/bot/compaction.ts#L73)) once usage crosses `compaction_threshold` (80%) of `context_limit`. Compaction runs a cheap model over the raw history and replaces it with a `[SESSION MEMORY SUMMARY]` injected into future prompts, so total tokens sent per request stay bounded while the conversation feels continuous to the user.

### What the meter counts: "resent" content only, not "system" content

Rather than trying to approximate the real next-call input size (system prompt + tool defs + whatever this request injects), the meter tracks something narrower and easier to reason about: **the token size of whatever gets persisted to history and resent on the *next* call.** The system prompt is excluded entirely — it's roughly constant (~5-6k), already accounted for in the $ cost ledger (§1–3) on every call, and would just add noise to a number meant to help the user understand *their own* session growth.

The dividing line is mechanical, not conceptual: if content is thrown away after the request that produced it and never appears in stored history again, it doesn't count, no matter how large it was for that one call. If it gets folded into persisted history and sent again on every subsequent turn, it counts, because it compounds.

Checking today's actual persistence (`route.ts` `logModelWebMessage`/`logWebInteraction`, [route.ts:199-200](../../../src/app/api/ai/chat/route.ts#L199)) against this rule:
- **Raw user messages + final assistant answers** — persisted and resent every turn → **counts**.
- **`[SEARCH DATA]` (Tavily/Exa results)** — injected into `system_prompt` fresh for the request that needed it ([chainRouter.ts:704](../../../src/lib/bot/chainRouter.ts#L704), [716](../../../src/lib/bot/chainRouter.ts#L716)), never persisted to stored history → **does not count**, even though it was real input tokens (and real $ cost) for that one call.
- **Vision `[VISION_CONTEXT]` digital-twin text** — stripped out of `content` before it's saved ([chainRouter.ts:425](../../../src/lib/bot/chainRouter.ts#L425)); only the cleaned final answer persists → **does not count**, by the same logic. (If a future change starts re-injecting the digital twin into history on later turns, it would need to start counting then — the rule is about what's actually resent, not the category of content.)
- **Session summary** (once compaction has run) — by definition persisted and resent every turn → **counts**.

Practically, this means today's meter is close to "raw conversation text," since search/vision content already doesn't survive into persisted history — the rule matters most as a guardrail for future features that might start re-injecting richer context into history without anyone revisiting whether it should count.

### Display as a percentage, not raw tokens

`context_limit` becomes a single hardcoded ceiling (32000, unchanged from today's default) treated as "100%" in any user-facing display — a progress bar or percentage, not a raw token count, since "you're at 61%" is legible to a casual user and "18,432 / 32,000 tokens" is not. This value stays a flat constant for now (not per-model) — precise per-chain/per-model sizing was considered and deferred as unnecessary complexity for the actual risk it protects against.

### Two gaps to close as part of this work

1. **Compaction cost is currently untracked.** `compactSession` makes a real model call ([compaction.ts:95](../../../src/lib/bot/compaction.ts#L95)) but nothing charges it anywhere. Since it's `await`ed inline in the request path that triggered it ([chainRouter.ts:1229](../../../src/lib/bot/chainRouter.ts#L1229)), it naturally becomes one more addend into that request's per-request cost accumulator (§3) — charged to the user whose message crossed the threshold, same as any other pipeline step.
2. **The `totalUsage` calculation should be audited against the "resent content only" rule above** as implementation proceeds — today it already only counts summary + recent raw history + a flat per-image estimate ([chainRouter.ts:1222-1223](../../../src/lib/bot/chainRouter.ts#L1222)), which is consistent with the rule now that we've confirmed search/vision content isn't persisted. No structural change needed unless a future feature starts re-injecting richer content into stored history, at which point this section is the reference for whether that new content should count.

This is intentionally orthogonal to the 5h/weekly/monthly $ budget in §2–3: compaction governs what fits in one model call's input, the credit ledger governs cumulative spend over time. A session can compact many times within a single 5h window; a user can run out of budget without ever approaching a context limit, and vice versa.

## 5. Settings page usage panel

New section, modeled directly on Claude.ai's usage UI:
- Two progress bars: current 5-hour window and current week, each showing `spent / cap` and a reset countdown.
- Current plan name + monthly credit summary.
- Upgrade CTA linking to plan selection.

Backed by `GET /api/usage`, which runs the same three fixed-window-anchor sum queries as `reserve_credit` (read-only, no reservation written), returning `{ window: { spent, cap, resets_at }, weekly: {...}, monthly: {...}, tier }`.

### Block message (5h/weekly/monthly limit hit)

Matches Claude.ai's pattern: `"You've hit your 5-hour limit. Resets in {time}."` with a `Usage` link that opens the Settings usage panel described above. Same pattern for weekly; monthly block additionally surfaces the upgrade CTA prominently since it's the terminal state for the billing cycle.

## Migration notes

- `increment_my_quota` RPC and `user_quotas` table are superseded by `credit_spend_events` and removed once this ships.
- `sync-quotas` route ([route.ts](../../../src/app/api/sync-quotas/route.ts)) is dead scaffolding (never wired to anything real) — remove during implementation.
- Existing `cost_log` inserts (`logCost`) remain as-is for internal admin cost dashboards; `credit_spend_events` is a separate, per-request-aggregated table for user-facing billing, not a replacement for `cost_log`.

## Testing

- Unit: cost formula (with/without cache tokens, with/without cache pricing configured on the model).
- Unit: window-sum derivation (5h/weekly/monthly) from a seeded set of `credit_spend_events` rows, including boundary timing.
- Integration: `reserve_credit` rejects when a window is exhausted; `reconcile_credit` fires on success, on simulated client abort, and on simulated mid-pipeline provider error, correctly adjusting the ledger up or down from the flat reservation estimate.
- Integration: two concurrent `reserve_credit` calls for a user near their cap — verify at most one succeeds when both would exceed it together (race coverage for the atomic-RPC fix).
- Integration: window anchor rolls forward correctly once `now() >= anchor + window_hours`, and a fresh anchor is set on the next request rather than continuing to sum against the expired window.
- Unit: anonymous user requesting `mode: 'pro'` is rejected with 401 before `reserve_credit` is ever called; anonymous + `mode: 'default'` proceeds normally.
- Integration: `getRouterChain(category, 'pro')` falls back to `default` chain when no pro-specific row exists or its `model_list` is empty.
- Unit: web search cost accumulation — Tavily fallback (2 calls) charges 2× `cost_per_call`; Exa search+extract in one pipeline charges both.
- Unit: compaction trigger fires at 80% of the flat 32000 ceiling; meter excludes system prompt and any per-request-only injected content (search/vision), counts only persisted/resent history; compaction's own model call is included in the triggering request's charged total.
- Manual: Settings usage panel reflects real spend after a live chat request; verify countdown timers match window boundaries.
