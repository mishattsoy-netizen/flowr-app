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

## 1. Cost accounting: dollars, not tokens

A Claude Sonnet 5 token costs roughly 100x a Gemini Flash Lite token. Counting raw tokens gives no meaningful, comparable limit across models — a limit sized for cheap models is meaningless the moment a mode routes to an expensive one. The unit that matters, and the one Flowr already computes per call, is **dollar cost**. All accounting in this design is in USD. The UI may still *display* a friendlier "credits" label if desired later, but internally everything is dollars.

### Fixing the cache-cost bug

`chainRouter.ts` currently computes cost as:

```
cost = prompt_tokens * prompt_cost + completion_tokens * completion_cost
```

But providers also report `cache_read_input_tokens` / `cache_creation_input_tokens` (captured in `providerUsage`, e.g. [chainRouter.ts:1104](../../../src/lib/bot/chainRouter.ts#L1104)) which are **never factored into the formula**. Cache reads are billed at a steep discount by providers (Anthropic, OpenAI, Gemini) — since `prompt_tokens` typically already includes cached tokens in its total, the current formula overcharges whenever caching is active. This has been silently overestimating `cost_log` figures; it becomes a real user-facing problem once balances are debited from this same number.

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

### `credit_spend_events` (new — the ledger)

| column | type | notes |
|---|---|---|
| `id` | bigserial pk | |
| `user_id` | uuid fk | |
| `request_id` | uuid | one row per chat request (post-charge, see §4) |
| `amount_usd` | numeric | total accumulated cost across all pipeline steps for this request; may be 0 |
| `mode` | text | default/pro, for reporting |
| `created_at` | timestamptz | default now() |

Balance for any window is **derived**, not stored: `cap_for_window - sum(amount_usd where created_at >= window_start)`. This is what makes 5h/weekly/monthly simultaneously computable from one source of truth, and keeps the ledger auditable (a support dispute is answerable by reading rows, not trusting a mutable counter). This replaces `increment_my_quota` / `user_quotas` entirely — that RPC and table are removed once this ships.

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

## 3. Request flow: pre-check → run → accumulate → post-charge

Dollar cost is only known *after* a model responds, so the flow is necessarily pre-check-then-charge, not charge-up-front:

1. **Pre-check** (before `runChain`): sum `credit_spend_events` for the user across all three windows (5h, week, month). If any window's cap is already met or exceeded, reject with `429` naming which window and its `resets_at` timestamp. No provider is called.
2. **Run**: `runChain` executes its pipeline as today (classifier → vision → search → synthesis, etc.).
3. **Accumulate**: every step that currently calls `logCost` (e.g. [chainRouter.ts:397](../../../src/lib/bot/chainRouter.ts#L397), [chainRouter.ts:1117](../../../src/lib/bot/chainRouter.ts#L1117)) also adds its `total_cost` to a running total carried on the shared pipeline context object already threaded through `runChain`.
4. **Post-charge**: after `runChain` returns — success, error, or client abort — write one `credit_spend_events` row with the accumulated total. This happens in the route's `finally` block ([route.ts:228](../../../src/app/api/ai/chat/route.ts#L228)) so it fires on every exit path, not just the success path.

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

## 4. Settings page usage panel

New section, modeled directly on Claude.ai's usage UI:
- Two progress bars: current 5-hour window and current week, each showing `spent / cap` and a reset countdown.
- Current plan name + monthly credit summary.
- Upgrade CTA linking to plan selection.

Backed by `GET /api/usage`, which runs the same three window-sum queries as the pre-check (read-only), returning `{ window: { spent, cap, resets_at }, weekly: {...}, monthly: {...}, tier }`.

### Block message (5h/weekly/monthly limit hit)

Matches Claude.ai's pattern: `"You've hit your 5-hour limit. Resets in {time}."` with a `Usage` link that opens the Settings usage panel described above. Same pattern for weekly; monthly block additionally surfaces the upgrade CTA prominently since it's the terminal state for the billing cycle.

## Migration notes

- `increment_my_quota` RPC and `user_quotas` table are superseded by `credit_spend_events` and removed once this ships.
- `sync-quotas` route ([route.ts](../../../src/app/api/sync-quotas/route.ts)) is dead scaffolding (never wired to anything real) — remove during implementation.
- Existing `cost_log` inserts (`logCost`) remain as-is for internal admin cost dashboards; `credit_spend_events` is a separate, per-request-aggregated table for user-facing billing, not a replacement for `cost_log`.

## Testing

- Unit: cost formula (with/without cache tokens, with/without cache pricing configured on the model).
- Unit: window-sum derivation (5h/weekly/monthly) from a seeded set of `credit_spend_events` rows, including boundary timing.
- Integration: pre-check rejects when a window is exhausted; post-charge fires on success, on simulated client abort, and on simulated mid-pipeline provider error.
- Integration: `getRouterChain(category, 'pro')` falls back to `default` chain when no pro-specific row exists or its `model_list` is empty.
- Unit: web search cost accumulation — Tavily fallback (2 calls) charges 2× `cost_per_call`; Exa search+extract in one pipeline charges both.
- Manual: Settings usage panel reflects real spend after a live chat request; verify countdown timers match window boundaries.
