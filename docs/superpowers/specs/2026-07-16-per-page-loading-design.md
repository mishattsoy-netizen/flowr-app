# Per-Page Content Loading — Design

**Date:** 2026-07-16
**Status:** Approved (pending spec review)
**Supersedes:** `2026-07-16-unified-readiness-gate-design.md` (Parts B/C — neutral shell / single gate — rejected by user; Part A is correct and carried forward here as Part A).
**Scope:** Content-region skeletons (Parts A–C, both platforms) + desktop SSR platform-tree mismatch (Part D, Electron-only fix, web unaffected).

## Problem, corrected

The previous spec proposed a neutral platform-agnostic shell shown during hydration, with everything flipping to real content at once. The user rejected this — for the second time (the very first message in this whole thread describes removing a full-app skeleton they'd built earlier and hated).

**What the user actually wants**, stated directly and confirmed against a real screenshot of Dashboard's current refresh behavior: system UI (sidebar frame, tabs bar, header chrome) must **never** flash, shift, or resize on refresh. Only user-created/customized **content regions** — recent cards, task rows, sidebar rows, chat messages, note blocks — show skeletons, and those skeletons must sit in the exact position the real content will occupy. This is a **per-page, per-content-region** pattern, not a unified shell.

The user's Dashboard screenshot is the reference: chrome (title, search bar, tab bar, sidebar) is fully present and stable; only the Recents cards, task list rows, and Shortcuts tiles show skeleton placeholders shaped like their real counterparts.

## What's already correct (verified)

- **Dashboard** (`Dashboard.tsx`): already exactly matches the target pattern. The page's own JSX shell always renders; only `Recents` cards (hand-built skeleton JSX at lines ~526-540) and the widgets (`SmartTaskStackWidget`, `ShortcutsWidget`, both receiving `isLoading`) swap to internal skeletons.
- **Tracker/Kanban** (`TrackerPage.tsx` → `KanbanColumn.tsx`): already has real per-column card-shaped skeletons (`KanbanColumn.tsx:277-290`, sized placeholder divs standing in for task cards). Genuinely as good as Dashboard's pattern already.
- **Chat** (`ChatConversation.tsx`): has an `isLoading`-gated skeleton (`ChatMainSkeleton`), but with a real bug — see root cause C below.
- **Note** (`NotePage.tsx`): already accepts an `isLoading` prop and forwards it to `NoteEditor` — but nothing ever passes it a value. See root cause B below.

## Root causes

### A. Routing bug — Kanban/Chat/Note show Dashboard's skeleton because Dashboard is what's actually mounted

Carried forward verbatim from the superseded spec, unchanged and still the correct fix:

`WorkspaceRouter.tsx:12` reads `activeEntityId` via `useStore(state => state.activeEntityId)`. Zustand's `persist` middleware has no `skipHydration` configured, so **every render before hydration completes — server AND the client's first paint — returns the store's initializer default**, the literal string `'dashboard'` (`store.ts:271`), not `null`/`undefined`. The fallback chain at `WorkspaceRouter.tsx:30` (`activeEntityId ?? initialEntityId ?? 'dashboard'`) therefore **always short-circuits to `'dashboard'`** — the `initialEntityId` cookie (already written in `layout.tsx`, already passed down as a prop) is dead code, never reached, because `activeEntityId` is always truthy before hydration.

This means the app isn't reusing Dashboard's skeleton styling for other pages — it is **literally mounting the Dashboard component** instead of Tracker/Chat/Note during the loading window, on every refresh, regardless of which page was actually open. This is the single root cause behind the "wrong skeleton per page" complaint, and fixing it is most of the real fix, because each page's own (already-correct or near-correct) internal skeleton wiring then actually gets a chance to render.

**Fix** — route from the cookie until hydration completes, exactly as before:

```tsx
"use client";

import { useStore } from '@/data/store';
import { EntityPageRenderer } from '@/components/EntityPageRenderer';
import { useAppReady } from '@/hooks/useAppReady';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { memo } from 'react';

export const WorkspaceRouter = memo(function WorkspaceRouter({ initialEntityId }: { initialEntityId?: string }) {
  const activeEntityId = useStore(state => state.activeEntityId);
  const { storeHydrated } = useAppReady();
  const containerRef = useRef<HTMLDivElement>(null);

  // Before hydration, the store's activeEntityId is the un-hydrated initializer
  // default ('dashboard'), not the user's real last page — trusting it here is
  // what causes Tasks/Chat/Note to flash a Dashboard route on every refresh.
  // Route from the server-provided cookie (the user's actual last page) until
  // the real persisted value is available.
  const resolvedEntityId = storeHydrated ? (activeEntityId ?? 'dashboard') : (initialEntityId ?? 'dashboard');

  useEffect(() => {
    if (containerRef.current) {
      if (resolvedEntityId === 'tracker' || resolvedEntityId === 'chat') {
        gsap.set(containerRef.current, { autoAlpha: 1, y: 0, x: 0, clearProps: 'transform' });
      } else {
        gsap.set(containerRef.current, { autoAlpha: 1, y: 0 });
      }
    }
  }, [resolvedEntityId]);

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-h-0 relative">
      <EntityPageRenderer entityId={resolvedEntityId} />
    </div>
  );
});
```

SSR-safety: server and the client's first paint both resolve from the cookie (`storeHydrated` is `false` on both), so the same component mounts on both sides — no hydration mismatch introduced.

### B. `NotePage` never receives `isLoading`

`EntityPageRenderer.tsx:61` — `return <NotePage entity={entity} />; // TODO pass isLoading` — the prop is dropped on the floor even though `NotePage` (and `NoteEditor` beneath it) already accept it.

**Fix:**

```tsx
// EntityPageRenderer.tsx, entity.type === 'note' branch:
case 'note':
  return <NotePage entity={entity} isLoading={isLoading} />;
```

`NoteEditor` must then render its own content-shaped skeleton (title bar + a few block-shaped placeholder lines, matching the Dashboard/Kanban quality bar) when `isLoading` is true, instead of blank/nothing. This is new skeleton JSX to write, following the same hand-built, position-matched pattern as Dashboard's Recents cards.

### C. Chat skeleton shows even when there's nothing to fetch (new/temp chat)

`ChatConversation.tsx:23,47-49`:

```tsx
const isMinLoading = useMinimumLoadingTime(!!isLoading || isChatMessagesLoading, 500);
...
if (isMinLoading) {
  return <ChatMainSkeleton />;
}
```

This fires unconditionally on `isLoading`, with no check for whether the current chat actually has anything to load. A brand-new or temporary chat has zero messages and nothing to fetch — per the user's explicit requirement ("when I hit refresh in new chat page, there is no content that needs to be fetched so only sidebar chat history shows skeleton"), it must never show a message skeleton.

**Fix** — skip the skeleton when there's no real conversation to hydrate:

```tsx
export function ChatConversation({ isLoading }: { isLoading?: boolean }) {
  const isTempChat = useStore(s => s.isTempChat);
  const activeChatId = useStore(s => s.activeChatId);
  // ...existing hooks...

  const hasNothingToLoad = isTempChat || !activeChatId;
  const isMinLoading = useMinimumLoadingTime(
    !hasNothingToLoad && (!!isLoading || isChatMessagesLoading),
    500,
  );

  // ...
  if (isMinLoading) {
    return <ChatMainSkeleton />;
  }
  // new/temp chat renders its real (already-correct) empty-state UI immediately
```

Also remove the extra `500`ms `useMinimumLoadingTime` floor here — it's a sibling of the artificial delay Scope 1 already removed from `useAppReady`, and it re-introduces exactly the kind of unnecessary wait Scope 1 eliminated elsewhere. Once root cause A is fixed, `isLoading` becomes true for only as long as real hydration takes (near-instant), so the 500ms floor is pure added latency with no benefit. Drop the wrapper and use `!!isLoading || isChatMessagesLoading` directly.

### D. Desktop shows the web layout tree during SSR/first paint (the "floating containers" flash)

The user confirmed they want this fixed too — previously flagged as out of scope, now folded in after investigation showed it has the same cheap fix shape as root cause A ("fix the value source, not every branch").

**What's actually different, not just how it looks:** `Shell.tsx` renders **two structurally different layout trees** depending on `isDesktop()`, not one tree with conditional styling. On desktop (`isDesktop() === true`): `HeaderBar` renders once, globally, above a row of separately-bordered/rounded/shadowed "floating" cards for sidebar, main content, and AI panel (`Shell.tsx` — e.g. `bg-sidebar border border-[var(--bone-10)] rounded-2xl shadow-sm` on the sidebar wrapper, main content wrapper, and AI panel wrapper, with `gap-2` between them). On web: `HeaderBar` renders *inside* the main content area, no floating cards, flush layout with a border-right divider instead.

**Root cause:** `isDesktop()` (`src/lib/env.ts`) is `typeof window !== 'undefined' && !!window.__FLOWR_DESKTOP__` — always `false` during any SSR render, including Electron's, because `window` doesn't exist server-side. Electron's `__FLOWR_DESKTOP__` flag is only ever set client-side after mount. So the Electron SSR server always renders the *web* tree, and the client always renders the *desktop* tree — guaranteed mismatch on every single load, not just refresh.

**Fix — correct the boolean's source, not the 40 call sites that read it.** Electron already runs its own dedicated forked Next server, separate from the web deployment (`electron/main.js`, `fork(serverPath, [], { env: {...} })`). That fork can be told at process birth that it's the desktop server:

```js
// electron/main.js, in the fork() call's env object:
nextServer = fork(serverPath, [], {
  cwd: isPackaged ? standalonePath : appPath,
  env: {
    ...process.env,
    ...envVars,
    PORT: port.toString(),
    HOSTNAME: '127.0.0.1',
    NODE_ENV: 'production',
    ELECTRON_RUN_AS_NODE: '1',
    FLOWR_DESKTOP: '1', // new — tells the SSR server it's serving the desktop client
  },
  stdio: 'pipe'
});
```

```ts
// src/lib/env.ts
export function isDesktop(): boolean {
  if (typeof window === 'undefined') {
    // Server-side: true only for the dedicated Electron-forked Next server.
    return process.env.FLOWR_DESKTOP === '1';
  }
  return !!(window as any).__FLOWR_DESKTOP__;
}
```

Now the Electron SSR server renders `true` (matching the Electron client's eventual `true`), and the web server still renders `false` (matching the web client). No cookie, no "one refresh behind" — correct from the very first request, because the value comes from the process's own identity, not a prior client render.

**Required companion fix — one unguarded module-level `window` access.** Audited all `isDesktop()` call sites for ones that execute outside a render/effect scope (i.e., would newly execute during SSR once `isDesktop()` can be `true` server-side). Found exactly one: `src/data/store.ts:3733`:

```ts
if (isDesktop()) {
  useStore.subscribe((state, prevState) => {
    // ...
    (window as any).flowrDB?.upsertEntity(entityToSQLiteRow(entityWithContent));
    // ...two more unguarded `window` references below (upsertTask, upsertSpace)
  });
}
```

This subscriber mirrors store writes to the Electron `window.flowrDB` bridge — it must only ever run in the browser, regardless of what the server believes about desktop-ness. With the fix above, `isDesktop()` now returns `true` on the Electron SSR server, so this block would newly execute at module-load time server-side and crash on the first unguarded `window` reference (`ReferenceError: window is not defined`). Fix by gating registration on `typeof window !== 'undefined'` in addition to `isDesktop()`, so it's explicitly browser-only regardless of the platform flag's source:

```ts
if (typeof window !== 'undefined' && isDesktop()) {
  useStore.subscribe((state, prevState) => {
    // ...unchanged...
  });
}
```

All other `isDesktop()` call sites checked: `partialize` (`store.ts:3654`) only executes inside `persist`'s `setItem`, which is never invoked server-side (no localStorage in Node) — safe regardless of the boolean's value. No other module-level (non-render, non-effect, non-handler) call sites exist in the codebase (verified: only one top-level `if (isDesktop())` block exists).

## Explicitly out of scope (flagged, not folded in)

- **Note-content caching / silent per-block sync** ("if we can somehow cache notes so they are not even loading... only newly added note block silently loads") — this is a real, separate, larger feature: it's the note-content equivalent of Scope 2's delta sync, requiring per-block change tracking. Worth a dedicated future spec; not part of this pass.
- **Sidebar grouping flash** and **task reorder flash** — per the previous spec's root-cause D analysis (still valid): both are synchronous derived computations with no network dependency, so once root cause A stops an extra empty-state render from happening, there's no intermediate frame to visibly resort in. No separate fix expected to be needed; verify manually after A ships.

## Testing strategy

No new pure-logic surface (this is render-routing and JSX; project vitest is `environment: node`, no React renderer, consistent with every prior spec in this series). Verification is manual, in the running app:

- Refresh while on Kanban — confirm Kanban's own shell + KanbanColumn's card-shaped skeletons show, not Dashboard.
- Refresh on an active chat with history — confirm `ChatMainSkeleton` shows briefly, positioned as message placeholders, then real messages.
- Refresh on a new/temporary chat — confirm **no** message skeleton; the empty-state ("Write like nobody's listening") UI renders immediately.
- Refresh on a note — confirm the note's own skeleton (title + block placeholders) shows, not a blank page, not Dashboard.
- Confirm system chrome (sidebar frame, tab bar, header) never flashes/shifts/resizes during any of the above.
- **Desktop-specific (root cause D):** refresh the Electron app — confirm floating containers (sidebar card, main content card, AI panel card) and desktop `HeaderBar` position are present from the very first paint, with no web-layout flash beforehand. Confirm the Electron app still boots correctly with no server crash (verifies the `store.ts:3733` guard fix) — check `flowr-server-stderr.log` (referenced in `electron/main.js`) for a clean boot with no `ReferenceError`.
- Confirm web refresh is unaffected by the `isDesktop()` change (still resolves `false` server-side, since `FLOWR_DESKTOP` is only set in the Electron fork's env, not the web deployment).
