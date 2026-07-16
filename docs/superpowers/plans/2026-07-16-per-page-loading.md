# Per-Page Content Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix refresh so that (1) the correct page/component mounts immediately instead of always showing Dashboard first, (2) Note and new/temp Chat show correct, already-built skeleton states instead of a generic or wrong one, and (3) the Electron desktop app renders its real "floating containers" layout from the very first paint instead of briefly showing the web layout.

**Architecture:** Four independent, sequentially-shippable fixes. Parts A–C fix client-side routing/prop-passing bugs (both web and desktop). Part D fixes a server-side environment-detection gap that only affects the Electron build (web is unaffected). None of these introduce new skeleton UI — the skeleton JSX for every case already exists in the codebase; the bugs are in *which component mounts* and *which prop gets passed*, not missing UI.

**Tech Stack:** Next.js (App Router) + React, Zustand (`persist` middleware), Electron (`child_process.fork`), Vitest (`environment: node`, no React renderer — verified no `@testing-library/react` or `renderHook` anywhere in this repo).

**Reference spec:** `docs/superpowers/specs/2026-07-16-per-page-loading-design.md`

**IMPORTANT — before you touch anything, read this:**

- This repo has other work in progress that is NOT part of this plan (uncommitted files unrelated to these tasks may exist). **Never run `git add -A` or `git add .`.** Every commit step in this plan lists the exact file(s) to stage by path. Only stage those files.
- Before every commit, run `git status` and confirm only the files this task's Step lists are staged. If you see other files staged, unstage them (`git reset <file>`) before committing.
- Do not "fix" or refactor anything not explicitly instructed in a step, even if it looks wrong. If you notice something that seems broken but isn't in scope, stop and report it instead of fixing it.
- If any "before" code block in a step does not match the file exactly (even a single character different), STOP and report the mismatch instead of guessing or improvising a fix. Do not proceed past a step where the anchor text doesn't match.

---

## File Structure

- Modify: `src/components/WorkspaceRouter.tsx` — route from the hydration-safe cookie value instead of the store's un-hydrated default.
- Modify: `src/components/EntityPageRenderer.tsx` — pass `isLoading` into `NotePage` (one line; `NotePage`/`NoteEditor` already handle it).
- Modify: `src/components/chat/ChatConversation.tsx` — skip the message skeleton when there's nothing to load (new/temp chat), remove an unnecessary artificial delay.
- Modify: `src/lib/env.ts` — make `isDesktop()` resolve correctly during server-side rendering on the Electron-forked server (currently always `false` server-side).
- Modify: `electron/main.js` — pass an env var into the forked Next server so it can identify itself as the desktop server.
- Modify: `src/data/store.ts` — guard one module-level `window`-referencing block so it can never execute server-side (required companion fix for the `env.ts` change — see Task 6).
- Test: `src/lib/env.test.ts` (new) — unit tests for `isDesktop()`'s new server-side branch.

---

### Task 1: Fix routing — stop always mounting Dashboard on refresh

**Files:**
- Modify: `src/components/WorkspaceRouter.tsx`

**Background (read this before editing):** Before the app's persisted state finishes loading from localStorage ("hydration"), `useStore(state => state.activeEntityId)` does not return `null` or `undefined` — it returns the store's built-in default value, which is the literal string `'dashboard'`. This means that on every single refresh, for a brief moment, the app thinks the user's page is `'dashboard'` even if they were actually on the Tasks or Chat page or a note. This causes the wrong page (and wrong page's loading skeleton) to flash briefly on every refresh before switching to the correct page.

There is already a mechanism meant to prevent this: a cookie named `flowr-initial-entity` is written to the browser by `src/app/layout.tsx` every time the app loads, containing the user's actual last-open page. This cookie is read server-side in `src/app/app/page.tsx` and passed down as a prop called `initialEntityId` through `Shell` and into `WorkspaceRouter`. But `WorkspaceRouter` currently ignores this prop when the store's default value (`'dashboard'`) is present, because `'dashboard'` is a truthy string, not `null`.

- [ ] **Step 1: Read the current file and confirm it matches exactly**

Open `src/components/WorkspaceRouter.tsx`. Confirm its exact current contents are:

