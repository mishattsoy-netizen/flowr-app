# How Loading Works in Flowr — Handoff

**Last updated:** 2026-07-17
**Read this before touching anything loading-related, especially on a new page.**

This document exists because "why does my page flash / load slowly" was debugged across six rounds. Most of those rounds failed because the debugger assumed there was ONE loading system. There are FOUR. If you're building a new page and loading feels long, the answer is almost certainly in the table in §3.

---

## 1. TL;DR for someone building a new page

**If your new page loads slowly or flashes, ask this question first:**

> Is the data my page needs stored in localStorage, or does it come from the network?

- **In localStorage** (notes, tasks, spaces, blocks, tabs, UI prefs) → it is available **instantly, synchronously, on the first render**. If your page still shows a skeleton, your page is gating on the wrong thing. See §4.
- **From the network** (chat conversation list, anything you fetch yourself) → it genuinely is not on the device. No amount of hydration cleverness fixes it. Your options are §6.

**The single most common mistake:** copying an existing page's loading pattern without checking which of the four systems it uses. Several pages gate on `isInitialSync` (network) when their data is actually local (instant). That produces a skeleton for no reason.

---

## 2. The architecture (what we built and why)

### `/app` is client-only. This is deliberate.

`src/app/app/page.tsx` is a Server Component that reads one cookie and passes it down. It renders `src/app/app/AppClient.tsx`, which loads the real app via `next/dynamic` with **`ssr: false`**.

**Why:** the server has no access to the user's localStorage. It cannot know which page was open, which tabs, whether split view was on, or any content. So a server render could only ever *guess*, and the guess was always wrong for anyone with data — producing a frame of wrong UI that then snapped to correct. Every "wrong thing flashes on refresh" bug lived in that frame.

Nothing under `/app` needs SSR — it fetches no server-side data. Its only server-side work was reading a cookie **the client itself had written**, to guess what the client already knew.

**Do not re-enable SSR for `/app` or any component under it.** If you add a route that needs SSR, keep it outside the `/app` interior.

### The store hydrates synchronously

`src/data/store.ts` uses Zustand `persist` with a **synchronous** localStorage adapter. Zustand applies persisted state during `create()`, at module load, **before any component renders**.

