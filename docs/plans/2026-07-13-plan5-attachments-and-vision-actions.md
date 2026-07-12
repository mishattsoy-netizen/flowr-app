# Plan 5 — Native attachments (spec §5b) + durable image storage

**Status:** root causes verified in code (2026-07-13). Supersedes an earlier draft
of this file that proposed patching the VISION flow — that was wrong. The spec
(`docs/superpowers/specs/2026-07-11-bot-rework-design.md` §5b) says to **delete**
the digital-twin/VISION architecture, not patch it. This plan implements §5b.

**Owner-session vs hand-off:** 5.1 (storage) involves cross-device behavior and
Electron packaging that an executor with one machine cannot verify — do it with
the owner present. 5.2 (native attachments) is the core spec work and is subtle;
recommend owner-session too. 5.3/5.4 are more mechanical.

---

## The bugs (as reported by the owner)

1. Images attached on the PC are invisible on the Mac, and vice-versa (chat + tasks).
2. A Telegram album produces one bot reply **per image** instead of one for the set.
3. Those Telegram images appear in the web chat as **empty bubbles**.
4. "Create a note from this" (with an image) makes the bot *describe* the image in
   chat — no note is created.

## Verified root causes

| # | Bug | Root cause |
|---|---|---|
| A | Cross-device images broken | `src/app/api/ai/upload/route.ts` uploads to Supabase Storage only if `supabaseAdmin` exists. `supabaseAdmin` (`src/lib/supabase.ts:61`) needs `SUPABASE_SERVICE_ROLE_KEY`. Electron loads env from a `.env` at runtime (`electron/main.js:174-198`) but **`.env` is not in electron-builder's `files` list** (`package.json` ~96), so it never ships. On desktop `supabaseAdmin` is null → the route **always** writes to that machine's local disk (`public/user_uploads/…`) and returns a machine-local URL. The URL syncs via the DB; the file doesn't. Each device sees only its own images. |
| B | Image + action = no action | **Legacy code the rework was supposed to delete.** The VISION chain runs as a pre-pass, and its `FAST_SIMPLE` branch (`chainRouter.ts` ~450-470) **returns the vision model's prose directly** — classifier and PRIMARY never run, so `create_content` is unreachable. Separately, `useTools` (`chainRouter.ts:970`) omits `VISION`. Spec §5b explicitly lists `logic_nature`/`FAST_SIMPLE` and the VISION category as **deleted**. |
| C | Images never reach PRIMARY | Image buffers are passed **only** to the VISION chain (`chainRouter.ts:368`). `executeProvider` — which runs PRIMARY — takes **no image argument at all**. PRIMARY only ever sees a lossy *text description* of the image. Spec §5b: all chain models are multimodal; pass images **natively**. |
| D | Telegram album → N replies | `media_group_id` appears nowhere in `src/app/api/telegram/webhook/route.ts`. Telegram sends an album as N separate updates sharing that id; each is handled as its own message. `photoBuffer` is also a single `Buffer`. (`runChain` already accepts `Buffer[]` — `chainRouter.ts:159` — so only the webhook is single-image.) |
| E | Telegram images = empty bubbles | The webhook **never persists attachments** — it downloads each photo to a Buffer, passes it to `runChain`, and writes no `attachments` array on the message row. |
| F | Telegram timezone wrong | The webhook's `runChain` call (`webhook/route.ts:579`) passes **no `clientTime`**, unlike the web route (`api/ai/chat/route.ts:190`). The server falls back to its own clock (UTC on Vercel), so "remind me tomorrow 6pm" and the today/overdue task filters compute against the wrong timezone. |

---

## Task 5.1 — Durable, cross-device attachment storage **[owner-session]**

Fixes **A**. Prerequisite for 5.3.

**The fix is NOT "prefer Supabase in the upload route"** — on desktop that route
*cannot* reach Supabase (no service-role key). Options:

- **Option A (recommended): upload from the client with the user's own session.**
  The renderer already holds an authenticated Supabase session (that's how DB sync
  works). Upload straight to the `user_uploads` bucket with the anon key under RLS,
  and store the returned **public Supabase URL** on the attachment. Keep
  `/api/ai/upload` only as the server-side path (Telegram).
  Needs: a storage RLS policy letting authenticated users insert into `user_uploads`.
- **Option B: ship the service-role key in the desktop build.** One-line change
  (add `.env` to electron-builder `files`) but it puts an **RLS-bypassing secret on
  every user's disk**. Do not do this.

**Also fix while here:** `src/app/api/images/route.ts` `SAFE_FILENAME` only allows
`png|jpe?g|gif|webp`, so any **PDF/other file** stored in Supabase returns a
`/api/images?file=…pdf` URL that this route rejects with 400.

