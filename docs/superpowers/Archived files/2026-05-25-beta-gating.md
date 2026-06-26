# Beta Gating System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate Flowr's web deploy to invited users only — per-person invite links, Google OAuth, no guest mode, admin UI to generate and track invites.

**Architecture:** A `beta_invites` table holds single-use tokens; `/invite/[token]` validates the token and sets a short-lived cookie; `/auth/callback` consumes the cookie after Google sign-in and writes the user to `beta_approved_users`; middleware blocks unapproved users. Admin can generate and view invites at `/admin/beta`.

**Tech Stack:** Next.js 15 App Router, Supabase (service role for writes, anon for reads), Node.js crypto for token generation, httpOnly cookies via Next.js `cookies()`.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `run_in_supabase_sql_editor.sql` | Modify | Add migration SQL for both new tables |
| `src/lib/beta.ts` | Create | Token generation and invite DB helpers (server-only) |
| `src/app/invite/[token]/page.tsx` | Create | Validates token, sets cookie, redirects to login |
| `src/app/auth/callback/page.tsx` | Modify | After Google sign-in: consume cookie, approve user or reject |
| `src/app/login/page.tsx` | Modify | Show sign-in button only if cookie present; remove guest link |
| `src/middleware.ts` | Modify | Block approved-users check; add `/invite` to pass-through |
| `src/app/api/admin/beta/route.ts` | Create | REST API: POST create invite, GET list invites |
| `src/app/admin/beta/page.tsx` | Create | Admin UI: generate invite link, view invite table |
| `src/lib/beta.test.ts` | Create | Unit tests for token generation and helper logic |

---

## Task 1: SQL Migration — Add beta tables

**Files:**
- Modify: `run_in_supabase_sql_editor.sql`

- [ ] **Step 1: Append migration SQL to the existing file**

Open `run_in_supabase_sql_editor.sql` and append at the bottom:

```sql
-- Beta gating tables
create table if not exists public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  label text not null,
  used_by_email text,
  used_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.beta_approved_users (
  email text primary key,
  approved_at timestamptz default now(),
  invite_token text not null references public.beta_invites(token)
);

alter table public.beta_invites enable row level security;
alter table public.beta_approved_users enable row level security;

-- Allow server-side reads (anon key) to check if a user is approved
create policy "Public read for approval check"
  on public.beta_approved_users for select
  using (true);
```

- [ ] **Step 2: Run this SQL in Supabase SQL editor**

Go to your Supabase project → SQL Editor → paste and run the appended block. Verify both tables appear in Table Editor.

- [ ] **Step 3: Commit**

```bash
git add run_in_supabase_sql_editor.sql
git commit -m "feat: add beta_invites and beta_approved_users SQL migration"
```

---

## Task 2: Token helpers — `src/lib/beta.ts`

**Files:**
- Create: `src/lib/beta.ts`
- Create: `src/lib/beta.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/beta.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateInviteToken } from './beta'

describe('generateInviteToken', () => {
  it('returns a 24-character string', () => {
    const token = generateInviteToken()
    expect(token).toHaveLength(24)
  })

  it('returns only URL-safe characters', () => {
    const token = generateInviteToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('returns a different token each call', () => {
    expect(generateInviteToken()).not.toBe(generateInviteToken())
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- src/lib/beta.test.ts
```

Expected: FAIL — "Cannot find module './beta'"

- [ ] **Step 3: Implement `src/lib/beta.ts`**

