# Per-Page Loading Round 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 problems that survived Round 2, whose real root causes are now identified. Two of Round 2's tasks (4 and 5) were **structurally incapable** of fixing their targets — this plan explains why and replaces them.

**Architecture:** The 5 remaining findings have exactly **three** root causes:

- **Cause 1 — `<Sidebar>` never receives `initialEntityId` (one missing prop).** `Shell.tsx:381` renders `<Sidebar forceFull={...} />` without passing `initialEntityId`, even though `Sidebar` accepts it (`Sidebar.tsx:360`). So `inferredEntityId` initializes to `null`, and its DOM-attribute fallback only runs inside a `useEffect` (i.e. after first paint). Two things key off `inferredEntityId` during the pre-hydration frame: the nav slider's selected tab (`Sidebar.tsx:1127`) and which skeleton + action buttons show (`Sidebar.tsx:1225-1227`). With `null`, both fall into the dashboard/Home branch. **This one missing prop causes findings #2, #3, and #5.**
- **Cause 2 — split-view column IDs are never persisted.** `partialize` in `store.ts` (~line 3681) persists `splitViewActive` and `splitViewPosition` but **omits `splitViewLeftId` and `splitViewRightId`**. They are never written to localStorage, so after refresh they restore to their default `null` — permanently, not just during hydration. Split view re-opens (because `splitViewActive` *is* persisted) with two empty columns. **This causes finding #4.**
- **Cause 3 — temp-chat-ness is not knowable on the first frame.** `isTempChat` lives only in the store, so before hydration every chat looks identical. Round 2's Task 5 gated on `storeHydrated && (isTempChat || !activeChatId)`, which is always `false` on frame 1 — meaning the skeleton always shows, including for temp chats. **This causes finding #1.**

**Why Round 2's Tasks 4 and 5 could not have worked (read this — it prevents repeating the mistake):**
- **Task 4** added a `!storeHydrated` skeleton to split columns. But the columns aren't empty *because of hydration timing* — they're empty because the IDs were never saved. After hydration completes, the IDs are still `null`. A skeleton for the loading frame doesn't help when the data is permanently gone.
- **Task 5** gated the chat skeleton on `storeHydrated && isTempChat`. On frame 1, `storeHydrated` is `false`, so that expression is `false`, so `hasNothingToLoad` is `false`, so the skeleton shows — for temp chats too. The gate cannot see temp-ness during the exact frame it needs to.

**The invariant this plan enforces:** *any chrome that renders differently per-route must get its first-frame value from a cookie-backed prop, never from a store default.* Where that isn't possible (Cause 3), the honest answer is to accept a one-frame skeleton rather than add more gating that can't work.

**Tech Stack:** Next.js (App Router) + React, Zustand (`persist` middleware), Vitest (`environment: node`, no React renderer).

**IMPORTANT — read before touching anything:**

- This repo has unrelated work in progress. **Never run `git add -A` or `git add .`.** Each commit step lists exact files.
- Before every commit, run `git status` and confirm only that task's files are staged.
- If any "before" code block does not match the file exactly, STOP and report the mismatch instead of guessing.
- Do not fix anything not explicitly instructed. Report it instead.
- **Do not modify `src/hooks/useAppReady.ts`.** Its `useState(false)` initial value is deliberate SSR-safety (a previous change to it caused a crash). Nothing in this plan needs it changed.
- Do the tasks in order.

---

## File Structure

- Modify: `src/components/layout/Shell.tsx` — pass `initialEntityId` to `<Sidebar>` (Cause 1).
- Modify: `src/data/store.ts` — persist `splitViewLeftId`/`splitViewRightId` (Cause 2).
- Modify: `src/components/chat/ChatConversation.tsx` — remove the gate that cannot work; accept a one-frame skeleton (Cause 3).
- Modify: `src/components/layout/SplitViewLayout.tsx` — remove Round 2 Task 4's ineffective skeleton (cleanup, after Cause 2 is fixed).

---

### Task 1: Pass `initialEntityId` to Sidebar (fixes findings #2, #3, and #5 together)

**Files:**
- Modify: `src/components/layout/Shell.tsx`

**Background:** `Sidebar` already accepts an `initialEntityId` prop and already has all the logic to use it — it just never receives one. Everything needed for this fix already exists; this is a one-line wiring fix.

- [ ] **Step 1: Confirm the current line**

Run: `grep -n "<Sidebar" src/components/layout/Shell.tsx`

Expected: exactly one match, looking like:

```tsx
                <Sidebar forceFull={currentSidebarCollapsed && isTabsHeaderVisible} />
```

If there is more than one `<Sidebar` usage, or it already passes `initialEntityId`, STOP and report.

- [ ] **Step 2: Confirm `initialEntityId` is available in this component**

Run: `grep -n "initialEntityId" src/components/layout/Shell.tsx`

