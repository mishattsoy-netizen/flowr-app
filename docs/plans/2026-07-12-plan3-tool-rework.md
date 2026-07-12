# Plan 3 — Tool Rework & Reliability (self-contained)

**Audience:** an engineer/model with NO prior context on this codebase. Everything
needed is in this document. Read the "Orientation" section first, then execute
tasks in order. Each task is independent unless a dependency is stated.

**Repo:** Flowr app. Windows, PowerShell primary shell (Bash tool also available).
**Working dir:** the repo root (folder containing `package.json`).

---

## Orientation — how the bot works (read this first)

Flowr has an AI assistant ("Router v2") that answers chat messages and performs
actions on the user's workspace content (tasks, notes, folders, workspaces,
memory). A message flows through this pipeline:

1. **Classifier** — a small model reads the message and outputs JSON
   `{category, complexity, action}`. Categories: `PRIMARY` (chat + actions),
   `WEB_SEARCH`, `RESEARCH`, `IMAGE_GEN`. `complexity` is `normal|hard`.
   `action` is `true` only when the request needs 2+ coordinated tool calls.
2. **Tier selection** — `PRIMARY` requests route to a `PRIMARY_SMART` model chain
   (stronger, e.g. Claude Haiku 4.5) or `PRIMARY_LIGHT` chain (cheaper, e.g.
   Gemini Flash Lite). Rule lives in `src/lib/bot/routerV2.ts` → `selectTier()`:
   `action || complexity==='hard' || extendedThinking → smart, else light`.
3. **Execution** — the chosen model runs with tool-calling enabled. It calls
   tools in a loop (max 4 hops today) until it produces a final text answer.

### Key files (all paths from repo root)

| File | Role |
|---|---|
| `src/lib/bot/tools/definitions.ts` | Tool JSON schemas sent to the model (`FLOWR_TOOLS` array). OpenAI/Google function-calling format. |
| `src/lib/bot/tools/handlers.ts` | Tool implementations. `export const toolHandlers: Record<string, (args, context) => Promise<any>>`. One method per tool name. |
| `src/lib/bot/providers/openrouter.ts` | Runs OpenRouter (Anthropic/OpenAI) models incl. the tool loop. Has `MAX_TOOL_HOPS`. |
| `src/lib/bot/providers/google.ts` | Same for Google Gemini. Has `MAX_TOOL_HOPS`. |
| `src/lib/bot/providers/groq.ts` | Same for Groq. Has `MAX_TOOL_HOPS`. |
| `src/lib/bot/providers/nvidia.ts` | Same for NVIDIA. Has `MAX_TOOL_HOPS`. |
| `src/lib/bot/chainRouter.ts` | Orchestrates the pipeline. Builds `routeContext` (~line 964) passed to every provider. |
| `src/lib/bot/prompts/tools.txt` | Natural-language tool workflow rules injected into the system prompt. |
| `src/lib/bot/prompts/chains/primary.txt` | The PRIMARY chain's behavior prompt. |

### The 7 tools (current)

`list_content` (ONLY reader), `create_content`, `update_content`,
`append_to_note`, `move_content`, `delete_content`, `manage_memory`.

### Ground-truth facts confirmed in the code (do not re-assume — verify if unsure)

- **`create_content` handler** (`handlers.ts` ~line 101) ALREADY has a dedup guard,
  but ONLY for `type === 'workspace' | 'folder' | 'note'` (30-second window,
  matches title+type+parentId). **Tasks are NOT deduped** — this is the gap.
- **`list_content` `taskFilters.dueDate`** (`handlers.ts` ~line 522) only supports
  the literal string `'overdue'` (→ `.lt('due_date', now)`) or an exact-match
  `.eq('due_date', value)`. **No range filtering** ("this week") — this is the gap.
  Schema for `taskFilters` is in `definitions.ts` under `list_content`.
- **`MAX_TOOL_HOPS = 4`** is hardcoded independently in all FOUR provider files.
- **`routeContext`** (`chainRouter.ts` ~line 964) is the object spread into every
  provider call. It already carries `thinkingBudget`, `temperature`, `useTools`.
  Add new per-request signals here.
- Tasks live in Supabase table `tasks`; entities (notes/folders/workspaces) in
  table `entities`. Task IDs look like `task-<timestamp>`; entity IDs like `e<...>`.

### How to run checks (do this after EVERY task)

```bash
npm test            # full vitest suite — must stay green (330 tests as of writing)
npx tsc --noEmit    # typecheck — no new errors in files you touched
```

### Commit discipline

- Commit after each task with a `feat(...)`/`fix(...)` message.
- Use `--no-verify` (pre-commit hooks are slow and not required here).
- **DO NOT push, merge, or run the release script.** Stop and report when all
  tasks are done. The repo owner handles release.
