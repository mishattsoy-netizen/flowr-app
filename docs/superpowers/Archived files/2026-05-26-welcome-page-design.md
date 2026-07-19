# Welcome Page Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show first-time beta users a satisfying, dark full-screen welcome page — premium + celebratory — exactly once, then never again.

**Architecture:** New standalone route `/welcome` (no app shell). Auth callback redirects first-time approved users here instead of `/app`. Page checks a `welcome_seen` cookie on mount and skips itself if already seen. On "ENTER", fades out then navigates to `/app`.

**Tech Stack:** Next.js App Router, client component for animation, `js-cookie` or native `document.cookie`, CSS keyframe animations, Flowr dark theme CSS variables.

---

## Trigger

In `src/app/auth/callback/page.tsx`, the existing logic calls `processInviteAfterAuth(email)` which returns `'approved'`, `'already_approved'`, or `'rejected'`.

- `'approved'` → redirect to `/welcome` (currently redirects to `/app`)
- `'already_approved'` → redirect to `/app` (unchanged)
- `'rejected'` → redirect to `/login?error=not_invited` (unchanged)

No changes to `actions.ts` — just the redirect target in the callback page client component.

---

## Route

**File:** `src/app/welcome/page.tsx`

Single client component (`'use client'`). No layout wrapping (standalone route, no sidebar, no nav).

---

## Seen-Once Logic

On mount (inside `useEffect`):
1. Read `document.cookie` for `welcome_seen=1`.
2. If present → `router.replace('/app')` immediately (no flash, no content rendered).
3. If absent → set `welcome_seen=1` with `Max-Age=31536000; Path=/; SameSite=Lax` and show the page.

This is purely client-side cookie logic — no server involvement, no Supabase.

---

## Visual Design

**Background:** `#0d0d0c` (Flowr's darkest bg, matching `--app-dark` in dark mode)

**On-load animation sequence (all CSS keyframes, no library):**

1. **Confetti burst** — 12 small particles (5–8px, mix of `#E09952`, `#6c63ff`, `#52d4e0`, `#ff6b6b`) scatter outward from center using `@keyframes confetti-fly`. Each has a random direction via inline transform. Duration: 1.2s, ease-out, fills-forward, then opacity fades to 0.

2. **Glow fade-in** — a radial gradient pseudo-element (`rgba(224,153,82,0.25)` at top center) fades from opacity 0 → 1 over 0.8s with 0.2s delay.

3. **Content fade-up** — the entire content block (`display: flex; flex-direction: column; align-items: center`) fades from `opacity: 0; transform: translateY(16px)` → `opacity: 1; translateY(0)` over 0.6s with 0.3s delay.

**Content (centered, vertically centered on screen):**

```
[ ✦ PRIVATE BETA ]          ← small pill tag, amber border, amber text
                             
Welcome to Flowr.            ← 36–40px, font-display, font-semibold, --bone-100

You were personally invited. ← 14px, --bone-70, max-width ~280px, centered
You're one of the first      
people here.

[ ENTER → ]                  ← amber filled button, 12px uppercase tracking-wide
```

**Logo:** Flowr logo SVG (same as login page / admin sidebar) above the tag, ~32px.

---

## Enter Button Behavior

1. User clicks "ENTER →"
2. CSS class `exiting` applied to root element: `opacity: 0; transition: opacity 0.4s ease`
3. After 400ms (`setTimeout`): `router.push('/app')`

No loading state needed — the transition IS the feedback.

---

## Middleware

`/welcome` must be accessible to authenticated users but not unauthenticated ones. The existing middleware already handles this: unauthenticated users on any unmatched path get redirected to `/login`. The middleware matcher does not include `/welcome`, so it falls through to Next.js default handling — authenticated users can access it, unauthenticated users get caught by the existing auth check.

Add `/welcome` to the middleware matcher to ensure unauthenticated users hitting `/welcome` directly get redirected to `/login`.

**Updated matcher:**
```ts
matcher: ['/admin/:path*', '/login', '/', '/app', '/invite/:path*', '/welcome']
```

---

## Files Changed

| File | Change |
|---|---|
| `src/app/welcome/page.tsx` | Create — full welcome page client component |
| `src/app/auth/callback/page.tsx` | Change `'approved'` redirect from `/app` → `/welcome` |
| `src/middleware.ts` | Add `/welcome` to matcher |

No new dependencies required. All animation via CSS keyframes. No `js-cookie` needed — raw `document.cookie` string is sufficient for a single cookie read/write.

---

## Edge Cases

- **User navigates back to `/welcome` later:** Cookie is set, so they're immediately bounced to `/app`. No flash because the redirect fires in `useEffect` before any paint of the welcome content — achieve this by rendering `null` until the cookie check completes (use a `checked` state, initialize to `false`, render nothing until `true`).
- **Cookie blocked (private mode):** `document.cookie` write silently fails. User sees welcome page every login. Acceptable — no error handling needed.
- **User is on `/welcome` but not approved:** Middleware redirects unauthenticated users to `/login`. Authenticated but unapproved users are caught by the middleware beta check on `/` and `/app` — `/welcome` itself doesn't need an approval check since only the auth callback puts users there.
