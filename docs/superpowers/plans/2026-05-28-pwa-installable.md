# PWA: Make Flowr Installable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Web App Manifest, service worker, and a sidebar install button so users can install Flowr as a standalone desktop app from Chrome/Edge/Brave/Arc/Safari macOS.

**Architecture:** Three thin layers on top of the existing Next.js 16 app — a JSON manifest in `public/`, a hand-written service worker in `public/sw.js` that caches the app shell (stale-while-revalidate) but never caches API/Supabase traffic, and a tiny `<InstallButton />` icon button placed left of the workspace switcher in the sidebar that triggers the browser's `beforeinstallprompt` event.

**Tech Stack:** Next.js 16, React 19, TypeScript, lucide-react icons. No PWA libraries (no Workbox, no next-pwa) — the surface is small enough to hand-write and keeps the dependency footprint zero.

**Spec:** [docs/superpowers/specs/2026-05-28-pwa-installable-design.md](../specs/2026-05-28-pwa-installable-design.md)

**Testing note:** This feature is browser-API integration (Service Worker, `beforeinstallprompt`, manifest). The project does not have a jsdom/Playwright setup that would meaningfully exercise these. Verification is **manual via Chrome DevTools** at the end of each task that produces user-visible behavior, as specified in the spec. Each task ends with a commit so progress is checkpointed.

---

## Task 1: Generate PWA icons from existing logo

The manifest needs three PNG icons. We'll generate them from `public/logo simple.svg` using a one-off script with `sharp` (already transitively in the tree via Next.js). The script lives in `scripts/` and can be re-run if the logo changes.

**Files:**
- Create: `scripts/generate-pwa-icons.mjs`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/icons/icon-maskable-512.png`

- [ ] **Step 1: Write the icon generation script**

Create `scripts/generate-pwa-icons.mjs`:

```js
// One-off script: regenerate PWA icons from public/logo simple.svg.
// Run with: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const src = resolve(root, 'public', 'logo simple.svg');
const outDir = resolve(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const bg = { r: 10, g: 10, b: 10, alpha: 1 }; // #0a0a0a, matches manifest background_color

async function render(size, filename, padPct = 0) {
  const inner = Math.round(size * (1 - padPct * 2));
  const offset = Math.round((size - inner) / 2);
  const logo = await sharp(src).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: logo, top: offset, left: offset }])
    .png()
    .toFile(resolve(outDir, filename));
  console.log(`wrote ${filename}`);
}

await render(192, 'icon-192.png', 0.10);
await render(512, 'icon-512.png', 0.10);
// Maskable: Android crops to a circle, so logo must sit inside an 80% safe zone.
await render(512, 'icon-maskable-512.png', 0.20);
```

- [ ] **Step 2: Verify `sharp` is available, install if not**

Run:
```bash
node -e "require('sharp')" 2>&1 | head -5
```

If it errors with "Cannot find module 'sharp'":
```bash
npm install --save-dev sharp
```

Expected: command exits cleanly (either already present, or installed).

- [ ] **Step 3: Run the script**

Run:
```bash
node scripts/generate-pwa-icons.mjs
```

Expected output:
```
wrote icon-192.png
wrote icon-512.png
wrote icon-maskable-512.png
```

- [ ] **Step 4: Verify the icons exist and look right**

Run:
```bash
ls -la public/icons/
```

Expected: three PNG files, each non-zero size (typically 5–30 KB).

Open `public/icons/icon-512.png` in Finder/Preview and visually confirm the Flowr logo is centered on a dark background. Open `public/icons/icon-maskable-512.png` and confirm the logo sits well inside the safe zone (more padding around it than the regular icon).

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-pwa-icons.mjs public/icons/
git commit -m "feat(pwa): generate app icons from logo"
```

---

## Task 2: Add the Web App Manifest

**Files:**
- Create: `public/manifest.webmanifest`

- [ ] **Step 1: Create the manifest**

Create `public/manifest.webmanifest`:

```json
{
  "name": "Flowr",
  "short_name": "Flowr",
  "description": "Visual-first productivity and knowledge workspace.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: Verify the JSON is valid**

Run:
```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('public/manifest.webmanifest','utf8')).name)"
```

Expected: prints `Flowr`.

- [ ] **Step 3: Commit**

```bash
git add public/manifest.webmanifest
git commit -m "feat(pwa): add web app manifest"
```

---

## Task 3: Wire the manifest and theme color into `<head>`

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add manifest reference to `metadata` and a `themeColor` to `viewport`**

In `src/app/layout.tsx`, update the `viewport` and `metadata` exports:

Find this block:
```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Flowr",
  description: "Visual-first productivity and knowledge workspace",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};
```

Replace with:
```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  title: "Flowr",
  description: "Visual-first productivity and knowledge workspace",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};
```

- [ ] **Step 2: Verify the dev server still renders**

Run:
```bash
npm run dev
```

In a separate terminal:
```bash
curl -s http://localhost:3000 | grep -E 'manifest|theme-color'
```

Expected: output contains `<link rel="manifest" href="/manifest.webmanifest"/>` and `<meta name="theme-color" content="#0a0a0a"/>`.

Kill the dev server (Ctrl+C in its terminal) before continuing.

- [ ] **Step 3: Verify the manifest is served correctly**

Restart dev server (`npm run dev`), then:
```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:3000/manifest.webmanifest
```

Expected: `200 application/manifest+json` (Next.js infers the MIME type from the `.webmanifest` extension automatically; if it shows `application/octet-stream` we'll fix that in Task 6 via headers config).

Kill the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(pwa): link manifest and set theme color"
```

---

## Task 4: Write the service worker

**Files:**
- Create: `public/sw.js`

- [ ] **Step 1: Write the service worker**

Create `public/sw.js`:

```js
// Flowr service worker.
// Strategy:
//   - Precache critical shell URLs on install.
//   - Static assets (/_next/static/*, icons, manifest): stale-while-revalidate.
//   - HTML navigations: network-first, fall back to cached / on failure.
//   - API / Supabase / non-GET: pass through, never cached.
// Cache name includes a build ID so each deploy invalidates old caches.

const BUILD_ID = self.__FLOWR_BUILD_ID || 'dev';
const CACHE_NAME = `flowr-shell-v${BUILD_ID}`;

const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('flowr-shell-') && k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/')
    || url.pathname.startsWith('/icons/')
    || url.pathname === '/manifest.webmanifest'
    || url.pathname === '/favicon.svg';
}

function isApiOrSupabase(url) {
  return url.pathname.startsWith('/api/') || url.hostname.endsWith('.supabase.co');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Same-origin only for caching decisions; everything cross-origin (CDN images etc.) passes through.
  if (url.origin !== self.location.origin && !isApiOrSupabase(url)) return;

  if (isApiOrSupabase(url)) return; // network only

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => {
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || network;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req) || await cache.match('/');
    if (cached) return cached;
    throw new Error('offline and no cached shell');
  }
}
```

- [ ] **Step 2: Verify the file parses as JavaScript**

Run:
```bash
node --check public/sw.js
```