```ts
import { randomBytes } from 'crypto'
import { supabaseAdmin } from './supabase'

export function generateInviteToken(): string {
  return randomBytes(18).toString('base64url')
}

export async function createInvite(label: string): Promise<{ token: string } | { error: string }> {
  const token = generateInviteToken()
  const { error } = await supabaseAdmin
    .from('beta_invites')
    .insert({ token, label })
  if (error) return { error: error.message }
  return { token }
}

export async function validateInviteToken(token: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('beta_invites')
    .select('used_at')
    .eq('token', token)
    .maybeSingle()
  return !!data && data.used_at === null
}

export async function consumeInvite(token: string, email: string): Promise<{ error: string } | null> {
  const isValid = await validateInviteToken(token)
  if (!isValid) return { error: 'invalid_or_used' }

  const { error: markError } = await supabaseAdmin
    .from('beta_invites')
    .update({ used_by_email: email, used_at: new Date().toISOString() })
    .eq('token', token)
  if (markError) return { error: markError.message }

  const { error: approveError } = await supabaseAdmin
    .from('beta_approved_users')
    .insert({ email, invite_token: token })
  if (approveError) return { error: approveError.message }

  return null
}

export async function isApprovedUser(email: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('beta_approved_users')
    .select('email')
    .eq('email', email)
    .maybeSingle()
  return !!data
}

export async function listInvites() {
  const { data, error } = await supabaseAdmin
    .from('beta_invites')
    .select('id, token, label, used_by_email, used_at, created_at')
    .order('created_at', { ascending: false })
  if (error) return []
  return data
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/lib/beta.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/beta.ts src/lib/beta.test.ts
git commit -m "feat: add beta invite token helpers"
```

---

## Task 3: `/invite/[token]` page

**Files:**
- Create: `src/app/invite/[token]/page.tsx`

- [ ] **Step 1: Create the invite page**

Create `src/app/invite/[token]/page.tsx`:

```tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateInviteToken } from '@/lib/beta'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const valid = await validateInviteToken(token)

  if (!valid) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center max-w-sm px-6">
          <h1 className="text-2xl font-display font-medium text-foreground mb-2">Invalid Invite</h1>
          <p className="text-sm text-muted-foreground">
            This invite link is invalid or has already been used. Ask for a new one.
          </p>
        </div>
      </div>
    )
  }

  const cookieStore = await cookies()
  cookieStore.set('beta_invite_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60, // 1 hour
    path: '/',
    sameSite: 'lax',
  })

  redirect('/login')
}
```

- [ ] **Step 2: Add `/invite` to middleware matcher so it passes through without auth redirect**

Open `src/middleware.ts`. Find the `config` export at the bottom:

```ts
export const config = {
  matcher: ['/admin/:path*', '/login', '/', '/app'],
}
```

Change it to:

```ts
export const config = {
  matcher: ['/admin/:path*', '/login', '/', '/app', '/invite/:path*'],
}
```

Then add a pass-through check at the top of the `middleware` function body, after the Supabase URL check:

```ts
// Pass invite pages through — they handle their own validation
if (request.nextUrl.pathname.startsWith('/invite')) {
  return NextResponse.next()
}
```

Add this block right after:

```ts
if (!supabaseUrl || !supabaseKey) {
  return NextResponse.next()
}
```

- [ ] **Step 3: Manually test the invite page**

