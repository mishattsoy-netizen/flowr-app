# Welcome Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show first-time beta users a satisfying dark full-screen welcome page exactly once, then redirect all subsequent logins straight to `/app`.

**Architecture:** New standalone route `src/app/welcome/page.tsx` (client component, no shared layout). Auth callback redirects `'approved'` users to `/welcome` instead of `/app`. On mount the page checks for a `welcome_seen=1` cookie — if present it immediately bounces to `/app`; if absent it sets the cookie and shows the page. Clicking "ENTER →" fades the page out over 400ms then navigates to `/app`.

**Tech Stack:** Next.js 15 App Router, React client component, CSS keyframe animations, raw `document.cookie` API, Tailwind + inline styles for one-off animation values, Flowr dark theme CSS variables.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/app/welcome/page.tsx` | Create | Full welcome page — seen-once logic, animations, enter behavior |
| `src/app/auth/callback/page.tsx` | Modify (1 line) | Redirect `'approved'` to `/welcome` instead of `/app` |
| `src/middleware.ts` | Modify (1 line) | Add `/welcome` to matcher so unauthenticated users get redirected to login |

---

### Task 1: Create the welcome page

**Files:**
- Create: `src/app/welcome/page.tsx`

This is the full welcome page. It:
1. Renders `null` until the cookie check runs (avoids flash of welcome content for returning users)
2. On mount: reads `document.cookie` for `welcome_seen=1`. If found → `router.replace('/app')`. If not → sets the cookie and shows the page.
3. Animates in: confetti burst + amber glow + content fade-up
4. "ENTER →" button: applies `.exiting` class (opacity 0, transition 400ms), then after 400ms calls `router.push('/app')`

- [ ] **Step 1: Create the file**

Create `src/app/welcome/page.tsx` with this full content:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const FlowrLogo = () => (
  <svg width="36" height="36" viewBox="0 0 39 39" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M29.9302 39H9.06977L8.9525 38.9993C4.03648 38.937 0.063001 34.9635 0.000708576 30.0475L0 29.9302V9.06977C0 4.06067 4.06067 1.38779e-07 9.06977 0H29.9302C34.9393 0 39 4.06067 39 9.06977V29.9302C39 34.9002 35.0026 38.9365 30.0475 38.9993L29.9302 39ZM24.1066 15.9808L23.7628 23.7174C23.7628 26.3798 22.6382 28.9779 20.5522 31.064L14.9561 36.2791H29.9302C33.4366 36.2791 36.2791 33.4366 36.2791 29.9302V9.06977C36.2791 8.08478 36.0548 7.15218 35.6544 6.32027L35.5436 6.35738C33.2742 7.11717 30.99 7.88195 28.8924 8.89124C25.9704 10.2972 24.2398 13.0277 24.1066 15.9808ZM16.3045 18.0338L16.7254 13.687C17.0538 10.2965 19.4868 7.35444 23.0273 6.06642L32.4536 3.24217C31.6802 2.90682 30.8269 2.72093 29.9302 2.72093H9.06977C5.5634 2.72093 2.72093 5.5634 2.72093 9.06977V27.2509L8.39919 26.1046C12.7272 25.2308 15.9235 21.9676 16.3045 18.0338Z" fill="#E09952" />
  </svg>
)

const CONFETTI = [
  { color: '#E09952', x: -120, y: -80,  size: 6, delay: 0 },
  { color: '#6c63ff', x:  130, y: -60,  size: 5, delay: 0.05 },
  { color: '#52d4e0', x: -80,  y:  110, size: 7, delay: 0.1 },
  { color: '#ff6b6b', x:  100, y:  90,  size: 5, delay: 0.08 },
  { color: '#E09952', x:  60,  y: -130, size: 4, delay: 0.15 },
  { color: '#6c63ff', x: -140, y:  40,  size: 6, delay: 0.03 },
  { color: '#52d4e0', x:  150, y: -30,  size: 4, delay: 0.12 },
  { color: '#ff6b6b', x: -50,  y: -140, size: 5, delay: 0.07 },
  { color: '#E09952', x:  80,  y:  140, size: 6, delay: 0.18 },
  { color: '#6c63ff', x: -160, y: -50,  size: 4, delay: 0.02 },
  { color: '#52d4e0', x:  40,  y: -110, size: 7, delay: 0.14 },
  { color: '#ff6b6b', x: -100, y:  130, size: 5, delay: 0.09 },
]

export default function WelcomePage() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const seen = document.cookie.split(';').some(c => c.trim().startsWith('welcome_seen=1'))
    if (seen) {
      router.replace('/app')
      return
    }
    document.cookie = 'welcome_seen=1; Max-Age=31536000; Path=/; SameSite=Lax'
    setChecked(true)
  }, [router])

  function handleEnter() {
    setExiting(true)
    setTimeout(() => router.push('/app'), 400)
  }

  if (!checked) return null

  return (
    <>
      <style>{`
        @keyframes confetti-fly {
          0%   { opacity: 1; transform: translate(0, 0) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.5); }
        }
        @keyframes glow-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes content-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .welcome-exiting {
          opacity: 0;
          transition: opacity 0.4s ease;
        }
      `}</style>

      <div
        className={exiting ? 'welcome-exiting' : ''}
        style={{
          position: 'fixed', inset: 0,
          background: '#0d0d0c',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Confetti */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {CONFETTI.map((p, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: p.size, height: p.size,
                borderRadius: '50%',
                background: p.color,
                ['--tx' as any]: `${p.x}px`,
                ['--ty' as any]: `${p.y}px`,
                animation: `confetti-fly 1.2s ${p.delay}s ease-out both`,
              }}
            />
          ))}
        </div>

        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)',
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(224,153,82,0.22) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'glow-in 0.8s 0.2s ease both',
          pointerEvents: 'none',
        }} />

        {/* Content */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          animation: 'content-up 0.6s 0.3s ease both',
          position: 'relative', zIndex: 1,
          textAlign: 'center', padding: '0 24px',
        }}>
          <FlowrLogo />

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px',
            border: '1px solid rgba(224,153,82,0.3)',
            borderRadius: 20,
            background: 'rgba(224,153,82,0.08)',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            color: '#E09952',
            textTransform: 'uppercase',
          }}>
            ✦ Private Beta
          </div>

          <h1 style={{
            fontSize: 40, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.05,
            color: '#eeeee8',
            fontFamily: 'var(--font-display, Georgia, serif)',
            margin: 0,
          }}>
            Welcome to Flowr.
          </h1>

          <p style={{
            fontSize: 14, lineHeight: 1.6,
            color: 'rgba(233,233,226,0.55)',
            maxWidth: 280, margin: 0,
          }}>
            You were personally invited.<br />
            You&apos;re one of the first people here.
          </p>

          <button
            onClick={handleEnter}
            style={{
              marginTop: 8,
              padding: '10px 28px',
              background: '#E09952',
              color: '#0d0d0c',
              border: 'none',
              borderRadius: 8,
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Enter →
          </button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify the file was created**

Run:
```bash
ls src/app/welcome/page.tsx
```
Expected: file path printed with no error.

- [ ] **Step 3: Commit**

```bash
git add src/app/welcome/page.tsx
git commit -m "feat: add welcome page for first-time beta users"
```

---

### Task 2: Redirect approved users to `/welcome`

**Files:**
- Modify: `src/app/auth/callback/page.tsx` (line 27)

Currently the auth callback redirects approved users to `/app` (or a sessionStorage redirect). First-time approved users (`result === 'approved'`) should go to `/welcome` instead. Already-approved users (`result === 'already_approved'`) keep their existing redirect to `/app` (or sessionStorage value).

- [ ] **Step 1: Open `src/app/auth/callback/page.tsx` and find the redirect block**

The block looks like this (around line 21–28):
```tsx
processInviteAfterAuth(email).then(async (result) => {
  if (result === 'rejected') {
    await signOut()
    router.replace('/login?error=not_invited')
  } else {
    const redirect = (() => { try { const url = sessionStorage.getItem('login-redirect'); sessionStorage.removeItem('login-redirect'); return url } catch { return null } })()
    router.replace(redirect || '/app')
  }
```

- [ ] **Step 2: Change the redirect logic**

Replace the `else` block so `'approved'` goes to `/welcome` and `'already_approved'` keeps the existing sessionStorage redirect:

```tsx
processInviteAfterAuth(email).then(async (result) => {
  if (result === 'rejected') {
    await signOut()
    router.replace('/login?error=not_invited')
  } else if (result === 'approved') {
    router.replace('/welcome')
  } else {
    const redirect = (() => { try { const url = sessionStorage.getItem('login-redirect'); sessionStorage.removeItem('login-redirect'); return url } catch { return null } })()
    router.replace(redirect || '/app')
  }
```

- [ ] **Step 3: Verify the change looks correct**

Run:
```bash
grep -n "approved\|welcome\|redirect" src/app/auth/callback/page.tsx
```
Expected output should include both `/welcome` and `/login?error=not_invited` redirects, and the `already_approved` path going to `/app`.

- [ ] **Step 4: Commit**

```bash
git add src/app/auth/callback/page.tsx
git commit -m "feat: redirect first-time approved users to /welcome"
```

---

### Task 3: Add `/welcome` to middleware matcher

**Files:**
- Modify: `src/middleware.ts` (last line, the `matcher` array)

Without this, unauthenticated users who navigate directly to `/welcome` won't be caught by the middleware and may see an error or empty state instead of being redirected to `/login`.

- [ ] **Step 1: Open `src/middleware.ts` and find the matcher**

At the bottom of the file:
```ts
export const config = {
  matcher: ['/admin/:path*', '/login', '/', '/app', '/invite/:path*'],
}
```

- [ ] **Step 2: Add `/welcome` to the matcher**

```ts
export const config = {
  matcher: ['/admin/:path*', '/login', '/', '/app', '/invite/:path*', '/welcome'],
}
```

- [ ] **Step 3: Verify**

```bash
grep -n "matcher" src/middleware.ts
```
Expected: the matcher array includes `/welcome`.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add /welcome to middleware matcher"
```

---

### Task 4: Manual end-to-end test

No automated test is appropriate here — this is a UI animation page with cookie-based seen-once logic. Manual verification is the right approach.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test the welcome page directly**

Open `http://localhost:3000/welcome` in your browser.

Expected:
- Dark full-screen page loads
- Confetti particles burst outward from center and fade out (~1.2s)
- Amber glow appears at top
- Logo, `✦ PRIVATE BETA` tag, `Welcome to Flowr.` headline, subtext, and `ENTER →` button fade up
- Clicking `ENTER →` fades the page to black over ~400ms, then navigates to `/app`

- [ ] **Step 3: Test seen-once behavior**

After clicking ENTER and landing on `/app`, navigate back to `http://localhost:3000/welcome`.

Expected: immediately redirected to `/app` with no welcome page shown.

- [ ] **Step 4: Test cookie reset (to simulate a new user)**

In DevTools → Application → Cookies, delete the `welcome_seen` cookie. Navigate to `http://localhost:3000/welcome`.

Expected: welcome page shows again from the beginning.

- [ ] **Step 5: Test unauthenticated access**

Log out completely. Navigate to `http://localhost:3000/welcome`.

Expected: redirected to `/login` (middleware catches it).

- [ ] **Step 6: Test full flow**

To test the auth callback redirect: you'd need a fresh invite link and a new Google account. If that's not practical, verify the callback page code change by reading it: `grep -n "approved\|welcome" src/app/auth/callback/page.tsx` — confirm `result === 'approved'` maps to `/welcome`.
