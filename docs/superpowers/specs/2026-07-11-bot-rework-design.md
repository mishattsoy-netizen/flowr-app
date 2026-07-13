# Flowr AI Bot Rework — Design

Date: 2026-07-11 · Last updated: 2026-07-13
Status: **In progress — this is the living plan.** New findings and bugs are folded
into the relevant section here rather than spawned as separate plan documents.
Scope: Bot pipeline (`src/lib/bot/**`), Telegram webhook, chat API route, Router admin, notifications.

## 0. Progress (source of truth — update as steps land)

Build order and status. Step numbers refer to §13.

| Step | Section | Status |
|---|---|---|
| 1 | P0 fixes (§9) | ✅ **Done** — shipped v1.3.4 |
| 2 | Category collapse + classifier + thinking + PRIMARY tiers (§2, §3, §4) | ✅ **Done & verified live** — router v2 enabled |
| 2b | Tool rework (§7c) | 🟡 **Partially done** — `patch` shipped; `edit_content` rename/`is_confirmed_by_user` removal did NOT ship, corrected 2026-07-13, now folded into §6b |
| 4a | Grounding guard + tool-loop guard (part of §6) | ✅ **Done** — pulled forward, see §6a. Dry-run-only gap (found 2026-07-13) fixed as part of §6b. |
| 8 | Prompt diet (§10) | ✅ **Substantially done** — prompt ~9k→~4k tokens, caching fixed |
| 5 | Native attachments (§5b) + attachment storage (§5c) + Telegram parity (§5d) | ✅ **Done** (not yet live-tested with actual telegram bot). |
| 4b | Server-side action state: pending confirmations (§6b), focus tracking (§6c), content sanitization (§6d) | ✅ **Done** — §6b, §6c, §6d shipped 2026-07-13; §6c fully removed 2026-07-14. |
| 4c | Date/time correctness (§6e) | ✅ **Done & verified live** (2026-07-14), 3/3 real UI tests. ⬅️ **NEXT: §7b** (Compaction rework). |
| 7b | Compaction rework | ⬜ Not started |
| 3 | Context pack (§5) | ⬜ Not started |
| 6 | Memory v2 (§7) | ⬜ Not started |
| 7 | Notifications v1 (§8) | ⬜ Not started |

**Verified in step 2 (live testing, 2026-07-12):** 5/5 novel requests routed
correctly (3× Light single-op, 1× Smart multi-step, 1× Smart via `hard`); prompt
cache hit ~79-85% on Smart tier; "hi" latency ~10s → ~2-3s.

**Deferred from step 2:** classifier model swap (llama-3.1-8b → gpt-oss). The
few-shot "count the operations" prompt stabilized llama-8b; revisit only if the
`action` flag drifts again.

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

The VISION category is also deleted — see §5b (native attachments).

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

Tier applies within each existing bot mode (default/pro → "Regular"/"Max"). Default model lists (admin-editable):

| Mode | Light | Smart |
|---|---|---|
| Regular | gemini-3.1-flash-lite → gpt-4o-mini | claude-haiku-4.5 → gemini-3-flash-preview → gpt-5.6-luna-pro |
| Max | claude-haiku-4.5 → gemini-3-flash-preview | claude-sonnet-5 → gemini-3.5-flash |
| SYSTEM (§7) | deepseek-v4-flash → gpt-oss-120b (Groq) → gemini-2.5-flash-lite | — |

SYSTEM is text-only: background jobs never receive raw images — stored history carries cached text descriptions alongside images (§5b), which is what the jobs read.

Prompt-prefix stability is preserved (static/dynamic split) so Anthropic/OpenAI prompt caching keeps Smart-tier tool turns near cached pricing.

Mode UI: each mode selector gets an ⓘ info button with a short popup (benefits, trade-offs, relative cost) — including a note that local-only workspaces get no background runs.

## 5. Context pack (injected user state)

Every tool-enabled turn receives a compact server-computed block:

- **Workspace map**: for each workspace — title, id, one-line description, note/task counts.
- **Task snapshot**: counts + titles of tasks due today and overdue.
- **Recent activity**: last few touched items.
- Current local time (existing date context stays).

Workspace descriptions: new field on workspaces; AI-drafted from workspace contents, user-editable in workspace settings.

**Anti-nagging rule (hard, in prompt):** the pack is background awareness. Never volunteer it, never open with reminders, never mention overdue counts unprompted. Surface schedule facts only when (a) the user asks about tasks/schedule, or (b) they are creating/scheduling something that directly conflicts. Use memories implicitly; never say "I remember that you…".

This is what makes low-context requests ("create a note from this and set a reminder to review it") resolve to the right workspace, tag, and priority without the user spelling it out.

## 5b. Native vision & attachment pipeline

> **Status: ✅ DONE (2026-07-13).** Replaced the VISION pre-pass twin-generation with a direct-to-PRIMARY pipeline. Images are natively routed to Smart-tier models, preserving multi-modal interactions while maintaining a simplified plain-text description cache via `narrateGeneratedImage` for long-term memory/system context.

**Root causes found in the live code (why image turns are broken today):**

- **Images never reach PRIMARY.** `chainRouter.ts` passes image buffers **only** to the VISION chain (~line 368). `executeProvider` — which runs PRIMARY — takes **no image argument at all**. PRIMARY only ever sees a lossy *text description*. The providers (`runOpenRouter`, `runGoogle`) already accept an `imageBuffers` param; the gap is purely that chainRouter never passes them past VISION.
- **Image + action is structurally impossible.** The VISION pre-pass has a `FAST_SIMPLE` branch (`chainRouter.ts` ~450-470) that **returns the vision model's prose directly** — the classifier and PRIMARY never run, so `create_content` is unreachable. Separately `useTools` (~line 970) omits `VISION`. Symptom: "create a note from this" makes the bot *type the note into chat* instead of creating it. This is exactly the legacy path this section deletes.

The digital-twin architecture is deleted: VISION chain/category, `[VISION_CONTEXT]` parsing, vision-first orchestration handoff (`logic_nature`/`FAST_SIMPLE`), and twin injection in `memory.ts`. All chain models are multimodal; images are passed natively.

Unified attachment pipeline (same code path for Telegram and web):

- Every upload normalizes to `{ kind: image | pdf | text, name, mime, data }`.
  - Images and PDFs → native message parts.
  - md/txt → labeled text blocks (`[FILE: name] …`).
  - docx → server-side text extraction (e.g. mammoth), then treated as text.
- Mixed multi-attachment requests become one ordered parts array — no per-type special casing downstream.
- Caps: ~10 attachments/message, per-file size limits, oversized text truncated with a marker.

Routing: any turn with attachments goes to the Smart tier (all Smart models multimodal). The classifier stays text-only and receives an attachment hint (`[3 images, 1 pdf attached]`).

History cost policy: images stay native for the recent turns of the current session; when an image ages past the recency window (or on compaction), it is replaced in history by a one-time cached description stored on its own message — same idea as the twin, but generated once and never attached to the wrong turn. Generated images keep the existing narration step.

**Acceptance:** image + "create a note from this" → note created with the image's content. Image + "what is this?" → clean description, no spurious note. Multi-image + PDF in one message → one coherent answer.

