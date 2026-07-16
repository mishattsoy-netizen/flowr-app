# Per-Page Content Loading — Design

**Date:** 2026-07-16
**Status:** Approved (pending spec review)
**Supersedes:** `2026-07-16-unified-readiness-gate-design.md` (Parts B/C — neutral shell / single gate — rejected by user; Part A is correct and carried forward here as Part A).

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

## Explicitly out of scope (flagged, not folded in)

- **Note-content caching / silent per-block sync** ("if we can somehow cache notes so they are not even loading... only newly added note block silently loads") — this is a real, separate, larger feature: it's the note-content equivalent of Scope 2's delta sync, requiring per-block change tracking. Worth a dedicated future spec; not part of this pass.
- **Desktop `isDesktopEnv` platform flash** (header briefly shows web chrome on Electron) — a different axis (Electron-only rendering), independent of per-page content skeletons. Known, tracked, deliberately not bundled here — the previous spec's attempt to fold this in is what caused the scope to balloon. Revisit separately if it's still bothersome after this ships.
- **Sidebar grouping flash** and **task reorder flash** — per the previous spec's root-cause D analysis (still valid): both are synchronous derived computations with no network dependency, so once root cause A stops an extra empty-state render from happening, there's no intermediate frame to visibly resort in. No separate fix expected to be needed; verify manually after A ships.

## Testing strategy

No new pure-logic surface (this is render-routing and JSX; project vitest is `environment: node`, no React renderer, consistent with every prior spec in this series). Verification is manual, in the running app:

- Refresh while on Kanban — confirm Kanban's own shell + KanbanColumn's card-shaped skeletons show, not Dashboard.
- Refresh on an active chat with history — confirm `ChatMainSkeleton` shows briefly, positioned as message placeholders, then real messages.
- Refresh on a new/temporary chat — confirm **no** message skeleton; the empty-state ("Write like nobody's listening") UI renders immediately.
- Refresh on a note — confirm the note's own skeleton (title + block placeholders) shows, not a blank page, not Dashboard.
- Confirm system chrome (sidebar frame, tab bar, header) never flashes/shifts/resizes during any of the above.
