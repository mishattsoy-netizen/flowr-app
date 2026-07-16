# Unified Readiness Gate — Design

**Date:** 2026-07-16
**Status:** SUPERSEDED by `2026-07-16-per-page-loading-design.md` — the neutral shell / single gate (Parts B/C below) was rejected by the user in favor of per-page content-region skeletons matching Dashboard's existing pattern. Part A (routing fix) was correct and is carried forward unchanged in the successor spec.
**Supersedes:** `2026-07-15-zero-flash-shell-ssr-design.md` (Scope 4 — abandoned; see "Why this replaces Scope 4" below)

## Problem

After Scope 1 (instant cached render) shipped, refresh is faster but **inconsistent** — confirmed against real screenshots:

1. **Desktop shows the web layout for a split second.** Header height, window controls, and chrome briefly render in the web shape before snapping to the desktop shape.
2. **Sidebar renders as one flat unsorted chunk**, then snaps into its grouped Workspace/Unsorted sections.
3. **Wrong skeleton per page.** Refreshing on Tasks or Chat briefly shows the *Dashboard* skeleton. A temporary/new chat briefly shows the generic "active chat" skeleton instead of its own empty-state UI.
4. **Tasks visibly reorder** in front of the user on every refresh.

The user's core ask: not zero-flash (confirmed against Notion's own soft-refresh behavior — even Notion flashes skeletons and reorders on refresh), but **consistency** — one predictable loading treatment instead of every component independently deciding when it's "ready" and briefly rendering something wrong.

## Root causes (verified against current code)

**A. Route-on-first-paint is wrong, not just slow.** `WorkspaceRouter.tsx:12` reads `activeEntityId` via `useStore(state => state.activeEntityId)`. Zustand's `persist` middleware has no `skipHydration` configured, so **every render before hydration completes — server AND the client's first paint — returns the store's initializer default**, which is the literal string `'dashboard'` (`store.ts:271`), not `null`/`undefined`. Line 30's fallback chain `activeEntityId ?? initialEntityId ?? 'dashboard'` therefore **always short-circuits to `'dashboard'`** — the `initialEntityId` cookie (meant to fix exactly this) is dead code; it's never reached because `activeEntityId` is always truthy before hydration. This is the real cause of symptom 3: the app doesn't just show a generic loading state on Tasks/Chat, it genuinely routes to Dashboard first and reroutes after hydration.

**B. Platform shape (`isDesktopEnv`) is unknowable at SSR time.** `isDesktop()` (`src/lib/env.ts`) checks `window.__FLOWR_DESKTOP__`, which doesn't exist during SSR → always `false` server-side. On Electron, the client's real value is `true`. `isDesktopEnv` is woven through `HeaderBar.tsx` far beyond the tab pills — `BAR_H` (header height, 42 vs 50px), window-controls region, padding, tab shape — so the server/first-paint render is unavoidably the *web* shape on a desktop client. This is symptom 1.

**C. No single readiness signal — every component decides independently.** `useAppReady()` gates `EntityPageRenderer`/`Shell`, but `HeaderBar`'s tabs and `Sidebar`'s skeleton each have their own hydration checks (`Sidebar.tsx` has an independent `persist.hasHydrated()` check, separate from `useAppReady`). Because these gates aren't the same signal, they can flip at slightly different times, producing the observed "some things load faster than others" — e.g. sidebar skeleton clearing before the page content is actually routed correctly.

**D. Sort/grouping is a synchronous derived computation, not a separate load step** (verified: `Sidebar.tsx`/`TrackerPage.tsx` sort inline via `.sort(...)` on `entities`/`tasks` from the store — no network dependency). Symptom 4 isn't the data re-sorting after arriving; it's that the list currently gets rendered once on empty/default state and again after hydration, and each render triggers a fresh (synchronous) sort — visible as a snap. Fixing the render-timing (root cause C) removes the intermediate render, and the reorder flash disappears as a side effect — no separate fix needed.

## Why this replaces Scope 4 (zero-flash tab SSR)

Scope 4 investigated cookie-feeding real tab data to the server so tabs render correctly with zero flash. That investigation surfaced root cause B — `isDesktopEnv` is woven through the entire header, not just tabs — meaning true zero-flash would require threading platform state through dozens of conditionals across the whole component, a large, fragile, high-risk refactor for one component's flash duration.

Given the user's actual goal is **consistency, not zero-flash** (confirmed: even Notion doesn't achieve zero-flash on soft refresh), this design targets a smaller, more robust bar: **one predictable, minimal, correctly-shaped placeholder shown for the brief hydration window, everywhere, then the real UI all at once.** This fixes symptoms 1–4 without SSR-ing any client-only data.

