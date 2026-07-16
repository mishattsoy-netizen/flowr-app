# Handoff: Brain P2a — Tasks 4, 5, 6, 7

You are implementing four tasks from an existing, fully-specced implementation plan. Do NOT redesign, restructure, or "improve" anything — the plan already contains complete code for every step. Your job is to execute it exactly, verify with the commands given, and commit exactly as instructed.

**Read these two files first, in full, before writing any code:**
1. `docs/superpowers/specs/2026-07-16-brain-presets-design.md` — the design these tasks implement.
2. `docs/superpowers/plans/2026-07-16-brain-p2a-presets.md` — read the "Global Constraints" and "File Structure" sections at the top, then Tasks 4, 5, 6, and 7 in full (search for `### Task 4`, `### Task 5`, `### Task 6`, `### Task 7`).

## What's already done (do not touch)

Tasks 1-3 of that plan are complete and committed on `main`:
- Migration applied to the live database: `brains` table exists; `brain_nodes`/`brain_edges` have a NOT NULL `brain_id` column; `bot_session_states` has `active_brain_id`. Verified live: 3 existing users backfilled into an auto-created "Main" brain each, 0 rows left with a null `brain_id`.
- `src/lib/bot/services/brainStore.ts` — every function is now scoped to `brain_id`, not just `user_id`. New exports you'll use: `getOrCreateDefaultBrain(userId)`, `listUserBrains(userId)`, `createBrain(userId, title, description?)`, `updateBrainMeta(userId, brainId, updates)`, `deleteBrain(userId, brainId)`, `assertOwnedBrain(userId, brainId)`, `switchActiveBrain(sessionId, userId, brainId)`. Every P1-era function (`listBrain`, `addBrainNode`, `updateBrainNode`, `removeBrainNodes`, `restoreBrainNode`, `addBrainEdge`, `removeBrainEdge`, `compileBrain`) now takes a `brainId` parameter it didn't take before — **read the actual current file before calling any of them, do not assume the old P1 signatures.**
- `src/lib/bot/context.ts` — `SessionState` has a new `active_brain_id: string | null` field.
- `src/lib/bot/chainRouter.ts` — already resolves which brain is active for a session (server-persisted `active_brain_id` first, then `context.activeBrainId` from the client, then lazily creates the user's default "Main" brain) before injecting the `[BRAIN]` block. You do not need to touch this file for Tasks 4-7.

You are building Tasks 4-7 ON TOP of this. Task 4 fixes `manage_brain`'s tool handler (currently broken — it still calls the old brainStore signatures and **will not compile** until you fix it). Task 5 fixes the `user-brain` API route (same problem). Tasks 6 and 7 are new UI: a message-bar pill to pick/switch the active brain, and a brain switcher in the existing Brain page.

**Current build status when you start:** `npx tsc --noEmit` will show real errors in exactly two files — `src/lib/bot/tools/handlers.ts` and `src/app/api/ai/user-brain/route.ts` — because Tasks 1-3 changed brainStore's function signatures and these two files still call them the old way. This is expected and exactly what Tasks 4 and 5 fix. Do not be alarmed by this when you first run tsc.

## Your four tasks (do them in this order — Task 4 and 5 are independent of each other but must both land before tsc is clean; Task 6 depends on Task 5's route; Task 7 depends on Task 5's route)

### Task 4: `manage_brain` tool — resolve brainId from the active session

Full task spec is in the plan under `### Task 4`. Summary: `src/lib/bot/tools/handlers.ts`'s `manage_brain` method needs a `brainId` resolved at the top (from the session's `active_brain_id`, falling back to `getOrCreateDefaultBrain`) and passed into every brainStore call it makes. **The tool itself gets NO new parameter** — it never lets the model address a brain by name; it always operates on whatever brain is active for the current chat session. This is an explicit design decision (spec §4) — do not add a `brain_id` argument to the tool definition.

There are TWO places in this method that resolve `supabaseAdmin`/`brain` — one in an early "multi-id confirmed" branch, one in the main body. Both need their own `brainId` resolution; the plan's Task 4 spells out the exact before/after code for each.

Verify: `npx tsc --noEmit` (handlers.ts should now be clean; route.ts will still show errors until Task 5) and `npx vitest run src/lib/bot/tools/handlers.brain.test.ts 2>&1 | tail -10` (must still pass — these tests use `sessionId: 'temp'` which never touches Supabase, so the gate logic should behave identically to before).

Commit exactly:
```bash
git add src/lib/bot/tools/handlers.ts
git commit -m "feat(brain): manage_brain resolves brainId from session's active brain"
```

### Task 5: `user-brain` API route — brain_id everywhere + brain management actions

Full task spec is in the plan under `### Task 5`. Summary: replace the entire contents of `src/app/api/ai/user-brain/route.ts` with the plan's version. `GET` now accepts an optional `?brain_id=` query param (defaults to the user's Main brain) and also returns the user's full brain list (`{ ...state, brains }`). `POST` gains five new actions on top of the existing ones: `list_brains`, `create_brain`, `update_brain`, `delete_brain`, `switch_active_brain`.

Verify: `npx tsc --noEmit` (must be fully clean now — this was the last file with brainStore signature errors) and `npx vitest run 2>&1 | tail -10` (should show 479 passing, 3 skipped — the 3 skipped are the brain_id isolation test, which needs a live Supabase connection this test environment doesn't have; that's expected, not a failure).