```tsx
"use client";

import { useStore } from '@/data/store';
import { EntityPageRenderer } from '@/components/EntityPageRenderer';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

import { memo } from 'react';

export const WorkspaceRouter = memo(function WorkspaceRouter({ initialEntityId }: { initialEntityId?: string }) {
  const activeEntityId = useStore(state => state.activeEntityId);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      if (activeEntityId === 'tracker' || activeEntityId === 'chat') {
        gsap.set(containerRef.current, { autoAlpha: 1, y: 0, x: 0, clearProps: 'transform' });
      } else {
        gsap.set(containerRef.current, { autoAlpha: 1, y: 0 });
      }
    }
  }, [activeEntityId]);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col min-h-0 relative"
    >
      <EntityPageRenderer entityId={activeEntityId ?? initialEntityId ?? 'dashboard'} />
    </div>
  );
});
```

If this does not match exactly, STOP and report the difference instead of proceeding.

- [ ] **Step 2: Replace the entire file contents**

Replace the full contents of `src/components/WorkspaceRouter.tsx` with:

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

  // Before hydration, activeEntityId is the store's un-hydrated default
  // ('dashboard'), not the user's real last page — trusting it here is what
  // causes every other page to flash a Dashboard route on refresh. Route from
  // the server-provided cookie (the user's actual last page) until the real
  // persisted value is available; storeHydrated flips true right after
  // hydration completes (see useAppReady.ts), matching the same instant the
  // real activeEntityId becomes trustworthy.
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
    <div
      ref={containerRef}
      className="flex-1 flex flex-col min-h-0 relative"
    >
      <EntityPageRenderer entityId={resolvedEntityId} />
    </div>
  );
});
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `WorkspaceRouter.tsx`. (Pre-existing unrelated errors elsewhere in the codebase, if any, are not your concern — only check that this file introduces none.)

- [ ] **Step 4: Commit**

```bash
git status
```
Confirm only `src/components/WorkspaceRouter.tsx` shows as modified relative to what you intend to stage. Then:

```bash
git add src/components/WorkspaceRouter.tsx
git commit -m "fix(refresh): route from initial-entity cookie during hydration window

Prevents every page from flashing Dashboard's route on refresh — the
store's un-hydrated default activeEntityId ('dashboard') was being
treated as a real route instead of falling back to the cookie."
```

---

### Task 2: Pass `isLoading` into NotePage (skeleton already exists, just wire it)

**Files:**
- Modify: `src/components/EntityPageRenderer.tsx`

**Background:** `NotePage` and `NoteEditor` already have fully-built skeleton UI for the note title and note content (a title-shaped placeholder and 8 varied-width block-shaped placeholder lines) — this was verified already in the code, nothing needs to be built. The only bug is that `EntityPageRenderer.tsx` never passes the `isLoading` value to `NotePage`, so the skeleton never triggers and the note area shows nothing (or stale content) while loading.

- [ ] **Step 1: Confirm the current line**

Open `src/components/EntityPageRenderer.tsx`. Find this exact line (it is inside a `switch (entity.type)` block, in the `case 'note':` branch):

```tsx
    case 'note':
      return <NotePage entity={entity} />; // TODO pass isLoading
```

If this exact text is not present, STOP and report what you find instead.

- [ ] **Step 2: Replace it**

Replace that line with:

```tsx
    case 'note':
      return <NotePage entity={entity} isLoading={isLoading} />;
```

