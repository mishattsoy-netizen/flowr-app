# Handoff: §7b Compaction rework — watermark compaction, single trigger, real config

**You are implementing one section of a living spec.** Read `docs/superpowers/specs/2026-07-11-bot-rework-design.md` §7b first (search for "## 7b. Compaction rework"). That section is the source of truth for *why*; this doc is the source of truth for *exactly what to change, file by file*. If they conflict, the spec wins on intent, this doc wins on mechanics — but if you find a real conflict, stop and flag it instead of guessing.

**Do not invent a new plan doc.** When you finish, update the spec's §0, §7b, and §13 sections in place (template at the bottom). Do not create a "plan N" file.

## The four defects you're fixing — read this before touching code

The spec names four defects in the current compaction implementation. Each has an exact, verified location in the codebase (verified by reading the code, not assumed from the spec text):

1. **Context hole.** `chainRouter.ts:775-776` — `if (currentSummary && historyForChain.length > 5) historyForChain = historyForChain.slice(-5)`. Once a summary exists, the model only ever sees `summary + last 5 raw messages`, **regardless of when the summary was actually generated**. Any message between "what the summary covers" and "the last 5" is invisible to the model on every subsequent turn. This is the direct, verified cause of the "bot loses focus in long chats" complaint from live testing.
2. **Compaction re-summarizes/loses messages.** `memoryManager.ts:41-55`'s `manageSessionCompaction` calls `summarizeSession(sessionId, history, null)` with whatever `history` was fetched (capped at `historyLimit`, default 20 — see `chainRouter.ts:209`), not "messages since the last compaction." There's no watermark concept anywhere today. Every compaction re-reads the same capped window; already-summarized messages can be summarized again (drift), and anything older than the cap is silently gone forever.
3. **Two uncoordinated triggers, no locking.** Trigger A: `manageSessionCompaction` (`memoryManager.ts:41`), runs **before** the request, only when `!currentSummary` (first-time compaction only) and the token threshold is exceeded. Trigger B: `chainRouter.ts:1088-1106`, runs **after** the response, fire-and-forget (`summarizeSession(...).then(...)`, never awaited by the caller), whenever `totalUsage > limit * threshold` — this one fires on every subsequent compaction, not just the first. Neither knows about the other; neither takes a lock. Two turns arriving close together (e.g. a user sending two quick messages) can both trigger trigger B simultaneously, racing to write `distilled_summary`.
4. **Config is fake.** `compaction.ts:16-30` — `getCompactionConfig()` always returns a hardcoded `HARDCODED_COMPACTION_CONFIG` object; `saveCompactionConfig()` is a no-op that only logs a warning. The admin UI sliders (`src/app/admin/bot/global/page.tsx`) call these and appear to work, but nothing persists. Also: `chainRouter.ts:1084`'s `totalUsage` is computed via `estimateTokens` (chars/4 estimate), even on turns where the provider already reported real `usage.prompt_tokens`/`usage.completion_tokens` (same shape `compaction.ts:60-70` already extracts for cost calculation) — the estimate is used even when a real number is sitting right there in scope.

## Design: watermark compaction

- Session state gains a **message-id watermark**: `last_compacted_message_id` (the id of the newest message already folded into `distilled_summary`).
- The prompt window fed to the model is always `summary + all messages after the watermark` — no fixed slice. The context hole (#1) disappears by construction: there's no "last 5" cutoff anymore, because the summary itself defines exactly what's already covered.
- Compaction consumes exactly `old summary + messages since watermark`, then advances the watermark to the newest message id it just consumed. Nothing is summarized twice (the watermark always moves forward), nothing is silently dropped (every message either sits in the summary or sits after the watermark).
- Single pre-request trigger, replacing both existing triggers, with a per-session lock so two concurrent requests for the same session can't both compact at once.

## A prerequisite this needs that the spec doesn't call out explicitly: message IDs don't currently flow through history

Before you can compare "is this message before or after the watermark," you need a per-message identifier on every history item. Today, `MemoryItem` (`src/lib/bot/memory.ts:4-7`) is just `{ role, parts: [{ text }] }` — no `id` field. Both `getConversationMemory` and `getWebConversationMemory` (`memory.ts`) `.select('role, content, context_messages')` from `message_logs` — `id` isn't even fetched.

Verified: `message_logs.id` is `BIGSERIAL PRIMARY KEY` (`supabase/migrations/20260421_telegram_bot_tables.sql:32`) — monotonically increasing, reliable as a watermark anchor (more reliable than `created_at`, which has no collision guarantee across fast-successive inserts).

You need to: add `id` to `MemoryItem`, add `id` to both `.select(...)` calls in `memory.ts`, and thread it through both functions' `.map(...)` transforms.

**Note on `clientHistory` (the 3rd history source in `fetchConversationHistory`, `memoryManager.ts:14-31`):** this path has no DB-backed message IDs at all — it's raw client-supplied history. Verified this does NOT create a design fork: `clientHistory` is only used as a fallback when `history.length === 0` (i.e., the DB fetch returned nothing), and compaction's own gate requires `history.length >= 5` — so compaction can never fire on the very turn where `clientHistory` populates an otherwise-empty history. By the next turn, the DB has real rows with real ids. **You do not need to make `clientHistory` items watermark-compatible** — just make sure your watermark-comparison code doesn't crash when an item has no `id` (treat missing-id items as "always after the watermark," i.e. always include them — this only matters for a session that somehow never accumulates DB history, which in practice doesn't compact anyway).