Commit exactly:
```bash
git add src/app/api/ai/user-brain/route.ts
git commit -m "feat(brain): user-brain route -- brain_id everywhere + brain CRUD actions"
```

### Task 6: Message-bar pill — pick/swap active brain

Full task spec is in the plan under `### Task 6`. This is the largest task — it touches three files: `src/data/store.ts`, `src/app/api/ai/chat/route.ts`, and `src/components/assistant/AIAssistant.tsx`. Read the plan's Task 6 carefully, step by step; it gives you exact `find this / replace with` instructions for each file rather than one giant diff, because these files are large and you need to locate the right insertion points precisely.

Key things NOT to get wrong (the plan explains why in each case, re-read if anything here is unclear):
- The pill subsumes BOTH "pick a brain before your first message" and "switch brains mid-conversation" — there is no separate new-chat page in this codebase to put picker cards on, so don't try to build one.
- A mid-session swap must call `switch_active_brain` (which updates BOTH `active_brain_id` and `pinned_brain_version` together) — never just update the client's local `activeBrainId` state and assume that's enough. If you only update client state without calling the API, the session will keep serving the OLD brain's compiled `[BRAIN]` block silently.
- `AIMessage.role` already supports `'system'` as a valid value (defined in `src/data/store.types.ts`) — you do NOT need to widen any type to add the "Switched to X brain" divider message. Check `ChatMessage.tsx` for whether a `'system'`-role rendering path already exists before adding a new one.

Verify: `npx tsc --noEmit && npx vitest run 2>&1 | tail -10` — must be clean, same pass count as after Task 5 (this task adds no new automated tests; it's UI-only, verified live later).

Commit exactly:
```bash
git add src/data/store.ts src/app/api/ai/chat/route.ts src/components/assistant/AIAssistant.tsx
git commit -m "feat(brain): message-bar pill for picking/swapping the active brain"
```

**⚠️ Before staging `src/data/store.ts` and `src/components/assistant/AIAssistant.tsx`:** run `git diff` on both files first and confirm the diff contains ONLY the changes described in the plan's Task 6. These are large, actively-developed files — if you see unrelated hunks that aren't yours, they belong to the owner's parallel work; stage the whole file anyway (unavoidable when changes are interleaved in the same file) but say so explicitly in your report so it's not a silent surprise.

### Task 7: Brain page — brain switcher + scoped views

Full task spec is in the plan under `### Task 7`. Summary: modify `src/components/brain/BrainPanel.tsx` to add a brain switcher (a dropdown in the header, replacing the static "Brain" title) plus "+ New Brain" and "Delete Brain" controls. Every existing mutate call in this component needs to include `brain_id: selectedBrainId` in its request body — the plan's Task 7 gives you the exact updated `mutate` function for this.

This is UI-only, plain — matching the existing P1 panel's deliberately simple style (no canvas, no drag/drop, no graph). If you're tempted to make it fancier, don't.

Verify: `npx tsc --noEmit && npx vitest run 2>&1 | tail -10` — must be clean, same pass count as after Task 6.

Commit exactly:
```bash
git add src/components/brain/BrainPanel.tsx
git commit -m "feat(brain): brain switcher + create/delete in the Brain page"
```

## Critical safety rule — read this before touching anything

**The owner works in this same repo in parallel, with uncommitted changes in other files at any given time.** Before you stage anything:

1. Run `git status --short` FIRST, before you start, and note what's already modified/untracked that you did NOT touch. Do not stage, commit, revert, or otherwise interact with those files.
2. When you `git add`, add ONLY the exact file paths listed in each task's commit command above. Never use `git add -A` or `git add .`.
3. Never run `git checkout`, `git restore`, `git reset`, or `git clean` for any reason.
4. If `git status --short` after your changes shows files you didn't intend to touch, STOP and report it rather than staging them.
5. As of this handoff being written, `src/data/store.ts` and `src/components/assistant/AIAssistant.tsx` (Task 6's files) have NO owner uncommitted changes — they should be clean when you start. If they're NOT clean when you actually begin, the owner has started new work there since this handoff was written; proceed carefully and flag it in your report rather than assuming it's safe to overwrite.
6. Do NOT touch `src/lib/bot/services/brainStore.ts`, `src/lib/bot/context.ts`, `src/lib/bot/chainRouter.ts`, or the migration file — those are Tasks 1-3, already done.

## When you're done

Do NOT attempt Task 8 (final verification) — that's reserved. Report back:
- Which of Tasks 4/5/6/7 you completed, with their commit hashes.
- The exact output of `npx tsc --noEmit` and `npx vitest run 2>&1 | tail -10` after your LAST commit.
- Anything in the plan's code that didn't apply cleanly (a line-number mismatch, a signature that didn't match the current brainStore.ts, an import that didn't exist where expected) and what you did about it — do not silently improvise past a mismatch, report it exactly.
- For Task 6 specifically: confirm whether `git diff` on `store.ts`/`AIAssistant.tsx` showed only your changes, or whether owner work was interleaved in (see safety rule 5).
- Confirm `git status --short` is clean of anything you introduced (parallel owner work may still show — that's expected and fine, just confirm it isn't yours).
