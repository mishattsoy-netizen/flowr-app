# Fix: §5d refactor silently dropped user-message logging

**Context:** you (or another instance) just implemented `docs/superpowers/handoffs/2026-07-13-5d-telegram-parity-handoff.md` (Telegram album batching + attachment persistence) in `src/app/api/telegram/webhook/route.ts`. That implementation is otherwise correct and verified — `tsc --noEmit` clean, `npm test` 47/47 files / 350/350 tests passing, no other files touched that shouldn't have been. This is a narrow, one-issue follow-up fix, not a redo of that work. Do not re-litigate or restructure anything else in the file.

## The bug

The pre-refactor code had this call, right before the old single `runChain` call site:

```ts
// ── Log incoming user message ──
const usageType = photo ? 'vision' : 'chat'
logWebInteraction(linkedAuthUserId, activePrompt, 'user', usageType, 'success', undefined, requestId, undefined, undefined, activeChatId)
  .catch(e => logger.error('User web log failed', e))
```

When the refactor introduced the `executeAndReply` helper and the album-batching branch, this call was deleted and **never added back anywhere**. Confirm this yourself: `logWebInteraction` is still imported at the top of the file (line ~6) but grepping the file for `logWebInteraction(` now returns zero call sites. The assistant-side logging (`logModelWebMessage`) is still present and working fine inside `executeAndReply` — only the **user's inbound message** log was lost.

**Impact:** every Telegram user message (text or photo, single or from an album) now silently stops being written to `message_logs` as a `role: 'user'` row. This breaks analytics/usage-type tracking (`'vision'` vs `'chat'`) for the user side of every Telegram turn. It's a regression introduced by this refactor, not something the original handoff asked to change.

## The fix

Add the log call back inside `executeAndReply` (in `src/app/api/telegram/webhook/route.ts`), since that function is now the single place both code paths (normal single message, and the album claimer) funnel through before calling `runChain`. Do **not** log it twice — it must fire exactly once per actual `runChain` invocation, which `executeAndReply` already guarantees (non-claimer album invocations return early and never call `executeAndReply` at all).

Inside `executeAndReply(prompt, buffers)`, right before the `const { runChain } = await import(...)` line, add:

```ts
const usageType = buffers && buffers.length > 0 ? 'vision' : 'chat'
logWebInteraction(authId, prompt, 'user', usageType, 'success', undefined, requestId || undefined, undefined, undefined, activeChatId as string | undefined)
  .catch(e => logger.error('User web log failed', e))
```

Notes on the exact call:
- Use `authId` (the local `const authId = linkedAuthUserId!` already defined at the top of `executeAndReply`), not `linkedAuthUserId` directly — matches the pattern the rest of the function already uses for the other logging calls in the same helper.
- Use `prompt` (the helper's own parameter), not `activePrompt` — for the album-claimer path, `prompt` is the batched caption (`claimed.caption || ''`), which is what should be logged as the user's message for that turn, not whatever `activePrompt` happened to hold in the outer scope.
- `usageType` must be derived from `buffers`, the helper's own parameter — not from the outer `photo` variable (which only reflects the *current* single Telegram update, not the full album-claimer's actual attachment count).
- Match the original's trailing-args pattern (`undefined, requestId, undefined, undefined, activeChatId`) — `requestId` and `activeChatId` are still in scope as outer-scope closures inside `executeAndReply`, same as they already are for the other calls in that function.

## Verification checklist

1. Re-run `grep -n "logWebInteraction(" src/app/api/telegram/webhook/route.ts` — should now show exactly one call site (inside `executeAndReply`), plus the import line.
2. `npx tsc --noEmit` — must stay clean.
3. `npm test` — must still show 47/47 files, 350/350 tests (no regression, no new test needed for this — there's no existing webhook-logging unit test to extend).
4. Confirm no other files changed — this should be a single-file, single-hunk diff in `src/app/api/telegram/webhook/route.ts`.
5. Do not touch the spec doc for this — §5d's status/date entry is already correct from the prior pass; this is a bugfix on top of already-shipped work, not a new spec milestone. If you want to note it, a one-line addendum to the existing §5d bug 1/2 write-up is enough (e.g. "(fixed 2026-07-14: user-message logging regression from the initial refactor)") — do not change the ✅ DONE status or dates on the bugs themselves.

## Stop condition

Same as before: fix this one issue, verify, commit, then stop. Do not proceed to §7b or any other spec section.
