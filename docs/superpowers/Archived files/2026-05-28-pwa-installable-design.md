# PWA: Make Flowr Installable

**Date:** 2026-05-28
**Status:** Approved design — ready for implementation plan

## Goal

Make Flowr installable as a standalone app on desktop (Chrome, Edge, Brave, Arc, Safari macOS) so it lives in the dock/start menu like a native app rather than a browser tab. No app store, no separate codebase, no offline data — just the PWA install experience with a fast, cached app shell.

## Non-goals

- Offline data access (Supabase queries always require network — by design)
- Push notifications
- Background sync
- iOS install support (hidden on iOS — see iOS section)
- Native installer / .dmg / .exe (that's the Tauri path, deferred)
- App store submission

## Architecture

Three thin additions on top of the existing Next.js 16 app:

1. **Web App Manifest** (`public/manifest.webmanifest`) — declares name, icons, theme color, `display: "standalone"`, `start_url: "/"`. This is what triggers the browser's native install affordance.
2. **Service Worker** (`public/sw.js`) — caches the app shell with a stale-while-revalidate strategy. Never caches API or Supabase traffic.
3. **Install button** — small icon button in the sidebar's bottom user/workspace bar, left of the workspace switcher. Wired to the browser's `beforeinstallprompt` event.

## Files

### New

- `public/manifest.webmanifest`
- `public/icons/icon-192.png` — generated from `public/logo simple.svg`
- `public/icons/icon-512.png` — generated from `public/logo simple.svg`
- `public/icons/icon-maskable-512.png` — generated with safe-zone padding for Android adaptive icons
- `public/sw.js` — hand-written service worker (no library)
- `src/components/pwa/InstallButton.tsx` — the icon button
- `src/components/pwa/ServiceWorkerRegistrar.tsx` — client component that registers `sw.js` on mount

### Touched

- `src/app/layout.tsx` — add `<link rel="manifest">`, `<meta name="theme-color">`, mount `<ServiceWorkerRegistrar />` once
- `src/components/layout/Sidebar.tsx` — drop `<InstallButton />` into the bottom user bar row, immediately left of the workspace switcher (`⇅` chevrons button), using the same icon-button styling
- `next.config.ts` — add a header rule so `/sw.js` is served with `Cache-Control: no-cache, no-store, must-revalidate` (otherwise SW updates get stuck behind HTTP caching)

## Component details

### Manifest (`public/manifest.webmanifest`)

```json
{
  "name": "Flowr",
  "short_name": "Flowr",
  "description": "Flowr — your workspace.",
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

Final `background_color` / `theme_color` values to be confirmed against the actual dark-mode chrome color used by the app shell.

### Service worker (`public/sw.js`)

Hand-written, no Workbox/next-pwa dependency. Strategy:

- **On `install`:** precache a small list of critical static URLs (manifest, icons, `/` shell). `skipWaiting()`.
- **On `activate`:** delete any cache whose name doesn't match the current version. `clients.claim()`.
- **On `fetch`:**
  - If request URL is for Supabase, any `/api/*`, or any non-GET → pass through to network, do not cache.
  - If request is for a Next.js static asset (`/_next/static/*`) or one of the precached URLs → **stale-while-revalidate**: serve from cache immediately, refetch in background, update cache.
  - Everything else (HTML navigations) → **network-first** with cache fallback, so users always see latest pages when online but still get the shell when offline.

Cache name: `flowr-shell-v{BUILD_ID}` where `{BUILD_ID}` is injected at build time (Next.js exposes `process.env.NEXT_PUBLIC_BUILD_ID` or we wire one through). Every deploy produces a new cache name and the old one is evicted on `activate`. This prevents the "user stuck on stale bundle" failure mode that plagues hand-rolled service workers.

### `<ServiceWorkerRegistrar />`

Client component, mounted once in `src/app/layout.tsx`. On mount:

- If `'serviceWorker' in navigator` and `process.env.NODE_ENV === 'production'`, register `/sw.js`.
- Skip registration entirely in dev so the SW doesn't interfere with HMR.
- No UI — pure side effect.

### `<InstallButton />`

Client component. State:

- `deferredPrompt: BeforeInstallPromptEvent | null`
- `isInstalled: boolean` (from `matchMedia('(display-mode: standalone)')`)
- `isIOS: boolean` (UA check for iPhone/iPad)

Lifecycle:

- On mount, attach a `beforeinstallprompt` listener that calls `e.preventDefault()` and stashes the event in state.
- Also listen for `appinstalled` to flip `isInstalled = true`.

Render:

- If `isIOS` → render nothing.
- If `isInstalled` → render nothing.
- If `!deferredPrompt` → render nothing (browser hasn't deemed the app installable yet).
- Otherwise → render an icon button matching the workspace switcher's styling (same size, same padding, same hover, same dark/light theme treatment). Icon: `Download` from `lucide-react`. `aria-label="Install Flowr"`. Tooltip: "Install app."

Click handler: call `deferredPrompt.prompt()`, await `userChoice`, then clear `deferredPrompt` regardless of outcome.

### Sidebar placement

In `src/components/layout/Sidebar.tsx`, locate the bottom user/workspace bar row that contains the workspace switcher (`ChevronsUpDown` button), theme toggle (`Sun`/`Moon`), and settings gear. Insert `<InstallButton />` **immediately to the left of the workspace switcher**, using the same wrapper/styling so it visually belongs to the same icon-button cluster.

### `next.config.ts` headers

```ts
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
}
```

Merge with any existing `headers()` config rather than overwriting.

## Data flow

```
First visit:   browser fetches HTML/JS/CSS from network → SW installs → precaches shell
Return visit:  SW serves cached shell instantly → revalidates in background → updates cache
API/Supabase:  always pass through to network, never cached (real-time data stays real-time)
Offline:       shell loads from cache → existing in-app error states show on failed data fetches
New deploy:    new BUILD_ID → new cache name → old cache deleted on next activation
```

## iOS handling

iOS Safari doesn't fire `beforeinstallprompt` and has no programmatic install API. The only path is the user manually picking Share → Add to Home Screen.

Decision: **hide the install button entirely on iOS.** iPhone usage of a desktop-oriented productivity app is low, and surfacing a button that requires a tutorial adds noise. iOS users who want it can use the share sheet themselves.

## Error handling

- **SW registration fails:** swallow silently (log to console). The app still works as a regular web app.
- **`beforeinstallprompt` never fires:** button stays hidden. This is the correct behavior — the browser has decided the app isn't installable (HTTPS missing, manifest broken, already installed, etc.).
- **User dismisses install prompt:** clear `deferredPrompt`, hide button until next page load. Don't re-prompt.

## Testing

Manual verification (no automated tests for the PWA layer — the surface is tiny and browser-dependent):

1. **Lighthouse audit:** Chrome DevTools → Lighthouse → PWA category passes installability checks.
2. **Manifest valid:** DevTools → Application → Manifest shows no errors, all icons load.
3. **SW registered:** DevTools → Application → Service Workers shows `sw.js` activated.
4. **Install flow (Chrome desktop):** Install button appears in sidebar → click → native install dialog → confirm → app opens in standalone window.
5. **Install flow (Edge, Brave, Arc):** same as Chrome.
6. **Hidden when installed:** open the installed app, confirm Install button doesn't render.
7. **Hidden on iOS:** load on iPhone Safari, confirm button doesn't render.
8. **Offline shell:** install app, go offline via DevTools, reload — shell loads, data fetches show existing error states.
9. **Cache versioning:** deploy a code change, reload — new BUILD_ID, old cache deleted, new bundle served. No manual cache clear needed.
10. **API not cached:** DevTools Network tab shows Supabase/API requests go to network even on repeat visits.

## Out of scope (explicit YAGNI)

- Push notifications
- Background sync
- Offline data caching of Supabase queries
- Custom iOS install instructions / modal
- App store submission
- Native installer (.dmg, .exe) — separate Tauri project, deferred

## Open questions for implementation

- Exact `background_color` / `theme_color` hex — sample from the actual dark-mode app chrome during implementation.
- Icon generation: which tool (`sharp` script in `scripts/`, or one-off via a design tool). Either works; pick whichever is faster at implementation time.