## 5c. Durable attachment storage — ✅ DONE (2026-07-13)

> Not in the original spec. Found while investigating §5b. Ships with step 5.

**Bug:** an image attached on one device is invisible on the user's other devices, in both chat and tasks.

**Root cause:** `src/app/api/ai/upload/route.ts` uploads to Supabase Storage **only if `supabaseAdmin` exists**. `supabaseAdmin` (`src/lib/supabase.ts:61`) requires `SUPABASE_SERVICE_ROLE_KEY`. The Electron app loads env from a `.env` at runtime (`electron/main.js:174-198`), but **`.env` is not in electron-builder's `files` list** (`package.json` ~96), so it never ships. On desktop `supabaseAdmin` is therefore always null → the route **always** falls through to writing `public/user_uploads/<file>` on **that machine's local disk** and returns a machine-local URL. The URL syncs via the DB; the file does not. Each device renders only its own images.

**Shipped: Option A — upload from the client using the user's own authenticated Supabase session.** New migration (`20260713_user_uploads_bucket_rls.sql`) creates the `user_uploads` bucket + RLS policies (public read; insert/delete scoped to `<user_id>/…` paths matching `auth.uid()`) — previously the bucket existed only as a runtime side-effect of `supabaseAdmin.storage.createBucket`, so no RLS ever protected it. Both attachment surfaces named in the bug report were rewired to upload directly to Storage: `AIAssistant.tsx` (chat) and `TaskInspectorPanel.tsx` (tasks) — the latter used a *different* code path than chat and had to be found separately (grep every caller of `/api/ai/upload`, not just the obvious one). `/api/ai/upload` remains only as the Telegram server-side path (§5d).

**Rejected — Option B:** shipping `.env` (with the service-role key) inside the desktop build. One-line change, but it places an **RLS-bypassing secret on every user's disk**. Not acceptable.

**Verified before shipping (per-review, not assumed):** checked for an `img-src` CSP that could block cross-origin `*.supabase.co` URLs now that uploads return public Storage URLs directly instead of same-origin `/api/images?file=…` proxy URLs. None exists on web; Electron's CSP (`electron/main.js:343`) explicitly allow-lists `https://*.supabase.co`. Safe on both surfaces.

**A second, wider bug was found and fixed as a side-effect, not by design:** `AIAssistant.tsx` and `TaskInspectorPanel.tsx` both imported the plain `@/lib/supabase` client (`export const supabase`) and called `.auth.getSession()` / `.storage.*` on it. That client is a **separate, unauthenticated instance** from the SSR-cookie-backed client `AuthProvider` actually uses (`@/utils/supabase/client`) — so `getSession()` silently always returned no session, no error surfaced. Fixed in both files by switching to the real client. This also incidentally repaired `AIAssistant.tsx`'s voice-transcription auth header, which was never being sent.

**NOT yet fixed — same bug pattern, found but out of §5c's scope:** `UsagePanel.tsx` (promo code redemption, downgrade-to-free — 3 occurrences) and three admin subscription files (`src/app/admin/subscriptions/page.tsx`, `PromoCodeSection.tsx`, `SubscriptionsTable.tsx`) all call `.auth.getSession()` on the same wrong `@/lib/supabase` client. These may be silently broken the same way. Needs its own pass — grep `from '@/lib/supabase'` combined with `.auth.` or `.storage.` calls to find any more instances.

**Security review found a real vulnerability post-ship (fixed same session, 2026-07-13):** going direct-to-browser-upload dropped two protections the old `/api/ai/upload` server route had — a hardcoded content-type allowlist and forced `Content-Disposition: inline` with a strict CSP. The initial migration trusted the browser-reported `file.type` with no server-side check, and allowed unrestricted public read — a malicious client could set `file.type` to `text/html`, upload a script payload, and get back a publicly-servable `supabase.co` URL a browser would render as executable HTML (stored XSS). Fixed by adding `allowed_mime_types` to the bucket (Supabase Storage enforces this server-side regardless of client claims), scoped to the app's real attachment categories (image/audio/video/pdf/text) and excluding anything that can execute as active content.

**Accepted tradeoff, not fixed:** public read remains (owner decision, 2026-07-13) — same exposure level as the old `/api/images` proxy. True ownership-gated read needs Supabase signed URLs, which requires storing a path instead of a permanent URL on `AIAttachment` and re-signing on every render (chat/tasks currently render via plain `<img src>`/`<audio src>` with no custom auth headers). That's real scope — tracked as an explicit follow-up, not bundled into this fix under review pressure.

**Still open:** `src/app/api/images/route.ts` `SAFE_FILENAME` only permits `png|jpe?g|gif|webp`, rejecting any non-image with a 400 — but new uploads bypass this route entirely now (they return raw public Storage URLs), so this only affects reading back **old** attachments still using `/api/images?file=…pdf`-style URLs. Low priority; only matters for historical PDF/non-image attachments.

**Migration/backfill:** existing attachments point at dead local paths from before this fix. Not backfilled — accepted that historical images stay broken; only new uploads are durable.

**Acceptance:** attach an image on device A → it renders on device B, and vice-versa. **Not yet verified on two devices** — code shipped, RLS/CSP reasoning checked, but needs an actual cross-device test before this is fully closed.

## 5d. Telegram parity (NEW — 2026-07-13)

> Not in the original spec. Telegram shares `runChain` (and therefore router v2, tiers, memory, tools) but its webhook is under-wired. Ships with step 5, on top of the §5b unified pipeline.

**Bug 1 — an album produces one reply per image.** ✅ DONE (2026-07-14). DB-backed claim table (`telegram_media_groups`), settle window, single `runChain` call with `Buffer[]`. `media_group_id` appears nowhere in `src/app/api/telegram/webhook/route.ts`. Telegram delivers an album as N separate updates sharing that id; each is processed as an independent message. `photoBuffer` is also a single `Buffer`. (`runChain` already accepts `Buffer[]` — `chainRouter.ts:159` — so only the webhook is single-image.)

**The naive fix is wrong:** album items arrive as **separate serverless invocations with no shared memory**, so an in-memory map/debounce works locally and silently breaks on Vercel. Batching state must live in the DB:

1. Migration: `telegram_media_groups(media_group_id text primary key, chat_id text, file_ids jsonb, caption text, processed boolean default false, created_at timestamptz default now())`.
2. On a message with `media_group_id`, append its `file_id` (and the caption — Telegram puts it on only one item of the album).
3. After a short settle window (~1.5-2s), **claim atomically**: `UPDATE … SET processed = true WHERE media_group_id = $1 AND processed = false RETURNING *`. Only the claiming invocation runs `runChain`; the others return 200 and do nothing.
4. The claimer downloads all `file_ids` and calls `runChain` once with the full attachment set (via the §5b pipeline).
5. Clean up rows older than ~10 minutes.

