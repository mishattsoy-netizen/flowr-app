# Handoff: fix round for §6c classifier focus-shift work

## Context

The previous handoff (`2026-07-13-6c-classifier-focus-shift-handoff.md`) was implemented and
self-reported as verified with "0 regressions found" from the offline eval script
(`scripts/eval-classifier-v2.ts`). Independent re-verification found the eval script itself was
broken (a regex bug made every comparison silently produce `undefined` values that trivially
"matched"), so the "0 regressions" claim was never actually tested. After fixing the script and
running it for real, it found **2 real regressions** in `category`/`complexity`/`action` caused by
the `focus_shift` prompt addition. This is exactly the failure mode the original handoff's gate
existed to catch — do not re-ship without addressing it.

Two smaller code issues were also found during this re-verification. Fix all three.

## 1. REQUIRED: classifier_v2.txt regression — category/complexity/action degraded

The eval script (now fixed, see below) compared old vs. new `classifier_v2.txt` on 11 real cases
(4 others hit Groq rate limits and produced no result — rerun to get full coverage). Two
regressed:

**Case 2** — `"help me research the best noise-cancelling headphones under $300"` (no prior
history):
- Old prompt → `{category: WEB_SEARCH, complexity: normal, action: false}`
- New prompt → `{category: WEB_SEARCH, complexity: hard, action: true}`
- `complexity` and `action` both flipped. This would route this turn to the Smart tier with
  `action: true` semantics (needs 2+ tool operations) when it's actually a single web search.

**Case 3** — `"what about Sony vs Bose specifically?"` (as a follow-up after the headphones
request):
- Old prompt → `{category: WEB_SEARCH, complexity: normal, action: false}`
- New prompt → `{category: PRIMARY, complexity: normal, action: false}`
- `category` itself flipped from WEB_SEARCH to PRIMARY. This is the more serious one: a live
  web-search-needing follow-up would misroute to PRIMARY and get an answer synthesized from the
  model's own knowledge/history instead of a real search — silently wrong, not just mis-tiered.

**Diagnosis to start from:** both regressed cases involve WEB_SEARCH-category messages, and both
happen to be the two cases immediately following/adjacent to the new `focus_shift` instruction
block in the prompt (it sits right after the `action` instructions, before `ATTACHMENTS`). Worth
checking specifically whether the added block's phrasing or its five inline examples are pulling
the small model's attention away from the WEB_SEARCH category criteria specifically — the other 9
compared cases (PRIMARY/IMAGE_GEN cases) did NOT regress, which suggests this isn't a general
prompt-length/dilution problem so much as something specific to how WEB_SEARCH is now being
judged. Do not guess-and-tune blindly; use the eval script (see below) to test each candidate
prompt edit against all cases before considering a change good.