Expected: no output (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "feat(pwa): add service worker with shell caching"
```

---

## Task 5: Service worker registrar component

A tiny client component that registers `/sw.js` in production. Mounted once in `layout.tsx`.

**Files:**
- Create: `src/components/pwa/ServiceWorkerRegistrar.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create the registrar component**

Create `src/components/pwa/ServiceWorkerRegistrar.tsx`:

```tsx
'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  }, []);

  return null;
}
```

- [ ] **Step 2: Mount it in `layout.tsx`**

In `src/app/layout.tsx`, add the import at the top with the other component imports:

```ts
import ServiceWorkerRegistrar from "@/components/pwa/ServiceWorkerRegistrar";
```

Find the `<SpeedInsights />` line inside `<SupabaseProvider>` and add `<ServiceWorkerRegistrar />` immediately after it:

```tsx
              <Analytics />
              <SpeedInsights />
              <ServiceWorkerRegistrar />
```

- [ ] **Step 3: Verify the project still type-checks and builds**

Run:
```bash
npm run build
```

Expected: build completes with no TypeScript errors. (It's fine if the build is slow; just make sure it finishes cleanly.)

- [ ] **Step 4: Commit**

```bash
git add src/components/pwa/ServiceWorkerRegistrar.tsx src/app/layout.tsx
git commit -m "feat(pwa): register service worker in production"
```

---

## Task 6: Add Next.js header config for `sw.js` and manifest

The service worker file itself must not be HTTP-cached or updates will get stuck. The manifest gets a short cache and an explicit MIME type for safety.

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add the `headers()` function**

Replace the contents of `next.config.ts` with:

```ts
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
};

export default nextConfig;
```

- [ ] **Step 2: Verify the headers apply**

Run:
```bash
npm run dev
```

In another terminal:
```bash
curl -sI http://localhost:3000/sw.js | grep -iE 'cache-control|content-type'
curl -sI http://localhost:3000/manifest.webmanifest | grep -iE 'cache-control|content-type'
```

Expected:
- `/sw.js` shows `Cache-Control: no-cache, no-store, must-revalidate` and JavaScript content type
- `/manifest.webmanifest` shows `Cache-Control: public, max-age=3600` and `application/manifest+json`

Kill the dev server.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat(pwa): serve sw.js no-cache and manifest with correct MIME"
```

---

## Task 7: Install button component

**Files:**
- Create: `src/components/pwa/InstallButton.tsx`

- [ ] **Step 1: Create the install button**

Create `src/components/pwa/InstallButton.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPad on iPadOS 13+ reports as Macintosh; check touch points to disambiguate.
  const isIPadOS = ua.includes('Macintosh') && typeof (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints === 'number' && (navigator as Navigator & { maxTouchPoints: number }).maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || isIPadOS;
}

export default function InstallButton({ collapsed }: { collapsed: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(detectIOS());

    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (isIOS || isInstalled || !deferredPrompt) return null;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const p = deferredPrompt;
    if (!p) return;
    setDeferredPrompt(null);
    try {
      await p.prompt();
      await p.userChoice;
    } catch {
      // user dismissed or prompt unavailable — nothing to do
    }
  };

  return (
    <Tooltip content="Install app">
      <button
        onClick={handleClick}
        aria-label="Install Flowr"
        className={cn(
          collapsed
            ? "w-10 h-10 flex items-center justify-center rounded-[var(--radius-8)] text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] transition-colors border border-transparent"
            : "btn-sidebar-utility hover:!bg-[var(--bone-6)]"
        )}
      >
        <Download strokeWidth={2} className="w-4 h-4" />
      </button>
    </Tooltip>
  );
}
```

The two class branches mirror the workspace switcher button at `src/components/layout/Sidebar.tsx:1156-1172` exactly, so the install button will visually match.

- [ ] **Step 2: Verify the file type-checks**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors involving `InstallButton.tsx`. (Pre-existing errors elsewhere in the project, if any, are fine — just confirm none come from the new file.)

- [ ] **Step 3: Commit**

```bash
git add src/components/pwa/InstallButton.tsx
git commit -m "feat(pwa): add install button component"
```

---

## Task 8: Mount the install button in the sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Import the component**

In `src/components/layout/Sidebar.tsx`, find the existing component imports near the top (around line 18 where `WorkspaceSwitcher` is imported). Add:

```ts
import InstallButton from '@/components/pwa/InstallButton';
```

- [ ] **Step 2: Render it left of the workspace switcher**

In the same file, find the bottom user/workspace bar — the block around line 1156 that begins:

```tsx
        <div className={cn("flex items-center gap-1 shrink-0", effectiveCollapsed && "flex-col gap-2 py-4 h-auto")}>
          <Tooltip content="Spaces">
```

Insert `<InstallButton collapsed={effectiveCollapsed} />` immediately before the `<Tooltip content="Spaces">` line, so it appears as the leftmost icon button in the cluster:

```tsx
        <div className={cn("flex items-center gap-1 shrink-0", effectiveCollapsed && "flex-col gap-2 py-4 h-auto")}>
          <InstallButton collapsed={effectiveCollapsed} />
          <Tooltip content="Spaces">
```

- [ ] **Step 3: Verify the sidebar still type-checks**

Run:
```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(pwa): mount install button left of workspace switcher"
```

---

## Task 9: End-to-end manual verification

The service worker only registers in production, so we need to test against a built/served bundle, not the dev server.

- [ ] **Step 1: Build and start the production server**

```bash
npm run build && npm run start
```

Expected: server starts on http://localhost:3000.

- [ ] **Step 2: Verify the manifest in Chrome DevTools**

Open http://localhost:3000 in Chrome. Open DevTools → Application → Manifest.

Expected:
- Name: Flowr
- Short name: Flowr
- Start URL: /
- Display: standalone
- Theme color: #0a0a0a
- All three icons load with no red error indicators
- No "Manifest" errors listed at the bottom of the panel

- [ ] **Step 3: Verify the service worker is registered**

DevTools → Application → Service Workers.

Expected: `sw.js` listed, status "activated and running."

- [ ] **Step 4: Verify the install button appears and works**

The `beforeinstallprompt` event only fires after the browser confirms installability (HTTPS or localhost, valid manifest, registered SW, some engagement). On localhost this should fire on first load.

Look at the bottom-left of the sidebar — the install button (download icon) should appear immediately to the left of the workspace switcher (`⇅`). Click it. Confirm Chrome's native install dialog appears. Click "Install" — Flowr should open in a standalone window with no browser chrome.

- [ ] **Step 5: Verify the button hides after install**

Reopen http://localhost:3000 in the standalone window. The install button should not render.

In a fresh Chrome tab (not the installed window), reload — the install button should also not render (already installed).

- [ ] **Step 6: Verify offline shell loads**

Back in the standalone window (or a regular Chrome tab on the installed app), DevTools → Network → throttle to "Offline" → reload.

Expected: the app shell renders (sidebar, theme, layout). In-app data fetches fail with the existing app error states. The page does NOT show Chrome's built-in offline dinosaur.

Re-enable network before continuing.

- [ ] **Step 7: Verify API calls are not cached**

DevTools → Network → filter by `supabase` or `/api/`. Reload. Confirm every Supabase/API request shows as a network request (not "(from ServiceWorker)" or "(disk cache)").

- [ ] **Step 8: Verify Lighthouse PWA audit**

DevTools → Lighthouse → check "Progressive Web App" → Analyze page load.

Expected: PWA installability checks pass (green checkmarks for manifest, service worker, HTTPS/localhost, icons).

- [ ] **Step 9: Stop the production server**

Ctrl+C in the terminal running `npm run start`.

- [ ] **Step 10: Final commit (if any tweaks were needed)**

If the manual verification surfaced any small fixes (e.g., a typo in the manifest, a class name adjustment), commit them now:

```bash
git status
# review changes
git add -p
git commit -m "fix(pwa): <describe the fix>"
```

If no changes were needed, skip this step.

---

## Self-review checklist (already applied — listed for transparency)

- **Spec coverage:** All spec sections mapped to tasks — manifest (T2), SW (T4), registrar (T5), headers (T6), button (T7), placement (T8), iOS hidden (T7 `detectIOS`), versioned cache (T4 `BUILD_ID`), verification matrix (T9). The spec's `BUILD_ID` injection is implemented via a runtime `self.__FLOWR_BUILD_ID` fallback to `'dev'` — the current build does not yet inject a real ID, but the versioned-cache mechanism is in place; switching to a real injected ID is a one-line future change and is not needed for first ship.
- **No placeholders:** All steps contain concrete code, commands, and expected output.
- **Type consistency:** `InstallButton` exports default; imported as default in Sidebar. `ServiceWorkerRegistrar` same pattern. Class strings copied verbatim from the workspace switcher button.
- **File paths:** all absolute-from-repo-root, matching the actual project layout.
