# Handoff: revert `token_usage_total` off provider-reported `prompt_tokens`, back to a persistent-history estimate (chars/3.5)

**You are fixing a regression introduced by the §7b compaction rework** (see `docs/superpowers/specs/2026-07-11-bot-rework-design.md` §7b — read it first, it's the source of truth for the whole compaction system this bug lives inside). This doc is the source of truth for exactly what to change.

## The bug, with live evidence

User asked the bot "list all notes with their detailed summaries" (a `list_content` tool call returning 9 notes' summaries, rendered back as a markdown table in the reply). Immediately after that single turn:
- The Memory Usage meter jumped to **132%** (screenshot: `Memory Usage 132%`, "Memory full. Preparing to distill...").
- Automatic compaction never fired.
- The manual "Compact Memory" button was greyed out / did nothing.

## Root cause (confirmed via code read, not inference)

§7b changed `chainRouter.ts`'s `totalUsage` computation (~line 1106) to prefer the AI provider's own reported `prompt_tokens`/`completion_tokens` over the old chars-based estimate, on the reasoning that "real numbers beat estimates":

```ts
const totalUsage = providerUsage
  ? (providerUsage.prompt_tokens ?? 0) + (providerUsage.completion_tokens ?? 0)
  : summaryTokens + estimateTokens(activeHistoryText) + (activeImageCount * 258);
```

This is wrong for this specific purpose. `providerUsage.prompt_tokens` reflects **everything sent to the model in that one API call** — including the full tool-result payload from an internal tool-call round-trip (e.g. all 9 notes' summaries, sent to the model so it could write the reply). That payload is real for the one provider call, but confirmed via `src/app/api/ai/chat/route.ts:271-274` (`buildToolSummary`) that **it is never persisted**: `message_logs` only ever stores the final rendered reply text plus a one-line tool annotation like `[Tools: list_content(...) → 9 items]`, never the raw tool output.

So `token_usage_total` was measuring a phantom: tokens that were real for one request but aren't part of the compactable session state at all, can never be replayed, and — critically — **can never be reduced by compaction**, because compaction only ever consumes what's actually in `message_logs`. Once the metric got inflated by a big tool-output turn, it stayed inflated forever (or until the number happens to age out via some other means, which doesn't exist).

**Secondary, compounding factor, not the primary bug — do not spend time on this unless the primary fix doesn't fully resolve it:** `prompt_tokens` also includes the static system prompt (~4k tokens post-diet) and tool definitions on every turn, which are never part of the compactable history either. Even under the old estimate-based method this floor exists conceptually (context sent to the model always includes the system prompt), but the estimate method never counted it toward `token_usage_total` in the first place, so it wasn't visible as a problem before this regression.

**Confirmed NOT the cause (do not re-investigate):** the manual "Compact Memory" button being disabled was a secondary, correct-per-design behavior — it requires ≥5 messages in the session (`msgCount < 5` → `canCompact` false), and this particular test session only had ~2 messages. That gate is fine and not in scope for this fix. Once the metric itself stops spiking to 132% on a single tool-heavy turn, this stops mattering in practice for normal-length sessions.

## The fix

**1. `src/lib/bot/context.ts`** — change the token-per-char ratio, per explicit owner instruction:

```ts
const CHARS_PER_TOKEN = 4
```
→
```ts
const CHARS_PER_TOKEN = 3.5
```

This makes `estimateTokens` slightly more conservative (larger token counts for the same text) everywhere it's used — confirmed via grep this is shared by the input-token-limit trimming guard (`chainRouter.ts:808`, `:819`) and cost/analytics estimation (`chainRouter.ts:1170`, `:1190`, `:1194`, `:1205`), not just compaction. A more conservative estimate is a safe direction for all of those (errs toward trimming/counting slightly early, never toward overflowing a real limit) — no other change needed to accommodate this, just confirm `npx tsc --noEmit` and `npm test` still pass after the ratio change (some existing tests may assert exact `estimateTokens` output values — check `context.test.ts` if it exists, and any snapshot-style assertions elsewhere).

**2. `src/lib/bot/chainRouter.ts`** — revert the `totalUsage` computation (~line 1101-1108) to always use the history-based estimate, dropping the `providerUsage` branch for this specific purpose only:

```ts
const summaryTokens = currentSummary ? estimateTokens(currentSummary) : 0;
const totalUsage = summaryTokens + estimateTokens(activeHistoryText) + (activeImageCount * 258);
```

Delete the `providerUsage ? ... : ...` branch and its comment block entirely — `activeHistoryText`/`limitHistory` already correctly represent "what's actually persisted and compactable" (built from `historyWithResponse`, itself `history` + the final reply, watermark-filtered — this part of §7b was correct and stays as-is). Do **not** touch `providerUsage` itself, its declaration, or its other use sites — it's still correctly used for cost accounting and analytics (`chainRouter.ts:1168` `tokensUsed`, and wherever it flows into `computeModelCost`/`credit_spend_events`). This fix is scoped to `token_usage_total` only — the "is this session big enough to compact" metric — not to cost tracking, which measures something legitimately different (actual API spend, where the full `prompt_tokens` including tool-round-trip cost IS the correct number).

## What NOT to do

- Do not loosen the manual-compact button's `msgCount < 5` gate or the auto-trigger's `history.length < 5` gate in `manageSessionCompaction` — confirmed not the root cause, out of scope.
- Do not touch the system-prompt-floor issue (secondary factor above) unless verification shows the primary fix doesn't fully resolve the reported symptom.
- Do not re-touch anything else in §7b (the watermark logic, the lock, `compactSession`, the migration) — this is a narrow, single-purpose revert of one computation plus one shared constant.

## Verification

1. `npx tsc --noEmit` — clean.
2. `npm test` — same or higher than baseline (380 as of this handoff's writing — re-check, don't assume).
3. Manually trace: reconstruct the failing scenario — a session with a few short messages, then one turn that calls `list_content` returning several items and the model reproduces them in a table reply. Confirm `token_usage_total` after that turn reflects only `activeHistoryText` (the persisted reply + prior history), not the inflated tool-round-trip `prompt_tokens`.
4. If possible, live-retest against the actual bot (same request Mikhail used: "list all notes with their detailed summaries") and confirm the Memory Usage meter does not spike to anything resembling the tool-output size — it should track roughly what the OLD estimate method would have shown for the same request, since that's the number being restored.

## After implementation — update the spec (separate commit)

In `docs/superpowers/specs/2026-07-11-bot-rework-design.md` §7b: add a dated follow-up note (do not rewrite the existing "Shipped"/"What changed" prose — append) explaining: the provider-usage switch for `token_usage_total` was found live, same day, to cause exactly this kind of phantom-spike bug, root-caused via `route.ts`'s tool-summary logging (raw tool output is never persisted, only the rendered reply + one-line annotation), and reverted to the history-based estimate; `CHARS_PER_TOKEN` changed from 4 to 3.5 project-wide at the same time (owner instruction, not root-cause-driven — note it as a deliberate conservatism tweak, not a fix for this bug specifically). Update §0's compaction row status line and the "not yet live-verified" note to reflect this second commit.

## Explicit stop condition

Once the fix is implemented, tested (tsc + npm test + the manual trace above), and the spec is updated — stop. Do not proceed to loosen the 5-message gates, do not investigate the system-prompt-floor secondary factor, and do not touch any other part of §7b or move on to §3/§6/§7. Report back what you changed and stop.