Verified empirically: with a sync adapter, `useStore.persist.hasHydrated()` is `true` and real state is present immediately after `create()` — no microtask delay. (Zustand's `toThenable` preserves synchronous execution for non-Promise returns.)

**Consequence:** any component reading persisted store data has the **real data on its very first render**. There is nothing to wait for. A skeleton over persisted data is pure waste.

### The frame fallback

`AppClient.tsx` has an `AppFrameFallback` shown while the JS chunk downloads. It contains **only** the outer frame (sidebar-width column, header strip) and no content.

**This is not an oversight — do not "improve" it.** It renders before any app code exists, so nothing about the user is knowable. Any skeleton row/card/text there is a guess, and a wrong guess reintroduces the exact flash the client-only change eliminated. Only draw things identical for every user on every page.

---

## 3. The FOUR loading systems ⚠️ READ THIS

This is the part that caused six rounds of failed debugging. These are **independent**. Knowing one tells you nothing about the others.

| # | Signal | Driven by | Default | Who uses it |
|---|--------|-----------|---------|-------------|
| 1 | `useAppReady()` → `isReady` / `storeHydrated` | localStorage hydration | **effectively `true` on first render** | `EntityPageRenderer`, `Shell`, `HeaderBar`, `WorkspaceRouter`, `ChatPage` |
| 2 | `isInitialSync` (+ `useDeferredLoading`) | **Supabase network fetch** | `true` until sync completes | `AllFilesWidget` |
| 3 | `isChatHistoryLoading` | **network fetch** of conversation list | `false`, set `true` around fetch | `Sidebar` (chat history rows) |
| 4 | `isAILoading` / `isChatMessagesLoading` | AI request / message fetch state | `false` | `AIAssistant`, `ChatConversation` |

### System 1 — `useAppReady` (hydration)

```ts
const { isReady, storeHydrated } = useAppReady(); // src/hooks/useAppReady.ts
```

Reads `hasHydrated()` in the `useState` initializer, so it returns `true` on first render. `EntityPageRenderer` does `const isLoading = !isReady;` and passes `isLoading` into pages.

**Practical effect: `isLoading` is `false` immediately.** Skeletons gated on it (Dashboard's Recents, KanbanColumn's cards, NoteEditor's title/blocks, `ChatMainSkeleton`) essentially **never render** anymore. That is correct and intended — the data is already there.

⚠️ **Historical trap:** `useAppReady` used to start `false` deliberately, to match the server's render (commit `5048a6c`). That constraint is gone now that `/app` is client-only. **Do not "restore" it** — you'd reintroduce a fake loading frame for no reason.

### System 2 — `isInitialSync` (network)

Starts `true`. Only becomes `false` after `SupabaseProvider`'s boot fetch resolves (`SupabaseProvider.tsx` — four `setInitialSync(false)` call sites, covering success/failure/no-supabase/local-only paths).

`useDeferredLoading(isLoading, delay)` (`src/hooks/use-deferred-loading.ts`) only returns `true` if loading persists past `delay` ms — an anti-flicker wrapper.

⚠️ **If your new page gates on `isInitialSync` but your data is persisted, you are showing a skeleton over data you already have.** This is the #1 cause of "my new page loads slowly."

### System 3 — `isChatHistoryLoading` (network)

`chatConversations` is **NOT in the persist allowlist** — the conversation list is fetched from the network on every load. This is why chat history always skeletons. It is not a bug in the hydration work; the data genuinely isn't on the device.

### System 4 — `isAILoading` / `isChatMessagesLoading`

Request-scoped AI state. Unrelated to boot.

---

## 4. Decision guide for a new page

```
Is your page's data in the persist allowlist (§5)?
├─ YES → Do NOT gate on isInitialSync. Do NOT add a skeleton.
│        Just read from the store. It's there on frame 1.
│        (Optional: use `isLoading` from EntityPageRenderer — it's false anyway.)
│
└─ NO (you fetch it) → You have a real load. Pick one:
   ├─ Add it to persist (§5) → becomes instant, updates quietly in background
   ├─ Show a skeleton gated on YOUR OWN loading flag (like isChatHistoryLoading)
   └─ Cache just the cheap part (e.g. titles) and lazy-load the heavy part
```

**Rule of thumb:** the app's whole design goal is *"show cached data instantly, update quietly in the background."* Not *"skeleton until the server confirms."* If your page shows a skeleton over data the user already has locally, that's a regression in intent even if it "works."

---

## 5. What's persisted (localStorage) — instant

From `partialize` in `src/data/store.ts`. If it's here, it's on frame 1:

`entities`, `tasks`, `blocks`, `spaces`, `chatMessagesMap`, `chatConversations`, `brainCanvasState`, `activeSpaceId`, `syncCursors`, `pendingModeWrites`, `activeEntityId`, `activeTabId`, `openTabIds`, `favoriteIds`, `collapsedIds`, `theme`, `interfaceSize`, `isSidebarCollapsed`, `isSidebarPinned`, `isToolbarVisible`, `isChatNewNoteButtonVisible`, `toolbarPosition`, `sidebarWidth`, `aiSidebarWidth`, `taskPanelWidth`, `splitViewActive`, `splitViewLeftId`, `splitViewRightId`, `splitViewPosition`, `isFullWidth`, `isTabsHeaderVisible`, `appStyle`, `dashboardLayout`, `defaultDashboardLayout`, `aiMessages`, `aiBehaviorMode`, `aiApiKey`, `copiedBlock`, `sidebarSectionSettings`, `readModeStates`, `trackerColumnSortModes`, `trackerColumnSortLocks`, `hiddenEntityIds`, `recentEntityIds`, `activeMode`, `activeChatId`, `isTempChat`, `pendingNewChat`, `chatHistoryOpen`, `defaultsSeeded`, `chatInputs`, `sessionContextsMap`, `shortcuts`, `cachedDisplayName`

`chatConversations` (metadata only — no message content) and `brainCanvasState` (the full `/api/ai/user-brain` response, incl. node content) were added 2026-07-17 to fix the chat-history sidebar and the brain canvas/sidebar, which previously had no local cache at all and always showed a full loading state on every mount. `brainCanvasState` is loosely typed as `Record<string, any> | null` in `store.types.ts` (see `useBrainData.ts` for the real `BrainCanvasState` shape) to avoid the foundation layer depending on a component-layer type — same pattern as `sessionContextsMap`.

**No longer un-persisted / all local data now caches.** If you find another page with a hook-local `useState(null)` + `fetch` pattern and no store involvement (that's what both of these were), it's a strong signal it needs the same treatment: move the state into the store, `partialize` it, initialize the hook's local state from the store selector instead of `null`.

**To make new data instant:** add the key to `partialize`. Additive changes need **no version bump** — the store's `create()` initializer already provides defaults, so old persisted blobs lacking the key are harmless. (`version: 22` migrations are only for *transforming* existing data.)

---

## 6. Known landmines

### 6.1 `setEntities` silently reassigns `activeSpaceId`

`src/data/store.ts`:

```ts
setEntities: (entities) => {
  set((s) => {
    let newActiveSpaceId = s.activeSpaceId;
    const globalSpaces = s.spaces;
    if (!newActiveSpaceId || !globalSpaces.some(ws => ws.id === newActiveSpaceId)) {
      newActiveSpaceId = globalSpaces.length > 0 ? globalSpaces[0].id : 'ws-personal';
    }
    return { entities, activeSpaceId: newActiveSpaceId };
  });
},
```

**Always call `setSpaces` BEFORE `setEntities`.** If `setEntities` runs against a stale/empty `spaces` array, it clobbers `activeSpaceId` → `TrackerPage`'s filter (`t.spaceId === activeSpaceId`) matches nothing → Kanban columns go empty until the correct value returns. All boot paths in `SupabaseProvider` were reordered for this. If you add a new bulk-load path, preserve the order.

### 6.2 Component-local hydration gates

`Sidebar.tsx` does **not** use `useAppReady` — it has its own `isMounted` + `storeHydrated` state (both now initialized to the real value). If you add a component with its own gate, initialize it truthfully; don't copy the old `useState(false)` pattern.

### 6.3 The `flowr-initial-entity` cookie is now vestigial

Written by the inline `<head>` script in `src/app/layout.tsx` and by a store subscriber; read by `page.tsx` → passed as `initialEntityId` into `Shell` / `WorkspaceRouter` / `Sidebar`.

It was built to *fight* SSR. Now that `/app` is client-only and the store hydrates on frame 1, it's a harmless no-op kept only to avoid a risky refactor. **Don't build new features on it** — read the store instead. (The `--sidebar-w` CSS var from that same script IS still load-bearing for the frame fallback.)

### 6.4 Skeleton components exist but mostly don't render

`SidebarSkeleton`, `ChatHistorySkeleton`, `ChatMainSkeleton`, `NoteSkeleton`, `TrackerSkeleton` all exist. Most are now unreachable because their `isLoading` gate is always `false`.

Two of these are **hand-drawn duplicates** of the real UI (`SidebarSkeleton` re-implements the sidebar's buttons as static divs). They drift from the real UI and caused "inaccurate replica" complaints. **Don't add more hand-drawn skeleton duplicates.** If a skeleton is genuinely needed, derive it from the same component that renders the real thing.

### 6.5 A "fifth loading system" can hide in a feature-local hook

The four systems in §3 aren't exhaustive — they're what existed in the core app shell as of this doc's first version. `src/components/brain/canvas/useBrainData.ts` was a **fifth**, independent one: a plain `useState<T | null>(null)` + `fetch`, no Zustand involvement, no cache, `!state` gating a full-page loader. It was also called from **two unrelated components** (`BrainCanvasPage` and `BrainSidebarContent`), each with its own separate instance — meaning two redundant fetches, and the sidebar rendering genuinely empty (not skeleton) until its own fetch resolved.

Fixed 2026-07-17 the same way as §5: added `brainCanvasState` to the store + `partialize`, and `useBrainData` now initializes its local `useState` from the store selector instead of `null`, and writes through the store on every update. Both hook instances now read the same cached value, so the sidebar and canvas both paint instantly and the redundant-fetch problem disappears as a side effect (fetches still happen for freshness, they just don't gate the first paint).

**When auditing a new/unfamiliar page for slow loading, don't assume it uses one of the four systems in §3.** Grep for `useState<...>(null)` combined with a `fetch(...)` call in the same file — that pattern means "sixth system," not a bug in an existing one.

---

## 7. Debugging checklist for "loading is slow on my page"

1. **Which of the four systems is your page gating on?** (`grep` for `isLoading`, `isInitialSync`, `useDeferredLoading`, `storeHydrated` in your page.) Don't assume — check.
2. **Is your data in `partialize` (§5)?** If yes and you see a skeleton → you're gating on a network signal for local data. Remove the gate.
3. **Is it the JS chunk download?** That's `AppFrameFallback` (frame, no content). Judge it on `npm run build && npm start` — **dev mode is dramatically slower and will mislead you.**
4. **Is it a real network wait?** Then it's honest. Fix it by persisting the data, not by adding a skeleton.
5. **Columns/lists empty briefly?** Suspect §6.1 (`activeSpaceId` clobbering), not hydration.

---

## 8. Things that are true and surprising (verified, don't re-litigate)

- Zustand `persist` with a **sync** adapter hydrates **synchronously** at `create()`. `hasHydrated()` is `true` before the first render. (Empirically tested; `toThenable` short-circuits for non-Promises.)
- `ssr: false` is **only allowed in a Client Component** in the App Router. That's the sole reason `AppClient.tsx` exists as a wrapper around `page.tsx`.
- `/app` still shows as `ƒ (Dynamic)` in build output. That's expected — the *route* is server-handled (it reads the cookie); the *interior* is excluded from that render. Verified: nothing under `src/app/` statically imports `Shell`.
- Adding keys to `partialize` does **not** require a `version` bump.
- The project has **no React test renderer** (`vitest` runs `environment: node`, no `@testing-library/react`). Loading/render behavior **cannot be unit-tested here** — it must be verified visually in a browser. Store logic can be tested.