## Files you will touch

1. `src/lib/bot/memory.ts` — add `id` to `MemoryItem` and both fetch functions.
2. `supabase/migrations/20260714_compaction_watermark.sql` — new migration: `bot_session_states.last_compacted_message_id`, new `bot_compaction_config` table (replaces the hardcoded config).
3. `src/lib/bot/context.ts` — extend `SessionState` with `last_compacted_message_id`; add `id` fallback handling to the 3 existing fallback objects.
4. `src/lib/bot/compaction.ts` — rewrite `getCompactionConfig`/`saveCompactionConfig` to actually read/write the new table; change `compactSession`'s signature to accept/return a watermark; use real provider `usage` when available instead of always estimating.
5. `src/lib/bot/services/memoryManager.ts` — rewrite `manageSessionCompaction` to be the **single** trigger, watermark-aware, with a per-session lock.
6. `src/lib/bot/chainRouter.ts` — delete the second compaction trigger (lines ~1086-1106) and the `slice(-5)` prompt-window cut (lines 775-776); replace the prompt-window construction with `summary + messages after watermark`.

Do NOT touch: `src/app/admin/bot/global/page.tsx`/`actions.ts` (the admin UI already calls `getCompactionConfig`/`saveCompactionConfig` correctly — once those functions are real, the UI starts working with zero UI-side changes needed; verify this claim yourself by reading the page, but you should not need to edit it), `router-config.ts`'s `getPipelineSettings` (same hardcoded-config pattern exists there too, but it's explicitly out of scope for §7b — don't scope-creep into fixing it), any provider file (`google.ts`/`groq.ts`/`openrouter.ts`/`nvidia.ts` already return `usage` in the shape you need; you're just consuming it differently, not changing what they return).

---

## Step 1 — `memory.ts`: thread `id` through history

`MemoryItem` (line 4-7):

```ts
export interface MemoryItem {
  id?: number
  role: 'user' | 'model'
  parts: [{ text: string }]
}
```

(`id` optional — the `clientHistory` fallback path never sets it, per the note above.)

In `getConversationMemory` (line 39), add `id` to the select and the returned object:

```ts
.select('id, role, content, context_messages')
```

and in the `.map(...)` (line 51-65), add `id: msg.id` to the returned object.

