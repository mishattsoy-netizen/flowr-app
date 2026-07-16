# Per-Page Loading Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 problems found while verifying the first per-page-loading plan (`docs/superpowers/plans/2026-07-16-per-page-loading.md`), plus correct one bug that plan's own Task 2 introduced (it does not do what it claims — see Task-1-Correction below) and revert a since-added commit that reintroduced a bug Round 1's Task 3 had fixed.

**Architecture:** All 7 findings trace to three root-cause themes, not seven unrelated bugs:
- **Theme A — stale/wrong route identity during the hydration window.** The `flowr-initial-entity` cookie is written only once, on full page load — never on in-app (client-side) navigation. After you switch pages without reloading, the cookie is stale, so the *next* refresh briefly resolves the wrong page. Several components each independently read the store's un-hydrated default (`activeEntityId: 'dashboard'`) instead of a hydration-safe resolved value, so they show wrong/default state during the loading window even when a cookie exists.
- **Theme B — entity-backed views show an empty-state instead of a skeleton during hydration.** `EntityPageRenderer`'s `!entity` branch fires whenever the store hasn't hydrated yet (not just when an entity is genuinely missing), and unconditionally shows "Select an item from the sidebar" — never giving Note/Canvas/Folder/Workspace pages a chance to render their own (already-built) loading skeletons. The same gap, with no fallback content at all, exists in split-view columns.
- **Theme C — chat's hydration-window layout is coupled to `isLoading` in a way that has already caused one regression-and-counter-regression cycle.** Round 1's Task 3 fix and a later hotfix commit (`53be2cc`) each solved one half of the chat problem while re-breaking the other half. This plan fixes the actual distinguishing signal (`storeHydrated`, not `activeChatId`) so both halves are correct simultaneously.

**Tech Stack:** Next.js (App Router) + React, Zustand (`persist` middleware), Vitest (`environment: node`, no React renderer).

**Reference:** This plan is self-contained; no separate design-spec document was written for round 2 given the fast turnaround requested. Reference the Round 1 plan (`docs/superpowers/plans/2026-07-16-per-page-loading.md`) for shared background on `useAppReady`, `storeHydrated`, and the hydration-window concept if anything here is unclear.

**IMPORTANT — read before touching anything:**

- This repo has unrelated work in progress. **Never run `git add -A` or `git add .`.** Every commit step lists exact files to stage.
- Before every commit, run `git status` and confirm only the files that task's step lists are staged.
- If any "before" code block does not match the file exactly, STOP and report the mismatch instead of guessing.
- Do not fix anything not explicitly instructed, even if it looks wrong. Report it instead.
- **Task order matters.** Do the tasks in the order given — later tasks depend on earlier ones (e.g. Task 4 depends on the subscriber added in Task 1).

---

## File Structure

