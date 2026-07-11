# Flowr AI Bot Rework — Design

Date: 2026-07-11
Status: Approved pending final review
Scope: Bot pipeline (`src/lib/bot/**`), Telegram webhook, chat API route, Router admin, notifications.

## 1. Goals

- Stability and consistency of the bot's execution and output quality.
- Useful-first personal assistant: handles low-context requests by knowing the user's workspaces, tasks, and profile.
- Memory that improves with use, captured automatically, injected invisibly.
- Honest grounding: the bot never claims an action it did not perform.
- Simpler routing: fewer categories, fewer prompts, fewer places to drift.

Non-goals (explicitly out of scope for this rework):
- Daily/morning briefs.
- Gemini-style scheduled actions (the notifications scheduler is designed so these can ride on it later).
- Email / Apple Messages delivery (provider abstraction only; Telegram + in-app ship in v1).
- New end-user UI beyond: workspace description field, notification surfaces, admin tier lists.

## 2. Category model (routing)

Classifier output shrinks from 9 categories to **4 + a flag**:

| Category | Pipeline |
|---|---|
| PRIMARY | Chat + tools. Replaces REGULAR, COMPLEX, ADVISOR, THINKING, CODING. |
| WEB_SEARCH | Search step → synthesis (unchanged shape). |
| RESEARCH | Iterative deep research (unchanged shape). |
| IMAGE_GEN | Prompt expansion → image provider → narration. |

Plus two flags returned alongside the category:

- `complexity: normal | hard` — drives the thinking value (§3) and tier choice (§4).
- `action: true | false` — does the request require reading or writing app content (tasks, notes, workspaces, memory)? Drives tier choice (§4). When in doubt the classifier says `true`; a chat turn on the Smart tier costs a little more, but an action turn on the Light tier fails.

Deleted: ADVISOR (mode, gate, prompt, `advisor.ts` flow), THINKING (category, `thinkChain.ts` pre-pass, `thinking.txt`), CODING (category, `coding.txt`, hardware-misroute regex guard), MEDIUM_THINKING/FAST_SIMPLE legacy aliases.

Advisor behavior is retained as a PRIMARY prompt rule: for large or genuinely ambiguous requests, propose a short plan or ask 1–2 targeted questions inline; otherwise act.

### Classifier fixes

- The "<10 words = follow-up, inherit previous classification" heuristic is removed. Follow-up inheritance only fires on an explicit short list ("try again", "retry", "redo", "one more"). "yes"/"no"/short confirmations are resolved against pending-action state (see §6), never re-classified from history.
- Keyword fast-path regex tightened (no more 5-wildcard-words-between matching).
- `augmentSearchQuery` bug fix: `split(/s+/)` → `split(/\s+/)`.

## 3. Thinking = native values only

The THINKING chain and `runThinkChain` pre-pass are deleted. Reasoning depth is a **request parameter**, mapped per provider:

- Gemini: `thinkingBudget`
- OpenRouter/OpenAI-style: `reasoning.effort`
- Groq (supported models): `reasoning_effort`

Two presets:

- **Regular** (default): medium / provider default budget.
- **Extended**: maximum value available for that model.

Trigger: user toggle (forces Extended) OR classifier `complexity: hard` (auto-escalates). Models with no reasoning support cannot serve Extended-required turns; the chain skips to one that can.

## 4. PRIMARY chain: two tiers

Router admin shows PRIMARY as two visually separate sub-chains, each with its own ordered, toggleable model list:

- **PRIMARY · Smart** — strong models. Used when the turn needs tools, complexity is hard, or Extended is on.
- **PRIMARY · Light** — cheap/free models. Used only for pure conversation (no tools, normal complexity).

Selection rule (router, not prompt): `action || hard || extended → Smart; else → Light` (flags from §2). Light-tier total failure escalates to Smart. Smart never falls back to Light — a tool-using turn must never land on a small model.

One PRIMARY prompt replaces `regular.txt` + `complex.txt`.

## 5. Context pack (injected user state)

Every tool-enabled turn receives a compact server-computed block:

- **Workspace map**: for each workspace — title, id, one-line description, note/task counts.
- **Task snapshot**: counts + titles of tasks due today and overdue.
- **Recent activity**: last few touched items.
- Current local time (existing date context stays).

Workspace descriptions: new field on workspaces; AI-drafted from workspace contents, user-editable in workspace settings.