(Note: `isLoading` is already defined earlier in this same function via `const isLoading = !isReady;` — you are just passing an existing variable into an existing prop, not adding new logic.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `EntityPageRenderer.tsx` or `NotePage.tsx`.

- [ ] **Step 4: Commit**

```bash
git status
```
Confirm only `src/components/EntityPageRenderer.tsx` is what you're about to stage.

```bash
git add src/components/EntityPageRenderer.tsx
git commit -m "fix(refresh): pass isLoading to NotePage so its existing skeleton renders

NoteEditor already has title/content skeleton UI gated on isLoading;
EntityPageRenderer was never passing the prop through."
```

---

### Task 3: Chat — don't show a message skeleton when there's nothing to load

**Files:**
- Modify: `src/components/chat/ChatConversation.tsx`

**Background:** A new or temporary chat has zero messages and nothing to fetch from anywhere — there is no loading to show a skeleton for. Currently, `ChatConversation` shows a full message-skeleton (`ChatMainSkeleton`) even for a brand new/temp chat, which is wrong (it briefly shows fake message bubbles for a conversation that never had any). This task makes the skeleton only apply when there's an actual existing chat that could have real messages to load. It also removes an unrelated, unnecessary artificial 500ms minimum-loading delay that was making this worse.

- [ ] **Step 1: Confirm the current contents**

Open `src/components/chat/ChatConversation.tsx`. Confirm these exact lines are present near the top of the `ChatConversation` function:

```tsx
export function ChatConversation({ isLoading }: { isLoading?: boolean }) {
  const aiMessages = useStore(s => s.aiMessages);
  const isAILoading = useStore(s => s.isAILoading);
  const isChatMessagesLoading = useStore(s => s.isChatMessagesLoading);
  const regenerateAIMessage = useStore(s => s.regenerateAIMessage);
  const setReplyMessage = useStore(s => s.setReplyMessage);
  const openModal = useStore(s => s.openModal);
  const aiSessionContext = useStore(s => s.aiSessionContext);
  const isCompacting = useStore(s => s.isCompacting);

  const isMinLoading = useMinimumLoadingTime(!!isLoading || isChatMessagesLoading, 500);
  const activeChatId = useStore(s => s.activeChatId);
```

And further down:

```tsx
  if (isMinLoading) {
    return <ChatMainSkeleton />;
  }
```

If either block does not match exactly, STOP and report the mismatch.

- [ ] **Step 2: Add the `isTempChat` read and change the loading calculation**

Replace this block:

```tsx
  const isMinLoading = useMinimumLoadingTime(!!isLoading || isChatMessagesLoading, 500);
  const activeChatId = useStore(s => s.activeChatId);
```

with:

```tsx
  const activeChatId = useStore(s => s.activeChatId);
  const isTempChat = useStore(s => s.isTempChat);

  // A new or temporary chat has zero messages and nothing to fetch — there is
  // nothing to show a message skeleton for. Only show it when there's an
  // actual existing chat whose messages could still be loading.
  const hasNothingToLoad = isTempChat || !activeChatId;
  const isMinLoading = !hasNothingToLoad && (!!isLoading || isChatMessagesLoading);
```

- [ ] **Step 3: Remove the now-unused import**

Find this import line near the top of the file:

```tsx
import { useMinimumLoadingTime } from '@/hooks/use-minimum-loading-time';
```

Delete this line entirely (it is no longer used anywhere in this file after Step 2).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `ChatConversation.tsx`. In particular, confirm there is no "unused import" or "unused variable" error for `useMinimumLoadingTime` or `isMinLoading` — `isMinLoading` is still used at the `if (isMinLoading)` check further down in the file, so it must remain defined.

- [ ] **Step 5: Search for other usages of this file's changed export**

Run: `grep -rn "useMinimumLoadingTime" src/components/chat/ChatConversation.tsx`
Expected: no output (the import and its one usage are both removed).

- [ ] **Step 6: Commit**

```bash
git status
```
Confirm only `src/components/chat/ChatConversation.tsx` is what you're about to stage.

```bash
git add src/components/chat/ChatConversation.tsx
git commit -m "fix(refresh): skip chat message skeleton for new/temp chats (nothing to load)

Also removes an artificial 500ms minimum-loading delay left over from
before the main hydration gate was fixed."
```

---

### Task 4: Write a failing test for `isDesktop()`'s server-side behavior

**Files:**
- Test: `src/lib/env.test.ts` (new)

**Background:** `isDesktop()` currently always returns `false` when there is no `window` object (i.e. during server-side rendering), because it checks `window.__FLOWR_DESKTOP__`, and there is no `window` on the server. This is correct for the *web* server, but wrong for the *Electron desktop* server — that server should identify itself as desktop so the page it renders matches what the Electron client will render. Task 5 will make this test pass by reading a `FLOWR_DESKTOP` environment variable when there's no `window`.

- [ ] **Step 1: Confirm the current contents of `src/lib/env.ts`**

Open `src/lib/env.ts`. Confirm its exact current full contents are:

```ts
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__FLOWR_DESKTOP__;
}

export function isWeb(): boolean {
  return !isDesktop();
}
```

If this does not match exactly, STOP and report the difference.

- [ ] **Step 2: Write the failing test**

Create `src/lib/env.test.ts` with this exact content:

```ts
// Verifies isDesktop() correctly identifies the Electron-forked Next server
// via a FLOWR_DESKTOP env var, so server-side rendering on Electron matches
// what the Electron client will render (avoiding a hydration mismatch where
// the server renders the web layout and the client renders the desktop one).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isDesktop, isWeb } from './env';

describe('isDesktop() server-side (no window) behavior', () => {
  const ORIGINAL_ENV = process.env.FLOWR_DESKTOP;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.FLOWR_DESKTOP;
    } else {
      process.env.FLOWR_DESKTOP = ORIGINAL_ENV;
    }
  });

  it('returns true server-side when FLOWR_DESKTOP=1 (the Electron-forked server)', () => {
    process.env.FLOWR_DESKTOP = '1';
    expect(isDesktop()).toBe(true);
  });

  it('returns false server-side when FLOWR_DESKTOP is unset (the web server)', () => {
    delete process.env.FLOWR_DESKTOP;
    expect(isDesktop()).toBe(false);
  });

  it('returns false server-side when FLOWR_DESKTOP is set to something other than "1"', () => {
    process.env.FLOWR_DESKTOP = 'true'; // must be the literal string '1', not truthy-any-string
    expect(isDesktop()).toBe(false);
  });

  it('isWeb() is the exact inverse of isDesktop() in the FLOWR_DESKTOP=1 case', () => {
    process.env.FLOWR_DESKTOP = '1';
    expect(isWeb()).toBe(false);
  });
});
```

- [ ] **Step 3: Run it and verify it fails**

Run: `npx vitest run src/lib/env.test.ts`
Expected: FAIL — specifically, the first test ("returns true server-side when FLOWR_DESKTOP=1") should fail, because `isDesktop()` doesn't check `process.env` yet. The other three tests may already pass (they describe today's `false` behavior) — that's fine, only the first one must fail.