- **DO NOT stage or commit files you did not change for this task.** The owner
  keeps unrelated uncommitted edits in the working tree. Commit only the files
  each task names, e.g. `git add <file1> <file2> && git commit ...`.
- End commit messages with:
  `Co-Authored-By: Claude <noreply@anthropic.com>`

---

## Task 3.1 — Task deduplication guard

**Problem:** Creating a task never checks for an existing identical task, so router
retries or a user repeating themselves produces duplicate tasks (observed:
two "Buy milk" tasks). Notes/folders/workspaces already have this guard; tasks don't.

**File:** `src/lib/bot/tools/handlers.ts`, inside the `create_content` handler.

**What to do:** In the `if (type === 'task')` branch, BEFORE the `insert`, add a
dedup check mirroring the existing entity guard (which is ~line 120, `type ===
'workspace' | 'folder' | 'note'`). Match on: same `title`, same `owner_id`
(`context.userId`), same `entity_id` (= `assignedWorkspaceId || null`), and
`created_at >= 30 seconds ago`. Query the `tasks` table. If a match exists,
return `{ success: true, id: existing[0].id, type: 'task', title, deduplicated: true }`
WITHOUT inserting.

**Why 30s window (not "ever"):** a user legitimately may want two same-named tasks
over time; the guard only kills near-instant duplicates from retries/double-sends.

**Verify:** Add a unit test if a test file for handlers exists (`handlers.test.ts`);
otherwise skip test authoring but confirm `npm test` + `tsc` stay green. Manually
reason through: calling create task "X" twice within 30s → second returns
`deduplicated: true` with the first's id.

**Commit:** `git add src/lib/bot/tools/handlers.ts && git commit --no-verify -m "fix(tools): dedupe task creation within 30s window"`

---

## Task 3.2 — Date-range task filters

**Problem:** "What's due this week?" can't be filtered server-side. The model must
fetch all tasks and eyeball them, which is slow and error-prone. `taskFilters`
supports only exact-date or `overdue`.

**Files:**
- `src/lib/bot/tools/definitions.ts` — add schema fields.
- `src/lib/bot/tools/handlers.ts` — apply the filters.
- `src/lib/bot/prompts/tools.txt` — tell the model the new fields exist.

**What to do:**

1. In `definitions.ts`, inside `list_content`'s `taskFilters` object properties,
   add two optional string fields:
   - `dueAfter`: "Only tasks with due_date on or after this ISO date (inclusive). Use for ranges like 'this week'."
   - `dueBefore`: "Only tasks with due_date on or before this ISO date (inclusive)."

2. In `handlers.ts`, in the `if (args.taskFilters)` block (~line 517), after the
   existing `dueDate` handling, add:
   ```ts
   if (tf.dueAfter) query = query.gte('due_date', tf.dueAfter)
   if (tf.dueBefore) query = query.lte('due_date', tf.dueBefore)
   ```
   Keep the existing `dueDate` (overdue/exact) logic intact — the new fields are
   additive and can combine with `status`/`priority`/`tag`.

3. In `tools.txt`, under the READING & IDs section, add one line:
   "For date ranges (this week, next 3 days), pass taskFilters.dueAfter and
   taskFilters.dueBefore as ISO dates — do not fetch everything and filter yourself."

**Note on dates:** The model already receives current local date + a UTC-conversion
rule via `[CURRENT CONTEXT]` in the prompt (see `promptBuilder.ts`). It computes the
ISO range itself. Do not add server-side "this week" parsing — keep the handler dumb.

**Verify:** `npm test` + `tsc` green. Reason through: `taskFilters: {dueAfter:
"2026-07-13", dueBefore: "2026-07-19"}` → query gains `.gte` and `.lte` on `due_date`.

**Commit:** `git add src/lib/bot/tools/definitions.ts src/lib/bot/tools/handlers.ts src/lib/bot/prompts/tools.txt && git commit --no-verify -m "feat(tools): dueAfter/dueBefore range filters on list_content"`

---

## Task 3.3 — Tier-aware MAX_TOOL_HOPS (shared constant)

**Problem:** `MAX_TOOL_HOPS = 4` is hardcoded in 4 provider files. Complex
multi-step Smart-tier requests (lookup → create task → create note → update
memory = 4+ calls) can hit the ceiling mid-sequence. Also, duplicating the
constant 4× invites drift.

**Files:**
- NEW: `src/lib/bot/toolLoopConfig.ts` — shared constant + resolver.
- `src/lib/bot/providers/openrouter.ts`, `google.ts`, `groq.ts`, `nvidia.ts` —
  replace the local `const MAX_TOOL_HOPS = 4`.