**Anti-nagging rule (hard, in prompt):** the pack is background awareness. Never volunteer it, never open with reminders, never mention overdue counts unprompted. Surface schedule facts only when (a) the user asks about tasks/schedule, or (b) they are creating/scheduling something that directly conflicts. Use memories implicitly; never say "I remember that you…".

This is what makes low-context requests ("create a note from this and set a reminder to review it") resolve to the right workspace, tag, and priority without the user spelling it out.

## 6. Server-side action state (pending confirmations & multi-step ops)

New session-scoped state object (stored with session state) tracking:

- **Pending confirmation**: e.g. delete dry-run issued → list of ids awaiting yes/no. A following "yes" executes deterministically; "no"/anything else clears it. No re-classification of "yes".
- **Multi-step operations**: e.g. create workspace → create note inside; step list with produced ids, so step 2 survives model failures and swaps.

Grounding guard: after each turn, if the reply text claims a create/update/delete but no matching successful tool call happened this turn, the reply is regenerated or replaced with an honest error. Error sentinels (`*System Overload*`) are never written into replayable history.

## 7. Memory v2

Three layers:

1. **Profile cards** (exists): ~20 cards, always injected. Unchanged.
2. **Auto-capture** (new): post-session background job reads the transcript and extracts typed memories — `profile`, `preference`, `project`, `pattern` (schedule/habits). Updates existing entries instead of duplicating; drops stale ones. Mid-chat `manage_memory` stays but is no longer the only capture path.
3. **Smart injection** (new): always inject profile; add only project/preference memories relevant to the current request (matched by workspace, keywords, recency) instead of dumping everything.

Weekly consolidation pass merges near-duplicates and expires dead short-term facts.

## 8. Notifications v1

Today `reminder` is a stored string that nothing fires. New:

- **Scheduler**: periodic job scans upcoming task reminders/due dates and dispatches due notifications. Table designed so scheduled actions can later reuse it.
- **Provider abstraction**: `NotificationProvider` interface; v1 implementations: **Telegram** (bot message) and **in-app**. Email/Apple later.
- Telegram flow target: attach images + "create a note from this and set a reminder to review it" → vision → note created → task created in the right workspace with tags/priority from context pack + memory → reminder wired to scheduler.

## 9. P0 fixes (locked)

1. Never let system/memory content reach image-gen prompts; sanitize anything placed in GET URLs (pollinations leak); truncate to provider limits (Cloudflare 2048).
2. Replace the `Successfully executed N tool action(s)` placeholder in all providers with a forced follow-up summarization turn.
3. Classifier follow-up heuristic fix (§2) and `split(/\s+/)` fix.
4. Do not log error sentinels as model turns in history.
5. Grounded-claims post-check (§6).
6. Fix digital-twin ↔ user-message misalignment in history stitching (`memory.ts`).
7. `[Tools: …]` annotation: strip everywhere on replay, and post-filter live output that imitates it.

## 10. Prompt diet

- One PRIMARY prompt; per-category prompts only for WEB_SEARCH / RESEARCH / IMAGE_GEN.
- Remove contradictions: "6 powerful tools" vs 7; ghost `search_notes` tool reference; emoji rules conflicting between global and Telegram blocks.
- Target: each assembled prompt ≤ ~15 core behavior rules beyond tool specs; formatting minutiae moved to post-processing where possible.

## 11. Error handling & fallbacks

- Existing circuit breaker / cooldown / key rotation retained.
- Tier-aware fallback per §4.
- Search chains: existing [SEARCH DATA]/[SEARCH FAILED] flow retained.
- On total PRIMARY failure the user gets an honest error message; the failure is not replayed into history.

## 12. Testing

- Golden transcript regression set: freeze the failure cases from the 2026-07-09/10 analysis (delete-confirmation arc, "yes" misroute, placeholder tool summaries, memory leak into image URL, twin misalignment) and replay them against the pipeline on change.
- Unit tests: classifier guards (follow-up list, 4-category output), tier selection rule, thinking-value mapping per provider, grounding guard, scheduler due-scan.
- Existing test files (`classifier.test.ts`, `outputGuard.test.ts`, `memory.test.ts`) extended rather than replaced.

## 13. Build order (implementation plan input)

1. P0 fixes (§9) — independent, ship first.
2. Category collapse + classifier simplification (§2) + thinking values (§3) + PRIMARY tiers (§4).
3. Context pack + workspace descriptions (§5).
4. Action state + grounding guard (§6).
5. Memory v2 (§7).
6. Notifications v1 (§8).
7. Prompt diet finalization (§10) — iterates alongside 2–5.