Expected: you should see it in the `Shell` function's props (something like `export function Shell({ children, initialEntityId }: ...)`), and used in the `<HeaderBar ... resolvedEntityId={...}>` lines. This confirms the value is already in scope — you're just forwarding it one more place.

If `initialEntityId` is NOT a prop of `Shell`, STOP and report.

- [ ] **Step 3: Pass the prop**

Replace:

```tsx
                <Sidebar forceFull={currentSidebarCollapsed && isTabsHeaderVisible} />
```

with:

```tsx
                <Sidebar forceFull={currentSidebarCollapsed && isTabsHeaderVisible} initialEntityId={initialEntityId} />
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `Shell.tsx` or `Sidebar.tsx`.

- [ ] **Step 5: Manual verification — this one fix should resolve three separate reports**

Run `npm run dev`. Then check all three:

1. **Nav slider (finding #2):** Go to the Chat page. Refresh. During the brief loading moment, the nav slider should show **Chat** as the selected tab — not Home. Repeat on the Tasks page (should show Tasks selected, not Home).
2. **Action buttons (finding #3):** On the Chat page, refresh — during loading, the sidebar's action buttons should be the chat ones ("New Chat" / "Temp Chat"), not "New Page"/"Dashboard". On the Tasks page, refresh — should show "New Task"/"All tasks".
3. **Sidebar skeleton (finding #5):** On the Chat page, refresh. You should see the **chat history skeleton immediately** — NOT the home/tree skeleton that then switches to chat history.

Report each of the three separately. If any still fails, STOP and report before continuing — the remaining tasks are independent, but this result tells the reviewer whether the cookie itself is correct.

- [ ] **Step 6: Commit**

```bash
git status
```
Confirm only `src/components/layout/Shell.tsx` is staged.

```bash
git add src/components/layout/Shell.tsx
git commit -m "fix(refresh): pass initialEntityId to Sidebar

Sidebar accepted this prop and had all the logic to use it, but Shell
never passed it — so inferredEntityId was always null on first paint,
making the nav slider show Home, the action buttons show the dashboard
set, and the sidebar render the home tree skeleton before switching to
the real page's skeleton. Fixes three reported findings at once."
```

---

### Task 2: Persist split-view column IDs (fixes finding #4)

**Files:**
- Modify: `src/data/store.ts`

**Background — why Round 2's Task 4 didn't work:** Round 2 added a loading skeleton to split-view columns, assuming they were empty only during hydration. They are not. `splitViewLeftId` and `splitViewRightId` are **missing from the `partialize` list**, which is the allowlist of what gets saved to localStorage. They are never saved, so after any refresh they restore to their default value of `null` — permanently. Meanwhile `splitViewActive` *is* persisted, so split view re-opens with two empty columns.

Note: these IDs *are* already included in the cloud `ui_state` sync (see `store.ts` ~line 2457), which confirms they're meant to survive a refresh — the localStorage omission is an inconsistency, not a deliberate choice.

- [ ] **Step 1: Confirm the current `partialize` block**

Run: `grep -n "splitViewActive: state.splitViewActive," src/data/store.ts`

You should get **two** matches. The one inside `partialize` is the one you want — it will be in a list of many `key: state.key,` lines near other UI settings like `sidebarWidth`, `taskPanelWidth`, `splitViewPosition`. (The other match is inside a cloud-sync `uiState` object — **do not touch that one**; it already includes the split IDs.)

Open the `partialize` one and confirm you see exactly this sequence:

```ts
        taskPanelWidth: state.taskPanelWidth,
        splitViewActive: state.splitViewActive,
        splitViewPosition: state.splitViewPosition,
```

If this exact sequence isn't there, STOP and report what you find.

- [ ] **Step 2: Add the two missing fields**

Replace:

```ts
        taskPanelWidth: state.taskPanelWidth,
        splitViewActive: state.splitViewActive,
        splitViewPosition: state.splitViewPosition,
```

with:

```ts
        taskPanelWidth: state.taskPanelWidth,
        splitViewActive: state.splitViewActive,
        // These two were missing from the persist allowlist while
        // splitViewActive was present — so split view would re-open after a
        // refresh with both columns empty (the ids restored to their null
        // default). They're already part of the cloud ui_state sync, so
        // persisting them locally too is consistent with that intent.
        splitViewLeftId: state.splitViewLeftId,
        splitViewRightId: state.splitViewRightId,
        splitViewPosition: state.splitViewPosition,
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `store.ts`.

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: all tests pass. Report the count.

- [ ] **Step 5: Manual verification**

**Important:** you must open split view *fresh after this change* — a split view opened before this fix has nothing saved for it yet.

Run `npm run dev`. Open split view with two different items (one in each column). Refresh.
Expected: both columns show their content again after refresh (not the "open something" placeholder, not blank).

