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
| 2b | Tool rework (§7c) | ✅ **Done** |
| 4a | Grounding guard + tool-loop guard (part of §6) | ✅ **Done** — pulled forward, see §6 |
| 8 | Prompt diet (§10) | ✅ **Substantially done** — prompt ~9k→~4k tokens, caching fixed |
| 5 | Native attachments (§5b) + attachment storage (§5c) + Telegram parity (§5d) | 🟡 **In progress.** §5d bug 3 (timezone) done. §5c (storage) done, code-complete, cross-device test pending. ⬅️ **NEXT: §5b** (native attachments, delete the twin). |
| 7b | Compaction rework | ⬜ Not started |
| 3 | Context pack (§5) | ⬜ Not started |
| 4b | Server-side action state (§6) | ⬜ Not started |
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

> **Status: NEXT.** Root causes below verified in code 2026-07-13.

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

**Bug 1 — an album produces one reply per image.** `media_group_id` appears nowhere in `src/app/api/telegram/webhook/route.ts`. Telegram delivers an album as N separate updates sharing that id; each is processed as an independent message. `photoBuffer` is also a single `Buffer`. (`runChain` already accepts `Buffer[]` — `chainRouter.ts:159` — so only the webhook is single-image.)

**The naive fix is wrong:** album items arrive as **separate serverless invocations with no shared memory**, so an in-memory map/debounce works locally and silently breaks on Vercel. Batching state must live in the DB:

1. Migration: `telegram_media_groups(media_group_id text primary key, chat_id text, file_ids jsonb, caption text, processed boolean default false, created_at timestamptz default now())`.
2. On a message with `media_group_id`, append its `file_id` (and the caption — Telegram puts it on only one item of the album).
3. After a short settle window (~1.5-2s), **claim atomically**: `UPDATE … SET processed = true WHERE media_group_id = $1 AND processed = false RETURNING *`. Only the claiming invocation runs `runChain`; the others return 200 and do nothing.
4. The claimer downloads all `file_ids` and calls `runChain` once with the full attachment set (via the §5b pipeline).
5. Clean up rows older than ~10 minutes.

**Bug 2 — Telegram images show as empty bubbles in the web chat.** The webhook **never persists attachments**: it downloads each photo to a Buffer, hands it to `runChain`, and writes no `attachments` array on the message row. Fix: upload each file to the §5c durable store and write the URLs into the message's `attachments` (shape: `AIAttachment`, `src/data/store.types.ts:266`).

**Bug 3 — wrong timezone on Telegram — ✅ DONE (2026-07-13).** The webhook's `runChain` call passed no `clientTime`, unlike the web route, so the server fell back to its own clock (UTC on Vercel). Root cause turned out bigger than expected: `manualTimezone` lived only in browser Zustand state and wasn't even in `partialize` (didn't survive a reload), so there was nothing durable to read cross-surface. Fixed properly per owner decision: new `user_settings` table (RLS-scoped like `bot_memories`), the Settings timezone picker now persists there (`saveTimezone` action) and loads on mount, and the Telegram webhook reads the same row and builds `clientTime` with the shared `getClientTime()` helper. **Opt-in, not automatic** — a user who has never opened Settings and picked a timezone sees no change (same server-clock fallback as before).

**Also missing vs. the web route** (lower priority, decide case by case): `clientHistory`, `thinkingEnabled`, `replyContext`, `intentTag`, `advisorEnabled`.

**Acceptance:** a 4-image album → exactly ONE reply referencing all four, images render in the web chat, and "remind me tomorrow 6pm" lands at 6pm **local**.

## 6. Server-side action state (pending confirmations & multi-step ops)

### 6a. Grounding guard + tool-loop guard — ✅ DONE (2026-07-12, pulled forward)

Grounding guard: after each turn, if the reply text claims a create/update/delete but no matching successful tool call happened this turn, the reply is regenerated or replaced with an honest error. Error sentinels (`*System Overload*`) are never written into replayable history.

**Shipped.** `hasUngroundedActionClaim` previously returned "fine" as soon as **any** tool call was captured, regardless of outcome — so a *failed* `create_content` still let the bot say "Done. Created your note." It now requires a **mutating** tool (create/update/append/move/delete/manage_memory) to have actually **succeeded**; a successful *read* never grounds a mutation claim. Fails safe (a mutation with no success flag counts as succeeded, so the bot is never falsely accused).

**Also shipped (not originally specced):** a **repeat-call guard**. Nothing stopped a model re-issuing an identical tool call that had just failed, burning every remaining hop — worse since Smart tier moved to 8 hops. `checkRepeatedFailure`/`recordToolFailure` live in the shared `toolLoopConfig.ts` (deliberately shared, not inlined per-provider — that duplication is exactly how `MAX_TOOL_HOPS` drifted). On an exact repeat of an already-failed call the handler is skipped and the model gets a synthetic result naming the prior error. It is a **nudge, not a loop-kill**: different args, different tools, and repeated successful reads all still run, so legitimate retries survive.

### 6b. Action state — ⬜ NOT STARTED

New session-scoped state object (stored with session state) tracking:

- **Pending confirmation**: e.g. delete dry-run issued → list of ids awaiting yes/no. A following "yes" executes deterministically; "no"/anything else clears it. No re-classification of "yes".
- **Multi-step operations**: e.g. create workspace → create note inside; step list with produced ids, so step 2 survives model failures and swaps.

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
2b. ✅ Tool rework (§7c).
4a. ✅ Grounding guard + tool-loop guard (§6a) — pulled forward out of step 4.
8. ✅ Prompt diet (§10) — substantially done alongside step 2 (~9k→~4k tokens, prompt caching fixed).

**⬅️ NEXT — 5. Attachments (§5b native pipeline + §5c durable storage + §5d Telegram parity).**

> **Reorder note (2026-07-13):** step 5 was moved ahead of steps 3 and 4b. The
> original order was written before live testing surfaced four broken behaviours:
> images invisible across devices (§5c), Telegram albums split into N replies and
> images not persisted (§5d), and image+action turns being structurally impossible
> (§5b). Those are broken functionality; steps 3 and 4b are quality improvements.
> Broken beats better.

Remaining, in order:

5. **Attachments** — §5b (native pipeline, delete the twin) + §5c (durable storage, Option A) + §5d (Telegram parity). Suggested internal order: §5d bug 3 (`clientTime`, quick + standalone) → §5c (unblocks §5d bug 2) → §5b (core) → §5d bugs 1-2.
7b. Compaction rework (§7b) — pairs naturally with §5b's history cost policy.
3. Context pack + workspace descriptions (§5).
4b. Action state (§6b).
6. Memory v2 incl. session descriptions (§7).
7. Notifications v1 (§8).