Run `npm run dev`, visit `http://localhost:3000/invite/fake-token-xyz`. You should see the "Invalid Invite" error page (since the token doesn't exist in the DB).

- [ ] **Step 4: Commit**

```bash
git add src/app/invite/[token]/page.tsx src/middleware.ts
git commit -m "feat: add /invite/[token] page and middleware pass-through"
```

---

## Task 4: Modify `/login` — gate on cookie, remove guest mode

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Replace the login page with the gated version**

Replace the full contents of `src/app/login/page.tsx` with:

```tsx
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

function LoginPageInner() {
  const { user, loading, signInWithGoogle } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [hasInvite, setHasInvite] = useState<boolean | null>(null)

  useEffect(() => {
    const err = searchParams.get('error')
    if (err === 'auth_failed') setError('Authentication failed. Please try again.')
    if (err === 'not_invited') setError('Your account is not approved for the beta.')
  }, [searchParams])

  useEffect(() => {
    // Check if the beta_invite_token cookie is present via a lightweight API call
    fetch('/api/admin/beta/check-invite').then(r => r.json()).then(d => {
      setHasInvite(d.hasInvite === true)
    }).catch(() => setHasInvite(false))
  }, [])

  useEffect(() => {
    if (!loading && user) {
      const redirect = (() => { try { return sessionStorage.getItem('login-redirect') } catch { return null } })()
      sessionStorage.removeItem('login-redirect')
      router.replace(redirect || '/app')
    }
  }, [user, loading, router])

  if (loading || hasInvite === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin w-5 h-5 border-2 border-foreground/20 border-t-foreground rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display font-normal text-foreground tracking-tight">Flowr</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {hasInvite ? 'Sign in to continue' : 'Private Beta'}
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        {hasInvite ? (
          <button
            onClick={() => {
              const redirect = searchParams.get('redirect') || '/app'
              try { sessionStorage.setItem('login-redirect', redirect) } catch {}
              signInWithGoogle()
            }}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-[var(--bone-12)] bg-sidebar hover:bg-[var(--bone-6)] text-foreground text-sm font-medium transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
        ) : (
          <div className="text-center px-4 py-6 rounded-lg border border-[var(--bone-6)] bg-sidebar">
            <p className="text-sm text-muted-foreground">
              Flowr is in private beta. If you received an invite link, open it to continue.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin w-5 h-5 border-2 border-foreground/20 border-t-foreground rounded-full" />
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  )
}
```

- [ ] **Step 2: Create the cookie-check API endpoint**

Create `src/app/api/admin/beta/check-invite/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('beta_invite_token')?.value
  return NextResponse.json({ hasInvite: !!token })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx src/app/api/admin/beta/check-invite/route.ts
git commit -m "feat: gate login page on invite cookie, remove guest mode"
```

---

## Task 5: Modify `/auth/callback` — consume invite, approve or reject

**Files:**
- Modify: `src/app/auth/callback/page.tsx`

The current callback page is a client component that waits for the auth session and redirects. We need to add server-side invite consumption. The cleanest approach for this App Router setup is a Server Action called from the client component on mount.

- [ ] **Step 1: Create the server action file**

Create `src/app/auth/callback/actions.ts`:

```ts
'use server'

import { cookies } from 'next/headers'
import { consumeInvite, isApprovedUser } from '@/lib/beta'

export async function processInviteAfterAuth(email: string): Promise<'approved' | 'rejected' | 'already_approved'> {
  const cookieStore = await cookies()
  const token = cookieStore.get('beta_invite_token')?.value

  if (token) {
    const error = await consumeInvite(token, email)
    cookieStore.delete('beta_invite_token')
    if (error) {
      // Token was invalid or already used — check if they're already approved (edge case)
      const approved = await isApprovedUser(email)
      return approved ? 'already_approved' : 'rejected'
    }
    return 'approved'
  }

  // No cookie — check if they were previously approved
  const approved = await isApprovedUser(email)
  return approved ? 'already_approved' : 'rejected'
}
```

- [ ] **Step 2: Update the callback page to call the server action**

Replace the full contents of `src/app/auth/callback/page.tsx` with:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { processInviteAfterAuth } from './actions'

export default function AuthCallbackPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const processed = useRef(false)

  useEffect(() => {
    if (!loading && user && !processed.current) {
      processed.current = true
      const email = user.email
      if (!email) {
        router.replace('/login?error=auth_failed')
        return
      }
      processInviteAfterAuth(email).then(async (result) => {
        if (result === 'rejected') {
          await signOut()
          router.replace('/login?error=not_invited')
        } else {
          const redirect = (() => { try { return sessionStorage.getItem('login-redirect') } catch { return null } })()
          sessionStorage.removeItem('login-redirect')
          router.replace(redirect || '/app')
        }
      })
    }
  }, [user, loading, router, signOut])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!user) {
        router.replace('/login?error=auth_failed')
      }
    }, 15000)
    return () => clearTimeout(timer)
  }, [user, router])

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin w-5 h-5 border-2 border-foreground/20 border-t-foreground rounded-full" />
        <p className="text-sm text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/callback/page.tsx src/app/auth/callback/actions.ts
git commit -m "feat: consume invite token and approve user after Google sign-in"
```

---

## Task 6: Admin API — create and list invites

**Files:**
- Create: `src/app/api/admin/beta/route.ts`

- [ ] **Step 1: Create the admin beta API route**

Create `src/app/api/admin/beta/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createInvite, listInvites } from '@/lib/beta'

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !serviceKey || !anonKey) return false

  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false

  const anonClient = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data: { user } } = await anonClient.auth.getUser(token)
  if (!user?.email) return false

  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data } = await serviceClient.from('admins').select('email').eq('email', user.email).single()
  return !!data
}

