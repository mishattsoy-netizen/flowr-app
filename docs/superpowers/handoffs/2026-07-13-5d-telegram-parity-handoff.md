# Handoff: §5d Telegram parity — media-group batching + attachment persistence

**You are implementing one section of a living spec.** Read `docs/superpowers/specs/2026-07-11-bot-rework-design.md` §5d first (search for "## 5d. Telegram parity"). That section is the source of truth for *why*; this doc is the source of truth for *exactly what to change, file by file*. If they conflict, the spec wins on intent, this doc wins on mechanics — but if you find a real conflict, stop and flag it instead of guessing.

**Do not invent a new plan doc.** When you finish, update the spec's §5d, §0, and §13 sections in place (template at the bottom). Do not create a "plan N" file.

## Status going in

§5d bug 3 (timezone) is **already done** — do not touch it, it's unrelated to this task and already verified working. This handoff covers **bug 1** (album → N replies) and **bug 2** (Telegram images don't render in web chat). Both bugs live in the same file: `src/app/api/telegram/webhook/route.ts`. §5b (native attachments, PRIMARY receives real image bytes) and §5c (durable Supabase Storage for attachments) are both done and this task builds directly on them — you are not re-solving either.

## The two bugs, in plain terms

**Bug 1:** when a user sends multiple photos as one Telegram "album," Telegram doesn't deliver it as one message — it delivers **N separate webhook calls**, one per photo, each sharing a `media_group_id` field. Today the webhook has zero awareness of `media_group_id`: each of the N calls is processed as if it were its own independent message, so `runChain` gets called N times and the user gets N separate bot replies instead of one reply covering all N images.

**Bug 2:** when a user sends a photo (single or from an album) via Telegram, the webhook downloads it into a `Buffer`, passes that buffer to `runChain` so the model can see it — but never uploads that image to durable storage and never writes anything into the message's `attachments` field. So when that conversation is later viewed in the web app, the user's message bubble shows the caption text but the image itself is just gone — no `attachments` array was ever persisted for it. (Contrast with the web upload flow, which uploads to Supabase Storage first and stores the resulting URL in `attachments` — see §5c.)

## Why the naive fix for bug 1 is wrong — read this before writing any code

Your first instinct will be "just buffer the album in memory for ~2 seconds, then process it once." **That will pass local testing and then silently break in production.** This app deploys to Vercel. Each of the N webhook calls for one album is a **separate serverless function invocation** — they do not share memory, a module-level `Map`, or any in-process state. An in-memory debounce works great on `localhost` (one long-running Node process) and does nothing on Vercel (N cold-or-warm invocations that never talk to each other). You must coordinate through the database, not through memory.

## Files you will touch

1. New migration: `supabase/migrations/20260714_telegram_media_groups.sql`
2. `src/app/api/telegram/webhook/route.ts` — both bugs live here.
3. `docs/superpowers/specs/2026-07-11-bot-rework-design.md` — mark §5d bugs 1-2 done, update §0/§13. Separate commit from the code.

Do NOT touch: `chainRouter.ts`, `providerExecution.ts`, `classifier.ts`, `image-narration.ts`, `memory.ts`, `src/app/api/ai/upload/route.ts` (the web upload route), `AIAssistant.tsx`, `TaskInspectorPanel.tsx`. None of §5b/§5c's code needs to change — `runChain` already accepts `Buffer[]` (confirmed: `chainRouter.ts:159`, `inputBuffer?: Buffer | Buffer[]`), and the durable-storage bucket/RLS from §5c (`user_uploads`, migration `20260713_user_uploads_bucket_rls.sql`) already exists and already allow-lists image MIME types. You are only wiring the *webhook* to use both of those correctly — nothing about how images are consumed downstream needs to change.

---

## Step 1 — Migration: `telegram_media_groups` table

Create `supabase/migrations/20260714_telegram_media_groups.sql`:

```sql
-- Telegram delivers a multi-photo "album" as N separate webhook invocations
-- sharing a media_group_id, with no shared process memory between them
-- (each is its own serverless invocation on Vercel). This table is the
-- coordination point: every invocation for the same album appends its
-- file_id here; after a short settle window, exactly one invocation wins
-- an atomic claim and processes the whole batch. See spec §5d bug 1.
create table if not exists telegram_media_groups (
  media_group_id text primary key,
  chat_id text not null,
  file_ids jsonb not null default '[]'::jsonb,
  caption text,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS is not needed here — this table is only ever touched by the webhook
-- route using supabaseAdmin (service role), never from the client.
alter table telegram_media_groups enable row level security;
-- No policies added: service-role key bypasses RLS entirely; this blocks
-- any accidental anon/authenticated access.
```

