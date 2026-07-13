# Handoff: classifier-driven focus-shift detection + read-side fix (§6c reliability fix)

## Context you need

The bot tracks "what topic is the user currently on" in `bot_session_states.current_focus` /
`previous_focus`, injected into the model's prompt each turn as a `[FOCUS]` block. Today the
**only** way this gets updated is the model calling a tool named `update_focus({ focus })` on its
own judgment, per a prompt rule (`tools.txt` rule 12) telling it to call this "on a genuine topic
shift."

Live testing found this fires on roughly **1 in 3** real topic shifts — the model is doing this as
a side task while also composing an answer, and mostly forgets. This handoff does NOT remove the
`update_focus` tool (keep it — a user can still ask "let's focus on X" explicitly, which should
still work). It adds a **second, deterministic path**: the classifier that already runs on every
single turn (`classifyIntentV2` in `src/lib/bot/classifier.ts`) will also emit a focus-shift
judgment, so focus tracking no longer depends on PRIMARY remembering to do it.

**This handoff has two parts, both required — fixing only the first does not change real
behavior.** (1) Write-side: make `[FOCUS]` update reliably (the classifier work below). (2)
Read-side: make the model actually defer to `[FOCUS]` once it's there. Evidence from real
transcripts shows `[FOCUS]` has never once changed a model outcome so far — in the one apparent
success case it was still stale at the moment the right thing happened (a different mechanism,
`[PENDING CONFIRMATION]`'s own instruction, did the work), and in the one clear failure case
`[FOCUS]` was correct and current and the model overrode it anyway using raw history. See the
"Read-side fix" section below — do not skip it.

**Do this only if `pipelineSettings.routerV2Enabled` is true in this deployment.** Check
`src/lib/bot/chainRouter.ts:356` (`const routerV2 = pipelineSettings.routerV2Enabled === true`) —
if the v1 classifier path is what's actually live, stop and flag this back; the plan below only
touches the v2 output schema and prompt.

## What already exists (don't rebuild these)

- `bot_session_states.current_focus` / `previous_focus` columns — already exist (migration
  `20260714_bot_session_action_state.sql`). No new migration needed.
- `getSessionState(sessionId)` / `updateSessionState(sessionId, updates)` —
  `src/lib/bot/context.ts` — use these, don't touch Supabase directly.
- `toolHandlers.update_focus` — `src/lib/bot/tools/handlers.ts:598-611`. This is the reference
  implementation for the shift/clear semantics: read current `current_focus`, move it to
  `previous_focus`, write the new value, and **unconditionally clear `pending_action`** (an
  explicit topic shift drops any outstanding unconfirmed delete/update confirmation — see §6b).
  Your new code must replicate this exact same three-field write, not just `current_focus`.
- `[FOCUS]` block injection in `promptBuilder.ts` — already reads from
  `currentFocus`/`previousFocus` passed in via `PromptBuilderContext`. No changes needed there;
  once session state is updated, the existing injection picks it up automatically next turn.

## What to change

### 1. `src/lib/bot/prompts/chains/classifier_v2.txt`

Current output shape (line 1-2):
```
You are a routing classifier. Output ONLY a JSON object, no prose:
{"category": "...", "complexity": "...", "action": ...}
```

Add a 4th field, `focus_shift`. Proposed shape: `focus_shift: string | null` — a short (≤10 word)
description of the new topic if this message represents a genuine topic shift from what's in
`[FOCUS]`/history, or `null` if the message continues the current topic (including follow-ups,
clarifications, "yes"/"no" answers, and anything that's part of executing a task already in
flight).

Add a new instruction block (model this on the existing `action` block's example-driven style —
it responds well to that format):

```
focus_shift — null UNLESS the user has moved to a clearly different topic/task than immediately
before. A short (max 10 words) description of the NEW topic if so, else null. Do NOT set this for
follow-ups, clarifications, confirmations ("yes", "no", "actually forget that"), or continuations
of the same task using different words.
- "hi" → null (no prior topic to shift from)
- "what's 15% of 340" (previous topic: task creation) → "calculating a percentage"
- "make it due tomorrow instead" (still discussing the same task) → null
- "actually, tell me a fun fact about octopuses" (previous topic: deleting a task) → "learning about octopuses"
- "yes" (answering a pending confirmation) → null
- "can you write me a LinkedIn bio" (previous topic: banana bread recipe) → "writing a LinkedIn bio"
```

Add `focus_shift` to the top-line schema and to every EXAMPLE line at the bottom (all existing
examples should get `,"focus_shift":null` appended — none of the existing examples represent a
topic shift from a prior turn, since they're presented context-free).

**Risk to manage**: this file's existing `category`/`complexity`/`action` instructions are tuned
and presumably routing-tested. Keep the new instruction block clearly separated (its own
paragraph, after `action`'s block, before `ATTACHMENTS`) and do not reword any existing category/
complexity/action instructions or examples beyond appending the `focus_shift` field to them.

### 2. `src/lib/bot/routerV2.ts`

`V2Classification` interface (line 3-7):
```ts
export interface V2Classification {
  category: V2Category
  complexity: 'normal' | 'hard'
  action: boolean
}
```
Add `focus_shift: string | null`.

`parseClassifierV2Output` (line 20-43): in the successful-parse branch (line 28-32), add:
```ts
focus_shift: typeof obj.focus_shift === 'string' && obj.focus_shift.trim() ? obj.focus_shift.trim() : null,
```
In the salvage/fallback branches (line 39 and the final `return null` at line 42), the salvage
path already returns a degraded object on regex-only match — add `focus_shift: null` there too
(a fully malformed response should not attempt a focus shift; same "don't under-provision on
unknown" reasoning the file already documents for `action`, applied conservatively in the other
direction since a false focus shift is worse than a missed one).

### 3. `src/lib/bot/classifier.ts`

`classifyIntentV2`'s return type `ClassifyV2Result` and the `classification` object it builds
(around line 236-245) already just forwards whatever `parseClassifierV2Output` returns as
`final` — once step 2 is done, `v2res.classification.focus_shift` will already be available to
the caller with no further change needed here. Confirm this by reading `ClassifyV2Result`'s
definition near the top of the file before assuming — if it explicitly re-lists fields instead of
using `V2Classification` directly, add `focus_shift` there too.

### 4. `src/lib/bot/chainRouter.ts`

Around line 356-390 (the `routerV2` branch), `v2Flags` is currently typed and built as:
```ts
let v2Flags: { complexity: 'normal' | 'hard'; action: boolean } | null = null
...
v2Flags = { complexity: v2res.classification.complexity, action: v2res.classification.action }
```
Leave `v2Flags` alone (it's used elsewhere for tier/thinking-level selection — don't widen its
type or reuse it for this). Instead, right after that block, add a new step: if
`v2res.classification.focus_shift` is a non-null string, apply the same three-field session-state
write that `toolHandlers.update_focus` does:

```ts
if (v2res.classification.focus_shift) {
  const { updateSessionState } = await import('./context')
  await updateSessionState(sessionId, {
    previous_focus: sessionState?.current_focus ?? null,
    current_focus: v2res.classification.focus_shift,
    pending_action: null,
  })
  if (sessionState) {
    sessionState.previous_focus = sessionState.current_focus ?? null
    sessionState.current_focus = v2res.classification.focus_shift
    sessionState.pending_action = null
  }
}
```

The in-memory `sessionState` mutation matters: `sessionState` was already fetched earlier in this
function (line ~203) and is read again later (line ~484-486) to build the prompt context for
*this same turn*. Without updating the in-memory object too, the DB write would be correct for
the *next* turn but this turn's `[FOCUS]` block would still show stale data — worse, it'd show
different focus than what's about to be true, and this turn wouldn't even benefit from the shift
it just detected. Confirm the exact shape of `sessionState` (`SessionState` interface in
`context.ts:5-15`) matches this direct-mutation approach; it's a plain object, not a class, so
this should be safe, but verify no readonly/frozen semantics were added elsewhere.

Place this new block immediately after the existing `v2Flags = {...}` assignment (~line 385),
still inside the `if (routerV2)` branch, before `classifierModel = v2res.classifierModel`.

### 5. Interaction with `update_focus` tool (don't double-fire)

If the classifier sets a focus shift AND the model also calls `update_focus` in the same turn
(possible — nothing stops both), the tool call runs later in the turn and will simply overwrite
`current_focus`/`previous_focus` again with its own value, which is fine — last-write-wins, no
special-casing needed. Do not add any suppression logic; this is an acceptable, rare, harmless
overlap.

## Required gate: offline routing-regression eval (do not skip — this is the actual risk check)

Unit tests on `parseClassifierV2Output` verify the parser accepts the new field; they CANNOT
detect whether adding `focus_shift`'s instructions to `classifier_v2.txt` degrades the model's
`category`/`complexity`/`action` judgment — that's a real model-behavior risk, not a parsing risk,
and nothing else in this handoff catches it.

Build a small offline eval script (put it in `scripts/` or similar, doesn't need to be permanent):
1. Pull ~15-20 `(message, last-8-turn history) → expected {category, complexity, action}` cases
   directly from the transcript files under `transcripts/` — these are real production inputs with
   real classifier outputs already observed, no need to invent synthetic cases. Include a mix: a
   few from this session's known-tricky moments (task creation, delete request, the octopus
   topic-shift, the three missed shifts) plus a few unrelated ones for baseline coverage.
2. Run each case's `(message, history)` through `classifyIntentV2` twice: once against the
   CURRENT (pre-change) `classifier_v2.txt`, once against the NEW one.
3. Diff `category`/`complexity`/`action` between the two runs for every case. Any case where these
   three fields differ between old and new prompt is a potential regression — investigate before
   proceeding; do not just eyeball `focus_shift`'s output and call it done.
4. Spot-check `focus_shift` itself on the topic-shift cases (does it correctly flag the octopus
   shift, the banana-bread shift, etc., and correctly say `null` on the "yes" turn and on plain
   continuations) — this is the actual feature under test, but it does not matter if it comes at
   the cost of regressing the three existing fields.

If any of `category`/`complexity`/`action` regress on a real case, do not ship — report back with
the specific case(s) instead of tuning the prompt further without review.

## Testing

- Add unit tests to `src/lib/bot/routerV2.test.ts` (or wherever `parseClassifierV2Output` is
  currently tested — check first) for: `focus_shift` present and non-empty → passed through
  trimmed; `focus_shift: null` → passed through as `null`; `focus_shift` absent from the object →
  defaults to `null`; `focus_shift` non-string (e.g. a number) → `null`, not thrown.
- `chainRouter.ts` currently has NO test file (`src/lib/bot/chainRouter.test.ts` does not exist) —
  it is a large, heavily-integrated function with many external calls (Supabase, model providers,
  compaction). Do not attempt to create a full test file for it as part of this handoff; that's a
  much bigger undertaking than this fix and out of scope. Instead:
  - Keep the new logic block (step 4) as a small, easily-eyeballed diff — a plain `if` reading
    `v2res.classification.focus_shift` and calling `updateSessionState` + mutating `sessionState`,
    mirroring `toolHandlers.update_focus`'s existing three-field write exactly. Its correctness
    should be verifiable by direct comparison against `handlers.ts:598-611`, not by a new test
    harness.
  - If you want incremental test coverage without building full `chainRouter.ts` mocking
    infrastructure, consider extracting the three-field write (previous←current, current←new,
    pending_action←null) into a small exported helper — e.g. `applyFocusShift(sessionState,
    newFocus)` returning the update object — that both `chainRouter.ts` and, in a future cleanup,
    `toolHandlers.update_focus` could share. This is optional; only do it if it's a clean small
    extraction, not a larger refactor. If done, test the helper directly (pure function, no mocks
    needed) instead of trying to test `chainRouter.ts` as a whole.
- Do NOT modify or weaken any existing `classifier_v2.txt`-adjacent test that checks
  `category`/`complexity`/`action` parsing — those must still pass unchanged, since regressing
  those would be worse than the problem this handoff fixes.

## Read-side fix (do this too — evidence shows the write-side fix alone won't change behavior)

Investigation found `[FOCUS]` has never actually changed a model outcome in the real evidence
available. In the one apparent "success" (transcript `ai-transcript-2026-07-13T15-19-07.md`), the
model correctly abandoned a pending delete and answered a new question — but `[FOCUS]` was still
STALE at that exact moment (still showed the old topic); what actually drove the correct behavior
was `[PENDING CONFIRMATION]`'s own instruction text ("if the topic changed... drop it and address
whatever they actually said"), not `[FOCUS]`. Then two turns later
(`ai-transcript-2026-07-13T15-19-25.md`), `[FOCUS]` was CORRECT and CURRENT ("Current: Learning
fun facts about octopuses") sitting directly above a bare "yes" — and the model ignored it
entirely, re-derived "yes → delete the earlier task" from raw history, and executed it. So raising
`[FOCUS]`'s fire-rate (the classifier work above) makes a hint more often present that the model
has been directly observed overriding. Do these two prompt changes alongside the classifier work,
or the write-side fix won't move real behavior:

### A. `src/lib/bot/prompts/system_prompt.txt` line 13

Current:
```
- Vague follow-ups ("do it again", "add it there", an unnamed "it"): resolve the reference from conversation flow — usually the immediately previous turn, or older context when the logic clearly points there. Act on the resolved intent; don't ask the user to restate.
```

This is the exact rule that won the passport incident — "resolve from conversation flow, usually
the immediately previous turn" is precisely how the model reached back past a topic shift to
re-derive "yes → delete." Add an explicit carve-out:

```
- Vague follow-ups ("do it again", "add it there", an unnamed "it"): resolve the reference from conversation flow — usually the immediately previous turn, or older context when the logic clearly points there. Act on the resolved intent; don't ask the user to restate. EXCEPTION: if a [FOCUS] block is present, it is a stronger signal than raw conversation flow — a vague follow-up refers to the CURRENT focus topic, not to something from before the last focus shift, unless the user's wording explicitly points elsewhere (e.g. names the earlier thing directly).
```

### B. `src/lib/bot/prompts/tools.txt` rule 12

Current (line 26):
```
12. Call update_focus whenever the user's intent meaningfully shifts to a new subject (e.g. "actually, let's work on X instead") or when they explicitly return to something discussed earlier ("back to that note"). Don't call it on simple continuations of the same topic. Fire it alongside other tools — it does not interrupt the flow. When a [FOCUS] block is present, you always reason from it as ground truth rather than re-deriving topic from raw history.
```

The ground-truth clause is already there but is the last, easiest-to-skim-past sentence in a rule
about calling a tool. Split it into two sentences with the ground-truth instruction leading,
stated as a hard constraint rather than a trailing note:

```
12. When a [FOCUS] block is present, treat it as ground truth for what the user is currently doing — including when resolving a vague follow-up like a bare "yes"/"no". Do NOT re-derive the current topic from raw conversation history if [FOCUS] says otherwise; a bare confirmation refers to whatever [FOCUS] or [PENDING CONFIRMATION] currently describes, not to an older exchange. Separately: call update_focus whenever the user's intent meaningfully shifts to a new subject (e.g. "actually, let's work on X instead") or when they explicitly return to something discussed earlier ("back to that note"). Don't call it on simple continuations of the same topic. Fire it alongside other tools — it does not interrupt the flow.
```

**This is a prompt-behavior change, not just a schema change — same risk category as the
classifier prompt edit.** Verify with the same kind of check: re-run a few of the transcript
scenarios (at minimum, replicate the shape of the `15-19-25` bare-"yes" turn — pending confirmation
for one item, unrelated current focus, bare "yes" — and confirm the model now either asks for
clarification or acts on the [FOCUS]-consistent interpretation, not the stale pending one) against
the new prompt before considering this done. This can be a manual/scripted prompt replay, not
necessarily a new automated test.

## Explicitly out of scope for this handoff

- Do not touch the `update_focus` tool's handler itself — it stays as-is.
- Do not add a new model call. `focus_shift` must ride on the existing per-turn
  `classifyIntentV2` call — if implementing this requires a second call, stop and report back
  instead of adding one silently.

## Verification checklist for whoever reviews this (do not skip)

1. `npx tsc --noEmit` clean.
2. Full test suite passes, with the new tests actually exercising the new code (not just
   asserting `true`).
3. Read `classifier_v2.txt`'s full diff — confirm no existing category/complexity/action wording
   was altered, only additions.
4. Manually trace one full example through `parseClassifierV2Output` → `chainRouter.ts`'s new
   block → confirm the exact three-field session-state write matches `update_focus`'s handler
   semantics (previous ← old current, current ← new value, pending_action ← null). Since
   `chainRouter.ts` has no test file, this is a read-the-diff-side-by-side check against
   `handlers.ts:598-611`, not something a test will catch for you.
5. Confirm the in-memory `sessionState` mutation happens BEFORE `sessionState` is read again for
   this turn's prompt-building (~line 484-486), so the shift is reflected same-turn.
6. Confirm the offline routing-regression eval (required-gate section above) was actually run,
   not skipped, and that no case regressed `category`/`complexity`/`action` between old and new
   `classifier_v2.txt`. Ask for the eval output/diff if it isn't provided — do not accept "I tested
   it and it seemed fine" without seeing the actual per-case comparison.
7. Confirm BOTH read-side prompt changes (§A `system_prompt.txt` line 13, §B `tools.txt` rule 12)
   were made — this handoff's core finding is that the write-side fix alone (classifier detection)
   does not change behavior; if only the classifier/schema changes shipped and the two prompt
   files are untouched, this handoff is incomplete regardless of how clean the tests are.
8. Re-check the `15-19-25`-shaped scenario (pending confirmation for one item + unrelated current
   [FOCUS] + bare "yes") against the new prompts before calling this done — this is the exact
   failure this handoff exists to fix, so this specific case must be re-verified, not assumed
   fixed from the wording change alone.