Same treatment for `getWebConversationMemory` (line 80) — find its `.select(...)` call and `.map(...)` transform (read the function in full first; it's longer than `getConversationMemory` due to the `memory_cleared_at`/chat-isolation logic, but the pattern is the same).

## Step 2 — Migration

Create `supabase/migrations/20260714_compaction_watermark.sql`:

```sql
-- §7b: watermark compaction. Two independent additions:
--
-- 1. last_compacted_message_id on bot_session_states: the id of the newest
--    message_logs row already folded into distilled_summary. The prompt
--    window is always "summary + messages after this id" — replacing the
--    old fixed "last 5 messages" slice, which created a context hole for
--    any message between what the summary covered and the last 5 (see
--    spec §7b defect 1).
--
-- 2. bot_compaction_config: previously HARDCODED_COMPACTION_CONFIG in
--    compaction.ts — the admin UI sliders wrote to a no-op function and
--    nothing persisted (spec §7b defect 4). Single-row table (like other
--    global config), RLS-open to service role only (bot-internal, same
--    pattern as bot_session_states).
ALTER TABLE bot_session_states
  ADD COLUMN IF NOT EXISTS last_compacted_message_id BIGINT;

CREATE TABLE IF NOT EXISTS bot_compaction_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  context_limit INTEGER NOT NULL DEFAULT 10000,
  compaction_threshold REAL NOT NULL DEFAULT 0.80,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO bot_compaction_config (id, context_limit, compaction_threshold)
VALUES (1, 10000, 0.80)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE bot_compaction_config ENABLE ROW LEVEL SECURITY;
```

No RLS policies needed on either table — both are only ever touched via `supabaseAdmin` (service role bypasses RLS), same as `bot_session_states` and `telegram_media_groups` before it.

## Step 3 — `context.ts`: extend `SessionState`

Add `last_compacted_message_id: number | null` to the `SessionState` interface (line 5-12) and to all 3 fallback objects (same 3 spots you'll recognize from the §6b/§6c handoffs — `temp` path, `no-supabase` path, `baseState` fallback). Default to `null` in each.

`getSessionState`'s existing `SELECT '*'` from `bot_session_states` (line 57-61) will pick up the new column automatically once the migration lands — same as it did for `pending_action`/`current_focus`/`previous_focus` in §6b/§6c, no query change needed.

## Step 4 — `compaction.ts`: real config, watermark-aware summarization, real token usage

### 4a. Real config

Replace the hardcoded config block (lines 16-30):

```ts
export async function getCompactionConfig(): Promise<CompactionConfig> {
  if (!supabase) return { context_limit: 10000, compaction_threshold: 0.80 }
  const { data, error } = await supabase.from('bot_compaction_config').select('context_limit, compaction_threshold').eq('id', 1).maybeSingle()
  if (error || !data) {
    logger.warn(`Failed to fetch compaction config, using defaults: ${error?.message}`)
    return { context_limit: 10000, compaction_threshold: 0.80 }
  }
  return { context_limit: data.context_limit, compaction_threshold: data.compaction_threshold }
}

export async function saveCompactionConfig(config: Partial<CompactionConfig>): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('bot_compaction_config').update({ ...config, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) logger.error('Failed to save compaction config:', error)
}
```

Delete `HARDCODED_COMPACTION_CONFIG`. Import `supabaseAdmin as supabase` at the top of the file if not already present (check — `logger` is already imported, `supabase` may not be; `context.ts` in this same directory already does `import { supabaseAdmin as supabase } from '../supabase'`, copy that exact pattern).

### 4b. `compactSession` becomes watermark-aware

Current signature (line 79-83):

```ts
export async function compactSession(
  chatId: string,
  history: any[],
  currentSummary: string | null
): Promise<{ summary: string | null; cost: number }>
```

Change to accept and return the watermark:

```ts
export async function compactSession(
  chatId: string,
  history: MemoryItem[],
  currentSummary: string | null
): Promise<{ summary: string | null; cost: number; newWatermark: number | null }>
```

Import `MemoryItem` from `./memory`. Inside the function, `history` passed in should already be pre-filtered by the caller to "messages since the last watermark" (see Step 5 — this is `manageSessionCompaction`'s job, not `compactSession`'s; `compactSession` just summarizes whatever it's given and reports back the newest id it saw). At the end of the function, before each `return`, compute `newWatermark = history.length > 0 ? Math.max(...history.map(h => h.id ?? 0).filter(id => id > 0)) : null` and include it in the returned object. On the failure path (line 107-108, "all models failed"), return the **old** watermark unchanged (pass it in as a parameter or have the caller preserve it — do not advance the watermark if compaction didn't actually succeed, or you'd silently drop the un-compacted messages).

### 4c. Real token usage instead of always estimating

`runCompactionModel` (line 32-77) already extracts `usage` from the provider response (line 60) and uses it for cost (line 61-70) — it just never surfaces it to the caller for the token-accounting purpose. This part is about `chainRouter.ts`'s `totalUsage` computation (line 1084), not about `compaction.ts` itself — see Step 6c below. No further change needed in `compaction.ts` for this specific defect; `runCompactionModel`'s return already has what's needed once you look at how `chainRouter.ts` computes `totalUsage` for the *main* chat turn (not the compaction call) — that's the actual place using `estimateTokens` when real `usage` is already in scope from the main provider call.

## Step 5 — `memoryManager.ts`: the single, locked trigger

Replace `manageSessionCompaction` (lines 33-58) entirely. New design:

```ts
const compactionLocks = new Map<string, Promise<any>>()

export async function manageSessionCompaction(
  sessionId: string,
  history: MemoryItem[],
  sessionState: any
): Promise<{ currentSummary: string | null; updatedSessionState: any; cost: number }> {
  let currentSummary = sessionState?.distilled_summary || null
  let cost = 0

  if (!sessionState) return { currentSummary, updatedSessionState: sessionState, cost }

  const totalUsage = sessionState.token_usage_total ?? 0
  const limit = sessionState.context_limit ?? 10000
  const threshold = sessionState.compaction_threshold ?? 0.80
  if (totalUsage <= limit * threshold) {
    return { currentSummary, updatedSessionState: sessionState, cost }
  }

  // Per-session lock: if a compaction for this session is already in flight
  // (e.g. two near-simultaneous requests both crossed the threshold), the
  // second caller awaits the first's result instead of racing it.
  if (compactionLocks.has(sessionId)) {
    await compactionLocks.get(sessionId)
    const refreshed = await getSessionState(sessionId)
    if (refreshed) {
      currentSummary = refreshed.distilled_summary
      Object.assign(sessionState, refreshed)
    }
    return { currentSummary, updatedSessionState: sessionState, cost: 0 }
  }

  const watermark: number | null = sessionState.last_compacted_message_id ?? null
  const messagesSinceWatermark = watermark
    ? history.filter(h => (h.id ?? Infinity) > watermark)
    : history

  if (messagesSinceWatermark.length === 0) {
    return { currentSummary, updatedSessionState: sessionState, cost }
  }

  const { compactSession } = await import('../compaction')
  const { updateSessionState } = await import('../context')

  const run = (async () => {
    logger.info(`Compaction for ${sessionId} (${totalUsage}/${limit}, watermark=${watermark})`)
    const result = await compactSession(sessionId, messagesSinceWatermark, currentSummary)
    if (result.summary) {
      await updateSessionState(sessionId, {
        distilled_summary: result.summary,
        last_compacted_message_id: result.newWatermark ?? watermark,
        last_summarized_at: new Date().toISOString(),
      })
    }
    return result
  })()

  compactionLocks.set(sessionId, run)
  try {
    const result = await run
    cost = result.cost
    if (result.summary) {
      currentSummary = result.summary
      sessionState.distilled_summary = result.summary
      sessionState.last_compacted_message_id = result.newWatermark ?? watermark
    }
  } finally {
    compactionLocks.delete(sessionId)
  }

  return { currentSummary, updatedSessionState: sessionState, cost }
}
```

Key differences from today: **single trigger** (was two — this replaces both `manageSessionCompaction`'s old body AND the second trigger you're deleting from `chainRouter.ts` in Step 6b); fires whenever the threshold is exceeded (not just "first time," which was the old `!currentSummary` restriction — that's why re-compaction on an already-summarized session never happened via this path before, only via the fire-and-forget one); watermark-filtered `history` passed to `compactSession`; in-process lock via a module-level `Map` (this is per-process, not cross-instance — acceptable here because Vercel serverless functions are single-invocation, and the race this closes is same-process concurrent requests, e.g. two browser tabs; a cross-instance DB-level lock would be more robust but is more scope than this defect needs — note this as a known limitation in your spec write-up, don't silently oversell it as fully race-proof across serverless instances).

**Important:** `history` passed into `manageSessionCompaction` from `chainRouter.ts` (call site at line 221, `await manageSessionCompaction(sessionId, history, sessionState)`) needs to be the `MemoryItem[]` with `id`s from Step 1 — confirm this is actually what's in scope at that call site (it should be, since `history` there comes straight from `fetchConversationHistory`, which now returns `id`-bearing items after your Step 1 change).

## Step 6 — `chainRouter.ts`: remove the second trigger, fix the prompt window

### 6a. Delete the fixed "last 5" slice

Lines 769-776 today:

```ts
let historyForChain = (category === 'WEB_SEARCH' || category === 'RESEARCH')
  ? history.slice(-4)
  : (!pipelineSettings.historyEnabledCategories || pipelineSettings.historyEnabledCategories.includes(category)) ? history : []

// When session summary exists, trim raw history — the summary carries prior context.
// Keep only the last few messages for immediate conversational coherence (Claude Code style).
if (currentSummary && historyForChain.length > 5) {
  historyForChain = historyForChain.slice(-5)
}
```

Replace the `if (currentSummary && ...)` block with a watermark-based filter:

```ts
// When a session summary exists, the summary already covers everything up to
// the watermark — only show the model messages AFTER that point, not a fixed
// "last 5" that could hide messages the summary never actually covered.
if (currentSummary && sessionState?.last_compacted_message_id) {
  const watermark = sessionState.last_compacted_message_id
  historyForChain = historyForChain.filter((h: any) => (h.id ?? Infinity) > watermark)
}
```

Leave the WEB_SEARCH/RESEARCH `slice(-4)` line untouched — that's a different, intentional, unrelated behavior (short-tail context for search follow-ups, explicitly commented as such at line 760-765) and is out of scope for this defect.

### 6b. Delete the second compaction trigger

Delete lines ~1086-1106 (the `if (totalUsage > limit * threshold) { ... summarizeSession(...).then(...) } else { await updateSessionState(...) }` block) in full. This entire block is superseded by Step 5's single trigger. But **keep the `token_usage_total` bookkeeping** — you still need session state to know the current usage so the *next* turn's `manageSessionCompaction` call can decide whether to compact. Replace the deleted block with just the accounting update, unconditionally:

```ts
await updateSessionState(sid, { token_usage_total: totalUsage, context_limit: limit, compaction_threshold: threshold })
  .catch((e: any) => logger.error(`Failed to update session state for ${sid}:`, e))
```

(This is exactly the `else` branch that already existed — just make it run unconditionally instead of only when under threshold, since compaction no longer happens here at all.)

### 6c. Real token usage instead of `estimateTokens`

Still within the block you're editing in 6b (read the surrounding code at lines ~1040-1090 in full before editing — variable names like `providerUsage` should already be in scope from the main provider call earlier in the same function, check for them), replace `totalUsage = summaryTokens + estimateTokens(activeHistoryText) + (activeImageCount * 258)` (line 1084) to prefer real provider-reported usage when available:

```ts
const totalUsage = providerUsage
  ? summaryTokens + (providerUsage.prompt_tokens ?? 0) + (providerUsage.completion_tokens ?? 0)
  : summaryTokens + estimateTokens(activeHistoryText) + (activeImageCount * 258)
```

Grep the function for `providerUsage` (or whatever the actual in-scope variable is named — verify the exact name yourself, don't assume it matches this doc) to confirm it's already populated from the main chat turn's provider response before this point in the function. If no such variable is in scope at this point, this part of defect #4 may need the variable threaded down from wherever the provider response is first received — investigate before assuming the fix is a one-line swap.

## Verification checklist

1. `npx tsc --noEmit` — clean.
2. `npm test` — same or higher than your baseline (record `npm test -- --silent`'s count before starting; it should be 361 as of this handoff's writing, but re-check, don't assume).
3. Manually trace: session with no summary yet, 20 messages, over threshold → `manageSessionCompaction` fires, `compactSession` runs on all 20 (no watermark yet), returns `newWatermark` = the last message's id, `last_compacted_message_id` written.
4. Second trace: same session, 10 MORE messages arrive later, over threshold again → `manageSessionCompaction` fires again, but `compactSession` only receives the 10 NEW messages (filtered by watermark), not all 30 — confirms the "no re-summarization, no drift" defect (#2) is fixed.
5. Third trace: with a summary + watermark set, confirm `historyForChain` in `chainRouter.ts` includes every message after the watermark, not just the last 5 — even if that's 8 or 12 messages. Confirms defect #1 is fixed.
6. Fourth trace: two near-simultaneous calls to `manageSessionCompaction` for the same `sessionId` (can be tested by calling it twice without awaiting the first, in a small script or test) — confirm the second call awaits the first's lock rather than triggering a second `compactSession` run.
7. Confirm the admin UI's compaction sliders (`src/app/admin/bot/global/page.tsx`) actually persist now — save a value, reload the page, confirm it's still there. This should require zero changes to the admin page/actions files themselves; if it doesn't work, the bug is in `getCompactionConfig`/`saveCompactionConfig`, not the UI.
8. Grep for `HARDCODED_COMPACTION_CONFIG` — should be zero hits after your changes.
9. Grep for `.slice(-5)` in `chainRouter.ts` — the one at line ~776 (prompt window) should be gone; confirm you haven't accidentally touched the WEB_SEARCH/RESEARCH `.slice(-4)` at line 770 or any other unrelated slice elsewhere in the file.

## After implementation — update the spec (separate commit)

In `docs/superpowers/specs/2026-07-11-bot-rework-design.md`:
- §7b: change status to `✅ DONE (<date>)`, 2-4 sentences following the style of other "Shipped:" write-ups (root cause → what changed → what was verified). Be honest about the lock being per-process/in-memory, not cross-instance — don't overclaim full race-safety across serverless instances if that's not what you built.
- §0: update the progress table row, move `⬅️ NEXT` to whatever's next in §13's "Remaining, in order" list at the time you land this (re-read §13 fresh — don't assume it's still what it was when this doc was written).
- §13: mark step 7b done, advance the `⬅️ NEXT` marker.

## Explicit stop condition

Once §7b is implemented, tested (tsc + npm test + the manual traces above), and the spec is updated — STOP. Do not proceed to §3 (context pack), §6 (memory v2), §7 (notifications), or §7c's remaining `edit_content` unification (a separate, already-identified piece of leftover scope, explicitly not part of this handoff). Report back what you changed and stop.