- [ ] **Step 4: Commit the failing test**

```bash
git status
```
Confirm only `src/lib/env.test.ts` is staged.

```bash
git add src/lib/env.test.ts
git commit -m "test(refresh): isDesktop() server-side FLOWR_DESKTOP env var (failing)"
```

---

### Task 5: Implement the `isDesktop()` fix

**Files:**
- Modify: `src/lib/env.ts`

- [ ] **Step 1: Replace the file contents**

Replace the full contents of `src/lib/env.ts` with:

```ts
export function isDesktop(): boolean {
  if (typeof window === 'undefined') {
    // Server-side: true only for the dedicated Electron-forked Next server
    // (see electron/main.js, which sets FLOWR_DESKTOP='1' on that fork's env).
    // The regular web deployment never sets this, so it correctly stays false
    // there. This must exactly match what the client will resolve to once it
    // hydrates, or React will report a hydration mismatch.
    return process.env.FLOWR_DESKTOP === '1';
  }
  return !!(window as any).__FLOWR_DESKTOP__;
}

export function isWeb(): boolean {
  return !isDesktop();
}
```

- [ ] **Step 2: Run the test from Task 4 and verify it now passes**

Run: `npx vitest run src/lib/env.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `env.ts`.

- [ ] **Step 4: Commit**

```bash
git status
```
Confirm only `src/lib/env.ts` is staged (the test file was already committed in Task 4 — do not re-add it here, but it's fine if `git status` shows it as already committed/clean).

```bash
git add src/lib/env.ts
git commit -m "feat(refresh): isDesktop() resolves correctly server-side via FLOWR_DESKTOP env var"
```

---

### Task 6: Guard the one module-level `window` reference that this change newly exposes

**Files:**
- Modify: `src/data/store.ts`

**Background — read this carefully, it explains why this task is required:** Before Task 5's change, `isDesktop()` was *always* `false` on any server (there's never a `window` object in Node.js). After Task 5, `isDesktop()` can now be `true` on the server — specifically, on the Electron-forked server once `FLOWR_DESKTOP=1` is set (Task 7 sets that env var). This means a block of code in `src/data/store.ts` that runs once when the file is first loaded — not inside a React component, not inside a `useEffect` — will now execute during server-side rendering on the Electron server, when it never did before.

That block registers a callback that references `window.flowrDB` directly (not guarded by a `typeof window !== 'undefined'` check). If that callback ever runs on the server, it will crash with `ReferenceError: window is not defined`, because `window` genuinely does not exist in Node.js regardless of what `isDesktop()` returns.

This task adds an explicit `typeof window !== 'undefined'` check so this block can never run on the server, no matter what `isDesktop()` says — which is correct, because this block's entire purpose is talking to a browser-only bridge (`window.flowrDB`), so it should only ever run in the browser.

- [ ] **Step 1: Locate and confirm the exact current line**

Run: `grep -n "^if (isDesktop())" src/data/store.ts`
Expected output: `3733:if (isDesktop()) {` (the line number may differ slightly if other parts of the file changed since this plan was written — if so, use the actual line number reported, but the code content below must still match).

Open `src/data/store.ts` at that line. Confirm the exact text is:

```ts
if (isDesktop()) {
  useStore.subscribe((state, prevState) => {
```

If this does not match exactly, STOP and report what you find.

- [ ] **Step 2: Replace the guard**

Replace:

```ts
if (isDesktop()) {
  useStore.subscribe((state, prevState) => {
```

with:

```ts
if (typeof window !== 'undefined' && isDesktop()) {
  useStore.subscribe((state, prevState) => {
```

Do not change anything else in this block — only this one `if` line changes. The rest of the subscriber body (which references `window.flowrDB` internally) stays exactly as-is; it's now unreachable on the server because of this added check.

- [ ] **Step 3: Confirm no other module-level (non-component, non-effect, non-handler) code in the codebase reads `isDesktop()` unguarded**

Run: `grep -rn "^if (isDesktop())" src/ --include="*.ts" --include="*.tsx"`
Expected: no output (the only occurrence, the one you just fixed, no longer matches this exact pattern since you changed it in Step 2).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `store.ts`.

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npm test`
Expected: all tests pass (same pass count as before this change — this is a guard addition, not a behavior change for any currently-passing test, since `typeof window !== 'undefined'` is `true` in every test/browser context these tests already assume).

- [ ] **Step 6: Commit**

```bash
git status
```
Confirm only `src/data/store.ts` is staged.

```bash
git add src/data/store.ts
git commit -m "fix(refresh): guard SQLite-mirror subscriber to browser-only

Required companion to the isDesktop() server-side fix — without this,
the subscriber would newly register during Electron SSR and crash on
its first unguarded window reference."
```

---

### Task 7: Tell the Electron-forked server it's the desktop server

**Files:**
- Modify: `electron/main.js`

- [ ] **Step 1: Confirm the current contents**

Open `electron/main.js`. Search for this exact block (run `grep -n "nextServer = fork" electron/main.js` to find the line number):

```js
    nextServer = fork(serverPath, [], {
      cwd: isPackaged ? standalonePath : appPath,
      env: {
        ...process.env,
        ...envVars,
        PORT: port.toString(),
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
        ELECTRON_RUN_AS_NODE: '1'
      },
      stdio: 'pipe'
    });
```

If this does not match exactly, STOP and report the difference.

- [ ] **Step 2: Add the env var**

Replace that block with:

```js
    nextServer = fork(serverPath, [], {
      cwd: isPackaged ? standalonePath : appPath,
      env: {
        ...process.env,
        ...envVars,
        PORT: port.toString(),
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
        ELECTRON_RUN_AS_NODE: '1',
        FLOWR_DESKTOP: '1'
      },
      stdio: 'pipe'
    });
```

(Only the added trailing `FLOWR_DESKTOP: '1'` line and the added comma after `'1'` on the `ELECTRON_RUN_AS_NODE` line above it are new — everything else is unchanged.)

- [ ] **Step 3: Search for any other place a Next server is forked or started, in case there's a second path (e.g. dev mode) that also needs this**

Run: `grep -n "fork(" electron/main.js`
Expected: exactly one match — the block you just edited. If there is more than one `fork(` call that starts a Next server (not some other process), STOP and report it — it may need the same env var added, and this plan does not have instructions for a second location.

- [ ] **Step 4: No automated test possible for this file**

`electron/main.js` runs in Electron's main process, outside of Next.js and outside of Vitest's module resolution — it cannot be unit tested with this project's existing test setup. Skip to manual verification (Task 8) to confirm this works end-to-end.

- [ ] **Step 5: Commit**

```bash
git status
```
Confirm only `electron/main.js` is staged.

```bash
git add electron/main.js
git commit -m "feat(refresh): tell the Electron-forked Next server it's the desktop server

Sets FLOWR_DESKTOP=1 on the forked server's env so isDesktop() (fixed
in a prior commit) resolves true server-side, matching the Electron
client and eliminating the web-layout flash on desktop refresh."
```

---

### Task 8: Full regression run and manual verification

- [ ] **Step 1: Run the entire automated test suite**

Run: `npm test`
Expected: all tests pass, with no failures. Note the total test count in your report for the human reviewer (e.g. "463 tests passed" — the exact number isn't important, just confirm 0 failed).

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: clean (no output, exit code 0). If there are pre-existing errors unrelated to any file this plan touched, note them in your report but do not attempt to fix them — they are out of scope.

- [ ] **Step 3: Start the web dev server and manually verify routing (Task 1)**

Run: `npm run dev` (leave it running; open a new terminal/tab for the remaining steps if needed).

In a browser, open the app, navigate to the Tasks page (not Dashboard), then hit refresh (F5 or Ctrl+R).

Expected: the page stays on Tasks after refresh — you should NOT see the Dashboard page/skeleton flash before Tasks appears. Repeat for the Chat page and for a note page. Report what you observed for each.

- [ ] **Step 4: Manually verify the Note skeleton (Task 2)**

While still running the dev server, open any note with several lines of content, then refresh.

Expected: briefly, you should see a title-shaped skeleton bar and several skeleton lines in place of the note's real title and content — not a blank page, not stale content with no skeleton at all. Report what you observed.

- [ ] **Step 5: Manually verify the Chat fix (Task 3)**

Open a new/temporary chat (one with zero messages), refresh.

Expected: NO message skeleton should appear — the chat's normal empty-state UI (e.g. a greeting/prompt) should appear immediately, with no flash of fake message bubbles.

Then open an existing chat that has real message history, refresh.

Expected: a brief message-shaped skeleton (`ChatMainSkeleton`) should appear, then the real messages. Report what you observed for both cases.

- [ ] **Step 6: Build and run the Electron desktop app, verify Task 6/7's fix**

Run: `npm run electron:dev`

Once the app window opens, refresh it (there is a refresh button in the desktop header, or use the app's reload shortcut if one exists — check `electron/main.js` or the app's keyboard-shortcut handling if unsure which to use).

Expected: you should NOT see the web-style flat layout (no floating rounded cards, different header) flash before the real desktop layout (floating cards for sidebar/main content/AI panel, desktop header with window controls) appears. The desktop layout should be present from the very first frame you can see.

Also check that the Electron app started without crashing. If you have access to it, check the file at the path Node's `os.tmpdir()` resolves to (referenced in `electron/main.js` as `STDERR_LOG`, filename `flowr-server-stderr.log`) for any `ReferenceError` — there should be none. If you cannot access this log file, note that in your report instead of guessing.

- [ ] **Step 7: Confirm the web deployment is unaffected**

Back in the regular browser (from Step 3, not Electron), refresh a few more times on different pages.

Expected: the web layout (flat, no floating cards) should still be exactly what it was before this plan — this plan's Task 5/6/7 changes should have zero visible effect on the web version, since `FLOWR_DESKTOP` is only ever set by the Electron fork, never by the web server. Report if you see anything different from before this plan (e.g. if the web layout suddenly shows desktop-style floating cards, that would mean something is wrong and should be reported, not fixed).

- [ ] **Step 8: Write a summary report**

Do not attempt to fix anything you find in Steps 3–7 that seems wrong — this plan's author (a separate reviewer) wants to do final verification themselves. Write a short summary covering:
- Test suite result (pass/fail count) and tsc result.
- What you observed for each of Steps 3–7, including anything that did NOT match the "Expected" description.
- Do NOT commit anything in this task — Steps 3–7 are observation-only, no code changes.
