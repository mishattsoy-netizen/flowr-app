# Manual test plan: §6c focus tracking (`update_focus`)

Run these in a single continuous chat session (web or Telegram — either works, `[FOCUS]` injection is chain-agnostic). Do them **in order** within one session; each builds on the previous turn's state. This tests reliability, not just the happy path — some tests are designed to see if the model skips a call it should have made.

## What you're actually verifying

The feature has three separable claims. Test each one, because a model can nail one and quietly fail another:
1. **Capture** — does the model call `update_focus` when the topic genuinely shifts?
2. **Recall** — when the user explicitly returns to an earlier topic, does the bot correctly resume it instead of confusing it with the most recent thing?
3. **Clearing** — does an unrelated topic shift correctly drop a stale pending confirmation, so a stray "yes" later doesn't accidentally execute something old?

If you have DB access (Supabase table editor), the strongest verification is checking `bot_session_states.current_focus` / `previous_focus` directly after each turn — that tells you what actually got written, independent of whether the bot's *reply text* sounds right. Both matter: the column proves the mechanism fired; the reply proves the model is actually using it to reason, not just calling it as a checkbox.

---

## Test 1 — Baseline: no premature focus-setting

**Send:** `hey`

**Expected:** Normal greeting. **Check the DB** (or just proceed) — `current_focus`/`previous_focus` should still be `null`. A single greeting is not a topic worth marking.

*Fail signs:* bot calls `update_focus` on a trivial "hey" — means rule 12 in `tools.txt` is firing too aggressively (over-triggering wastes tool calls and would eventually make `[FOCUS]` noisy/useless).

---

## Test 2 — Capture on genuine topic start

**Send:** `help me research the best noise-cancelling headphones under $300`

**Expected:** Bot researches/responds normally. **Check DB:** `current_focus` should now be non-null and should describe this task (e.g. "researching noise-cancelling headphones under $300"). `previous_focus` should still be `null` (nothing to shift *from* yet).

*Fail signs:* `current_focus` stays null — the model didn't call `update_focus` on a genuine new multi-step task starting. This is the core capture behavior; if this fails, the feature isn't working at all.

---

## Test 3 — Continuation does NOT re-trigger unnecessarily

**Send:** `what about Sony vs Bose specifically?`

**Expected:** This is a continuation of the same research topic, not a shift. **Check DB:** `current_focus` should be unchanged (or very similar/still headphones-related) — `previous_focus` should still be `null`, because nothing actually shifted.

*Fail signs:* `previous_focus` gets populated here — means the model treated a same-topic follow-up as a topic shift, which would start polluting `previous_focus` with noise instead of a real "prior topic."

---

## Test 4 — Real shift: capture + push old focus to previous

**Send:** `actually forget that, let's create a task instead: "renew passport" due next Friday`

**Expected:** Task gets created. **Check DB:** `current_focus` should now describe the passport task, and **`previous_focus` should now contain the headphones research topic** — this is the key mechanic: the old current became previous, not discarded.

*Fail signs:* `previous_focus` is still `null`, or `current_focus` didn't update — means the "actually, let's do X instead" signal wasn't recognized as a topic shift. This is the single most important test — it's the exact failure pattern from the original bug transcript (bot mixing unrelated topics together).

---

## Test 5 — Recall: explicit return to the earlier topic

**Send:** `ok back to the headphones thing — did you decide between Sony and Bose?`

**Expected:** Bot should resume the headphones discussion coherently, referencing what was actually discussed (not asking "what headphones thing?" or inventing new context). **Check DB:** `current_focus` should now describe headphones again, `previous_focus` should now hold the passport-task topic (they swap).

*Fail signs:* Bot asks for clarification about what "the headphones thing" means, or answers as if the passport task is still the topic — this is the "wdym canvas blocks"-style confusion the feature exists to prevent. If this fails, `[FOCUS]`'s `Previous:` field either isn't being injected correctly or the model isn't using it.

---

## Test 6 — Interaction with pending confirmations (the §6b/§6c link)

This tests the specific rule: an explicit topic shift must drop a stale pending confirmation, so it can't be silently executed later.

**Send:** `delete the passport task`

**Expected:** Bot does NOT delete immediately — it dry-runs and asks for confirmation (per §6b). Do not confirm yet.

**Then send:** `actually, tell me a fun fact about octopuses instead`

**Expected:** Bot answers the octopus question, treating this as a clear topic shift. **Check DB:** `pending_action` should now be `null` (dropped), and `current_focus`/`previous_focus` should reflect the shift to the octopus topic.

**Then send:** `yes`

**Expected:** This is the critical check. The bare "yes" must **NOT** delete the passport task — there's no live pending action for it to confirm anymore, and the topic has moved on. The bot should either ask "yes to what?" or treat it as an unclear/no-op reply, but must not delete anything.

*Fail signs:* the passport task actually gets deleted after the unrelated "yes" — this is the exact "silently executes later" bug the §6b/§6c interaction rule exists to prevent, and would be a serious regression, not just a UX miss. If you see this, stop and flag it immediately — don't continue the test sequence.

---

## Test 7 — Multiple shifts, spot-check `previous_focus` doesn't accumulate stale garbage

**Send 3 more unrelated things in a row**, e.g.:
- `what's a good recipe for banana bread?`
- `switch topics — help me write a short bio for my LinkedIn`
- `one more switch — what's the weather like in Tokyo in October?`

**Expected:** After each, `current_focus` updates to the new topic and `previous_focus` holds only the *immediately preceding* one — not a running list, not the headphones topic resurfacing from 5 turns ago. This confirms the "2 values, not a stack" design (per your own earlier decision) behaves correctly under repeated rapid shifting, rather than drifting or getting stuck on an old value.

*Fail signs:* `previous_focus` stops updating after a few shifts (stuck on an old value), or reverts to something from much earlier in the conversation.

---

## Reliability note — this is a model call, run it more than once

Because `update_focus` firing depends on the model's own judgment (not a deterministic keyword trigger — that was a deliberate design choice, see spec §6b), **a single pass through this test isn't a real reliability signal**. Run the full sequence at least 2-3 times (fresh sessions each time) before concluding the feature is reliable vs. flaky. If capture (Test 2/4) or recall (Test 5) fails intermittently rather than consistently, that's a prompt-tuning issue (rule 12 in `tools.txt` may need to be more directive), not a code bug — worth telling me which specific test failed and how often, since that changes what the fix looks like.
