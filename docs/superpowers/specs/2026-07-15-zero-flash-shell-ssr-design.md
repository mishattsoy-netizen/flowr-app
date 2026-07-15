# Zero-Flash Shell SSR (Scope 4) — Design

**Date:** 2026-07-15
**Status:** Approved (pending spec review)
**Follows:** `2026-07-15-stable-refresh-design.md` (Scopes 1–3). This is Scope 4.

## Problem

Scope 1 removed the artificial 600ms loading gate, but a **brief skeleton flash still occurs on refresh** for the header tabs (and the sidebar). Root cause is structural, not a bug:

- Both web **and** Electron run a Next SSR server (Electron forks a Next server and `loadURL`s it — verified in `electron/main.js:204,450`). The app is never client-only.
- The SSR server has no `localStorage`, so it cannot know the user's open tabs / active page on first paint — it renders skeletons.
- To avoid a hydration mismatch, the client's first render must match the server (skeletons too). Real content can only appear after hydration.

The old `useAppReady` masked this by forcing skeletons on both server and first-client render for ≥600ms. Scope 1's fix (start `false`, flip in `useEffect`) keeps the render SSR-safe but shortens the flash to hydration time rather than eliminating it.

**Goal:** eliminate the *tab* skeleton flash by giving the SSR server enough state — via a cookie — to render the real tabs on first paint. Reduce (not eliminate) the sidebar flash.

## Key constraints (what makes this hard)

1. **Cookies are ~4KB and sent on every request.** Only tiny, slowly-changing state belongs there. Open tabs (a handful of `{id, title, icon}`) fit; the full entity/sidebar tree does not.
2. **A rendered tab reads `entities.find(id)` for its title/icon** (`HeaderBar.tsx:516`). System tabs (dashboard/chat/tracker) have hardcoded labels (lines 519–521); entity tabs (note/canvas/folder) get `title`/`Icon` from the store. So SSR-ing tab **IDs alone yields blank-label boxes** until hydration — the flash moves to the text, not gone. The cookie must carry per-tab `{id, title, icon}`.
3. **Free local-only desktop has no server-side data source.** The SSR server cannot fetch entities from Supabase (the user isn't signed in) or SQLite (that's in the Electron main process, not the Next server). So SSR must rely only on the cookie, never on a server-side data fetch.
4. **Server-fetching data to SSR would race localStorage** — a server-rendered tree vs the client's localStorage-cached tree is a fresh hydration mismatch, the same class of bug Scope 1's fix resolved.

## Scope decision

- **Tabs: cookie-SSR → zero flash.** Feasible and in scope.
- **Sidebar full-tree SSR: OUT.** Cookie-infeasible (too big, changes constantly), breaks the local-only desktop model (no server data source), and reintroduces the first-paint latency Scope 1 removed. Instead, apply the same false-on-both-sides hydration gate to the sidebar's own check so its skeleton is **brief and mismatch-free** — the best achievable without SSR-ing data. The sidebar's *data stability* (items disappearing) is already fixed by Scope 3; only the brief flash remains and it is not cookie-eliminable.

## Design

### Part A — Extend the shell cookie to carry open tabs

**Cookie writer** (`src/app/layout.tsx`, inline `flowr-init` script, currently lines 97–100 writing only `activeEntityId`):

Extend the script to also serialize a compact tabs payload from the persisted `flowr-storage` state it already parses. For each id in `state.openTabIds`, resolve `{ id, title, icon }` from `state.entities` (system routes get hardcoded labels). Write a second cookie:

```js
// after the existing flowr-initial-entity cookie
try {
  const openTabIds = Array.isArray(state.openTabIds) ? state.openTabIds : [];
  const entityById = {};
  (state.entities || []).forEach(function (e) { entityById[e.id] = e; });
  const SYS = { dashboard: 'Home', chat: 'Chat', tracker: 'Tasks' };
  const tabs = openTabIds.slice(0, 12).map(function (id) {
    if (SYS[id]) return { id: id, title: SYS[id], sys: 1 };
    var e = entityById[id];
    return e ? { id: id, title: (e.title || '').slice(0, 60), icon: e.icon || null, type: e.type || 'note' } : null;
  }).filter(Boolean);
  var payload = JSON.stringify({ tabs: tabs, activeTabId: state.activeTabId || null });
  // keep under ~3KB; if too large, drop to ids-only so we never blow the cookie limit
  if (payload.length < 3000) {
    document.cookie = "flowr-shell=" + encodeURIComponent(payload) + "; path=/; max-age=31536000; SameSite=Lax";
  } else {
    document.cookie = "flowr-shell=; path=/; max-age=0"; // clear — fall back to skeleton
  }
} catch (e) {}
```

