# Plan 5 — Attachments & Vision Actions

**Status:** root causes verified in code (2026-07-13). Four distinct bugs, not two.

**Audience note:** Tasks 5.1 and 5.3 involve cross-device storage and Electron
packaging that CANNOT be verified by an executor with one machine. Those are
marked **[owner-session]** — do them with the repo owner present to test, not as
a blind hand-off. Tasks 5.2 and 5.4 are safely hand-offable.

---

## The bugs (as reported)

1. Images attached on the PC are invisible on the Mac, and vice-versa — in both
   chat and tasks.
2. Sending several images from Telegram produces one bot reply *per image*
   instead of one reply for the album.
3. Those Telegram images show up in the web chat as **empty bubbles**.
4. "Create a note from this" (with an image) makes the bot *describe* the image
   in chat — no note is ever created.

## Verified root causes (all confirmed by reading the code)

| # | Bug | Root cause |
|---|---|---|
| 5.1 | Cross-device images broken | `src/app/api/ai/upload/route.ts` uploads to Supabase Storage **only if `supabaseAdmin` exists**. `supabaseAdmin` (`src/lib/supabase.ts:61`) requires `SUPABASE_SERVICE_ROLE_KEY`. The Electron app loads env from a `.env` file at runtime (`electron/main.js:174-198`), and `.env` is **not in electron-builder's `files` list** (`package.json` ~line 96) — so it isn't shipped. Therefore `supabaseAdmin` is null on desktop, the route **always** falls back to writing `public/user_uploads/<file>` on **that machine's local disk**, and returns a machine-local URL (`/user_uploads/x.png`). The URL syncs via the DB; the file does not. Each device only renders its own images. |
| 5.2 | Telegram album → N replies | `media_group_id` appears **nowhere** in `src/app/api/telegram/webhook/route.ts`. Telegram delivers an album as N separate update events sharing a `media_group_id`; each is processed as an independent message. Also `photoBuffer` (line ~558) is a single `Buffer`, so one message can't carry several images anyway. (`runChain` itself already accepts `Buffer[]` — `chainRouter.ts:159` — so the pipeline is fine; only the webhook is single-image.) |
| 5.3 | Telegram images = empty bubbles | The webhook **never persists attachments**: it downloads each photo into a Buffer via `telegram.downloadFile` and hands it to `runChain`. There is no upload to Storage and no `attachments` array written to the message row — so the web chat renders a message with no viewable image. |
| 5.4 | "Create a note from this" creates nothing | Two independent blockers. (a) The Specialized Vision Flow in `chainRouter.ts` has a `FAST_SIMPLE` branch (~line 450-470) that **returns the vision model's prose directly**, never reaching classification or the PRIMARY chain. (b) Even if it did, `useTools` (`chainRouter.ts:970`) is `['REGULAR','COMPLEX','CODING','ADVISOR','WEB_SEARCH','RESEARCH','PRIMARY']` — **`VISION` is not in it**. So an image turn is structurally incapable of calling `create_content`. It can only describe. |

---

## Task 5.1 — Make uploads durable across devices **[owner-session]**

**Goal:** an image attached on any device is visible on every device.

**The fix is NOT "prefer Supabase in the upload route"** — on desktop that route
cannot reach Supabase at all (no service-role key). Two viable designs; pick one
with the owner:

- **Option A (recommended): upload from the client using the user's own session.**
  The browser/renderer already has an authenticated Supabase session (that's how
  DB sync works). Upload directly to the `user_uploads` bucket from the client
  with the anon key + RLS, and store the resulting **public Supabase URL** on the
  attachment. The `/api/ai/upload` route stays only as a server-side path for
  Telegram. Requires a storage RLS policy allowing authenticated users to insert
  into `user_uploads`.
- **Option B: ship the service-role key in the desktop build.** Simplest code
  change (add `.env` to electron-builder `files`) but **puts a service-role
  secret on every user's disk** — it bypasses RLS entirely. Do not do this.

Additional bug to fix while here: `src/app/api/images/route.ts` has
`SAFE_FILENAME` restricted to `png|jpe?g|gif|webp`, so **any PDF/other file**
uploaded to Storage returns a `/api/images?file=...pdf` URL that this route
rejects with 400. Widen it (or route non-images differently).