Run/apply it the same way other recent migrations in this repo were applied (check how `20260713_user_settings_timezone.sql` was rolled out — likely `supabase db push` or the project's existing migration-apply script; don't invent a new mechanism).

## Step 2 — Bug 1: batch album webhook calls

### 2a. Where you're editing

In `src/app/api/telegram/webhook/route.ts`, the relevant existing code is around lines 232-238 (message/photo extraction) and lines 558-602 (photo handling → `runChain` call). Telegram's `message` payload for an album item includes `message.media_group_id` (a string) when the message is part of a group; it's `undefined` for a normal single photo or a plain text message.

### 2b. The flow to implement

Right after `const photo = message.photo` (line 237) and before the existing command-handling logic, add a branch: if `message.media_group_id` is present, this message is part of an album and needs the batching treatment instead of the normal single-message flow.

For an album item:

1. **Upsert into `telegram_media_groups`.** If no row exists for this `media_group_id`, insert one with `chat_id`, `file_ids: [photo[photo.length-1].file_id]`, and `caption: message.caption || null` (Telegram puts the caption on only one item of the album — whichever one has it; don't overwrite an existing non-null caption with null on a later item). If a row already exists, append this item's largest-resolution `file_id` to the existing `file_ids` array (read-modify-write is fine here — worst case is a rare double-append under high concurrency, which just means one image processed twice; not worth a DB-level array-append function for Telegram's realistic album sizes of ≤10).
2. **Wait out a settle window, then attempt to claim.** After appending, wait ~1.5-2s (Telegram delivers album items in quick succession, but not simultaneously — this window lets all N items land before anyone tries to process). A `setTimeout`/`await new Promise(r => setTimeout(r, 1800))` inside the same request handler is fine — each of the N invocations independently waits, then independently tries to claim.
3. **Claim atomically.** After the wait, run:
   ```sql
   UPDATE telegram_media_groups
   SET processed = true
   WHERE media_group_id = $1 AND processed = false
   RETURNING *
   ```
   via `supabaseAdmin!.from('telegram_media_groups').update({ processed: true }).eq('media_group_id', mediaGroupId).eq('processed', false).select().maybeSingle()`. **Only the invocation whose `UPDATE` actually matched a row (i.e. got a non-null row back) proceeds to run the chain.** Every other invocation (whether it arrived before or after the claim) sees `processed` already `true`, gets no row back, and should just return `NextResponse.json({ ok: true })` immediately — doing nothing further.
4. **The claimer downloads all images and calls `runChain` once.** Loop over the claimed row's `file_ids`, calling `telegram.getFile()` + `telegram.downloadFile()` for each (same pattern as the existing single-photo code at lines 566-568), building a `Buffer[]`. Use the row's `caption` (or `''` if null) as the prompt text. Call `runChain(caption, bufferArray, { ...same context as today })` — this is the one-line reason `runChain` already accepting `Buffer[]` matters; you don't need to call it once per image.
5. **Send exactly one reply**, same as the existing non-album flow (lines 604-635) — reuse that logic; don't duplicate it. The cleanest approach is probably to extract the existing "call runChain then send response then log" block (lines 593-635) into a small helper function that both the normal path and the album-claimer path call with `(activePrompt, photoBuffer | bufferArray, ...)`.
6. **Non-claimers still need to ack Telegram.** Return `{ ok: true }` with a 200 status even when not claiming — Telegram retries webhooks that don't return 200, and you don't want N retries of a no-op.

### 2c. Cleanup

Add a cheap best-effort cleanup: when handling any album item, before/after your main logic, delete rows from `telegram_media_groups` where `created_at < now() - interval '10 minutes'`. Don't make this its own cron job — a fire-and-forget `DELETE ... WHERE created_at < ...` on every album-webhook hit is enough to keep the table from growing unbounded; wrap it in a `.catch(() => {})` so a failure here never breaks the actual message flow.

### 2d. Things to be careful about

- **Don't let the claim race become the "who replies" decision for a single photo.** Only apply this whole batching path when `message.media_group_id` is present. A normal single photo (no `media_group_id`) must go through the existing unmodified code path — don't add latency or DB round-trips to the common case.
- **The `caption` can arrive on any one of the N items, not necessarily the first.** Your upsert logic must not clobber an already-stored non-null caption with a later null one. Use something like: on conflict, `file_ids = file_ids || new_file_id`, `caption = coalesce(existing.caption, new.caption)` — or just do a manual read-then-write with that same precedence in application code if a single SQL upsert is awkward.
- **Auth/credit reservation:** the existing code reserves credit (`reserve_credit_for_user`) and checks `checkUserAndLimits` per-invocation, before it knows whether this invocation will end up being the claimer. That's fine to leave as-is for now — every album item still goes through the normal per-message rate-limit/auth checks (this matches how a burst of N normal messages would already be treated), but only the actual claimer spends model cost by calling `runChain`. Do not try to defer the credit check to "only the claimer" — that would require restructuring auth/limit-checking around the claim, which is out of scope; the current per-message credit check is a pre-existing, acceptable cost of doing business here.

## Step 3 — Bug 2: persist attachments so images render in web chat

### 3a. What's missing today

Look at `syncTelegramMessages` (lines 28-80) — it inserts a `messages` row for the user's turn (`supabaseAdmin!.from('messages').insert({ conversation_id: chatId, role: 'user', content: userMessage })`, line 66) with **no `attachments` field at all**. Compare to the web upload flow: `insertMessage()` in `src/lib/chat.ts` (lines 195-231) takes an `attachments` param and — when present — appends it onto `content` as `\n\n<!-- ATTACHMENTS_JSON:${JSON.stringify(sanitizedAttachments)} -->`, which `fetchMessages` (same file, lines 172-180) later strips back out and parses into `ChatMessage.attachments`. **This embedded-HTML-comment-in-content trick, not a real `attachments` column, is how the web app already represents attachments — there is no separate `attachments` column on the `messages` table to write to.** You must follow the exact same convention, not invent a new one.

### 3b. What to add

For a Telegram message that includes photo(s) (both the single-photo path and the new album-claimer path from Step 2), before calling `syncTelegramMessages`:

1. **Upload each downloaded buffer to the `user_uploads` Supabase Storage bucket** (the same bucket §5c's migration `20260713_user_uploads_bucket_rls.sql` created and RLS'd). Since this is server-side (using `supabaseAdmin`, the service-role client — not the client-side authenticated-session upload pattern §5c used for the web routes, because there is no browser session in a webhook), you can upload directly:
   ```ts
   const filename = `${linkedAuthUserId}/telegram-${Date.now()}-${crypto.randomUUID()}.jpg`
   const { error } = await supabaseAdmin!.storage.from('user_uploads').upload(filename, buffer, {
     contentType: 'image/jpeg', // Telegram photos are always JPEG
     cacheControl: '31536000',
     upsert: false,
   })
   ```
   **Important:** the path must start with `<user_id>/` — the RLS insert policy on this bucket (`user_uploads_own_insert`) scopes writes to `(storage.foldername(name))[1] = auth.uid()::text`, but since you're using `supabaseAdmin` (service role), RLS doesn't apply to you anyway. Still use the `<user_id>/...` path prefix for consistency with how the web routes lay out files, and because a future read-side policy change may start relying on that convention.
   - Get the public URL via `supabaseAdmin!.storage.from('user_uploads').getPublicUrl(filename).data.publicUrl`.
2. **Build an `AIAttachment`-shaped object** per image: `{ type: 'image', url: publicUrl, name: filename }` (see `src/data/store.types.ts:266-273` for the exact shape — `type`, `url`, `name` are the fields that matter here; `uploading`/`tempId`/`textContent` are UI-only/optional and not relevant server-side).
3. **Pass these into `syncTelegramMessages`** — add an `attachments?: any[]` parameter to its signature, and inside it, apply the exact same `ATTACHMENTS_JSON` comment convention `insertMessage` uses:
   ```ts
   let userContent = userMessage
   if (attachments && attachments.length > 0) {
     userContent = `${userContent}\n\n<!-- ATTACHMENTS_JSON:${JSON.stringify(attachments)} -->`
   }
   await supabaseAdmin!.from('messages').insert({ conversation_id: chatId, role: 'user', content: userContent })
   ```
   (Replacing the current unconditional `content: userMessage` on line 66.) Do **not** touch the assistant-message insert in the same function — bug 2 is about the user's uploaded photo, not anything on the reply side.
4. **Update every call site of `syncTelegramMessages`** (there are two: line 611 for the photo-generation reply path, line 634 for the normal text reply path) to pass the built attachments array through when there is one, `undefined` otherwise.

### 3c. Things to be careful about

- **This only needs to run for the actual image bytes that exist right now** — i.e., the `Buffer`(s) you already downloaded via `telegram.downloadFile()` for the vision/runChain call. Don't re-download; reuse the same buffer(s).
- **Skip storage upload entirely if there's no `linkedAuthUserId`** — the auth gate earlier in the handler (line 531) already guarantees this can't happen by the time you reach the photo-handling code, but don't restructure that guarantee; just be aware the upload path assumes a linked user.
- **Upload failures should degrade gracefully, not crash the turn.** If the Storage upload fails (network blip, quota, etc.), log it and proceed without that attachment rather than failing the whole message — the user still gets their AI reply; they just won't see the image echoed back in the web app for that one turn. Same fail-open spirit as the existing `reserveError` handling a few lines up.
- **Do not change what buffer PRIMARY/`runChain` receives.** The image still goes to `runChain` as a raw `Buffer` (or `Buffer[]` for an album) exactly as today/as built in Step 2 — the Storage upload is a *parallel, additional* step purely for persistence/display, not a replacement for the native vision pipeline.

## Why these files are left alone

- **`chainRouter.ts` / `providerExecution.ts` / `classifier.ts`:** §5b already made `runChain` accept `Buffer[]` and route it natively to PRIMARY. The webhook already passes a single buffer through this path correctly today (that's not broken) — the only gaps are "N buffers from one album become one call" (bug 1) and "the buffer's bytes never get persisted to a URL" (bug 2). Neither requires changing how the chain router or providers consume buffers.
- **`image-narration.ts` / `memory.ts`:** these govern the *text-description* half of image handling (cached description for history replay). Nothing about batching or persisting Telegram photos changes what gets described or how history replay works — a batched album still produces one set of buffers handed to the same narration step inside `chainRouter.ts`, unmodified.
- **`src/app/api/ai/upload/route.ts`, `AIAssistant.tsx`, `TaskInspectorPanel.tsx`:** these are the *web* upload surfaces §5c already fixed, using a client-side authenticated-session upload (no service-role key involved, since a browser has a real user session). The webhook has no browser session to use — it must use `supabaseAdmin` (service role) directly, which is a legitimately different code path, not a duplication to unify. Don't try to make the webhook call the web upload route internally; it would add an unnecessary HTTP hop for no benefit.

## Verification checklist

1. `npx tsc --noEmit` — clean.
2. `npm test` — same pass count as baseline (currently 47 files / 350 tests passing); no regressions.
3. Manual trace (can't be fully tested without a live Telegram bot + webhook, but at minimum): read through the new album-claim logic and convince yourself that if 4 near-simultaneous invocations all reach the `UPDATE ... WHERE processed = false` at slightly different times, exactly one gets a non-null row back and the other three get `null`/no match. Confirm the non-claimers return `{ ok: true }` and do nothing else.
4. Confirm `chainRouter.ts`, `providerExecution.ts`, `classifier.ts`, `image-narration.ts`, `memory.ts` show **zero diff** (`git diff <before> <after> -- <file>` empty) — this task should not need to touch any of them.
5. Grep for any other caller of `syncTelegramMessages` you might have missed when threading the new `attachments` param through — there should be exactly two call sites (photo-generation reply, normal reply), both inside `route.ts`.
6. Confirm the new migration file matches this repo's existing migration-file conventions (compare against `20260713_user_settings_timezone.sql` or `20260713_user_uploads_bucket_rls.sql` for header-comment style and naming).

## Spec update template (§5d + §0 + §13)

In §5d, change:
```
**Bug 1 — an album produces one reply per image.** ...
```
to prepend `✅ DONE (2026-07-14).` and a short paragraph describing what shipped (DB-backed claim table, settle window, single `runChain` call with `Buffer[]`) — mirror the style of how bug 3 documents its own resolution just below it in the same section.

Same treatment for bug 2 — prepend `✅ DONE (2026-07-14)` and describe: server-side `supabaseAdmin` upload to the existing `user_uploads` bucket (§5c), `AIAttachment`-shaped object appended to the message's `content` via the same `ATTACHMENTS_JSON` comment convention `insertMessage` uses on the web side.

Update the **Acceptance** line status if you verified it manually; if you could not do a real live-bot test, say so explicitly rather than claiming it — same honesty standard as §5c's "not yet verified on two devices" note.

In §0's progress table row for step 5, change:
```
§5c (storage) done, code-complete. ⬅️ **NEXT: §5d bugs 1-2** (Telegram media groups + attachments).
```
to reflect all of §5d being done and point `⬅️ NEXT` at whatever the next unstarted line item in §13 is (check §13's "Remaining, in order" list at the time you land this — do not assume it's still what it was when this doc was written, re-read §13 fresh).

In §13, mark step 5 fully done (all three of §5b/§5c/§5d) and move the `⬅️ NEXT` marker down to the next line item in the "Remaining, in order" list (as of this doc's writing that's `7b. Compaction rework`, but re-check — don't hardcode blindly).

## Stop condition

**Per explicit owner instruction carried over from §5b: after finishing §5d (this task), STOP. Do not proceed to §7b, §3, §4b, or any other spec section. Do not attempt a live Telegram test yourself if you don't have bot credentials/webhook access to do so safely — flag what you could and couldn't verify, commit, and wait for the owner to test manually before anything further proceeds.**
