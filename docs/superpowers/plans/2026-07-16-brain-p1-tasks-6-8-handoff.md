# Handoff: Brain P1 — Tasks 6, 7, 8

You are implementing three tasks from an existing, fully-specced implementation plan. Do NOT redesign, restructure, or "improve" anything — the plan already contains complete code for every step. Your job is to execute it exactly, verify with the commands given, and commit exactly as instructed.

**Read these two files first, in full, before writing any code:**
1. `docs/superpowers/specs/2026-07-14-brain-design.md` — the design these tasks implement.
2. `docs/superpowers/plans/2026-07-14-brain-p1.md` — read the "Global Constraints" and "File Structure" sections at the top, then Tasks 6, 7, and 8 in full (search for `### Task 6`, `### Task 7`, `### Task 8`).

## What's already done (do not touch)

Tasks 1-5 of that plan are complete and committed on `main`:
- Migration applied (brain tables, RLS, `pinned_brain_version`, `bot_memories` import).
- `brainCompiler.ts`, `brainStore.ts` — full CRUD + compile pipeline, unit-tested.
- `[BRAIN]` block injected into the system prompt; old `[USER MEMORY FACT SHEET]` removed.
- `manage_brain` tool replaces `manage_memory` everywhere (tool definitions, handler, `tools.txt`, `outputGuard.ts`, `toolSummary.ts`, `ChatMessage.tsx`'s tool-result card).

You are building Tasks 6-8 ON TOP of this. `brainStore.ts` already exports everything you need: `listBrain`, `addBrainNode`, `updateBrainNode`, `removeBrainNodes`, `restoreBrainNode`, `addBrainEdge`, `removeBrainEdge`, `compileBrain`. Read `src/lib/bot/services/brainStore.ts` to confirm exact signatures before calling them — do not guess.

## Your three tasks (do them in this order — 7 and 8 both depend on brainStore, 8 does not depend on 6 or 7)

### Task 6: Repoint the settings memories UI at brain nodes

Full task spec is in the plan under `### Task 6`. Summary: rewrite the 4 server actions in `src/app/settings/capabilities/actions.ts` (`getBotMemories`, `addBotMemory`, `updateBotMemory`, `deleteBotMemory`) so they read/write `brain_nodes` (type `'memory'`) instead of the old `bot_memories` table. The plan gives you the complete file contents to use — copy them, don't reinvent. Interface (function names/signatures) stays compatible with the existing settings UI that calls these actions — you are only changing what's inside them.

Verify: `npx tsc --noEmit && npx vitest run 2>&1 | tail -3` — must be clean, all tests still passing.

Commit exactly:
```bash
git add src/app/settings/capabilities/actions.ts
git commit -m "feat(brain): settings memories UI now reads/writes memory-type brain nodes"
```

### Task 7: user-brain API route

Full task spec is in the plan under `### Task 7`. Summary: create `src/app/api/ai/user-brain/route.ts` — a new file, `GET` returns `{ nodes, edges, compiledPreview, budget, deletedNodes, availableWorkspaces }` (whatever `listBrain` returns) for the authed user; `POST` handles `{ action: 'add_node' | 'update_node' | 'remove_node' | 'restore_node' | 'connect' | 'disconnect' | 'recompile', ... }` by calling the matching `brainStore` function. The plan gives you the complete route file — use it as written. Auth pattern: Bearer token via Supabase, same as the existing `/api/ai/memory/compact` route (read that file for the pattern if anything is unclear).

**Important naming note from the plan:** there is an existing, UNRELATED `/api/ai/brain/*` route used for admin bot-analysis. Do not touch it, do not confuse it with this one. This new route is `/api/ai/user-brain`.

Verify: `npx tsc --noEmit && npx vitest run 2>&1 | tail -3` — must be clean, all tests still passing.

Commit exactly:
```bash
git add src/app/api/ai/user-brain/route.ts
git commit -m "feat(brain): user-brain API route (GET state, POST mutations)"
```

### Task 8: BrainPanel UI + sidebar button

Full task spec is in the plan under `### Task 8`. Summary: create `src/components/brain/BrainPanel.tsx` (the plan gives you the complete component) and wire a "Brain" button into `src/components/chat/ChatHistoryPanel.tsx`'s header actions row (near the existing "Temp" button, currently around line 119 — re-check the exact line before editing since the file may have shifted slightly) that opens the panel.

This is the P1 UI: deliberately plain — a flat list grouped by section, pin/priority/enable/delete controls per node, a budget meter, a "view as bot sees it" compiled-text toggle, an add-workspace picker, a quick add-memory input, and a recently-deleted/restore list. **Do NOT add canvas rendering, node positioning/dragging, or graph visualization** — that's explicitly out of scope for P1 (it's a later phase, P2). If you're tempted to make it fancier, don't — match what the plan specifies.

Verify: `npx tsc --noEmit && npx vitest run 2>&1 | tail -3` — must be clean, all tests still passing.

Commit exactly:
```bash
git add src/components/brain/BrainPanel.tsx src/components/chat/ChatHistoryPanel.tsx
git commit -m "feat(brain): P1 Brain page — list, toggles, budget meter, compiled preview"
```

## Critical safety rule — read this before touching anything

**The owner works in this same repo in parallel, with uncommitted changes in other files at any given time.** Before you stage anything:

1. Run `git status --short` FIRST, before you start, and note what's already modified/untracked that you did NOT touch. Do not stage, commit, revert, or otherwise interact with those files.
2. When you `git add`, add ONLY the exact file paths listed in each task's commit command above. Never use `git add -A` or `git add .`.
3. Never run `git checkout`, `git restore`, `git reset`, or `git clean` for any reason.
4. If `git status --short` after your changes shows files you didn't intend to touch, STOP and report it rather than staging them.
5. Do not touch `src/lib/bot/tools/definitions.ts` or `ChatMessage.tsx` — those were Task 5's files (already done) and may currently carry the owner's own unrelated uncommitted edits.

## When you're done

Do NOT attempt Task 9 (final verification) — that's reserved. Report back:
- Which of Tasks 6/7/8 you completed, with their commit hashes.
- The exact output of `npx tsc --noEmit` and `npx vitest run 2>&1 | tail -5` after your LAST commit.
- Anything in the plan's code that didn't apply cleanly (e.g. a line-number mismatch, a signature that didn't match brainStore.ts) and what you did about it — do not silently improvise past a mismatch, report it.
- Confirm `git status --short` is clean of anything you introduced (parallel owner work may still show — that's expected and fine, just confirm it isn't yours).