**Migration:** existing attachments point at dead local paths. Decide with the owner
whether to backfill from whichever machine still has the file, or accept that
historical images stay broken.

**Verify:** attach an image on PC → open that chat on the Mac → it renders. And the
reverse. Requires two machines.

---

## Task 5.2 — Native attachments, delete the twin (spec §5b) **[owner-session]**

Fixes **B** and **C**. This is the core of the plan.

**Delete** (per §5b): the VISION chain/category, `[VISION_CONTEXT]` parsing, the
vision-first orchestration handoff (`logic_nature` / `FAST_SIMPLE`), and twin
injection in `memory.ts`.

**Build** the unified pipeline (same code path for web and Telegram):

1. Every upload normalizes to `{ kind: 'image'|'pdf'|'text', name, mime, data }`.
   - images/pdf → **native message parts** on the model call.
   - md/txt → labeled text blocks (`[FILE: name] …`).
   - docx → server-side text extraction (e.g. mammoth), then treated as text.
2. Mixed multi-attachment requests become **one ordered parts array** — no per-type
   special-casing downstream.
3. Caps: ~10 attachments/message, per-file size limits, oversized text truncated
   with a marker.
4. **Thread attachments through to `executeProvider`** so PRIMARY receives them.
   Today it takes no image argument (root cause C) — this is the central code change.
   The providers already accept image buffers (`runOpenRouter`/`runGoogle` take an
   `imageBuffers` param); the gap is `chainRouter` never passing them past VISION.
5. **Routing:** any turn with attachments → **Smart tier** (all Smart models are
   multimodal). The classifier stays **text-only** and receives an attachment hint
   like `[3 images, 1 pdf attached]`.
6. **History cost policy:** images stay native for recent turns of the session; when
   an image ages past the recency window (or on compaction) it is replaced in history
   by a **one-time cached description stored on its own message** — generated once,
   never reattached to the wrong turn. Generated images keep the existing narration step.

**Why this beats patching the twin:** the model sees the actual image instead of a
lossy text description of it, and image turns flow through PRIMARY where tools live —
so "create a note from this" works by construction.

**Verify:** image + "create a note from this" → a note is created with the image's
content. Image + "what is this?" → clean description, no spurious note. Multi-image +
PDF in one message → single coherent answer.

---

## Task 5.3 — Telegram: album batching + attachment persistence

Fixes **D** and **E**. Depends on 5.1 (durable storage) and 5.2 (unified pipeline).

**File:** `src/app/api/telegram/webhook/route.ts`

**Album batching (D) — the naive fix is wrong.** Album items arrive as **separate
serverless invocations with no shared memory**; an in-memory `Map`/debounce works
locally and silently breaks on Vercel. State MUST live in the DB.

1. Migration: `telegram_media_groups(media_group_id text primary key, chat_id text,
   file_ids jsonb, caption text, processed boolean default false,
   created_at timestamptz default now())`.
2. On a message with `media_group_id`: append this photo's `file_id` (and the caption
   — Telegram puts it on only one item of the album) to the row.
3. Wait a short settle window (~1.5-2s), then **claim atomically**:
   `UPDATE … SET processed = true WHERE media_group_id = $1 AND processed = false
   RETURNING *`. Only the claiming invocation proceeds; the others return 200 and do
   nothing.
4. The claimer downloads **all** `file_ids` and calls `runChain` once with the full
   attachment set (via the 5.2 pipeline).
5. Clean up rows older than ~10 min.

**Attachment persistence (E):** upload each Telegram file to the durable store from
5.1 and write the URLs into the message row's `attachments` array (shape:
`AIAttachment`, `src/data/store.types.ts:266`). This is why the web chat currently
shows empty bubbles.

**Verify:** 4-image album from Telegram → exactly ONE bot reply referencing all four,
and the images render in the web chat.

---

## Task 5.4 — Telegram: pass `clientTime` (small, standalone)

Fixes **F**. Independent of everything else — can ship first.

The webhook's `runChain` call passes no `clientTime`, so date/time math runs in the
server's timezone. Pass the user's timezone through (persist it on the linked user
record, or derive from Telegram if available) so "tomorrow 6pm", "today", and
"overdue" are correct on Telegram as they are on web.

**Verify:** from Telegram, "remind me tomorrow at 6pm" → the task's due time is 6pm
**local**, not 6pm UTC.

---

## Suggested order

5.4 (quick, independent) → 5.1 (unblocks 5.3) → 5.2 (core) → 5.3.

## Done criteria

`npm test` green, `npx tsc --noEmit` clean, per-task behavioral checks pass.
5.1/5.3 need **two devices** to verify. Do not push or release.

## Out of scope

Notifications/scheduler (spec §8), action state (spec §6), memory v2 — later plans.
