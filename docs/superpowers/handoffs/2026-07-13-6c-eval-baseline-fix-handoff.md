# Handoff: fix eval script's noisy comparison (§6c, final round)

## Context

`scripts/eval-classifier-v2.ts` was fixed once already (regex bug, dotenv loading, rate-limit
delay) and correctly caught 2-3 real-looking regressions on `category`/`complexity`/`action` for
cases 2, 3, and 5 (all headphones/Sony-Bose related). Those were sent back in a fix-round handoff.

**New finding, from independent re-verification:** the "old prompt" side of the comparison is
itself a fresh live model call every time the script runs — `llama-3.1-8b-instant` is not
deterministic, and re-running the exact same script twice (once by the delegate, once
independently) produced **different "old" results for the same case** on cases 2 and 3:

- Case 3 ("what about Sony vs Bose specifically?"), old prompt, run 1: `PRIMARY/normal/false`
- Case 3, old prompt, run 2 (independent re-run, identical script/prompt): `WEB_SEARCH/normal/false`
- Case 3, old prompt, run 3 (this re-verification): `PRIMARY/hard/false`

Three different answers from the SAME prompt on the SAME input across three runs. This means the
eval's "regression" detection has been comparing new-prompt output against a moving, noisy target
— it cannot currently distinguish "the new prompt broke this" from "the model is inherently
inconsistent on this input regardless of which prompt it's given." The 2-3 previously-reported
regressions on cases 2/3/5 are NOT yet trustworthy findings. Case 5 ("back to the headphones
thing...") did flag consistently as a category flip (PRIMARY→WEB_SEARCH) across the two real runs
we have — that one deserves real scrutiny once the eval is fixed — but even that is only 2 data
points, not enough on its own.

**Also fixed, directly, before this handoff (do not undo):** `src/lib/bot/classifier.ts`'s
`classifyIntentV2` was calling all three providers (`runGoogle`/`runGroq`/`runOpenRouter`) with no
`temperature` set, which meant every provider fell back to its conversational default (`0.7`) for
what is supposed to be a low-variance routing decision. Added a `CLASSIFIER_TEMPERATURE = 0.1`
constant and threaded it through all three provider calls (`{ aiApiKey, temperature:
CLASSIFIER_TEMPERATURE }` for Google/Groq, `{ openrouterProvider: ..., temperature:
CLASSIFIER_TEMPERATURE }` for OpenRouter — note OpenRouter's call site previously passed a bare
string as the 6th arg for `openrouterProvider`; it now passes an object, which
`runOpenRouter`'s existing `typeof context === 'string' ? {...} : (context || {})` normalization
already handles correctly, no changes needed there). This is a real, independent fix — it affects
live production classification for every user turn, not just this eval — and reduces (but does
NOT eliminate) the noise problem above.

**Important, tested directly:** even at `temperature: 0.1`, case 3
("what about Sony vs Bose specifically?" as a bare follow-up) still flip-flopped between
`WEB_SEARCH` and `RESEARCH` across 3 repeated calls with the OLD prompt. So this case is not pure
temperature noise — it sits genuinely near the model's decision boundary between those two
categories regardless of temperature. Keep this in mind while building the baseline-recording step
below: if a case still disagrees with itself across 3 baseline runs even at 0.1, that's a real
signal the case itself is ambiguous to this model (possibly worth a clarifying example added to
`classifier_v2.txt` separately, later) — not a sign the baseline-recording approach isn't working.
Don't force such a case to average out to a single answer; the "unstable, no reliable baseline"
label (step 3 below) is the correct outcome for it.

Because temperature is now 0.1 instead of 0.7, re-run everything below fresh — any earlier partial
eval output (including any run already in progress when this update landed) was captured before
the temperature fix and should be discarded, not treated as partial evidence.

## Fix: freeze the baseline instead of re-running the old prompt live each time

Change the comparison so the "old" side is a fixed, one-time-recorded reference, not a fresh live
call:

1. Add a `--record-baseline` mode (or a separate small script/step) that runs ONLY `oldPrompt`
   against all cases, several times each (e.g. 3 runs per case), and writes the result to a JSON
   file (e.g. `scripts/eval-classifier-v2-baseline.json`) — one entry per case with either the
   single stable answer (if all 3 runs agree) or a flag noting the case is itself unstable/noisy
   under the old prompt (if the 3 runs disagree with each other).
2. Change the main eval loop to load that baseline file and compare only the NEW prompt's live
   output against it — no more live `oldPrompt` call in the main comparison loop.
3. For any case flagged as "unstable under the old prompt" in step 1, exclude it from pass/fail
   regression counting (it doesn't have a reliable baseline to regress *from*) but still print its
   new-prompt output for manual read, with a clear label like `⚠️ NO STABLE BASELINE — old prompt
   itself is inconsistent on this case; visually inspect new output for sanity, cannot auto-detect
   regression`.
4. For a case where the baseline WAS stable (all 3 baseline runs agreed) and the new prompt's live
   output differs from it, that is now a trustworthy regression signal — flag it as before.

This does not need to be over-engineered — a plain JSON file checked into the repo (or just kept
locally, this is a dev tool) mapping case index → `{category, complexity, action}` or `null`
(unstable) is sufficient. Reuse the existing `cases` array and prompt strings already in the file;
don't restructure those.

## What to actually report back

1. The full baseline recording run's output (so it's visible which cases were stable vs. noisy
   under the old prompt).
2. The full new-prompt-vs-frozen-baseline comparison output — every case, not a summary.
3. For case 5 specifically (`"ok back to the headphones thing — did you decide between Sony and
   Bose?"`) — this is the one case that showed a consistent PRIMARY→WEB_SEARCH flip across the two
   real (if noisy) runs so far. Pay particular attention to whether it's a real regression once
   compared against a stable baseline, since it's plausible but not yet confirmed.
4. If the frozen baseline reveals a real, reproducible regression anywhere, do not tune the prompt
   further without sending it back for review first — same rule as the previous handoff.

## Verification checklist

1. `npx tsc --noEmit` clean (only matters if the eval script itself is `.ts` — it already is).
2. Baseline file/step exists and its full output is included in your report.
3. Main eval script no longer makes a live call to `oldPrompt` in its per-case comparison loop —
   confirm by reading the diff, not by trusting the report.
4. Full comparison output for all 15 cases included in your report (rate-limit delay from the
   previous fix should already handle most of this — keep the 20s delay, or increase it if cases
   are still dropping to "failed to run").
