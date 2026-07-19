# Beta Gating System — Design Spec
**Date:** 2026-05-25
**Status:** Approved

## Overview

Flowr is deploying to Vercel for the first time as a private beta. Access is restricted to people with a personal invite link. Guest mode is removed. Approved users (those who claimed an invite) can sign in freely on subsequent visits without needing their link again.

## Goals

- No one can use the app without a valid invite or an already-approved account
- You (admin) generate per-person invite links from `/admin/beta`
- Invites are single-use: one link per person, consumed on first sign-in
- Guest mode is fully removed from login UI and middleware

## Out of Scope

- Invite expiry dates (can be added later)
- Email-based invites (you share links manually via Telegram/WhatsApp)
- Waitlist or self-signup flow

---

## Data Model

### Table: `beta_invites`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | auto-generated |
| `token` | text, unique | random 24-char string, used in the invite URL |
| `label` | text | who it's for, e.g. "Alex from gym" |
| `used_by_email` | text, nullable | Google email of the person who claimed it |
| `used_at` | timestamptz, nullable | when it was claimed |
| `created_at` | timestamptz | auto-set on insert |

### Table: `beta_approved_users`

| Column | Type | Notes |
|---|---|---|
| `email` | text, PK | Google account email |
| `approved_at` | timestamptz | when they claimed their invite |
| `invite_token` | text | which invite token they used |

Both tables are in the `public` schema. Only `SUPABASE_SERVICE_ROLE_KEY` (server-side) can write to them. The anon key has no insert/update access.

---

## User Flow

### New user (has invite link)

1. Clicks `flowr.app/invite/[token]`
2. Server validates token exists and is unclaimed
3. Sets a short-lived cookie: `beta_invite_token=<token>` (httpOnly, 1 hour TTL)
4. Redirects to `/login`
5. Login page detects cookie → shows Google sign-in button (cookie is the gate here — Google email isn't known until after OAuth)
6. User signs in with Google → `/auth/callback` fires
7. Callback server action:
   - Reads `beta_invite_token` cookie
   - Verifies token is still unclaimed (race-condition guard)
   - Marks invite: sets `used_by_email`, `used_at`
   - Inserts row into `beta_approved_users`
   - Clears the cookie
8. User is redirected to `/app` — they're in

### Returning approved user (no link needed)

1. Visits the app or `/login`
2. Middleware checks if authenticated user's email is in `beta_approved_users` → passes through
3. If not authenticated, login page checks `beta_approved_users` for their email after sign-in
4. No invite cookie needed — account is already approved

### Uninvited visitor

1. Visits `/login` — no cookie, not in `beta_approved_users`
2. Sees a private beta wall: "Flowr is in private beta. If you received an invite link, open it to continue."
3. No sign-in button visible
4. Cannot access `/app` — middleware redirects to `/login`

### Invalid or used token

1. Visits `/invite/[token]` with a bad or already-used token
2. Server returns an error page: "This invite link is invalid or has already been used."
3. No cookie is set, no redirect to login

---

## Pages & Routes

### `/invite/[token]` (new — server component)

- Validates token against `beta_invites` table using service role key
- If valid and unclaimed: set cookie, redirect to `/login`
- If invalid or already used: render error page (no redirect)

### `/login` (modified)

- Remove "Continue without signing in" guest link entirely
- Add beta gate check: show Google sign-in button only if `beta_invite_token` cookie is present
- If no cookie: show private beta wall message instead of the sign-in button
- Note: returning approved users who have an active Supabase session are never sent to `/login` — middleware passes them through directly

### `/auth/callback` (modified)

- After successful Google sign-in, before redirecting to `/app`:
  - Read `beta_invite_token` cookie
  - If cookie present: validate token, consume invite, insert into `beta_approved_users`, clear cookie
  - If no cookie: check if user email is already in `beta_approved_users`
  - If neither: sign them out and redirect to `/login` with `?error=not_invited`

### `/admin/beta` (new)

- Protected by existing admin middleware (email must be in `admins` table)
- Two sections:
  1. **Generate invite**: text input for label, "Generate Link" button → displays the full URL to copy
  2. **Invite list**: table showing all invites — label, token (truncated), status (Pending / Claimed by email on date)
- Uses service role key via existing admin API pattern

### `/api/admin/beta` (new API route)

- `POST /api/admin/beta` — create invite (generates token, inserts into `beta_invites`)
- `GET /api/admin/beta` — list all invites
- Protected: verifies caller is in `admins` table via service role key

---

## Middleware Changes

Current middleware redirects unauthenticated users to `/login`. After this change:

- Add `/invite` to the matcher so it passes through without auth check
- Authenticated users who are NOT in `beta_approved_users` are redirected to `/login?error=not_invited` (edge case: someone with a Supabase session but no approval row)
- Guest path (`?guest=1`) check is removed entirely

---

## Vercel Environment Variables

These must be set in the Vercel project dashboard before deploy:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | From Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | From Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | From Supabase project settings — keep secret |
| `ENCRYPTION_KEY` | Yes | Used by vault decryption — must match your local value |
| `TELEGRAM_BOT_TOKEN_PROD` | Yes | Production Telegram bot token |
| `TELEGRAM_WEBHOOK_SECRET` | Yes | Webhook validation secret |
| `ADMIN_CHAT_ID` | Yes | Your Telegram chat ID for admin notifications |
| `TAVILY_API_KEY` | If used | Search feature |
| `EXA_API_KEY` | If used | Search feature |

Gemini, Groq, and OpenRouter keys live in Supabase Vault — do not add them to Vercel.

---

## SQL Migration

```sql
create table public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  label text not null,
  used_by_email text,
  used_at timestamptz,
  created_at timestamptz default now()
);

create table public.beta_approved_users (
  email text primary key,
  approved_at timestamptz default now(),
  invite_token text not null references public.beta_invites(token)
);

-- Only service role can write; no anon access
alter table public.beta_invites enable row level security;
alter table public.beta_approved_users enable row level security;

-- Allow server-side reads for auth check (service role bypasses RLS anyway,
-- but this lets us query from the client with anon key for the login gate check)
create policy "Public read for approval check"
  on public.beta_approved_users for select
  using (true);
```

---

## Token Generation

Tokens are 24 random URL-safe characters generated server-side:

```ts
import { randomBytes } from 'crypto'
const token = randomBytes(18).toString('base64url') // 24 chars, URL-safe
```

---

## Error States

| Scenario | What user sees |
|---|---|
| Invalid/used invite link | "This invite link is invalid or has already been used." |
| Signed in but not approved | Signed out automatically, redirected to `/login?error=not_invited` |
| Visits app without session or invite | Redirected to `/login`, sees private beta wall |
| Admin generates invite | Full URL shown inline, ready to copy |
