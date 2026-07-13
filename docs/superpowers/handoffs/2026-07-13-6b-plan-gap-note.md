Your §6b plan looks correct and ready to execute as written — go ahead and implement it. One addition before you consider verification complete:

**Add `update_content`'s dry-run path to your verification, not just `delete_content`'s.**

Your test plan (and the `outputGuard.test.ts` extension) only mentions confirming `hasUngroundedActionClaim` correctly returns `true` (ungrounded) after a `delete_content` dry-run-only turn. But Step 4 of your own plan adds the exact same dry-run shape to `update_content`'s full-replace path (no `.error` field, so `success` still comes out `true` via the `!output?.error` spread in all 4 providers) — meaning it has the identical bug surface the output-guard fix in Step 6 exists to close. The code fix itself already covers both (the `status !== 'pending_confirmation'` check in `hasUngroundedActionClaim` isn't tool-specific), but your test/manual-trace list should prove that, not just assume it from code-reading.

Concretely, add:
1. A second case in your `outputGuard.test.ts` extension: a captured call with `tool: 'update_content'`, `status: 'pending_confirmation'`, `success` truthy (no `.error`) → `hasUngroundedActionClaim` must still return `true` when the reply text claims a completed edit.
2. A manual trace line: `update_content({ id, content: "..." })` with no `confirmed` → dry-run response, `pending_action` written → if the model's reply claims the edit is done anyway, the grounding guard catches it (same as the `delete_content` case).

Everything else in the plan (migration, `SessionState` extension, the `delete_content` rewrite, the `update_content` gate itself, schema updates, prompt injection, `tools.txt`) is correctly scoped — no other changes needed. Proceed.
