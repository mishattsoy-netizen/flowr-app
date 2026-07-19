# Client-Only App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop server-rendering the `/app` interior so that the first paint is built on the client with real data already present, eliminating the entire class of "wrong content flashes then snaps to correct" bugs at their source.

**Architecture:** The `/app` route currently renders twice: once on the server (which has no access to the user's localStorage, so it guesses) and once on the client (which has the real data). Every "wrong thing flashes" bug lives in that server guess. This plan renders the `/app` interior client-only via `next/dynamic` with `ssr: false`. Because the Zustand store's persist adapter reads localStorage **synchronously**, a client-only first render already has real data in its `useState` initializer — so there is nothing to guess and nothing to snap.

**Tech Stack:** Next.js 16.2.4 (App Router), React 19.2.4, Zustand (`persist`, synchronous localStorage), Vitest (`environment: node`, no React renderer).

**Background — why this works (read before starting):**

The store's persist storage does `localStorage.getItem(name)` synchronously (`src/data/store.ts`, in the `storage:` block). Zustand applies persisted state during store creation, at module load — before any component renders. So on a client-only render, `useStore.persist.hasHydrated()` is **already true** on the very first render.

The reason the app doesn't currently benefit from that is `src/hooks/useAppReady.ts`, which deliberately starts `storeHydrated` as `false` and only flips it in a `useEffect`. That was added on purpose (commit `5048a6c`) to match the server's render and avoid a React hydration mismatch. Its commit message says so explicitly: *"start storeHydrated false to match the server."* Once there is no server render for this page, that constraint disappears and the hook can read the real value immediately.

**Two-phase design (important):** Task 1 makes the page client-only. Tasks 2–3 then let the hydration gates read the real value immediately. **Task 1 alone will NOT fix the reported bugs** — it removes the wrong-guess frame, but the gates still force one `false` frame. Both phases are needed. They are split so that if Task 1 causes an unexpected problem, it can be reverted independently.

**Out of scope (do not attempt):**
- Deleting `useAppReady`, the `flowr-initial-entity` cookie, the `data-initial-entity` attribute, or the `initialEntityId` props. After this change they become harmless (the gates just always report ready, and the cookie is written but unused for correctness). Removing them is a separate cleanup with its own risk; leaving them costs nothing.
- Unifying or rewriting any skeleton component.
- Any change to `src/app/layout.tsx` (the root layout's inline `<head>` script). It still runs, still applies the theme, and is still harmless.

**IMPORTANT — read before touching anything:**

- This repo has unrelated work in progress. **Never run `git add -A` or `git add .`.** Each commit step lists exact files.
- Before every commit, run `git status` and confirm only that task's files are staged.
- If any "before" code block does not match the file exactly, STOP and report the mismatch instead of guessing.
- Do not fix anything not explicitly instructed. Report it instead.
- Do the tasks in order. Task 2 and Task 3 depend on Task 1 having landed.

---

## File Structure

- Create: `src/app/app/AppClient.tsx` — a Client Component that dynamically imports the app interior with `ssr: false`. This wrapper is required because `ssr: false` is only permitted inside a Client Component in the App Router; `page.tsx` is a Server Component and cannot use it directly.
- Modify: `src/app/app/page.tsx` — render `<AppClient />` instead of `<Shell>`/`<WorkspaceRouter>` directly.
- Modify: `src/hooks/useAppReady.ts` — read the real hydration value on first render (safe once there is no server render).
- Modify: `src/components/layout/Sidebar.tsx` — same, for its two independent gates (`isMounted`, `storeHydrated`).

---

### Task 1: Render the `/app` interior client-only

**Files:**
- Create: `src/app/app/AppClient.tsx`
- Modify: `src/app/app/page.tsx`

**Background:** `src/app/app/page.tsx` is a Server Component (it's `async` and calls `cookies()`). In the Next.js App Router, `next/dynamic` with `ssr: false` is **not allowed in a Server Component** — it must live in a Client Component. So this task adds a small client wrapper whose only job is to do the `ssr: false` import.

The cookie read stays in `page.tsx` for now and is passed through as a prop, so nothing downstream changes shape. (It becomes unnecessary once Tasks 2–3 land, but leaving it costs nothing and keeps this task independently revertible.)

- [ ] **Step 1: Confirm the current `page.tsx`**

Open `src/app/app/page.tsx`. Confirm its exact contents are:

```tsx
import { Shell } from '@/components/layout/Shell';
import { WorkspaceRouter } from '@/components/WorkspaceRouter';
import { cookies } from 'next/headers';

export default async function AppPage() {
  const cookieStore = await cookies();
  const initialEntityId = cookieStore.get('flowr-initial-entity')?.value || 'dashboard';

  return (
    <Shell initialEntityId={initialEntityId}>
      <WorkspaceRouter initialEntityId={initialEntityId} />
    </Shell>
  );
}
```

If this does not match exactly, STOP and report.

- [ ] **Step 2: Create the client wrapper**

Create `src/app/app/AppClient.tsx` with exactly this content:

```tsx
"use client";

import dynamic from 'next/dynamic';

// The /app interior is rendered client-only (ssr: false) on purpose.
//
// The server has no access to the user's localStorage, so a server render can
// only ever guess at the user's real state (which page was open, which tabs,
// whether split view was on, what the chat messages were). That guess is
// always wrong for anyone with existing data, producing a frame of incorrect
// UI that then snaps to the correct UI once the client takes over. Every
// "wrong thing flashes on refresh" bug traced back to that frame.
//
// Nothing under /app needs SSR: this route fetches no server-side data. Its
// only server-side work was reading a cookie the client itself had written,
// to guess what the client already knew.
//
// Because the Zustand store's persist adapter reads localStorage
// synchronously, a client-only first render already has the real data
// available — so there is no guess and nothing to snap.
//
// `ssr: false` is only permitted inside a Client Component in the App Router,
// which is the only reason this wrapper file exists.
const Shell = dynamic(
  () => import('@/components/layout/Shell').then(m => m.Shell),
  { ssr: false },
);

const WorkspaceRouter = dynamic(
  () => import('@/components/WorkspaceRouter').then(m => m.WorkspaceRouter),
  { ssr: false },
);

export function AppClient({ initialEntityId }: { initialEntityId?: string }) {
  return (
    <Shell initialEntityId={initialEntityId}>
      <WorkspaceRouter initialEntityId={initialEntityId} />
    </Shell>
  );
}
```

- [ ] **Step 3: Replace `page.tsx`**

Replace the full contents of `src/app/app/page.tsx` with:

```tsx
import { cookies } from 'next/headers';
import { AppClient } from './AppClient';

export default async function AppPage() {
  const cookieStore = await cookies();
  const initialEntityId = cookieStore.get('flowr-initial-entity')?.value || 'dashboard';

  return <AppClient initialEntityId={initialEntityId} />;
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `page.tsx` or `AppClient.tsx`.

Note: this project has pre-existing, unrelated type errors in `src/app/api/ai/user-brain/route.ts` and `src/lib/bot/tools/handlers.ts`. Ignore those — they are not yours and must not be fixed here. Only confirm no NEW errors in the files this task touches.

- [ ] **Step 5: Run the test suite**

Run: `npm test`
Expected: all pass. Report the count.

- [ ] **Step 6: Verify the app still boots**

Run: `npm run dev`, open the app in a browser.

Expected: the app loads and works normally. You will probably still see skeletons/loading flashes at this stage — **that is expected and correct for now**; Tasks 2–3 address it. What you are checking here is only: does the app still render, navigate, and function without errors? Check the browser console for errors (especially any hydration warnings — there should now be FEWER, not more).

If the app fails to load or throws, STOP and report.

- [ ] **Step 7: Commit**

```bash
git status
```
Confirm only `src/app/app/AppClient.tsx` and `src/app/app/page.tsx` are staged.

```bash
git add src/app/app/AppClient.tsx src/app/app/page.tsx
git commit -m "refactor(refresh): render /app interior client-only

The server has no localStorage, so its render of /app could only guess
at the user's real state — producing a frame of wrong UI that snapped
to correct once the client took over. Every 'wrong thing flashes on
refresh' bug lived in that frame. Nothing under /app needs SSR; it
fetches no server data. Its only server-side work was reading a cookie
the client itself wrote."
```

---

### Task 2: Let `useAppReady` report the real hydration value immediately

**Files:**
- Modify: `src/hooks/useAppReady.ts`

**Background — read this, it explains why a previously-reverted change is now correct:**

This hook currently starts `storeHydrated` as `false` and flips it to `true` in a `useEffect`. That was deliberate: commit `5048a6c` added it to match the server's render and avoid a React hydration mismatch (the server rendered skeletons, the client rendered real content, React complained). Its message reads: *"start storeHydrated false to match the server."*

After Task 1, there is no server render of this page — so there is nothing to match, and the mismatch it was guarding against cannot occur. Reading the real value immediately is now correct. This restores what an earlier attempt (Scope 1) tried before SSR forced it back.

Keep the `useEffect` fallback: if the store somehow hasn't hydrated on first render, `onFinishHydration` still catches it.

- [ ] **Step 1: Confirm the current contents**

Open `src/hooks/useAppReady.ts`. Confirm the hook body is:

```ts
export function useAppReady() {
  const [storeHydrated, setStoreHydrated] = useState(false);

  useEffect(() => {
    if (useStore.persist.hasHydrated()) {
      setStoreHydrated(true);
      return;
    }
    const unsub = useStore.persist.onFinishHydration(() => setStoreHydrated(true));
    return unsub;
  }, []);

  return {
    isReady: storeHydrated,
    storeHydrated,
  };
}
```

If it does not match, STOP and report.

- [ ] **Step 2: Replace the whole file**

Replace the full contents of `src/hooks/useAppReady.ts` with:

```ts
import { useState, useEffect } from 'react';
import { useStore } from '@/data/store';

/**
 * Readiness = the persisted Zustand store has hydrated from localStorage.
 *
 * The store's persist adapter reads localStorage synchronously, and Zustand
 * applies persisted state during store creation (at module load, before any
 * component renders). So hasHydrated() is normally already true on the very
 * first render, and this hook reports ready immediately — no skeleton frame.
 *
 * This previously had to start `false` to match the server's render and avoid
 * a React hydration mismatch (see commit 5048a6c). That is no longer needed:
 * the /app interior is now rendered client-only (see src/app/app/AppClient.tsx),
 * so there is no server render to match.
 *
 * The useEffect below remains as a genuine fallback for the rare case where
 * the store has not hydrated by first render (e.g. if the storage adapter ever
 * becomes async).
 */
export function useAppReady() {
  const [storeHydrated, setStoreHydrated] = useState(() => useStore.persist.hasHydrated());

  useEffect(() => {
    if (storeHydrated) return;
    if (useStore.persist.hasHydrated()) {
      setStoreHydrated(true);
      return;
    }
    const unsub = useStore.persist.onFinishHydration(() => setStoreHydrated(true));
    return unsub;
  }, [storeHydrated]);

  return {
    isReady: storeHydrated,
    storeHydrated,
  };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no NEW errors (see Task 1 Step 4's note about pre-existing unrelated errors).

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: all pass. Report the count.

- [ ] **Step 5: Verify in the browser**

Run `npm run dev`. Refresh on several pages (Home, Tasks, Chat, a note).

Expected: content should now appear immediately without a skeleton flash. Check the browser console for **hydration mismatch warnings** — there should be none. If you see hydration errors, STOP and report immediately; that would mean something under `/app` is still being server-rendered.

- [ ] **Step 6: Commit**

```bash
git status
```
Confirm only `src/hooks/useAppReady.ts` is staged.

```bash
git add src/hooks/useAppReady.ts
git commit -m "fix(refresh): report real hydration state on first render

The forced-false first frame existed only to match the server's render
(commit 5048a6c). With /app now client-only there is no server render to
match, and the store's synchronous localStorage persist means the real
value is already available on the first render."
```

---

### Task 3: Let the Sidebar's own gates report the real value immediately

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Background:** `Sidebar` does not use `useAppReady`. It has its own two independent gates — `isMounted` and `storeHydrated` — both starting `false` and flipping in a `useEffect`, for the same now-obsolete SSR reason. Its skeleton is gated on `(!isMounted || !storeHydrated)`, so both must report true on the first render for the skeleton to be skipped.

- [ ] **Step 1: Confirm the current declarations**

Run: `grep -n "const \[isMounted, setIsMounted\] = useState(false);" src/components/layout/Sidebar.tsx`
Expected: exactly one match (around line 453).

Run: `grep -n "const \[storeHydrated, setStoreHydrated\] = useState(false);" src/components/layout/Sidebar.tsx`
Expected: exactly one match (around line 454, directly after the previous one).

If either does not match exactly, STOP and report.

- [ ] **Step 2: Replace both initializers**

Replace:

```tsx
  const [isMounted, setIsMounted] = useState(false);
  const [storeHydrated, setStoreHydrated] = useState(false);
```

with:

```tsx
  // These previously started false to match the server's render (the /app
  // interior used to be server-rendered, and a mismatch between server and
  // first-client render causes React hydration errors). /app is now
  // client-only (see src/app/app/AppClient.tsx), so the real values can be
  // read immediately — the store's persist adapter is synchronous
  // localStorage, so it has already hydrated by the time this renders.
  const [isMounted, setIsMounted] = useState(true);
  const [storeHydrated, setStoreHydrated] = useState(() => useStore.persist.hasHydrated());
```

- [ ] **Step 3: Confirm the existing effect still compiles**

The `useEffect` further down this file (around line 490) calls `setIsMounted(true)` and sets up hydration handling. Leave it exactly as-is — it is now a harmless no-op in the common case and still a correct fallback if the store somehow hasn't hydrated.

Run: `npx tsc --noEmit`
Expected: no NEW errors (see Task 1 Step 4's note).

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: all pass. Report the count.

- [ ] **Step 5: Commit**

```bash
git status
```
Confirm only `src/components/layout/Sidebar.tsx` is staged.

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "fix(refresh): Sidebar gates report real state on first render

Sidebar has its own isMounted/storeHydrated gates (it does not use
useAppReady). Both forced a false first frame to match the server —
no longer needed now that /app is client-only."
```

---

### Task 4: Final verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all pass, 0 failed. Report the count.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: only the pre-existing unrelated errors in `src/app/api/ai/user-brain/route.ts` and `src/lib/bot/tools/handlers.ts`. Report if you see any others; do not fix any of them.

- [ ] **Step 3: Check the console for hydration errors**

Run `npm run dev`. Open the app, refresh on several different pages, and watch the browser console throughout.

Expected: **no React hydration mismatch warnings.** This is the single most important check in this plan — if `/app` is genuinely client-only, hydration mismatches under it are structurally impossible. If you see any, STOP and report; it means something is still being server-rendered.

- [ ] **Step 4: Verify the previously-reported bugs, in the web app**

Refresh several times for each and report what you observe. The expectation for ALL of these is now the same: **the correct UI appears immediately, with no wrong-content frame and no snap.**

1. Refresh on a new/temp chat → greeting UI appears directly. No message skeleton. No grey glow flash. No message-bar reposition.
2. Refresh on an active chat with history → real messages appear. Message bar does not shift size. Token/context counter does not disappear and reappear.
3. Refresh in split view (with two different items open) → both columns show their own content immediately. No fullscreen single-page skeleton first.
4. Refresh on Chat → sidebar shows the real chat history immediately. No skeleton, no two-stage row-size change.
5. Refresh on Tasks / Home / a note → correct page's real content immediately.
6. Sidebar action buttons ("New Chat"/"Temp Chat", "New Task"/"All tasks", "New Page"/"Dashboard") → present and correct for the current page throughout. Not replicas, not skeletons.

- [ ] **Step 5: Note the new expected behavior (this is the trade-off, not a bug)**

Before the app's JavaScript loads, you will see a **blank/empty area** where the app interior will be, instead of a skeleton. This is expected and intended: the deal is "nothing, then the right thing" instead of "the wrong thing, then the right thing."

Report roughly how long that blank moment lasts in dev mode, and note that dev mode is significantly slower than a production build — if it feels long, it is worth re-checking with `npm run build && npm start` before judging it.

- [ ] **Step 6: Report**

Do **not** fix anything beyond this plan's tasks — report it instead; the reviewer wants to do final verification. Include:
- Test count + tsc result.
- Whether any hydration warnings appeared (Step 3) — call this out prominently either way.
- Pass/fail for each of Step 4's six checks.
- Your observation from Step 5 about the blank frame.
- Any step where a "before" block didn't match and you stopped.