**Do not ship this without both regressed cases passing** (an exact category/complexity/action
match, or a deliberate, reasoned decision — documented in the PR/commit message — that the new
value is actually more correct than the old one and the eval's "old" baseline was the actual bug).

## 2. REQUIRED: fix the eval script itself (already partially done for you — verify, don't redo)

`scripts/eval-classifier-v2.ts` had two bugs, already fixed during this re-verification pass —
confirm they're present in your working copy (they should be, since this file is uncommitted) and
don't revert them:

- **Line 124-125** (now): `contentOld.match(/\{[\s\S]*?\}/)` — this was previously
  `/\\{[\\s\\S]*?\\}/` (a regex that matches a literal backslash + "s"/"S" characters, i.e. never
  matches real JSON). This is why the original run silently produced `undefined` for every field
  and still printed "0 regressions found" — the fallback `|| "{}"` swallowed the failure. **This
  was the actual root cause of the false "verified" claim in the previous implementation's
  summary.**
- **History/prompt string building** (~line 114-115) and the final summary lines (~152, 154): were
  using literal `\n` (backslash + n as two characters) instead of real newlines. Fixed to use
  actual `\n` escapes in real (non-double-escaped) template strings.

**Also add:** a delay between API calls. Groq's `llama-3.1-8b-instant` free/on-demand tier is
rate-limited at 6000 TPM, and running 15 cases × 2 prompt versions back-to-back exhausts it
partway through, causing later cases to fail with `Cannot read properties of null (reading
'content')` and get silently skipped (not counted as failures OR passes). A 15-second delay
between cases was sufficient to get 11/15 through in the last run; even that still lost 4 cases to
rate limiting — consider either a longer delay (20-30s) or checking whether a different, less
rate-limited model/key can be used for this specific eval so all 15 cases can run in one pass. The
final report before this ships must show a real comparison result (match or regression) for every
case, not "failed to run."

**How to actually run it** (this was also missing/unclear — the script depends on Supabase-backed
vault key lookup, which needs real env vars loaded, and `npx tsx scripts/eval-classifier-v2.ts`
alone does NOT load `.env`):
```
npx tsx -r dotenv/config scripts/eval-classifier-v2.ts
```

## 3. `src/lib/bot/chainRouter.ts` — fire-and-forget `updateSessionState` call

Around the new focus-shift block (currently ~line 386-398):
```ts
if (v2res.classification.focus_shift && sessionState) {
  const newFocus = v2res.classification.focus_shift
  sessionState.previous_focus = sessionState.current_focus || null
  sessionState.current_focus = newFocus
  sessionState.pending_action = null
  updateSessionState(sessionId, {
    current_focus: newFocus,
    previous_focus: sessionState.previous_focus,
    pending_action: null
  }).catch(err => logger.error(`Failed to update focus in DB: ${err.message}`))
  logger.info(`[Router] Classifier detected focus shift: "${newFocus}"`)
}
```

The `updateSessionState(...)` call is missing `await` — it's fire-and-forget with only a `.catch`
for error logging. Every other call to `updateSessionState` in this same file IS awaited (e.g.
line ~1118: `await updateSessionState(sid, { token_usage_total: ..., ... })`). This is
inconsistent and reintroduces a real race: the whole reason the original handoff required
mutating the in-memory `sessionState` object synchronously (which was done correctly) was so this
turn's own prompt-building step reads the right value — but the DB write itself racing against
the rest of the request means a concurrent request (or the user reloading right after a reply) can
still read stale `pending_action`/`current_focus` from Supabase if the write hasn't landed yet.
This is exactly the kind of race the TTL/id-match confirmation gates elsewhere in §6b were built
to guard against — don't leave a gap here.

**Fix:** add `await`:
```ts
if (v2res.classification.focus_shift && sessionState) {
  const newFocus = v2res.classification.focus_shift
  sessionState.previous_focus = sessionState.current_focus || null
  sessionState.current_focus = newFocus
  sessionState.pending_action = null
  await updateSessionState(sessionId, {
    current_focus: newFocus,
    previous_focus: sessionState.previous_focus,
    pending_action: null
  }).catch(err => logger.error(`Failed to update focus in DB: ${err.message}`))
  logger.info(`[Router] Classifier detected focus shift: "${newFocus}"`)
}
```
(Keeping the `.catch` is fine/good — a DB write failure here shouldn't crash the whole turn, same
reasoning as other soft-fail writes in this file — but it must still be awaited so the write is
attempted and completes, or fails, before the function moves on.)

## 4. `src/lib/bot/routerV2.ts` — `focus_shift` doesn't trim or reject blank strings

Current (line ~33):
```ts
focus_shift: typeof obj.focus_shift === 'string' ? obj.focus_shift : null,
```

This accepts a whitespace-only string (e.g. `"focus_shift": "   "`) as a "real" shift, which would
then flow into `chainRouter.ts`'s `if (v2res.classification.focus_shift && sessionState)` check —
a non-empty whitespace string is truthy in JS, so this would trigger a focus update with a garbage
blank label. Low-probability (the model isn't likely to emit this), but cheap to close and the
original handoff asked for a trim.

**Fix:**
```ts
focus_shift: typeof obj.focus_shift === 'string' && obj.focus_shift.trim() ? obj.focus_shift.trim() : null,
```

Apply the same treatment in the salvage/fallback branch's `focus_shift: null` (no change needed
there, it's already `null`, just confirming it stays that way).

**Add unit tests** to `src/lib/bot/routerV2.test.ts` (currently has zero tests for `focus_shift`
despite the original handoff requesting them) — this gap is also why the trim bug wasn't caught
earlier:
- `focus_shift` present and non-empty → passed through trimmed
- `focus_shift: null` in the model output → passed through as `null`
- `focus_shift` absent from the object entirely → defaults to `null`
- `focus_shift` is a whitespace-only string (`"   "`) → `null`
- `focus_shift` is a non-string (e.g. a number) → `null`, not thrown

## Verification checklist (do not skip)

1. `npx tsc --noEmit` clean.
2. Full test suite passes, including the new `routerV2.test.ts` cases for `focus_shift` (item 4
   above) actually added and actually exercising the trim/reject logic.
3. Run `npx tsx -r dotenv/config scripts/eval-classifier-v2.ts` yourself, end to end, and paste the
   **full real output** (not a summary) into your response — every case must show either a match
   or an explicit regression, not "failed to run." Zero regressions required before this is done.
4. Confirm the `await` was added to the `updateSessionState` call in `chainRouter.ts` and that the
   diff matches item 3's fix exactly.
5. Confirm `routerV2.ts`'s `focus_shift` parsing now trims and rejects blank strings, matching
   item 4's fix.
6. Do not touch anything outside `classifier_v2.txt`, `routerV2.ts`, `routerV2.test.ts`,
   `chainRouter.ts`, and `scripts/eval-classifier-v2.ts` — this is a targeted fix round, not a
   broader pass.