**Migration:** existing attachments already point at dead local paths. Decide with
the owner whether to backfill (re-upload where the file still exists on one
machine) or accept that historical images stay broken.

**Verify:** attach an image on PC → open the same chat on Mac → image renders.
And vice-versa. This is the acceptance test; it needs two machines.

---

## Task 5.2 — Batch Telegram album into one request (hand-offable)

**File:** `src/app/api/telegram/webhook/route.ts`

**What to do:** when an incoming message has `media_group_id`, do not process it
immediately. Collect the group, then run `runChain` **once** with all the images.

**CRITICAL — the naive fix is wrong.** Album items arrive as **separate serverless
invocations with no shared memory**. An in-memory `Map`/debounce works locally and
silently breaks on Vercel. The batching state MUST live in the database.

**Design:**
1. New table (migration): `telegram_media_groups(media_group_id text primary key,
   chat_id text, file_ids jsonb, caption text, created_at timestamptz default now())`.
2. On a message with `media_group_id`: upsert/append this photo's `file_id` (and the
   caption if this item carries one — Telegram puts the caption on only one item)
   into the row. Then wait a short settle window (~1.5-2s) and re-read the row.
3. Exactly one invocation should proceed: claim the group atomically (e.g. an
   `UPDATE ... WHERE processed = false RETURNING *` — add a `processed boolean
   default false` column) so only the claiming invocation runs `runChain`; the
   others return 200 and do nothing.
4. The claimer downloads **all** `file_ids` into `Buffer[]` and calls
   `runChain(prompt, buffers, ...)` — it already accepts an array
   (`chainRouter.ts:159`).
5. Clean up rows older than ~10 minutes (cheap `delete` on read, or a cron).

**Verify:** send a 4-image album from Telegram → exactly ONE bot reply, and it
references all four images.

---

## Task 5.3 — Persist Telegram attachments so they render in the web chat **[owner-session]**

**Depends on 5.1** (needs a working durable-upload path).

**File:** `src/app/api/telegram/webhook/route.ts`

**What to do:** after downloading each photo Buffer, upload it to the same durable
store 5.1 lands on, and write the resulting URLs into the message row's
`attachments` array (shape: `AIAttachment` in `src/data/store.types.ts:266` —
`{type:'image', url, name}`). Today the webhook writes no attachments at all, which
is why the web chat shows empty bubbles.

**Verify:** send an image from Telegram → open the web chat → the image renders in
the message bubble.

---

## Task 5.4 — Let image turns actually perform actions (hand-offable, but review carefully)

**Goal:** "create a note from this image" creates a note.

**File:** `src/lib/bot/chainRouter.ts`

Two blockers, fix both:

1. **The vision flow returns early.** The `FAST_SIMPLE` branch (~line 450-470)
   returns the vision model's prose as the final answer. Instead, the vision step
   should act as a **pre-pass that produces the image description**, then let the
   request continue into normal classification/PRIMARY with that description
   available as context (the code already builds a `[VISION DATA - DIGITAL TWIN]`
   block and stashes it on `context.vision_notes` — that's the mechanism to reuse).
   Only short-circuit when the user's message is *purely* "what is this?" with no
   action verb — and even then, prefer letting PRIMARY answer it, since PRIMARY
   with vision context can both describe AND act.
2. **Tools are off for vision.** `useTools` (line ~970) omits `VISION`. Once (1)
   routes image turns into PRIMARY this is mostly moot, but audit that the
   category an image turn ends up in is tool-enabled.

**Care required:** this changes the routing path for every image message. Keep the
existing vision *description* quality (the digital-twin prompt) — the goal is to
stop the early-return, not to remove the vision pre-pass.

**Verify:** attach an image + "create a note from this" → a note is created
containing the image's content. Attach an image + "what is this?" → still a clean
description, no spurious note.

---

## Suggested order

5.1 (unblocks 5.3) → 5.4 (biggest user-visible win, independent) → 5.2 → 5.3.

## Done criteria

`npm test` green, `npx tsc --noEmit` clean, and the per-task behavioral checks
above pass on **two devices** for 5.1/5.3. Do not push or release.