Refresh a second time to confirm it persists repeatedly.

- [ ] **Step 6: Commit**

```bash
git status
```
Confirm only `src/data/store.ts` is staged.

```bash
git add src/data/store.ts
git commit -m "fix(refresh): persist splitViewLeftId/splitViewRightId

These were missing from partialize while splitViewActive was present,
so split view reopened after every refresh with both columns empty.
The ids are already part of the cloud ui_state sync — the localStorage
omission was an inconsistency, not intentional."
```

---

### Task 3: Remove the chat gate that cannot work, and accept a one-frame skeleton (finding #1)

**Files:**
- Modify: `src/components/chat/ChatConversation.tsx`

**Background — read this fully before editing, this file has regressed twice already:**

This file's skeleton logic has now been changed three times, each time fixing one case and breaking the other:
1. Round 1 Task 3: `hasNothingToLoad = isTempChat || !activeChatId` → suppressed the skeleton for *active* chats too, because `activeChatId` is `null` before hydration. Broke active chats.
2. Hotfix `53be2cc`: made the skeleton unconditional on `isLoading` → fixed active chats, re-broke temp chats.
3. Round 2 Task 5: `hasNothingToLoad = storeHydrated && (isTempChat || !activeChatId)` → on frame 1, `storeHydrated` is `false`, so this is `false`, so the skeleton shows for temp chats anyway. **Still broken** — this is the finding you're fixing now.

**The reason all three failed:** `isTempChat` lives only in the Zustand store. Before hydration, the store holds defaults — there is no way to know whether this is a temp chat during the exact frame where the decision matters. No arrangement of `storeHydrated`/`isTempChat`/`activeChatId` can fix this, because the information does not exist yet on the client.

**The honest fix:** stop trying. Once hydration completes (one frame later), `isTempChat` is correct and the skeleton correctly disappears for temp chats. The remaining artifact is a single frame of skeleton on a temp chat. That is the same one-frame cost every other page pays, and it is far better than the current state (a full skeleton that lingers for the whole load).

If a truly zero-frame fix is wanted for temp chats later, it requires putting temp-chat-ness into the cookie alongside the route — that is a larger change and is **explicitly not in this plan**. Do not attempt it.

- [ ] **Step 1: Confirm the current logic**

Run: `grep -n "hasNothingToLoad\|isMinLoading\|storeHydrated" src/components/chat/ChatConversation.tsx`

Expected to find something matching this shape:

```tsx
  const { storeHydrated } = useAppReady();
  const hasNothingToLoad = storeHydrated && (isTempChat || !activeChatId);
  const isMinLoading = !hasNothingToLoad && (!!isLoading || isChatMessagesLoading);
```

If the logic doesn't match this shape, STOP and report.

- [ ] **Step 2: Simplify to the honest version**

Replace:

```tsx
  const hasNothingToLoad = storeHydrated && (isTempChat || !activeChatId);
  const isMinLoading = !hasNothingToLoad && (!!isLoading || isChatMessagesLoading);
```

with:

```tsx
  // Temp-chat-ness only exists in the store, so on the first frame (before
  // hydration) we genuinely cannot know whether this is a temp chat — every
  // attempt to gate on it has failed for exactly this reason (see git history
  // for this file). So: show the skeleton while loading, and let it correctly
  // disappear one frame later once isTempChat is real. A temp chat therefore
  // shows at most one frame of skeleton, the same cost every other page pays.
  const hasNothingToLoad = isTempChat && !activeChatId;
  const isMinLoading = !hasNothingToLoad && (!!isLoading || isChatMessagesLoading);
```

- [ ] **Step 3: Remove the now-unused `useAppReady` if nothing else in this file uses it**

Run: `grep -n "storeHydrated\|useAppReady" src/components/chat/ChatConversation.tsx`

- If `storeHydrated` no longer appears anywhere except the `const { storeHydrated } = useAppReady();` line, delete that line **and** its `import { useAppReady } from '@/hooks/useAppReady';` import.
- If `storeHydrated` IS still used elsewhere in the file, leave both alone.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `ChatConversation.tsx`. In particular no "declared but never read" errors.

- [ ] **Step 5: Manual verification — BOTH cases must pass**

Case 1 — **active chat with real message history:** open it, refresh. The message skeleton should appear briefly, then real messages. The layout must not be broken/partial (no bottom bar floating with no title/messages).

Case 2 — **new/temp chat with zero messages:** open it, refresh. You should see **at most a single brief frame** of skeleton, then the empty-state greeting UI. The skeleton must NOT linger for the whole load.

If either case regresses while fixing the other, STOP and report — this exact trap has caught three previous attempts.

- [ ] **Step 6: Commit**

```bash
git status
```
Confirm only `src/components/chat/ChatConversation.tsx` is staged.

