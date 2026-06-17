# Custom Domain and Brand Login Implementation Plan (Next.js Rewrite)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Configure Next.js rewrites to proxy Supabase authentication traffic, allowing Google Sign-In to display `flowr.website` instead of `qmufalwubepttjxehvit.supabase.co` on the consent page, for free.

**Architecture:**
- **Next.js Rewrite Proxy**: Define a background proxy routing `/ _supabase/:path*` to the real Supabase endpoint.
- **Google OAuth Redirect Config**: Register `https://flowr.website/_supabase/auth/v1/callback` as the callback handler.
- **Service Worker Exclusion**: Exclude the rewritten `_supabase` path from standard PWA caching logic to allow network-only auth calls.

---

## Proposed Changes

### 1. Codebase Changes

#### [MODIFY] [next.config.ts](file:///Users/mktsoy/Dev/flowr-app/next.config.ts)
- Add a `rewrites()` async function mapping `/_supabase/:path*` to `https://qmufalwubepttjxehvit.supabase.co/:path*`.

#### [MODIFY] [sw.js](file:///Users/mktsoy/Dev/flowr-app/public/sw.js)
- Update `isApiOrSupabase` helper to match `/_supabase/` path prefixes.

---

## Tasks

### Task 1: Add Next.js Rewrite proxy
Add backend rewrites mapping to Supabase.

**Files:**
- Modify: `next.config.ts`

**Step 1: Modify next.config.ts**
Update [next.config.ts](file:///Users/mktsoy/Dev/flowr-app/next.config.ts):
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'gsap'],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/_supabase/:path*',
        destination: 'https://qmufalwubepttjxehvit.supabase.co/:path*',
      },
    ];
  },
};

export default nextConfig;
```

**Step 2: Commit**
```bash
git add next.config.ts
git commit -m "feat: add Next.js rewrite proxy for _supabase path routing"
```

---

### Task 2: Update Service Worker Whitelist
Ensure PWA caching is bypassed on proxy requests.

**Files:**
- Modify: `public/sw.js`

**Step 1: Modify sw.js**
Update `isApiOrSupabase` in [public/sw.js](file:///Users/mktsoy/Dev/flowr-app/public/sw.js):
```javascript
function isApiOrSupabase(url) {
  return url.pathname.startsWith('/api/') 
    || url.pathname.startsWith('/_supabase/')
    || url.hostname.endsWith('.supabase.co');
}
```

**Step 2: Commit**
```bash
git add public/sw.js
git commit -m "chore: exclude _supabase path from service worker caching"
```

---

### Task 3: Verification & Compilation Check
Confirm changes pass static type checking.

**Step 1: Run compiler**
Run: `/Users/mktsoy/.local/bin/node node_modules/typescript/bin/tsc --noEmit`
Expected: PASS with 0 errors

**Step 2: Commit**
```bash
git commit --allow-empty -m "test: verify Next.js custom domain configuration compile checks pass"
```