Rationale: this runs before React mounts (it's a synchronous `<head>` script), so the cookie is always one refresh behind — which is correct, because it describes the state the user is refreshing *into*. Truncation guards the 4KB cookie ceiling; on overflow we clear the cookie and gracefully fall back to the (brief) skeleton.

### Part B — Read the cookie server-side and pass tabs down

**`src/app/app/page.tsx`** currently reads only `flowr-initial-entity`. Add:

```tsx
const shellRaw = cookieStore.get('flowr-shell')?.value;
let initialTabs: InitialTab[] = [];
let initialActiveTabId: string | null = null;
if (shellRaw) {
  try {
    const parsed = JSON.parse(decodeURIComponent(shellRaw));
    if (Array.isArray(parsed.tabs)) initialTabs = parsed.tabs;
    initialActiveTabId = parsed.activeTabId ?? null;
  } catch { /* ignore — fall back to skeleton */ }
}
```

Pass `initialTabs` and `initialActiveTabId` into `<Shell>` → `<HeaderBar>`. Define `InitialTab` in a shared types location:

```ts
export interface InitialTab {
  id: string;
  title: string;
  icon?: string | null;
  type?: string;
  sys?: 1;
}
```

### Part C — HeaderBar renders cookie tabs until hydration, then swaps to live store

**`src/components/layout/HeaderBar.tsx`** currently gates tabs on `hasHydrated` (line 609: `{hasHydrated && ... openTabIds.map(...)}`) with a skeleton branch at 598 (`{!hasHydrated && ...}`).

Change so that **before hydration** it renders from the `initialTabs` prop (cookie-fed) instead of a skeleton, and **after hydration** it renders from the live store `openTabIds` as today:

- Source-of-truth for rendering: `const tabsToRender = hasHydrated ? openTabIds.map(id => ({ id, ...getTabMeta(id) })) : initialTabs;`
- `getTabMeta` stays for the hydrated path. For the pre-hydration path, use the cookie's `title`/`icon` directly (no store lookup — the store isn't hydrated yet server-side).
- Both branches must produce **identical HTML** for the same tab so the server render (using `initialTabs`) matches the client's first render (also `initialTabs`, since `hasHydrated` starts `false` on the client per Scope 1's fix). This is the critical invariant that prevents a new hydration mismatch.
- The existing skeleton branch (598) becomes the fallback only when `initialTabs` is empty (first-ever visit, no cookie yet).

**Icon resolution:** the cookie carries `icon` as the entity's icon *key* (string), not a component. Map it through the same `getEntityIcon(iconKey)` used in `getTabMeta` (line 522), with the same type-based fallback (`canvas → Frame`, `folder → Folder`, else `File`). Extract a shared `resolveTabIcon({ icon, type, sys, id })` helper so the pre- and post-hydration paths render the same icon for the same tab.

### Part D — Sidebar: brief mismatch-free flash (not zero)

**`src/components/layout/Sidebar.tsx`** has its own hydration check (lines 497–500) driving `SidebarSkeleton`/`ChatHistorySkeleton` (1223–1224). It is independent of `useAppReady`. Apply the same SSR-safe pattern: its hydrated flag must start `false` on the first client render (matching the server) and flip in `useEffect` — no timer. This keeps the sidebar skeleton **brief and mismatch-free**. True zero-flash sidebar is explicitly out of scope (requires SSR-ing entity data, which constraints 1/3/4 forbid).

## Testing strategy

The project's vitest is `environment: node` with no React renderer (per `bootHydration.test.ts`), so hydration itself can't be unit-tested here. Test the **pure serialization/parse boundary** instead, which is where bugs live:

- `serializeShellCookie(state)` → produces the tabs payload; unit-test: system tabs get hardcoded titles, entity tabs pull title/icon, output stays under the size cap, overflow returns the clear-signal.
- `parseShellCookie(raw)` → round-trips a serialized payload; tolerates malformed input (returns empty).
- `resolveTabIcon(meta)` → returns the same icon component for a cookie tab and its equivalent store entity.

Extract `serializeShellCookie`/`parseShellCookie`/`resolveTabIcon` as pure functions (not inline in the `<script>` string / component) so they are unit-testable, and have the inline script + page + HeaderBar call them.

Empirical verification (manual, in the running app, both platforms): refresh on a page with several entity tabs open → tabs render with correct labels/icons immediately, no blank-box or skeleton flash, no hydration error in console.

## Out of scope

- Sidebar full-tree SSR (constraints 1, 3, 4).
- Any server-side data fetch during SSR.
- Widget-content SSR (widgets read the store; same data-SSR constraint as the sidebar — brief mismatch-free flash is the ceiling).
- The pre-existing `<script>`-in-`<head>` Next warning at `layout.tsx:68` (unrelated, harmless).