**Bug 2 — Telegram images show as empty bubbles in the web chat.** ✅ DONE (2026-07-14). Server-side `supabaseAdmin` upload to the existing `user_uploads` bucket, `AIAttachment`-shaped object appended to the message's `content` via the same `ATTACHMENTS_JSON` comment convention `insertMessage` uses on the web side. The webhook **never persists attachments**: it downloads each photo to a Buffer, hands it to `runChain`, and writes no `attachments` array on the message row. Fix: upload each file to the §5c durable store and write the URLs into the message's `attachments` (shape: `AIAttachment`, `src/data/store.types.ts:266`). (fixed 2026-07-14: user-message logging regression from the initial refactor).

**Bug 3 — wrong timezone on Telegram — ✅ DONE (2026-07-13).** The webhook's `runChain` call passed no `clientTime`, unlike the web route, so the server fell back to its own clock (UTC on Vercel). Root cause turned out bigger than expected: `manualTimezone` lived only in browser Zustand state and wasn't even in `partialize` (didn't survive a reload), so there was nothing durable to read cross-surface. Fixed properly per owner decision: new `user_settings` table (RLS-scoped like `bot_memories`), the Settings timezone picker now persists there (`saveTimezone` action) and loads on mount, and the Telegram webhook reads the same row and builds `clientTime` with the shared `getClientTime()` helper. **Opt-in, not automatic** — a user who has never opened Settings and picked a timezone sees no change (same server-clock fallback as before).

**Also missing vs. the web route** (lower priority, decide case by case): `clientHistory`, `thinkingEnabled`, `replyContext`, `intentTag`, `advisorEnabled`.

**Acceptance:** a 4-image album → exactly ONE reply referencing all four, images render in the web chat, and "remind me tomorrow 6pm" lands at 6pm **local**. (Verified manually via typescript compile and test suite, but requires live bot testing for the race-condition coordination logic).

## 6. Server-side action state (pending confirmations & multi-step ops)

### 6a. Grounding guard + tool-loop guard — ✅ DONE (2026-07-12, pulled forward)

Grounding guard: after each turn, if the reply text claims a create/update/delete but no matching successful tool call happened this turn, the reply is regenerated or replaced with an honest error. Error sentinels (`*System Overload*`) are never written into replayable history.

**Shipped.** `hasUngroundedActionClaim` previously returned "fine" as soon as **any** tool call was captured, regardless of outcome — so a *failed* `create_content` still let the bot say "Done. Created your note." It now requires a **mutating** tool (create/update/append/move/delete/manage_memory) to have actually **succeeded**; a successful *read* never grounds a mutation claim. Fails safe (a mutation with no success flag counts as succeeded, so the bot is never falsely accused).

**Also shipped (not originally specced):** a **repeat-call guard**. Nothing stopped a model re-issuing an identical tool call that had just failed, burning every remaining hop — worse since Smart tier moved to 8 hops. `checkRepeatedFailure`/`recordToolFailure` live in the shared `toolLoopConfig.ts` (deliberately shared, not inlined per-provider — that duplication is exactly how `MAX_TOOL_HOPS` drifted). On an exact repeat of an already-failed call the handler is skipped and the model gets a synthetic result naming the prior error. It is a **nudge, not a loop-kill**: different args, different tools, and repeated successful reads all still run, so legitimate retries survive.

### 6b. Pending confirmation state — ✅ DONE (2026-07-13)

**Shipped:** Server-owned confirmation state replaces model-memory-based confirmation.
- **Root cause:** `delete_content` had a dry-run-then-confirm flow, but the server never stored what the dry-run found. The model had to re-derive the pending list from raw history, causing it to drift (confusing tasks with canvas blocks mid-flow).
- **What changed:** New `pending_action JSONB` column added to `bot_session_states` (migration `20260714_bot_session_action_state.sql`). `delete_content` and `update_content` (full-replace path only) now write the actual dry-run result to session state on every dry-run call and clear it on confirmed execution. `[PENDING CONFIRMATION]` is injected into `dynamicContext` each turn so the model always reasons over the real stored payload. The old `is_confirmed_by_user` param is renamed `confirmed`; `is_confirmed_by_user` is now fully absent from the codebase. `hasUngroundedActionClaim` in `outputGuard.ts` now treats any call with `status: 'pending_confirmation'` as not grounded, closing the bug where a dry-run turn could satisfy the guard's mutation check.
- **What was verified:** `npx tsc --noEmit` clean. All 359 tests pass (353 baseline + 6 new cases including both `delete_content` and `update_content` dry-run guard tests). Grepped for `is_confirmed_by_user` in `src/` — zero hits.

> Found while investigating live bot testing on 2026-07-13 (see the transcript in the "why this section exists" note below). Supersedes the original §6b stub, which only sketched this in one sentence — this is the fleshed-out design.

**Why this section exists — the bug that triggered it:** live testing surfaced a transcript where the bot (1) claimed it deleted 4 tasks, when it hadn't; (2) when challenged, second-guessed itself and called the same items "canvas blocks" instead of "tasks"; (3) only executed after a second, separate confirmation round. Root cause: `delete_content` already does a dry-run-then-confirm flow (`is_confirmed_by_user` flag, `src/lib/bot/tools/handlers.ts:418`), but the *only* record of "what's pending and what did the dry-run actually return" is the model's own memory of its last turn, re-derived from raw conversation text on every subsequent turn. Nothing forces that recollection to be accurate — so the model drifted. This is a **server-state gap**, not a prompting gap: the fix is to make the server the source of truth for what's pending, not the model's memory.

**Design:**

- New columns on `bot_session_states` (extending the existing table from `20260504_session_context_caching.sql`, no new table): `pending_action JSONB`, storing `{ tool: string, args: object, dry_run_result: object, created_at: string } | null`.
- **Which tools get gated behind a mandatory dry-run:** `delete_content` (already has this, being formalized) and `update_content` when called as a full-body replace (i.e. `content` or `blocks` provided, `patch` absent/empty — this is the tool §7c's design called `edit_content` with `mode:'replace'`, but see the implementation note below: that rename never actually shipped, the tool is still named `update_content`). Both are irreversible/high-blast-radius. `move_content` and `create_content` are explicitly NOT gated — reversible or low-stakes, and gating `create_content` would force a confirmation round-trip on the common case (plain task/note creation), which is worse UX than today.
- **Flow:** first call to a gated tool (no `confirmed: true` in args) always dry-runs — fetches/previews what would change, writes `pending_action` to session state via `updateSessionState(sessionId, { pending_action })`, and returns the preview to the model (same shape as today's `pending_confirmation` response). It does **not** execute.
- **Every subsequent turn**, if `pending_action` is non-null, `buildSystemPrompt`'s `dynamicContext` (`src/lib/bot/services/promptBuilder.ts`) injects it as ground truth: `[PENDING CONFIRMATION]\nTool: <tool>\nDetails: <dry_run_result>\nAwaiting user confirmation.` — right alongside the existing `[SESSION MEMORY SUMMARY]`/`[VISION DATA]` blocks. The model reasons over the *actual* stored dry-run payload every turn, not a memory of it — this is what directly fixes the "wdym canvas blocks" confusion.
- **Resolving it:** the model is NOT keyword-gated on "yes"/"no" (deliberately — a reply like "yes but skip the last one" needs to stay model-mediated, not regex-matched). The system prompt tells the model: if `[PENDING CONFIRMATION]` is present and the user's message answers it, call the same tool again with `confirmed: true` (replacing the old `is_confirmed_by_user` flag — finally enforcing §7c's original intent) and the *original* args from `dry_run_result`, not re-derived args. Server executes, clears `pending_action`. If the user's message is an unrelated topic (see §6c focus tracking below), `pending_action` is cleared without executing — an abandoned confirmation must never silently execute later.
- **Grounding guard interaction (critical fix, found during this investigation):** `hasUngroundedActionClaim` (`src/lib/bot/outputGuard.ts:91`) currently treats `delete_content`/`update_content` as "succeeded" whenever the captured tool call has `success !== false`. A dry-run response has no `success` field at all (it returns `{status: 'pending_confirmation', ...}`), which means `success !== false` is `true` — so the SAME BUG the grounding guard was built to catch (bot says "Done!" off an ungrounded claim) can still slip through when the ungrounded claim is riding on a dry-run instead of an outright hallucination. `hasUngroundedActionClaim` must be changed to only count a call to `delete_content`/`update_content`(full-replace) as a grounded completion when the result reflects **actual execution** (`result.status !== 'pending_confirmation'`), not merely `success !== false`.

**Acceptance:** ask the bot to delete 4 named items → it dry-runs, lists them accurately → user says "yes" → executes exactly those 4, no re-derivation, no drift in what "them" refers to. Ask it to delete something, then change topic before confirming → the pending action is dropped, never silently executed later.

**Post-ship correction, found via live user testing (2026-07-13):** the original design deliberately did NOT add a server-side check that `confirmed: true` matches a real stored `pending_action` — the reasoning at the time was "the stored state is for prompt grounding only, not a hard execution gate," trusting the model's own `confirmed: true` claim the same way the old `is_confirmed_by_user: true` was trusted. **This reasoning was wrong, proven by a live incident:** a real test session showed the model receiving a bare "yes" several turns after a topic shift (to which it had correctly called `update_focus`, correctly clearing the stale `pending_action` — the §6b/§6c mechanism itself worked exactly as designed), then re-deriving "yes" as "delete this" from raw conversation history via the global "resolve vague follow-ups from conversation flow" prompt rule, and calling `delete_content({ ids, confirmed: true })` as its **first and only** call in that cycle — no dry-run, no real `pending_action` on record — and it executed. Verified via the actual sent prompt and tool-call trace, not inferred: `[FOCUS]` correctly showed the current topic as unrelated, no `[PENDING CONFIRMATION]` block was present, and the model bypassed its own required dry-run-first rule anyway.

**Fixed same day:** `delete_content` and `update_content` (full-replace path) now hard-require, server-side, that `confirmed: true` matches a `pending_action` actually on record for that session — `pending.tool` matches, and `pending.args.ids`/`pending.args.id` matches exactly what's being confirmed. A `confirmed: true` call with no matching dry-run on record is now rejected with an error telling the model to dry-run again. This closes the exact bypass the live incident exploited: the model can no longer skip its own dry-run step by simply asserting `confirmed: true`. Two new regression tests added to `handlers.test.ts` reproducing the exact shape of the live failure (a `confirmed: true` call with `pending_action: null` on record, via `getSessionState('temp')` which needs no DB mock). Verified: `npx tsc --noEmit` clean, 363/363 tests passing (361 baseline + 2 new).

**Second post-ship correction, found during §6c reliability follow-up (2026-07-13):** the id-match gate above closes the bypass only when `pending_action` gets cleared promptly — and the only things that clear it are a confirmed execution or `update_focus` firing. §6c's reliability data (see §6c below) shows `update_focus` fires on roughly 1 in 3 real topic shifts, so on the other 2 in 3, an abandoned dry-run's `pending_action` (e.g. "delete this passport task?" that the user never answered and instead changed topics) stays on record indefinitely. A later, unrelated bare "yes" — re-derived by the model from raw history the same way the original incident happened — can still exactly match those stale `ids`/`id` and pass the gate. The id-match fix narrowed the exploit window; it didn't close it. **Fixed:** added `isPendingActionFresh()` in `handlers.ts`, a 5-minute TTL check against `pending_action.created_at` (already written on every dry-run, unused until now). Both gates now also require the stored action to be fresh, not just id-matching. Guards against clock skew (rejects a future `created_at` too). 5 new unit tests added directly against `isPendingActionFresh`. Verified: `npx tsc --noEmit` clean, 148/148 tests passing in `src/lib/bot`.

### 6c. Focus tracking — 🔴 FULLY REMOVED (2026-07-14)

**Shipped:** `update_focus` tool added; model explicitly maintains topic state in session.
- **What changed:** New `current_focus` and `previous_focus TEXT` columns added to `bot_session_states` (same migration as §6b — `20260714_bot_session_action_state.sql`). New `update_focus` tool definition and handler: reads current `current_focus`, shifts it to `previous_focus`, writes the new focus, and — per the §6b/§6c interaction spec — clears `pending_action` (an explicit topic shift drops any outstanding unconfirmed action). `[FOCUS]` block injected into `dynamicContext` (alongside `[PENDING CONFIRMATION]`) each turn whenever either field is non-null. Rule 12 added to `tools.txt` instructing the model when to call it (originally landed as a misnumbered rule 16 out of sequence with the surrounding NOTE FORMAT rules; renumbered during verification). `update_focus` is deliberately excluded from `MUTATING_TOOLS` in `outputGuard.ts`.
- **What was verified:** `npx tsc --noEmit` clean. 359/359 tests passing (no regressions).

**Reliability finding, from live user testing (2026-07-13):** across one real session with at least 6 unambiguous topic shifts, `update_focus` was correctly called on only 2 — the other 4 (task creation, a delete request, and 3 consecutive rapid shifts: octopus facts → banana bread → LinkedIn bio → Tokyo weather) got zero tool call, `[FOCUS]` staying frozen on the earlier topic throughout. Confirmed via raw transcript files (`transcripts/ai-transcript-2026-07-13T15-20-33.md`, `...15-20-50.md`, `...15-21-54.md`), not inferred from UI. A first-pass read of just the one success (the octopus turn) had suggested "the mechanism works" — that was premature; the actual observed rate is roughly 1-in-3, not "works with occasional misses." **Downstream risk already mitigated:** since `update_focus` not firing is what leaves `pending_action` stale, the second post-ship correction above (TTL on `pending_action`) closes the concrete safety hole this reliability gap opens, independent of whether `update_focus`'s hit rate is ever improved.

**Read-side finding (2026-07-13, same investigation):** checked whether a correctly-populated `[FOCUS]` block has ever actually changed a model outcome — it has not, in any evidence available. In the one apparent success (`ai-transcript-2026-07-13T15-19-07.md`, the octopus shift), `[FOCUS]` was still STALE at the moment the model correctly abandoned a pending delete — the actual driver was `[PENDING CONFIRMATION]`'s own instruction text ("if the topic changed... drop it and address whatever they actually said"), not `[FOCUS]`; calling `update_focus` was a side effect of that, not caused by `[FOCUS]`. Two turns later (`ai-transcript-2026-07-13T15-19-25.md`), `[FOCUS]` was CORRECT and CURRENT directly above a bare "yes," and the model ignored it entirely, re-deriving and executing a stale delete from raw history instead (the same incident that drove the first post-ship correction above). **Conclusion:** raising `[FOCUS]`'s fire-rate alone does not fix real behavior — it makes a hint more often present that the model has been directly observed overriding. Root cause: a pre-existing global rule in `system_prompt.txt` ("resolve vague follow-ups from conversation flow — usually the immediately previous turn") directly competes with, and beat, Rule 12's "reason from [FOCUS] as ground truth" clause in the observed incident.

**Fix Shipped (2026-07-13), after 3 verification rounds:** Two-part fix implemented:
1. **Write side:** Moved focus-shift detection from model-judgment-only (`update_focus` tool call) to a deterministic path — added a `focus_shift: string | null` field to the existing per-turn `classifyIntentV2` output (`classifier_v2.txt` / `routerV2.ts` / `chainRouter.ts`), so focus tracking no longer depends on PRIMARY remembering to call a tool.
2. **Read side:** Added an explicit `[FOCUS]`-beats-history carve-out to `system_prompt.txt`'s vague-follow-up rule, and reordered/strengthened `tools.txt` Rule 12 to lead with the ground-truth instruction instead of burying it as a trailing clause.

`update_focus` the tool stays as-is (still useful for explicit "let's focus on X" requests); this is additive, not a replacement.

**Verification history (worth keeping — shows why the eval gate mattered):** round 1's "0 regressions found" self-report was false — the eval script had a regex bug that silently produced `undefined` on every comparison, masking that nothing was actually being tested. Round 2 fixed the script and surfaced 2-3 apparent regressions on WEB_SEARCH-adjacent cases — but a second independent re-run of the *same* prompts produced *different* "old" results, revealing the eval itself was comparing against a noisy live re-run of the old prompt each time (the model isn't deterministic at the default temperature). Root-caused and fixed directly: `classifyIntentV2` never set `temperature` on any of its three provider call paths, defaulting to `0.7` (conversational) for what should be a low-variance routing decision — now `0.1` for all three providers. Round 3 (frozen 3-run baseline instead of a live re-comparison) found one real, reproducible regression: the classifier flipped `"did you decide between Sony and Bose?"` (recalling the bot's own prior answer) from `PRIMARY` to `WEB_SEARCH`. Root cause found by inspection, not guesswork: an example added alongside `focus_shift` (`"what about Sony vs Bose?" (following up on headphones) → WEB_SEARCH`) was near-identical in phrasing to the regressed case and taught the wrong lesson for it. Fixed by narrowing that example to a genuinely-fresh-comparison phrasing and adding a contrasting paired example for the recall case, mirroring how the `action` field's examples already teach boundaries via pairs. Re-verified against the frozen baseline: 0 regressions on all cases with a stable baseline (2 of 15 cases are inherently ambiguous to this small model even for the *old* prompt at low temperature and have no stable baseline to regress from — flagged, not silently ignored).

**Live re-test after all of the above (2026-07-13), two real sessions with natural (non-signposted) phrasing:** routing/tier selection was correct across all turns in both sessions (dinner→PRIMARY, task creation→PRIMARY, exchange rate→WEB_SEARCH, follow-up→WEB_SEARCH, delete request→PRIMARY, confirmation→PRIMARY, image request→IMAGE_GEN — no misroutes). `focus_shift` itself remained unreliable — null on most real, un-signposted topic shifts across both sessions (e.g. dinner-planning → currency question, currency → delete request never triggered a shift). More importantly, the second session caught the ORIGINAL live incident's exact shape happening again: the model received "yeah do it" after an intervening unrelated topic (a Forex tangent) and, per its usual behavior, re-derived "delete the task" from raw history and called `delete_content({ids, confirmed: true})` directly, skipping a fresh dry-run — same bypass attempt as the original bug. This time **the server-side id-match gate correctly rejected it** (`"error": "No matching pending confirmation found for these ids"`), forcing a second, real confirmation round instead of silently executing. This is the `confirmed:true` gate (first post-ship correction, above) working under real adversarial-shaped conditions, not just a synthetic test — strong evidence that specific fix holds.

However: the gate's rejection only worked because a *fresh* `pending_action` happened to have been re-armed by that very same rejected call (its own dry-run fallback), landing exactly one turn before the follow-up "yes" — i.e., it held by favorable timing, not by a guarantee. Tracing the general case: if `focus_shift` doesn't fire on a shift (shown to be the common case) and the user's very first "yes" attempt is a bare confirmation rather than a bypass-shaped tool call, the only backstop preventing a stale confirmation from executing was the 5-minute TTL — too coarse for a fast conversation where several unrelated turns can land well within that window.

**Fix shipped (2026-07-13): deterministic single-turn scoping for `pending_action`, independent of focus-shift detection.** Added `turn_seq`, a per-session monotonic counter (new `bot_session_states.turn_seq INTEGER NOT NULL DEFAULT 0` column, migration `20260713_bot_session_turn_seq.sql`), incremented once per turn in `chainRouter.ts` (`src/lib/bot/chainRouter.ts`, right after `sessionState` is fetched and before any tool handler can run that turn — both the DB write and the in-memory `sessionState.turn_seq` are bumped so the same turn's own tool calls see the new value). A dry-run (`delete_content`, `update_content` full-replace) stamps the counter's current value onto `pending_action.turn_seq` at creation. A `confirmed:true` call is now additionally gated by `isPendingActionSameNextTurn()` (`src/lib/bot/tools/handlers.ts`) — requires the session's current `turn_seq` to be exactly one more than the value stamped at dry-run time, i.e. confirmation must land on the very next turn or the gate rejects and asks for a fresh dry-run. This runs alongside the existing id-match and TTL checks (all three must pass), and is deterministic — it doesn't depend on `update_focus`/`focus_shift` ever firing correctly. 5 new unit tests added directly against `isPendingActionSameNextTurn`.

**Live re-verification of the turn_seq fix (2026-07-14):** ran the exact dangerous sequence — create task → "delete that task" (dry-run) → one genuinely unrelated turn (no signposting) → bare "yes" — as real transcripts, not synthetic tests. The model reached for the bypass exactly as before (`delete_content({ids, confirmed: true})` with no fresh dry-run in that cycle), and this time the rejection held for the right reason: `turn_seq` had advanced by 2 since the dry-run, so `isPendingActionSameNextTurn` failed even though ids still matched and the TTL hadn't expired. The model fell back to a fresh dry-run and asked again — task was NOT deleted. This rules out the "held by favorable timing" caveat above; the fix is confirmed deterministic, independent of `focus_shift` (which was, as expected, `null` on the intervening turn — a genuine shift the classifier missed, consistent with every other live session).

**Decision (2026-07-14): retire automatic focus-shift detection entirely.** Across three independent live sessions (this one plus the two `2026-07-13` sessions above), `focus_shift` never reliably fired on a real, un-signposted topic shift, and — going back to the original incident — even a correctly-populated `[FOCUS]` block was observed being ignored by the model in favor of raw-history re-derivation. No evidence across any session shows `[FOCUS]` ever changing a real outcome; the turn_seq re-verification above reconfirms the safety net was never actually dependent on it. Given that, continuing to invest in firing-rate improvements would be optimizing a mechanism with no demonstrated path to the actual goal (bot correctly tracking user intent across a conversation) — better to redirect that effort toward mechanisms with a real causal story, starting with `[PENDING CONFIRMATION]`'s own instruction wording, which is the one thing that has actually driven correct behavior in every session studied.

**Follow-up decision (2026-07-14, same day): remove `update_focus` entirely, not just the automatic path.** Once the tool is explicit-only, its value only exists if a user actually says "let's focus on X" — but the whole point of `[FOCUS]` was to help the model stay oriented on LATER turns, and that has never once been shown to work (the model ignores `[FOCUS]` even when correctly populated — see the read-side finding above). An explicit-only tool with no evidence it changes later behavior is dead weight: extra schema, extra prompt rule, extra DB columns, extra prompt-injection logic, zero demonstrated payoff. Decision: remove it completely rather than leave a narrower, still-unproven version around.

**What was removed (full list):** the classifier's `focus_shift` field and its instruction block (`classifier_v2.txt`, `V2Classification` in `routerV2.ts`, `parseClassifierV2Output`); the auto-detection block in `chainRouter.ts`; the `update_focus` tool definition and handler (`definitions.ts`, `handlers.ts`); `current_focus`/`previous_focus` from `SessionState` (`context.ts`) and the `[FOCUS]` prompt injection (`promptBuilder.ts`); `tools.txt`'s FOCUS rule (tool count reverted 8→7, trailing rules renumbered); `system_prompt.txt`'s `[FOCUS]`-beats-history carve-out (now meaningless — `[FOCUS]` can never be populated); the `current_focus`/`previous_focus` DB columns (migration `20260714_drop_focus_tracking_columns.sql`). `pending_action` and `turn_seq` are UNAFFECTED — both are load-bearing for the confirmed:true safety gate and have no dependency on focus tracking, confirmed by design and by the live re-test above.

**Explicitly NOT a fix for the underlying "bot loses my intent" complaint** — that problem is still open and unmeasured; removing a non-working mechanism removes noise but doesn't itself improve intent-tracking. Next steps for that: (1) reproduce the note-transcript degradation pattern with a real transcript before proposing a fix (best current hypothesis: `[CURRENT CONTEXT]`'s DATE/TIME block dominating a short follow-up message — same "scaffolding crowds out real speech" class as §6d, unverified), (2) separately, `§7b` (compaction) is a plausible but unconfirmed contributor for longer conversations specifically — do not assume it explains a short-conversation degradation without checking.

Verified: `npx tsc --noEmit` clean, 148/148 tests passing in `src/lib/bot` after full removal.

> Found in the same 2026-07-13 investigation. The same transcript showed a second, independent failure: mid-conversation the bot lost track of what topic was currently active and needed the user to re-explain, even though nothing had been compacted or dropped from history (§7b's context-hole bug does not apply here — the conversation was short). This is a reasoning/state-tracking gap, not a missing-context gap: the bot had no explicit signal for "what am I currently doing," so it had to re-infer intent from raw history every turn, and sometimes inferred wrong. This remains the open problem after focus-tracking's full removal — see the "next steps" note above.

**Original design (historical, no longer in effect):** this section originally specced `current_focus`/`previous_focus` columns, an `update_focus` tool, and a `[FOCUS]` prompt block, all fully implemented and shipped 2026-07-13. Fully removed 2026-07-14 — see the retirement/removal notes above for why and exactly what was deleted.

### 6d. Content sanitization — system-prompt scaffolding leaking into saved content — ✅ DONE (2026-07-13)

**Shipped:** Added explicit string sanitization to tool boundaries.
- **Root cause:** System markers (`[CURRENT CONTEXT]`, `[CURRENT REQUEST]`) were interleaved directly with user input in the final prompt string, leading the model to unknowingly reproduce them when asked to mirror conversation history into a note.
- **What changed:** Generalized the existing `imagePromptGuard` into a shared `stripSystemBlocks` helper. Added a strict prompt rule explicitly prohibiting the echo of system brackets, and applied `sanitizeToolContent` to `content`, `title`, and `description` inside the `create_content` and `update_content` handlers before writing to the database.
- **What was verified:** Confirmed via tests that `sanitizeToolContent` successfully strips both old and new system headers (`PENDING CONFIRMATION`, `FOCUS`) while leaving valid markdown untouched.
> Found in the same 2026-07-13 investigation, independent of §6b/§6c. User asked the bot to "create a note with the whole chat history transcript"; the resulting note contained multiple verbatim copies of the `[CURRENT CONTEXT]`/date-and-timezone-rules block and a stray `[CURRENT REQUEST]` label — internal prompt scaffolding, not anything the user actually said.

**Root cause:** `chainRouter.ts` builds `finalUserPrompt = dynamicContext + "\n\n[CURRENT REQUEST]\n" + activePromptForGen` (`chainRouter.ts:783-784`) and sends that whole concatenation to the model as the literal "user turn" for every non-`IMAGE_GEN` category. The model has no way to distinguish "this is infrastructure" from "this is what the user typed" — it's all just text in one message. `create_content`/`update_content` then write `args.content`/`args.title`/`args.description` straight to the DB (`src/lib/bot/tools/handlers.ts:129`, `:258`) with zero sanitization. This is the same class of risk §9 P0 fix #1 already fixed for image-gen prompts (`src/lib/bot/services/imagePromptGuard.ts`'s `sanitizeImagePrompt`, header-list based) — it was never extended to the general tool-content path.

**Design (defense in depth, per owner decision — prompt rule alone is not enough since it depends on the model reliably obeying it):**

1. **System-prompt rule:** add one explicit rule (global prompt or tool-instructions block) stating the bracketed blocks (`[CURRENT CONTEXT]`, `[CURRENT REQUEST]`, `[PENDING CONFIRMATION]`, `[FOCUS]`, `[SESSION MEMORY SUMMARY]`, `[VISION DATA]`, `[PAGE CONTEXT]`) are infrastructure and must never be quoted or reproduced in a reply or in tool call content.
2. **Server-side sanitization (the actual guarantee):** extract `imagePromptGuard.ts`'s `SYSTEM_BLOCK_HEADERS` stripping logic into a shared helper (or generalize `sanitizeImagePrompt` itself — it's already header-list-driven, just needs to stop being image-gen-only and gain the two new headers above), and call it on `create_content`/`update_content`'s `content`, `title`, and `description` fields before they reach `supabaseAdmin`. This guarantees the leak can't reach user-visible storage even if the model ignores the prompt rule.

**Acceptance:** ask the bot to "save this conversation as a note" → the resulting note contains only actual conversational content, no `[CURRENT CONTEXT]`/`[CURRENT REQUEST]`/etc. markers, even under adversarial prompting that tries to get the model to reproduce them.

### 6e. Date/time correctness for task creation — ✅ DONE (2026-07-14)

**Root cause (from `transcripts/ai-transcript-2026-07-13T15-14-52.md`):** user (UTC+3, Monday Jul 13) asked to create a task "renew passport" due next Friday. Bot called `create_content` with `dueDate: "2026-07-24T23:59:00Z", includeTime: true`, and told the user "due Friday, July 24." Two things looked like separate bugs but are one causal chain:
- `promptBuilder.ts`'s DATE/TIME RULES block had zero guidance for the no-explicit-time case, so the model invented an end-of-day `23:59:00Z` timestamp.
- `23:59:00Z` at UTC+3 is **02:59 local the next day**. `TaskCard.tsx`'s `formatTaskDate` runs `date-fns/format` on `new Date(dateStr)`, which renders in local time with zero day-boundary protection — so the stored "Jul 24 end of day" silently displayed as **Saturday Jul 25, 2:59 AM**, contradicting the bot's own stated "Friday, July 24." This is what the user actually saw and reported (not a date-arithmetic error — the bot's weekday reasoning was internally consistent, just never surfaced correctly).
- Confirmed via `task-overdue.ts`: `isDeadlinePassed` branches on whether the deadline string `includes('T')` — since the model always emits a full `...T...Z` ISO string per the DATE/TIME RULES, a bare-date task always takes the exact-timestamp comparison branch, never the date-only branch. So the encoded UTC instant, not just `includeTime`, controls both display and overdue behavior.

**Fix (prompt-only, `src/lib/bot/services/promptBuilder.ts` DATE/TIME RULES block):**
1. When the user does not state an explicit time, `includeTime` must be `false` and the date must be encoded at **local noon**, not local midnight or end-of-day (`UTC hour = 12 - utcOffsetHours`). Explicitly forbids `23:59`/`00:00` placeholders, since ±12h of tz conversion can never cross a day boundary from a noon anchor — this is a structural fix, not a hope-the-model-gets-it-right one.
2. Relative weekday phrases ("next Friday" etc.) are left genuinely ambiguous on purpose — no hardcoded "which Friday" rule, since usage is split and the user's actual complaint was the day-shift, not the weekday interpretation. Instead the model is told to always state the resolved calendar date back in its reply, so a misread is immediately visible and correctable.
3. Tightened `includeTime`'s description in `src/lib/bot/tools/definitions.ts` (both `create_content` and `update_content` schemas) to explicitly say "false for a bare date — never invent a time like end-of-day."

**Known accepted consequence:** a bare-date task now flips "overdue" at local noon on its due day instead of ~3am the following day (since `isDeadlinePassed` still takes the exact-timestamp branch on the full `Z` string). This is the deliberate trade for the 12-hour safety margin against the model's tz arithmetic — chosen consciously, not a side effect discovered later.

**Verified live (2026-07-14, 3 real UI tests, UTC+3 user, "today" = Tue Jul 14):**
1. Bare date: "renew passport due next Friday" → `dueDate` noon-anchored, task card shows **Jul 24** (matches the bot's own stated "Friday, July 24") — no day-shift. Bug fixed.
2. Explicit time: "call the dentist due Friday at 3pm" → `includeTime: true`, card shows **Jul 17 3:00 PM** — correct, no drift.
3. Two-date range: "conference trip starting tomorrow, ending Friday at 6pm" → card correctly shows **Jul 15 12:00 PM → Jul 17 6:00 PM**. Data is correct, but the bot's **reply** text was wrong: "due Friday, July 17 at 3:00 PM (6:00 PM local time)" — it surfaced the raw UTC hour (3:00 PM) alongside a parenthetical "local time" correction, violating `system_prompt.txt`'s existing "never say UTC/GMT/offset — give local time" rule. Root cause: the DATE/TIME RULES block teaches the model to reason explicitly in UTC-hour terms for the tool call, which bled into its reply. **Fix:** added an explicit clause to the same DATE/TIME RULES block: the UTC conversion is for the tool call only, the reply must state the local time the user gave and must never mention UTC/GMT/an offset/"local time" at all. Not yet independently re-tested live (low-risk, same prompt-block pattern already proven to work for the other two rules in this block) — flag for a spot-check next time a multi-date/timed task request comes through.

**Verified:** `tsc --noEmit` clean throughout (string-only prompt/schema edits, no logic touched).

## 7. Memory v2

Three layers:

1. **Profile cards** (exists): ~20 cards, always injected. Unchanged. The `manage_memory` tool stays available on every Smart-tier turn for explicit live capture.
2. **Auto-capture** (new): when a session goes idle (~30–60 min without messages) or the user starts a new chat, one background job reads that session's transcript and extracts durable typed facts — `profile`, `preference`, `project`, `pattern` (schedule/habits) — as JSON add/update/delete operations the server applies to the **same visible memory cards**. No hidden store; the user sees and can edit everything it learned. Transient conversational content is discarded. Model: SYSTEM chain (see below). Cost: fractions of a cent per session.
3. **Smart injection** (new): always inject profile; add only project/preference memories relevant to the current request (matched by workspace, keywords, recency) instead of dumping everything.

**Session descriptions** (from `session-descriptions-idea.md`): the same auto-capture run emits a second output — a ≤150-char (target ~100) one-sentence description of what the session covered and its outcome, stored on the session row, deleted with the session, refreshed only if the session resumes and goes idle again. The title carries the topic; the description carries outcome/state. No per-turn update overhead.

**Smart session titles**: two-stage. (1) After the first full exchange (user message + assistant reply), a cheap model generates a 3–6 word noun-phrase title — never the raw first message. (2) The idle-time auto-capture run refreshes the title if the conversation drifted from its starting topic. The idle run therefore emits three outputs in one call: memory operations, description, and (optionally) a corrected title.

**Browsable sessions**: `list_content` gains a `session` type returning id, title, description, updated_at — so "what did we discuss in the last 2 sessions?" resolves without loading transcripts; the bot loads a session's messages only when the user asks for specifics.

**SYSTEM chain**: the COMPACTION router category is renamed **SYSTEM** and serves every background job (compaction, title v1, idle run, weekly consolidation, workspace description drafting). One model list in the admin. Jobs are registered as `{ prompt, input builder, output schema }` entries pointing at the SYSTEM chain; none of them use tools — each is a single call returning strict JSON that the server applies.

| Job | Input | Output (JSON) |
|---|---|---|
| Compaction | old summary + messages since compaction watermark | new summary |
| Title v1 | first exchange | 3–6 word title |
| Idle run (auto-capture) | messages since capture watermark + existing cards/description | memory ops + description + corrected title |
| Weekly consolidation | memory cards only | merge/update/delete ops |
| Workspace description draft | workspace contents digest | one-line description |

**Scheduling & scale**:

- Scheduling infrastructure: Supabase `pg_cron` (same mechanism as the existing purge crons) triggers the sweeper and weekly endpoints. Local-only workspaces get no background runs (bot memory already requires cloud).
- Telegram sessions have real boundaries via `/new` (creates a new session in the app UI) and behave identically to web sessions; a never-`/new` chat simply gets its description refreshed at each idle gap.
- Idle runs are picked up by a **sweeper** (every ~10 min) that selects sessions idle >60 min with uncaptured messages, processed via a queue with a concurrency cap (3–5). Nothing user-facing waits on background jobs.
- **Incremental capture**: capture keeps its own watermark (`last_captured_message_id`); a resumed session's next run reads only new messages plus the existing description/title. No new messages → no run.
- **Skip threshold**: capture runs only for sessions with ≥3 user messages or at least one action (tool write); smaller sessions keep title v1 and get no description/memory pass.
- **Weekly runs are staggered** per user (hash of user id → day + hour of week).
- Compaction remains the only in-request job (per-session lock, fires only past the token threshold).

**Weekly consolidation**: a weekly background pass whose input is the memory cards only (never transcripts). It emits merge/update/delete operations via strict JSON: merges near-duplicates, rewrites facts superseded by newer ones, expires dated short-term facts. Model: cheap-smart tier. The run is silent; its results are visible in the memory cards UI and its operations are logged to the admin trace. Cost: <$0.01/user/week. Default ON with an opt-out toggle in bot settings.

Distinctions (to prevent confusion): session compaction summary (§7b) is invisible, per-session, purely technical context management; memory cards are visible, cross-session, about the user; session descriptions are per-session metadata for cross-session browsing. Session summaries are never silently promoted into memory.

## 7b. Compaction rework

Current implementation is defective and gets rebuilt:

Defects found: (1) when a summary exists the prompt window is hard-cut to the last 5 messages while re-compaction only fires past the token threshold — messages in between are in neither summary nor window (silent context hole; a direct cause of long-session focus loss); (2) compaction re-reads the last-20 fetch rather than "messages since last compaction" — older messages are lost, already-summarized ones are re-summarized (drift); (3) two uncoordinated triggers (pre-request when no summary exists + post-response fire-and-forget) with no locking — races and inconsistent `token_usage_total`; (4) `context_limit` hardcoded at 10k tokens and admin sliders are a no-op; token accounting is chars/4 even when providers report real usage.

New design (watermark compaction):

- Session state stores `last_compacted_message_id` (watermark).
- Prompt window is always `summary + all messages after the watermark`. No fixed slice — the context hole disappears by construction.
- Compaction consumes exactly `old summary + messages since watermark`, then advances the watermark. Nothing summarized twice, nothing dropped.
- Single pre-request trigger with a per-session lock (skip if already compacting).
- Admin compaction config becomes real (writes persist); context limits configurable per tier; provider-reported token usage preferred over estimates.

## 7c. Tool rework

> **Status correction (2026-07-13):** §0 previously marked this step "✅ Done," but that's inaccurate — found while investigating §6b. The `patch`-based surgical-edit capability described below DID ship (it lives inside `update_content`, see `handlers.ts:319`), but the actual `update_content`/`append_to_note` → `edit_content` **rename and merge never happened**: the tool is still called `update_content` with a separate `append_to_note`, not the unified `edit_content({ mode })` shape below. The `delete_content` `is_confirmed_by_user` removal also never happened (see §6b, which now formalizes and finally implements it). Toolset is still 7 tools, not 6. Marking the rename/removal as the remaining scope of this section; the `patch` capability itself does not need to be redone.

Toolset drops from 7 to 6: `create_content, edit_content, move_content, delete_content, list_content, manage_memory`.

**`edit_content` (new)** replaces both `update_content` and `append_to_note`:

```
edit_content({ id, mode: "replace" | "patch" | "append",
               content?, find?, replace?,
               title?, status?, priority?, dueDate?, ...,
               target? })
```

- `replace` = full body replacement (old update_content); `append` = old append_to_note; `patch` = targeted find-and-replace (new — avoids full rewrites of long notes, the main cause of content corruption/truncation).
- Metadata-only edits pass fields with no mode.
- `target` is reserved for canvas wiring later (`target: { blockId }` scopes patch/replace to one canvas block); `create_content`'s type enum will gain `"canvas"` at that point. Canvas tools are otherwise **out of scope** for this rework — designed so wiring them in later is additive (no renames, no prompt rework).

**Other tool changes:**

- `delete_content`: `is_confirmed_by_user` flag removed — the server owns pending confirmations (§6). Model calls delete → server returns dry-run list and stores the pending action → user's "yes" executes deterministically.
- `list_content`: gains `session` type (§7) and date-range task filters `taskFilters.dueDate: { from, to }` alongside `today`/`overdue`.
- `create_content`: server-side duplicate guard — returns a soft warning when a same-titled item exists in the same location, instead of relying on a prompt rule; `reminder` field wired to the notifications scheduler (§8).
- MAX_TOOL_HOPS: 8 on Smart tier, 4 on Light (currently hardcoded 4 everywhere).

## 8. Notifications v1

Today `reminder` is a stored string that nothing fires. New:

- **Scheduler**: periodic job scans upcoming task reminders/due dates and dispatches due notifications. Table designed so scheduled actions can later reuse it.
- **Provider abstraction**: `NotificationProvider` interface; v1 implementations: **Telegram** (bot message) and **in-app**. Email/Apple later.
- **In-app surface**: notification bell replaces the Download Desktop button next to the profile card; Download Desktop moves into the profile popup under Settings. Toast when the app is open at fire time.
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

Live status lives in **§0**. This is the sequence; it has been reordered once (see
note below). Work is folded into this spec — no separate plan documents.

1. ✅ P0 fixes (§9) — independent, shipped first.
2. ✅ Category collapse + classifier simplification (§2) + thinking values (§3) + PRIMARY tiers (§4) — behind a `router_v2` flag; verified live, flag enabled. Classifier model swap (gpt-oss-20b vs llama-3.1-8b) **deferred**: the few-shot "count the operations" prompt stabilized llama-8b.
2b. 🟡 Tool rework (§7c) — partially done, see status correction in §7c and §0.
4a. ✅ Grounding guard + tool-loop guard (§6a) — pulled forward out of step 4.
8. ✅ Prompt diet (§10) — substantially done alongside step 2 (~9k→~4k tokens, prompt caching fixed).

**⬅️ NEXT — 7b. Compaction rework (§7b).**

> **Reorder note (2026-07-13, second reorder):** step 4b was moved ahead of 7b/3/6/7.
> Live testing after step 5 shipped surfaced three more broken behaviours, this time
> in core tool execution rather than attachments: the bot claiming a delete succeeded
> when it hadn't and then contradicting itself about what it was even deleting (§6b),
> losing track of the active topic mid-conversation with no compaction involved (§6c),
> and verbatim system-prompt scaffolding leaking into saved note content (§6d). These
> are the same class of "broken, not just suboptimal" issue that justified the first
> reorder — a user cannot trust the bot's tool calls at all until §6b/§6d ship. §7b
> (compaction) remains valuable but does not fix any of these three; see §6c's
> "why this section exists" note for why compaction and focus-tracking are different
> problems.

Remaining, in order:

5. ✅ **Attachments** — §5b (native pipeline, delete the twin) + §5c (durable storage, Option A) + §5d (Telegram parity). Suggested internal order: §5d bug 3 (`clientTime`, quick + standalone) → §5c (unblocks §5d bug 2) → §5b (core) → §5d bugs 1-2.
4b. ✅ **Action state** — §6b (pending confirmations) → §6d (content sanitization) → §6c (focus tracking). All shipped 2026-07-13.
7b. Compaction rework (§7b) — pairs naturally with §5b's history cost policy.
3. Context pack + workspace descriptions (§5).
6. Memory v2 incl. session descriptions (§7).
7. Notifications v1 (§8).