```bash
git add src/components/chat/ChatConversation.tsx
git commit -m "fix(refresh): stop gating chat skeleton on unknowable pre-hydration state

isTempChat only exists in the store, so it cannot be known on the first
frame — three previous attempts to gate on it failed for this reason.
Accept a one-frame skeleton for temp chats instead; it resolves
correctly as soon as the store hydrates."
```

---

### Task 4: Remove Round 2's ineffective split-column skeleton (cleanup)

**Files:**
- Modify: `src/components/layout/SplitViewLayout.tsx`

**Background:** Round 2 Task 4 added a `!storeHydrated` skeleton to both split columns, on the theory that the columns were empty due to hydration timing. Task 2 of this plan fixed the real cause (the IDs were never persisted). The skeleton is now redundant — with the IDs restored, `EntityPageRenderer` handles its own loading state for each column, exactly as it does in single-column mode.

Removing it keeps the two code paths consistent (split and single-column both delegate to `EntityPageRenderer`) rather than leaving a special case that no longer has a reason to exist.

- [ ] **Step 1: Confirm Task 2 is done and verified first**

Do not do this task until Task 2's Step 5 manual verification passed (split columns retain content after refresh). If Task 2 didn't work, STOP — this cleanup would remove the only thing masking the bug.

- [ ] **Step 2: Confirm current contents**

Run: `grep -n "storeHydrated" src/components/layout/SplitViewLayout.tsx`

Expected: a `const { storeHydrated } = useAppReady();` line, and two `!storeHydrated ?` conditionals (one per column).

If not found, STOP and report — Round 2's Task 4 may not have landed.

- [ ] **Step 3: Remove the left column's skeleton branch**

Find and replace this block:

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
```

with:

```tsx
        {splitViewLeftId ? (
```

- [ ] **Step 4: Remove the right column's skeleton branch**

Find the identical block for the right column (same skeleton JSX, but ending in `) : splitViewRightId ? (`) and replace it with:

```tsx
        {splitViewRightId ? (
```

- [ ] **Step 5: Remove the now-unused hook**

Run: `grep -n "storeHydrated\|useAppReady" src/components/layout/SplitViewLayout.tsx`

If `storeHydrated` no longer appears anywhere except its `const { storeHydrated } = useAppReady();` declaration, delete that line and the `import { useAppReady } from '@/hooks/useAppReady';` import.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `SplitViewLayout.tsx`, and no "declared but never read" errors.

- [ ] **Step 7: Manual verification**

Open split view with two items, refresh. Both columns should still restore their content (this is Task 2's fix doing the work now). Confirm nothing regressed versus what you saw in Task 2 Step 5.

- [ ] **Step 8: Commit**

```bash
git status
```
Confirm only `src/components/layout/SplitViewLayout.tsx` is staged.

```bash
git add src/components/layout/SplitViewLayout.tsx
git commit -m "refactor(refresh): remove split-column skeleton made redundant by persisting ids

Round 2 added this on the theory that columns were empty due to
hydration timing; the real cause was the ids never being persisted
(fixed separately). EntityPageRenderer already handles each column's
loading state, same as single-column mode."
```

---

### Task 5: Final verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all pass, 0 failed. Report the count.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. Report any pre-existing unrelated errors without fixing them.

- [ ] **Step 3: Verify all 5 reported findings in the running web app (`npm run dev`)**

Refresh several times for each and report what you observe:

1. **New/temp chat skeleton:** open a new/temp chat, refresh — at most one brief frame of skeleton, then the greeting UI. (A single frame is expected and acceptable; a lingering skeleton is a failure.)
2. **Nav slider:** on Chat page, refresh — slider shows Chat selected during loading, not Home. Repeat on Tasks.
3. **Sidebar action buttons:** on Chat page, refresh — "New Chat"/"Temp Chat" present during loading, not "New Page"/"Dashboard". Repeat on Tasks ("New Task"/"All tasks").
4. **Split columns:** open split view with two items, refresh — both columns keep their content. Refresh again to confirm.
5. **Sidebar skeleton on chat:** refresh from Chat — chat history skeleton appears immediately, no home-tree skeleton flashing first.

- [ ] **Step 4: Regression check on Round 1/Round 2 fixes**

Confirm these still work (they were verified previously; make sure this round didn't break them):
- Refresh on a note → note skeleton (title + content lines), not a blank page.
- Refresh on Kanban/Tasks → Kanban's own skeleton, not Dashboard's.
- Switch pages client-side, then refresh → correct page, not the previous one.

- [ ] **Step 5: Report**

Do **not** fix anything you find beyond this plan's tasks — report it instead; the reviewer wants to do final verification themselves. Include:
- Test count + tsc result.
- Pass/fail for each of Step 3's five checks and Step 4's three regression checks.
- Any step where a "before" block didn't match and you stopped.