- Modify: `src/data/store.ts` — add a subscriber that re-writes the initial-entity cookie/attribute whenever the real route (or split-view columns) changes, so it's never stale after in-app navigation (Theme A root fix).
- Modify: `src/components/layout/HeaderBar.tsx` — accept a resolved-entity-id prop for the tab-pill highlight and title, instead of reading the store's possibly-un-hydrated value directly (Theme A).
- Modify: `src/components/layout/Shell.tsx` — compute the same hydration-safe resolved entity id `WorkspaceRouter` already computes, and pass it into both `HeaderBar` call sites (Theme A).
- Modify: `src/components/EntityPageRenderer.tsx` — distinguish "not hydrated yet" from "entity genuinely missing," and render a skeleton (not an empty-state message) in the former case (Theme B; also the correct fix for Round 1's non-functional Task 2).
- Modify: `src/components/layout/SplitViewLayout.tsx` — same hydration-vs-missing distinction for both columns (Theme B).
- Modify: `src/components/chat/ChatConversation.tsx` — replace the `isTempChat || !activeChatId` signal (ambiguous pre-hydration) with a `storeHydrated`-aware one that is correct for both active and new/temp chats simultaneously (Theme C).
- Modify: `src/components/chat/ChatPage.tsx` — stop letting `isLoading` alone force `showBottomBar` true regardless of chat type, using the same corrected signal (Theme C).
- No new test infrastructure needed beyond what exists; this round is render-logic/JSX like Round 1, verified manually (project vitest is `environment: node`, no React renderer).

---

## Theme A — Fix stale route identity

### Task 1: Keep the initial-entity cookie fresh across in-app navigation

**Files:**
- Modify: `src/data/store.ts`

**Background:** `src/app/layout.tsx` contains an inline `<head>` script that runs once per full page load. It reads `activeEntityId` from localStorage and writes it to a cookie (`flowr-initial-entity`) and a DOM attribute (`data-initial-entity`) — this is what lets the server render the right page on the very next load. The problem: this script does NOT run again when you navigate between pages inside the app (client-side route changes don't reload the page, so the script never re-fires). So if you're on Page A, the cookie says A. You navigate to Page B without reloading — the cookie still says A. Now you refresh: the server and the pre-hydration client both trust the stale cookie and briefly show Page A before switching to the real Page B once the store hydrates. This is finding #1 ("skeleton from previous page on first refresh after switching").

The fix: add a Zustand subscriber that re-writes the cookie and DOM attribute every time `activeEntityId` (or the split-view column ids) actually changes, so they're never more than one state-change stale — which in practice means always correct except mid-navigation.

- [ ] **Step 1: Locate the insertion point**

Run: `grep -n "^if (typeof window !== 'undefined' && isDesktop())" src/data/store.ts`

You should get exactly one match (this is the SQLite-mirror subscriber from Round 1's Task 6). Find the line number where that `if` block's matching closing brace is — the very first module-level statement AFTER that entire block (look for the next top-level `if (` or the end of that subscriber's closing `});`).

If you cannot find this block, or the file's structure looks substantially different from this description, STOP and report what you find instead of guessing where to insert.

- [ ] **Step 2: Add the new subscriber**

Immediately after that block (still at module level, not inside any function), add:

```ts
// Keep the initial-entity cookie/attribute fresh across in-app navigation.
// The <head> script in layout.tsx only writes these once, on full page load —
// never on client-side route changes. Without this subscriber, navigating
// between pages without reloading leaves the cookie pointing at the PREVIOUS
// page, so the next refresh briefly shows the wrong page during the
// pre-hydration window (before the real activeEntityId loads from storage).
if (typeof window !== 'undefined') {
  let lastWrittenRouteKey: string | null = null;
  useStore.subscribe((state) => {
    const routeKey = JSON.stringify({
      activeEntityId: state.activeEntityId,
      splitViewActive: state.splitViewActive,
      splitViewLeftId: state.splitViewLeftId,
      splitViewRightId: state.splitViewRightId,
    });
    if (routeKey === lastWrittenRouteKey) return;
    lastWrittenRouteKey = routeKey;

    if (state.activeEntityId) {
      try {
        document.documentElement.setAttribute('data-initial-entity', state.activeEntityId);
        document.cookie = "flowr-initial-entity=" + state.activeEntityId + "; path=/; max-age=31536000; SameSite=Lax";
      } catch (e) { /* localStorage/cookie access can fail in some embedded contexts — non-fatal */ }
    }
  });
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `store.ts`.

- [ ] **Step 4: Manual verification (do this now, not at the end — Theme A's remaining tasks depend on this working)**

Run `npm run dev`, open the app, navigate to a page other than Dashboard (e.g. a note) WITHOUT refreshing. Open browser devtools → Application/Storage tab → Cookies, find `flowr-initial-entity`. Confirm its value updated to match the note's entity id (not still `dashboard` or a previous page's id).

- [ ] **Step 5: Commit**

```bash
git status
```
Confirm only `src/data/store.ts` is staged.

```bash
git add src/data/store.ts
git commit -m "fix(refresh): keep initial-entity cookie fresh across in-app navigation

Previously only written once on full page load, so it went stale
after any client-side route change — causing the next refresh to
briefly show whichever page was open BEFORE the last navigation."
```

---

### Task 2: Fix the sidebar's Home/Dashboard tab-pill showing selected during every load

**Files:**
- Modify: `src/components/layout/Shell.tsx`
- Modify: `src/components/layout/HeaderBar.tsx`

**Background:** `HeaderBar.tsx` reads `activeEntityId` directly from the store (`const activeEntityId = useStore(s => s.activeEntityId);`) to decide which nav tab is highlighted (`const isDashboard = activeEntityId === 'dashboard' || !activeEntityId;`) and what title to show. Before hydration, the store's `activeEntityId` is always the default value `'dashboard'` — so the Home tab always shows as selected during the loading window, regardless of which page you're actually loading. This is finding #6. `WorkspaceRouter.tsx` already solved this exact problem for page routing (Round 1 Task 1); this task applies the same fix to `HeaderBar`'s tab highlight.

- [ ] **Step 1: Confirm current state in Shell.tsx**

Run: `grep -n "const activeEntityId = useStore\|<HeaderBar" src/components/layout/Shell.tsx`

Expected output includes a line near the top like `const activeEntityId = useStore(state => state.activeEntityId);` and two lines containing `<HeaderBar` (one with `leftWidth={leftWidth} rightWidth={rightWidth}`, one bare `<HeaderBar />`). If the shape is substantially different, STOP and report.

- [ ] **Step 2: Add a hydration-safe resolved id in Shell.tsx**

Find this line in `src/components/layout/Shell.tsx` (near the top of the component body):

```tsx
  const activeEntityId = useStore(state => state.activeEntityId);
```

Directly after it, add:

```tsx
  // Same hydration-safe resolution WorkspaceRouter uses (Round 1 Task 1) —
  // before hydration, activeEntityId is the store's un-hydrated default
  // ('dashboard'), not the real page, so HeaderBar's tab highlight needs this
  // too or it shows Home selected during every load regardless of real page.
  // NOTE: destructured as `shellStoreHydrated`, not `storeHydrated` — this
  // file already has an unrelated, unused local `const [storeHydrated, ...]
  // = useState(false)` a few lines below (harmless dead code, not part of
  // this task, do not touch it) and reusing the name would shadow/collide.
  const { storeHydrated: shellStoreHydrated } = useAppReady();
```

You will need to confirm `useAppReady` is already imported in this file. Run: `grep -n "useAppReady" src/components/layout/Shell.tsx`
- If you see an import line already, do nothing further for the import.
- If there is no import, add `import { useAppReady } from '@/hooks/useAppReady';` near the other imports at the top of the file.

Next, find where `initialEntityId` (a prop this component already receives) is destructured from Shell's props — run `grep -n "initialEntityId" src/components/layout/Shell.tsx` to find it. Confirm it is already a prop on the `Shell` component (it should be, since `src/app/app/page.tsx` already passes `<Shell initialEntityId={initialEntityId}>`).

Now find both `<HeaderBar` usages and add the new prop to each:

```tsx
          <HeaderBar leftWidth={leftWidth} rightWidth={rightWidth} resolvedEntityId={shellStoreHydrated ? (activeEntityId ?? 'dashboard') : (initialEntityId ?? 'dashboard')} />
```

and

```tsx
                  {!isDesktop() && <HeaderBar resolvedEntityId={shellStoreHydrated ? (activeEntityId ?? 'dashboard') : (initialEntityId ?? 'dashboard')} />}
```

(Only add the new `resolvedEntityId={...}` prop to each — do not change anything else on these two lines.)

- [ ] **Step 3: Accept and use the prop in HeaderBar.tsx**

Run: `grep -n "const activeEntityId = useStore(s => s.activeEntityId);" src/components/layout/HeaderBar.tsx`
Confirm exactly one match, and find the function signature above it (something like `export function HeaderBar({ leftWidth, rightWidth }: { ... }) {`).

Add `resolvedEntityId` to the props type and destructuring. Find the props destructuring line (it will be near the top of the `HeaderBar` function) and add `resolvedEntityId` as an optional string prop alongside the existing props.

Then find these two lines (verify they match exactly first):

```tsx
  const isDashboard = activeEntityId === 'dashboard' || !activeEntityId;
```

and (a few lines later):

```tsx
        {isDashboard ? 'Home' : activeEntityId === 'tracker' ? 'Tasks' : activeEntityId === 'chat' ? 'Chat' :
          stripHtml(entities.find(e => e.id === activeEntityId)?.title || '')}
```

Replace the first with:

```tsx
  // Prefer the hydration-safe resolved id (from Shell) over the raw store
  // value for the tab-highlight/title computation specifically — this is the
  // one place a stale/un-hydrated activeEntityId was visibly wrong during
  // every page load. Other activeEntityId reads in this file (inside click
  // handlers, e.g. around line 403-415) are unaffected — they only run after
  // a user interaction, which can't happen before mount, so they don't need
  // this.
  const effectiveHeaderEntityId = resolvedEntityId ?? activeEntityId;
  const isDashboard = effectiveHeaderEntityId === 'dashboard' || !effectiveHeaderEntityId;
```

Replace the second with:

```tsx
        {isDashboard ? 'Home' : effectiveHeaderEntityId === 'tracker' ? 'Tasks' : effectiveHeaderEntityId === 'chat' ? 'Chat' :
          stripHtml(entities.find(e => e.id === effectiveHeaderEntityId)?.title || '')}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `Shell.tsx` or `HeaderBar.tsx`.

- [ ] **Step 5: Manual verification**

Navigate to a note (not Dashboard) without refreshing, confirm Task 1's cookie fix already updated the cookie for this page (redo Task 1 Step 4's check if unsure). Then refresh. Confirm the Home tab pill does NOT show as selected during the brief loading window — it should either show no tab highlighted, or (once real content loads) highlight nothing since notes aren't a top-level nav tab. Then navigate to Tasks, refresh, confirm the Tasks tab (not Home) is what's highlighted during and after load.

- [ ] **Step 6: Commit**

```bash
git status
```
Confirm only `src/components/layout/Shell.tsx` and `src/components/layout/HeaderBar.tsx` are staged.

```bash
git add src/components/layout/Shell.tsx src/components/layout/HeaderBar.tsx
git commit -m "fix(refresh): HeaderBar tab-pill/title use hydration-safe resolved entity id

Previously read activeEntityId straight from the store, which is
'dashboard' (the un-hydrated default) during every load — Home always
showed as the selected tab regardless of the real page."
```

---

## Theme B — Skeleton, not empty-state, during hydration for entity-backed views

### Task 3 (Correction of Round 1's non-functional Task 2): Show a skeleton, not "Select an item," while the store hydrates

**Files:**
- Modify: `src/components/EntityPageRenderer.tsx`

**Why this task exists — read carefully:** Round 1's Task 2 ("pass isLoading to NotePage") does not fix anything on refresh, and this is a correction, not new work. Here is the proof: `EntityPageRenderer` only renders `NotePage` (or Canvas/Folder/Workspace) when `entity` is truthy, and `entity` is computed as `storeHydrated ? entities.find(...) : undefined`. Before hydration, `storeHydrated` is `false`, so `entity` is ALWAYS `undefined`, which means the `if (!entity)` branch always fires first and returns "Select an item from the sidebar" — `NotePage` never even mounts during the loading window, so the `isLoading` prop Round 1 wired up never has an opportunity to matter. This is finding #3 ("notes don't have any skeleton, just blank page" — the "blank page" is literally that "Select an item" message).

The actual fix: distinguish "we haven't hydrated yet, so we don't know what this entity is" from "we ARE hydrated and this entity genuinely doesn't exist." Only the second case should show "Select an item." The first case should show a generic content skeleton.

- [ ] **Step 1: Confirm current contents**

Open `src/components/EntityPageRenderer.tsx`. Confirm these exact lines are present:

```tsx
  const entity = storeHydrated ? entities.find(e => e.id === entityId) : undefined;
  
  const isLoading = !isReady;
```

and further down:

```tsx
  if (!entity) {
    // Store is hydrated (isLoading is instant now — see useAppReady). A missing
    // entity here genuinely means the id resolves to nothing, so show the empty
    // state rather than guessing a page type and flashing the wrong layout.
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Select an item from the sidebar.
      </div>
    );
  }
```

If either does not match exactly, STOP and report.

- [ ] **Step 2: Add a minimal generic content skeleton component inline**

Above the `EntityPageRenderer` function (after the imports, before the JSDoc comment), add:

```tsx
function EntityLoadingSkeleton() {
  return (
    <div className="flex-1 flex flex-col p-8 gap-4 max-w-3xl mx-auto w-full">
      <div className="h-10 w-1/2 rounded-lg bg-[var(--bone-5)] animate-pulse" />
      <div className="flex flex-col gap-3 mt-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className="h-4 rounded bg-[var(--bone-5)] animate-pulse"
            style={{ width: i % 3 === 0 ? '100%' : i % 3 === 1 ? '80%' : '60%' }}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace the `!entity` branch**

Replace:

```tsx
  if (!entity) {
    // Store is hydrated (isLoading is instant now — see useAppReady). A missing
    // entity here genuinely means the id resolves to nothing, so show the empty
    // state rather than guessing a page type and flashing the wrong layout.
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Select an item from the sidebar.
      </div>
    );
  }
```

with:

```tsx
  if (!entity) {
    if (!storeHydrated) {
      // We don't know what this entity is yet because the store hasn't
      // loaded from storage — show a content skeleton, not the "missing"
      // empty-state message. This is NOT the same case as below.
      return <EntityLoadingSkeleton />;
    }
    // Store IS hydrated and we still can't find this entity — it genuinely
    // doesn't exist (deleted, bad id, etc).
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Select an item from the sidebar.
      </div>
    );
  }
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `EntityPageRenderer.tsx`.

- [ ] **Step 5: Manual verification**

Open a note with visible text content, refresh. Confirm you see a title-bar-shaped skeleton and several skeleton lines briefly (not "Select an item from the sidebar", not a fully blank white/empty area), then the real note content. Repeat for a canvas and a folder if you have one open-able quickly.

- [ ] **Step 6: Commit**

```bash
git status
```
Confirm only `src/components/EntityPageRenderer.tsx` is staged.

```bash
git add src/components/EntityPageRenderer.tsx
git commit -m "fix(refresh): show content skeleton (not empty-state) while store hydrates

Corrects a gap Round 1's Task 2 didn't actually close: EntityPageRenderer's
!entity branch fires during EVERY hydration window (not just for genuinely
missing entities), so NotePage/CanvasPage/etc never got a chance to mount
with isLoading=true. Now distinguishes 'not hydrated yet' from 'genuinely
missing' and only shows the empty-state message for the latter."
```

---

### Task 4: Fix both split-view columns going empty on refresh

**Files:**
- Modify: `src/components/layout/SplitViewLayout.tsx`

**Background:** `SplitViewLayout` reads `splitViewLeftId`/`splitViewRightId` directly from the store with no hydration-awareness at all — unlike `WorkspaceRouter`, which Round 1 fixed. Before hydration, both are `null` (the store's default), so both columns render `ColumnPlaceholder` (an "open something" empty state) instead of any content or skeleton. This is finding #2.

There is no cookie carrying split-view state today (Task 1's new subscriber, once you've done it, DOES now keep the cookie's `data-initial-entity`/`flowr-initial-entity` fresh for the single-column case, but split columns need their own signal since there are two of them plus an active flag). The simplest correct fix here: while not hydrated, show a skeleton instead of the "open something" placeholder — this matches the Theme B pattern from Task 3 and doesn't require inventing new cookie plumbing for split view specifically.

- [ ] **Step 1: Confirm current contents**

Run: `grep -n "storeHydrated\|useAppReady\|splitViewLeftId ?\|splitViewRightId ?" src/components/layout/SplitViewLayout.tsx`

Expected: no matches for `storeHydrated` or `useAppReady` (this file currently has no hydration-awareness at all), and matches for `splitViewLeftId ? (` and `splitViewRightId ? (` (the two column conditionals). If `useAppReady`/`storeHydrated` already appear in this file, STOP and report — the file has changed since this plan was written and the instructions below may not apply cleanly.

- [ ] **Step 2: Import useAppReady**

Find the import block at the top of `src/components/layout/SplitViewLayout.tsx`. Add:

```tsx
import { useAppReady } from '@/hooks/useAppReady';
```

- [ ] **Step 3: Read storeHydrated in the component**

Find where `splitViewLeftId` and `splitViewRightId` are read from the store (near the top of the component function):

```tsx
  const splitViewLeftId = useStore(s => s.splitViewLeftId);
  const splitViewRightId = useStore(s => s.splitViewRightId);
```

Directly after these two lines, add:

```tsx
  const { storeHydrated } = useAppReady();
```

- [ ] **Step 4: Replace both column conditionals**

Find this block (left column):

```tsx
        {splitViewLeftId ? (
          <OverlayScrollbar className="flex-1 min-h-0" thumbOffsetRight={0} thumbRightClass="right-0">
            <EntityPageRenderer entityId={splitViewLeftId} />
          </OverlayScrollbar>
        ) : (
          <ColumnPlaceholder
            column="left"
            onOpenEntity={(entityId) => setColumnEntity('left', entityId)}
          />
        )}
```

Replace with:

```tsx
        {!storeHydrated ? (
          <div className="flex-1 min-h-0 p-6 flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-4 rounded bg-[var(--bone-5)] animate-pulse"
                style={{ width: i === 1 ? '60%' : i === 2 ? '90%' : '75%' }}
              />
            ))}
          </div>
        ) : splitViewLeftId ? (
          <OverlayScrollbar className="flex-1 min-h-0" thumbOffsetRight={0} thumbRightClass="right-0">
            <EntityPageRenderer entityId={splitViewLeftId} />
          </OverlayScrollbar>
        ) : (
          <ColumnPlaceholder
            column="left"
            onOpenEntity={(entityId) => setColumnEntity('left', entityId)}
          />
        )}
```

Find the equivalent right-column block (same shape, `splitViewRightId` / `column="right"`) and apply the identical change (same skeleton JSX, same `!storeHydrated ? ... : splitViewRightId ? ... : ...` structure).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `SplitViewLayout.tsx`.

- [ ] **Step 6: Manual verification**

Open split view with two different pages/notes in each column, refresh. Confirm both columns show a brief skeleton (not the "open something" empty-state placeholder) before their real content reappears.

- [ ] **Step 7: Commit**

```bash
git status
```
Confirm only `src/components/layout/SplitViewLayout.tsx` is staged.

```bash
git add src/components/layout/SplitViewLayout.tsx
git commit -m "fix(refresh): split-view columns show skeleton instead of empty on refresh

splitViewLeftId/RightId are null (store default) before hydration —
both columns were rendering the 'open something' empty-state
placeholder instead of any loading indication."
```

---

## Theme C — Chat hydration-window layout (fix both halves correctly, together)

### Task 5: Fix chat's skeleton/layout signal for both active AND new/temp chats

**Files:**
- Modify: `src/components/chat/ChatConversation.tsx`
- Modify: `src/components/chat/ChatPage.tsx`

**Background — read this whole section before editing, the history here matters:**

Round 1's Task 3 changed `ChatConversation`'s skeleton logic to:
```
hasNothingToLoad = isTempChat || !activeChatId
isMinLoading = !hasNothingToLoad && (isLoading || isChatMessagesLoading)
```
Intent: don't show a message skeleton for a new/temp chat (nothing to fetch). But this broke ACTIVE chats too — because `activeChatId` is ALSO `null` before hydration (it's not yet loaded from storage), so `hasNothingToLoad` was `true` for every chat during the loading window, active or not. This produced finding #4's "active chat shows no skeleton, just a broken partial layout" for active chats (documented in commit `53be2cc`'s message).

A later commit (`53be2cc`) tried to fix that by making the skeleton unconditional on `isLoading`:
```
isMinLoading = isLoading || (!hasNothingToLoad && isChatMessagesLoading)
```
This fixed active chats but re-broke new/temp chats — now EVERY chat shows the message skeleton during the loading window, including ones that never had any messages, which is finding #4 as you're currently seeing it ("new/temp chats show active chat skeleton").

**The actual fix:** the real distinguishing question isn't "is `activeChatId` null" (ambiguous — could mean either "genuinely no chat" or "haven't hydrated yet"). It's "are we hydrated AND is there no active chat." Only then do we know for certain it's a new/temp chat with nothing to load.

- [ ] **Step 1: Confirm current contents of ChatConversation.tsx**

Run: `grep -n "hasNothingToLoad\|isMinLoading\|isTempChat = useStore\|activeChatId = useStore" src/components/chat/ChatConversation.tsx`

You should see something matching:
```
  const activeChatId = useStore(s => s.activeChatId);
  const isTempChat = useStore(s => s.isTempChat);
  const hasNothingToLoad = isTempChat || !activeChatId;
  const isMinLoading = !!isLoading || (!hasNothingToLoad && isChatMessagesLoading);
```
(exact variable order/spacing may differ slightly — if the LOGIC doesn't match this shape at all, STOP and report what you find.)

- [ ] **Step 2: Import useAppReady**

Add near the top of `src/components/chat/ChatConversation.tsx`:

```tsx
import { useAppReady } from '@/hooks/useAppReady';
```

- [ ] **Step 3: Replace the loading-signal computation**

Replace:

```tsx
  const activeChatId = useStore(s => s.activeChatId);
  const isTempChat = useStore(s => s.isTempChat);
  const hasNothingToLoad = isTempChat || !activeChatId;
  const isMinLoading = !!isLoading || (!hasNothingToLoad && isChatMessagesLoading);
```

with:

```tsx
  const activeChatId = useStore(s => s.activeChatId);
  const isTempChat = useStore(s => s.isTempChat);
  const { storeHydrated } = useAppReady();

  // The distinguishing question is NOT "is activeChatId null" — that's true
  // both for a genuine new/temp chat AND for every chat before the store has
  // hydrated (it just hasn't loaded yet). Only trust "no active chat" once we
  // know we're actually hydrated; before that, we don't know what kind of
  // chat this is, so treat it as "might have messages" (show skeleton) to
  // avoid a broken partial layout for active chats. After hydration, a
  // genuinely temp/new chat correctly shows no skeleton at all.
  const hasNothingToLoad = storeHydrated && (isTempChat || !activeChatId);
  const isMinLoading = !hasNothingToLoad && (!!isLoading || isChatMessagesLoading);
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `ChatConversation.tsx`.

- [ ] **Step 5: Fix ChatPage.tsx's showBottomBar the same way**

**Background:** `ChatPage.tsx`'s `showBottomBar` includes `isLoading` unconditionally in its OR-chain, which forces the input bar into its "has messages" layout during the ENTIRE hydration window even for a chat that will turn out to have zero messages — causing a visible scale/position snap once `isLoading` flips false and `showBottomBar` recalculates to `false`. This is finding #7's "message bar scaling."

Open `src/components/chat/ChatPage.tsx`. Confirm this exact line:

```tsx
  const showBottomBar = displayMessages.length > 0 || isAILoading || isChatMessagesLoading || isLoading;
```

Add the same hydration-aware distinction. First, confirm `useAppReady` is not already imported (run `grep -n "useAppReady" src/components/chat/ChatPage.tsx`); if not present, add `import { useAppReady } from '@/hooks/useAppReady';` near the top with the other imports.

Then find where `isTempChat` is read (should already exist: `const isTempChat = useStore(s => s.isTempChat);`) and directly after it add:

```tsx
  const { storeHydrated: chatPageStoreHydrated } = useAppReady();
```

Then replace:

```tsx
  const showBottomBar = displayMessages.length > 0 || isAILoading || isChatMessagesLoading || isLoading;
```

with:

```tsx
  // Same distinction as ChatConversation: before hydration we don't yet know
  // if this will turn out to be an empty/new chat or one with real history,
  // so default to the "has content" layout (showBottomBar=true) to avoid a
  // broken partial layout — UNLESS we're hydrated and it's genuinely a
  // temp/new chat with definitely-zero messages, matching ChatConversation's
  // hasNothingToLoad logic so both components agree during the same window.
  const chatKnownEmpty = chatPageStoreHydrated && isTempChat && displayMessages.length === 0;
  const showBottomBar = !chatKnownEmpty && (displayMessages.length > 0 || isAILoading || isChatMessagesLoading || isLoading);
```

- [ ] **Step 6: Type-check again**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `ChatPage.tsx`.

- [ ] **Step 7: Manual verification — this must cover BOTH cases, not just one**

Case 1 — active chat with real history: open it, refresh. Confirm the message skeleton (`ChatMainSkeleton`) appears briefly, positioned as message placeholders (not a broken/partial layout with bottom bar but no title/messages), then real messages load in.

Case 2 — new/temp chat with zero messages: open it, refresh. Confirm NO message skeleton appears — the empty-state greeting UI should show immediately, with no visible scale/position jump in the input bar.

Both cases must work. If either one regresses while you're fixing the other, STOP and report — do not commit a fix that only solves one case (this exact mistake has already happened twice in this codebase's history for this file).

- [ ] **Step 8: Commit**

```bash
git status
```
Confirm only `src/components/chat/ChatConversation.tsx` and `src/components/chat/ChatPage.tsx` are staged.

```bash
git add src/components/chat/ChatConversation.tsx src/components/chat/ChatPage.tsx
git commit -m "fix(refresh): chat skeleton/layout correct for BOTH active and new/temp chats

Previous fix (Round 1 Task 3) broke active chats by treating
activeChatId===null as 'nothing to load' even when it just meant
'not hydrated yet'. A later hotfix (53be2cc) fixed active chats by
making the skeleton unconditional, which re-broke new/temp chats.
This fixes the actual distinguishing signal: only treat a chat as
'genuinely empty' once storeHydrated is true AND it's temp/has no id
— never based on activeChatId alone, which is ambiguous pre-hydration.

Also fixes ChatPage's showBottomBar (message bar scale/token-counter-
hide, finding #7), which had the identical bug: isLoading alone forced
the 'has content' layout during hydration regardless of chat type."
```

---

## Final verification

### Task 6: Full regression run and manual verification of all 7 findings

- [ ] **Step 1: Run the entire automated test suite**

Run: `npm test`
Expected: all tests pass, 0 failed. Report the total count.

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: clean (no output). Report any pre-existing unrelated errors without fixing them.

- [ ] **Step 3: Re-verify each of the 7 original findings, one at a time, in the running web app (`npm run dev`)**

For each, refresh several times and report what you observe:

1. Switch pages client-side (no reload), then refresh — confirm you see the CORRECT page's content/skeleton, not the previous page's.
2. Open split view with two different items, refresh — confirm both columns show skeletons, not empty "open something" placeholders.
3. Open a note, refresh — confirm a title+content skeleton appears, not a blank/empty page.
4. Open a new/temp chat, refresh — confirm NO message skeleton. Open an active chat with history, refresh — confirm the message skeleton DOES appear and the layout isn't broken/partial.
5. Confirm "New Page", "New Task", "New Chat" (and similar) sidebar action buttons are present (either as their real selves or within the sidebar's own already-existing skeleton state — `SidebarSkeleton.tsx` already renders these labels/icons as static text inside each of its dashboard/tracker/chat branches) throughout refresh — not disappearing to nothing. This finding traces to `Sidebar.tsx`'s `inferredEntityId` state (line ~488), which seeds from the `initialEntityId` prop — the same SSR-read cookie Task 1 now keeps fresh — so a correct Task 1 should already fix this on its own; this check confirms that inference held. If buttons still disappear after Tasks 1-5, STOP and report it as a new, distinct finding rather than assuming it's covered — do not attempt to fix `Sidebar.tsx` without further investigation, since it was not directly modified by this plan.
6. Navigate to a non-Dashboard page, refresh — confirm the Home tab pill does NOT show as selected during the loading window.
7. In an active chat with messages, refresh — confirm the message input bar does not visibly scale/jump, and the token/context counter does not flash hidden-then-shown in a jarring way (a brief appearance-after-hydration is acceptable since messages themselves take a moment to load; a visible SNAP/jump is not).

- [ ] **Step 4: Repeat Step 3's checks 1, 3, 4, 6, 7 in the Electron desktop app** (`npm run electron:dev`) if accessible in your environment — these are not desktop-specific fixes but should be re-confirmed there since Round 1 touched desktop-specific rendering paths. If Electron is not accessible in your environment, note that in your report instead of skipping silently.

- [ ] **Step 5: Write a summary report**

Do NOT fix anything you find in Steps 3–4 beyond what this plan's tasks already covered — report it instead, the plan's author wants to do final review. Include:
- Test suite pass/fail count, tsc result.
- Pass/fail + notes for each of the 7 numbered checks in Step 3, both web and (if accessible) desktop.
- Any file where a "before" code block in this plan didn't match and you stopped/reported instead of guessing — list those explicitly so they can be re-planned.