## Design

### Part A — Fix the route (root cause A)

`WorkspaceRouter.tsx` must not treat the store's un-hydrated default (`'dashboard'`) as a real route. Gate the route resolution on hydration explicitly, using the same `storeHydrated` signal `useAppReady` already exposes:

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
  // what causes Tasks/Chat to flash a Dashboard route on every refresh. Route
  // from the server-provided cookie (the user's actual last page) until the
  // real persisted value is available.
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

This makes the existing `flowr-initial-entity` cookie (already written in `layout.tsx`, already passed as a prop, previously dead code) actually take effect: server and first client paint both route to the user's real last page.

### Part B — Neutral platform-agnostic shell for the hydration window (root cause B)

Do **not** attempt to SSR the real desktop/web chrome (that's the abandoned Scope 4 path). Instead, `HeaderBar` renders a single neutral shell — fixed dimensions, no platform-specific chrome — for both server and first client paint, and swaps to the real (platform-correct) header only after `storeHydrated`.

Critically, per the identified risk: **the neutral shell must reserve the final layout's geometry** so the swap is a content change, not a size change (no reflow bounce). Use the desktop height (`50px`, the larger of the two) and reserve the window-controls gutter width unconditionally in the neutral shell, so whichever platform is real, nothing shifts when the swap happens.

```tsx
// In HeaderBar.tsx, near the top of the render, before any isDesktopEnv-
// dependent JSX:
const { storeHydrated } = useAppReady();

if (!storeHydrated) {
  return (
    <div
      className="w-full flex items-end border-b border-[var(--bone-10)]"
      style={{ height: 50 }} // reserves the larger (desktop) height so no reflow on swap
    >
      {/* Minimal empty chrome only — no shimmer, no fake tab boxes. This is
          deliberately NOT the full-app skeleton the user removed earlier;
          it is structural space only, shown for one hydration-length frame. */}
    </div>
  );
}

// ...existing isDesktopEnv-dependent render below, unchanged...
```

This is a single early-return, not a threaded platform cookie — small, low-risk, and fully sidesteps root cause B without the large refactor Scope 4 required.

### Part C — One shared readiness signal (root cause C)

Audit every component with its own hydration/skeleton gate and point it at the same signal: `useAppReady().storeHydrated`. Known independent gates to consolidate:

- `Sidebar.tsx` — currently has its own `useStore.persist.hasHydrated()` check independent of `useAppReady`. Replace with `useAppReady().storeHydrated` so it flips in lockstep with everything else.
- `HeaderBar.tsx` — already uses `useAppReady()` for the tab skeleton (`hasHydrated` at line ~240); Part B's neutral-shell gate uses the same signal, so the whole header flips atomically.
- `EntityPageRenderer.tsx` / `Shell.tsx` — already on `useAppReady()`; no change needed.

The result: there is exactly one moment, app-wide, when the UI goes from "neutral placeholder" to "real content" — not several components independently flipping at slightly different times.

### Part D — Verify the reorder flash is subsumed (root cause D)

No code change beyond Parts A–C. Once route (A) is correct and every component's content only renders after the single gate (C) opens, there is no intermediate render on empty/default `tasks`/`entities` — so there is nothing to visibly re-sort. Verify manually after A–C ship: refresh Tasks page repeatedly, confirm no visible reorder.

## What this explicitly does NOT do

- Does not SSR any client-only or platform-specific data (no cookie-threading of tabs, platform, or entity data beyond the existing `flowr-initial-entity` cookie).
- Does not attempt zero-flash. A single, brief, correctly-shaped neutral frame is expected and accepted, on both web and desktop, on every refresh — by design, matching the user's stated goal of consistency over zero-flash.
- Does not touch Scope 2 (delta sync) or Scope 3 (settings merge) — those remain as shipped.
- Does not rebuild a full-app skeleton. The neutral shell in Part B is structural space only (no shimmer, no fake rows, no fake content) — the distinction that keeps this from becoming what the user already rejected once.

## Testing strategy

No new pure-logic surface worth unit testing beyond what Scopes 1–3 already cover (this is render-timing/JSX, and the project's vitest is `environment: node` with no React renderer — consistent with prior specs in this series). Verification is manual, in the running app, both platforms:

- Refresh while on Tasks, Chat (both new/temp and an existing thread), a note, and a folder — confirm each shows only its own neutral shell (or nothing incorrect), never another page's skeleton, and lands back on the same page.
- Refresh on Electron — confirm no web-chrome flash; header dimensions do not visibly shift during the swap.
- Refresh with a large sidebar tree — confirm no flat-unsorted-chunk flash before grouping appears.
- Refresh on Tasks with many tasks — confirm no visible reorder snap.