export async function GET(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const invites = await listInvites()
  return NextResponse.json({ invites })
}

export async function POST(req: NextRequest) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { label } = await req.json()
  if (!label?.trim()) return NextResponse.json({ error: 'label is required' }, { status: 400 })
  const result = await createInvite(label.trim())
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ token: result.token })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/beta/route.ts
git commit -m "feat: add admin beta API for creating and listing invites"
```

---

## Task 7: Admin UI — `/admin/beta` page

**Files:**
- Create: `src/app/admin/beta/page.tsx`

- [ ] **Step 1: Create the admin beta page**

Create `src/app/admin/beta/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { Link, Copy, Check } from 'lucide-react'

interface Invite {
  id: string
  token: string
  label: string
  used_by_email: string | null
  used_at: string | null
  created_at: string
}

export default function BetaPage() {
  const { session } = useAuth()
  const [invites, setInvites] = useState<Invite[]>([])
  const [label, setLabel] = useState('')
  const [newLink, setNewLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  const authHeader = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {}

  async function fetchInvites() {
    const res = await fetch('/api/admin/beta', { headers: authHeader })
    const data = await res.json()
    setInvites(data.invites || [])
  }

  useEffect(() => { fetchInvites() }, [session])

  async function handleGenerate() {
    if (!label.trim()) return
    setLoading(true)
    setNewLink(null)
    const res = await fetch('/api/admin/beta', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label.trim() }),
    })
    const data = await res.json()
    if (data.token) {
      const origin = window.location.origin
      setNewLink(`${origin}/invite/${data.token}`)
      setLabel('')
      fetchInvites()
    }
    setLoading(false)
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display font-medium text-foreground mb-1">Beta Invites</h1>
        <p className="text-muted-foreground text-sm font-medium">Generate and track personal invite links.</p>
      </div>

      <div className="bg-panel border border-[var(--bone-6)] px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow space-y-3">
        <div className="text-[10px] font-bold text-bone-70 tracking-[0.1em] uppercase opacity-40">Generate Invite</div>
        <div className="flex gap-2">
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            placeholder="Who is this for? e.g. Alex"
            className="flex-1 px-3 py-2 rounded-lg border border-[var(--bone-12)] bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !label.trim()}
            className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50 transition-all hover:opacity-90"
          >
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {newLink && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20">
            <span className="flex-1 text-xs text-foreground font-mono truncate">{newLink}</span>
            <button onClick={() => copyLink(newLink)} className="shrink-0 text-accent hover:opacity-70 transition-opacity">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      <div className="bg-panel border border-[var(--bone-6)] px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow">
        <div className="text-[10px] font-bold text-bone-70 tracking-[0.1em] uppercase opacity-40 mb-4">All Invites</div>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invites generated yet.</p>
        ) : (
          <div className="space-y-2">
            {invites.map(invite => (
              <div key={invite.id} className="flex items-center justify-between gap-4 py-2 border-b border-[var(--bone-6)] last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{invite.label}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{invite.token}</div>
                </div>
                <div className="text-right shrink-0">
                  {invite.used_by_email ? (
                    <div>
                      <div className="text-xs text-accent font-medium">Claimed</div>
                      <div className="text-xs text-muted-foreground">{invite.used_by_email}</div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Pending</div>
                  )}
                </div>
                <button
                  onClick={() => copyLink(`${window.location.origin}/invite/${invite.token}`)}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Link className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/beta/page.tsx
git commit -m "feat: add /admin/beta page for invite generation and tracking"
```

---

## Task 8: Middleware — block unapproved authenticated users

**Files:**
- Modify: `src/middleware.ts`

Currently middleware only checks if a user is authenticated. We need to also block authenticated users who are not in `beta_approved_users`.

- [ ] **Step 1: Update middleware to check beta approval**

Open `src/middleware.ts`. After the block that gets the user (`const { data: { user } } = await supabase.auth.getUser()`), add an approval check for authenticated users accessing `/app`:

Replace the current middleware body with the full updated version:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next()
  }

  // Pass invite pages through — they handle their own validation
  if (request.nextUrl.pathname.startsWith('/invite')) {
    return NextResponse.next()
  }

  const { supabase, supabaseResponse } = await createClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAdminPath = request.nextUrl.pathname.startsWith('/admin')
  const isLoginPath = request.nextUrl.pathname === '/login'
  const isRootOrApp = request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/app'
  const isAuthCallbackPath = request.nextUrl.pathname === '/auth/callback'

  if (!user && !isLoginPath && !isAuthCallbackPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    if (!isRootOrApp) {
      url.searchParams.set('redirect', request.nextUrl.pathname)
    }
    return NextResponse.redirect(url)
  }

  if (user && isLoginPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/app'
    return NextResponse.redirect(url)
  }

  // Block authenticated users who are not beta-approved (only for /app and /)
  if (user && isRootOrApp && serviceKey) {
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const adminClient = createAdminClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })
    const { data: approved } = await adminClient
      .from('beta_approved_users')
      .select('email')
      .eq('email', user.email)
      .maybeSingle()

    if (!approved) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'not_invited')
      return NextResponse.redirect(url)
    }
  }

  if (user && isAdminPath && serviceKey) {
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const adminClient = createAdminClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })
    const { data: adminData } = await adminClient
      .from('admins')
      .select('email')
      .eq('email', user.email)
      .single()

    if (!adminData) {
      const url = request.nextUrl.clone()
      url.pathname = '/app'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/login', '/', '/app', '/invite/:path*'],
}
```

- [ ] **Step 2: Add your own email to `beta_approved_users`**

You are the admin — you need to approve yourself or you'll be locked out on deploy. Run in Supabase SQL editor:

```sql
-- Replace with your actual Google account email
insert into public.beta_approved_users (email, invite_token)
select 'your@email.com', token from public.beta_invites limit 1;

-- If no invites exist yet, create a self-invite first:
insert into public.beta_invites (token, label, used_by_email, used_at)
values ('self-bootstrap', 'Self (admin)', 'your@email.com', now());

insert into public.beta_approved_users (email, invite_token)
values ('your@email.com', 'self-bootstrap');
```

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: block unapproved authenticated users in middleware"
```

---

## Task 9: Production build check + Vercel env setup

**Files:**
- No code changes — verification only

- [ ] **Step 1: Run production build locally**

```bash
npm run build
```

Expected: clean build, no TypeScript errors, all routes listed including `/invite/[token]` and `/admin/beta`.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass including `src/lib/beta.test.ts`.

- [ ] **Step 3: Set environment variables in Vercel**

In your Vercel project dashboard → Settings → Environment Variables, add:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | From Supabase project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase project → Settings → API (secret) |
| `ENCRYPTION_KEY` | Copy exact value from your local `.env` |
| `TELEGRAM_BOT_TOKEN_PROD` | Your production Telegram bot token |
| `TELEGRAM_WEBHOOK_SECRET` | Your webhook secret |
| `ADMIN_CHAT_ID` | Your Telegram chat ID |
| `TAVILY_API_KEY` | If you use web search |
| `EXA_API_KEY` | If you use Exa search |

- [ ] **Step 4: Deploy to Vercel**

```bash
# If you haven't linked the project yet:
npx vercel link

# Deploy
npx vercel --prod
```

Or push to main if auto-deploy is configured.

- [ ] **Step 5: Set up Telegram webhook for production**

After deploy, register the webhook with Telegram (replace with your actual domain and token):

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN_PROD>/setWebhook" \
  -d "url=https://your-domain.vercel.app/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

- [ ] **Step 6: End-to-end test on production**

1. Go to `https://your-domain.com` — should redirect to `/login` and show the private beta wall
2. Go to `/admin/beta` as your admin account — generate an invite for yourself
3. Open the invite link in an incognito window — should redirect to `/login` with sign-in button visible
4. Sign in with Google — should land on `/app`
5. In Supabase, verify `beta_approved_users` has your row and `beta_invites` shows the token as claimed