- `src/lib/bot/chainRouter.ts` — pass the tier/hop signal into `routeContext`.

**What to do:**

1. Create `src/lib/bot/toolLoopConfig.ts`:
   ```ts
   // Tool-loop hop ceiling. Smart tier gets more room for multi-step chains;
   // Light tier stays tight (cheap models shouldn't spin).
   export const MAX_TOOL_HOPS_SMART = 8
   export const MAX_TOOL_HOPS_LIGHT = 4

   /** Resolve hop ceiling from the per-request context flag set in chainRouter. */
   export function resolveMaxToolHops(ctx: any): number {
     return ctx?.toolTier === 'smart' ? MAX_TOOL_HOPS_SMART : MAX_TOOL_HOPS_LIGHT
   }
   ```

2. In `chainRouter.ts` where `routeContext` is built (~line 964, the object with
   `useTools`, `thinkingBudget`, etc.), add a field:
   ```ts
   toolTier: (routerV2 && category === 'PRIMARY') ? tier : 'smart',
   ```
   NOTE: `tier` is the `'smart' | 'light'` value computed earlier in the function
   by `selectTier(...)`. If `tier` is not in scope at line 964, search upward in
   the same function for the `selectTier(` call and hoist its result into a
   variable visible here. For non-PRIMARY categories default to `'smart'`
   (preserves today's behavior of 4 hops — see step 3, LIGHT default is 4).
   **Double-check:** the goal is that today's non-v2 / non-PRIMARY paths keep
   exactly 4 hops. If unsure, default `toolTier` such that `resolveMaxToolHops`
   returns 4 for them.

3. In EACH of the 4 provider files, replace `const MAX_TOOL_HOPS = 4` with:
   ```ts
   import { resolveMaxToolHops } from '../toolLoopConfig'
   // ...inside the function, where the old const was:
   const MAX_TOOL_HOPS = resolveMaxToolHops(normContext) // or `context`/`ctx` — match the var name each file already uses for its context object
   ```
   In `openrouter.ts` the context var is `normContext`. In the others, grep the
   file for how the context object is named at the top of the function and use that.

**Verify:** `npm test` + `tsc` green. Confirm each provider still compiles and the
constant resolves. Light PRIMARY → 4, Smart PRIMARY → 8, everything else → 4.

**Commit:** `git add src/lib/bot/toolLoopConfig.ts src/lib/bot/providers/openrouter.ts src/lib/bot/providers/google.ts src/lib/bot/providers/groq.ts src/lib/bot/providers/nvidia.ts src/lib/bot/chainRouter.ts && git commit --no-verify -m "feat(tools): tier-aware MAX_TOOL_HOPS (smart=8, light=4)"`

---

## Task 3.4 — edit_content patch mode (OPTIONAL / higher-risk — do last, gate on owner)

**Problem:** Updating a large note today means `update_content` fully replaces the
body — the model must regenerate the entire note to change one line. Slow and
error-prone on big notes.

**This task is higher-risk and changes model-facing tool surface. DO NOT start it
without confirming with the repo owner that 3.1–3.3 shipped cleanly first.**

**Approach (design only — owner approves before implementing):** Add an optional
`patch` parameter to `update_content` (do NOT create a new tool — extend the
existing one to avoid classifier/tool-count churn). `patch` is an array of
`{find: string, replace: string}` operations applied to the note's current
Markdown body server-side. If `patch` is present, the handler fetches the note,
applies each find/replace in order, and writes back — instead of using `content`.
If both `content` and `patch` are given, `content` wins (full replace).

**Guardrails:**
- If any `find` string is not found in the body, return an error listing which
  ops failed and DO NOT write (atomic — all or nothing).
- Cap patch ops at 20 per call.
- Update `tools.txt` rule 4 to mention: "small edits to a large note → use
  update_content with `patch: [{find, replace}]` instead of resending the whole body."

**Verify:** unit tests for the patch applicator (found/not-found/atomic-fail),
`npm test` + `tsc` green.

**Commit:** `feat(tools): patch mode on update_content for surgical note edits`

---

## Done criteria

- Tasks 3.1, 3.2, 3.3 committed, `npm test` (330+) green, `tsc` clean.
- 3.4 only if owner greenlit after 3.1–3.3.
- Report a summary of what changed. DO NOT push or release.

## Out of scope (future plans — do not touch)

- Deleting legacy THINKING/ADVISOR/CODING categories (separate cleanup plan).
- Context-pack compression, action-state tracking, memory v2, notifications.
- Any change to the classifier prompt or tier-selection rule.
