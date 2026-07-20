# Brain Edit Latency — Optimization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every brain-canvas edit (create node, label, priority, tag, lifecycle) feels instant instead of the current 4–5s freeze.

**Architecture:** Two tiers. **Tier 1 (client orchestration)** removes the blocking, uncoalesced reloads that cause the perceived freeze — this is where 4–5s → instant happens. **Tier 2 (server round-trip reduction)** shrinks the *background* reconcile GET from ~1.5s by killing redundant `fetchBrainRows`/`getBrainConfigForUser` calls and the `resolveNodes` N+1 — improves first-load and brain-switch, and makes the background reconcile cheap.

**Measured baseline** (from `[brain-perf]` logs, remote Supabase, 10-node brain):
- One reload GET = **~1350–1500ms** (cache miss) / **~780ms** (cache hit).
- `compile.computeBrainVersion` = ~330ms, runs on **every** request (hit or miss).
- `compile.resolveNodes(10)` = ~260ms (N+1 on workspace nodes).
- `getBrainConfigForUser` called 4× (~150ms each, 2 queries each).
- `fetchBrainRows` called 3× per request.
- A mutation fires POST (~250ms) **+ one or more GETs**.

**Critical correctness constraint:** Do NOT "fix" the 100% cache-miss by removing `updated_at` from the version key. A content edit genuinely changes token counts and the compiled `[BRAIN]` block the chat pipeline reads — recompiling on write is *semantically required*. The fix is to move the recompile **off the blocking UI path**, never to serve a stale compile.

**Tech Stack:** React, `useBrainData` hook, Next.js API route, Supabase (remote), vitest.

**Files:**
- `src/components/brain/canvas/useBrainData.ts` — reconcile coalescing, optimistic add-node
- `src/components/brain/canvas/BrainCanvasPage.tsx` — make add_node optimistic; audit non-background mutations
- `src/lib/bot/services/brainStore.ts` — thread nodes/edges/cfg into compile; memoize config; batch resolveNodes
- `src/lib/bot/services/brainStore.compile.test.ts` — pure-ish test for threaded compile (create)

---

## Tier 1 — Client orchestration (do first; kills the 4–5s)

### Task 1: Coalesce background reconciles

Right now each optimistic mutation fires its own `load(brainId, { silent: true })`. Rapid edits (e.g. the tag picker autosaving per keystroke, or several pill changes) fire N overlapping ~1.5s GETs; the last few land after the user has moved on and overwrite state. Collapse them into one trailing reconcile.

**Files:** Modify `src/components/brain/canvas/useBrainData.ts`

- [ ] **Step 1: Add a coalesced silent-reload scheduler**

In `useBrainData`, add near the other refs:

```typescript
  const reconcileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReconcile = useCallback((brainId: string | null) => {
    if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
    reconcileTimer.current = setTimeout(() => {
      void load(brainId, { silent: true });
    }, 600); // one trailing reconcile after edits settle
  }, [load]);

  useEffect(() => () => {
    if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
  }, []);
```

- [ ] **Step 2: Use it in `mutate`'s background path**

Replace the `if (opts?.backgroundReload) { load(brainId, { silent: true }); }` branch:

```typescript
      if (opts?.backgroundReload) {
        scheduleReconcile(brainId);
      } else {
        await load(brainId);
      }
```

Add `scheduleReconcile` to `mutate`'s dependency array.

- [ ] **Step 3: Guard against clobbering a newer optimistic edit**

The silent GET replaces the whole `state`. If the user edited again while it was in flight, its `setState` would revert that edit for a frame. In `load`, the `requestIdRef` already guards stale *loads*, but not a load landing after a *local patch*. Add a monotonic local-edit counter: bump it in `patchLocalNode`/`patchLocalEdge`/`addLocalEdge`, capture it at the start of a silent `load`, and skip the `setState` if it changed:

```typescript
  const localEditSeq = useRef(0);
  // in each patch/add helper, after setState:
  localEditSeq.current++;
  // in load(), before the fetch (silent only):
  const editSeqAtStart = localEditSeq.current;
  // ...after res.json(), before setState, when opts?.silent:
  if (opts?.silent && localEditSeq.current !== editSeqAtStart) return; // a newer local edit supersedes
```

- [ ] **Step 4: Verify — no clobber, one reconcile**

Run the app with `[brain-perf]` still on. Change 3 pills quickly. Expected in the server log: **one** GET fires ~600ms after the last change, not three. In-app: each pill updates instantly and does not flicker back.

- [ ] **Step 5: Commit**

```bash
git add src/components/brain/canvas/useBrainData.ts
git commit -m "perf(brain): coalesce background reconciles into one trailing silent reload"
```

---

### Task 2: Make node creation optimistic

`add_node` (both `handleCreateNode` ~line 921 and `handleAddExisting` ~line 942) calls `mutate` with **no** `backgroundReload`, so it hits `setLoading(true)` → full-screen loader → blocking non-silent GET. This is the frozen "create new node." Add the node to local state immediately and reconcile in the background, mirroring `addLocalEdge`.

**Files:** Modify `src/components/brain/canvas/useBrainData.ts`, `src/components/brain/canvas/BrainCanvasPage.tsx`

- [ ] **Step 1: Add `addLocalNode` to the hook**

In `useBrainData.ts`, next to `addLocalEdge`:

```typescript
  const addLocalNode = useCallback((node: BrainCanvasNode) => {
    if (!state || !selectedBrainId) return;
    setState(selectedBrainId, { ...state, nodes: [...state.nodes, node] });
    localEditSeq.current++;
  }, [setState, state, selectedBrainId]);

  const removeLocalNode = useCallback((nodeId: string) => {
    if (!state || !selectedBrainId) return;
    setState(selectedBrainId, { ...state, nodes: state.nodes.filter(n => n.id !== nodeId) });
    localEditSeq.current++;
  }, [setState, state, selectedBrainId]);
```

Export both from the hook's return object.

- [ ] **Step 2: Make the POST return the created node**

Confirm `addBrainNode` returns the inserted row (read `brainStore.ts`). It returns `{ id }` — the client already knows the rest (`type`, `ref_id`, `position`, defaults). Build the optimistic node from what the caller has, use the returned `id` to reconcile. If `addBrainNode` returns only `{ id }`, that's enough; the background reconcile fills `perNodeTokens` etc.

- [ ] **Step 3: Rewrite `handleCreateNode` + `handleAddExisting` to be optimistic**

Pattern (apply to both, using each one's real `x`/`y`/`type`/`ref_id`):

```typescript
    const tempId = `temp-node-${Date.now()}`;
    addLocalNode({
      id: tempId, type, ref_id: refId, position: { x, y },
      content: null, label: null, section_id: null,
      priority: 0, pinned: false, enabled: true,
      created_by: 'user', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      tag_color: null, tag_name: null, active_from: null, active_until: null,
    });
    try {
      await mutate({ action: 'add_node', type, ref_id: refId, position: { x, y } }, { backgroundReload: true });
    } catch (e) {
      removeLocalNode(tempId);
      logger.error('Failed to add brain node:', e);
    }
```

(The trailing reconcile replaces the temp node with the real row — same temp-id lifecycle as `addLocalEdge`.)

- [ ] **Step 4: Verify**

Create a node. It appears instantly; no full-screen loader. ~600ms later the reconcile swaps in the real id (invisible). Server log shows one silent GET, not a blocking one.

- [ ] **Step 5: Commit**

```bash
git add src/components/brain/canvas/useBrainData.ts src/components/brain/canvas/BrainCanvasPage.tsx
git commit -m "perf(brain): optimistic node creation (no full-screen loader on add)"
```

---

### Task 3: Audit remaining non-background mutations

Every mutation that changes canvas state should be optimistic + background. From the grep, these still block (no `backgroundReload`): `remove_node` (332), workspace-desc (571, 580), position (726 — already fine, it's a drag commit), `move`/`set_workspace_description`, and the brain-meta ones (rename/set-default/icon at 206/219/230 — those legitimately need a full list refresh, leave them).

**Files:** Modify `src/components/brain/canvas/BrainCanvasPage.tsx`

- [ ] **Step 1: `remove_node` → optimistic**

`handleDeleteNode` (~332): call `removeLocalNode(nodeId)` first (Task 2's helper), then `mutate(..., { backgroundReload: true })`; on error, reconcile (`load`) to restore. Also close the details panel optimistically (already does).

- [ ] **Step 2: Leave brain-meta + workspace-description as blocking**

Rename / set-default / icon (206/219/230) change the brain *list* and are rare — a brief loader is acceptable; converting them is out of scope. Workspace-description save (571/580) is a popup Save button, not an inline edit — a spinner on Save is fine. Note this decision in the commit so it's not mistaken for an omission.

- [ ] **Step 3: Verify**

Delete a node → gone instantly, no loader. Rename a brain → brief loader is fine.

- [ ] **Step 4: Commit**

```bash
git add src/components/brain/canvas/BrainCanvasPage.tsx
git commit -m "perf(brain): optimistic node deletion; document which mutations stay blocking"
```

---

## Tier 2 — Server round-trip reduction (shrinks the background GET)

### Task 4: Thread already-fetched rows/config into `compileBrain`

`listBrain` fetches rows, then calls `compileBrain`, which calls `computeBrainVersion` (fetches rows + entities + config **again**) and then, on miss, `fetchBrainRows` + `getBrainConfigForUser` **again**. That's `fetchBrainRows`×3 and config×4 per request. Pass what's already in hand.

**Files:** Modify `src/lib/bot/services/brainStore.ts`

- [ ] **Step 1: Add optional preloaded params to `compileBrain` and `computeBrainVersion`**

```typescript
export async function computeBrainVersion(
  userId: string, brainId: string,
  preloaded?: { nodes: BrainNodeRow[]; edges: BrainEdgeRow[]; cfg: BrainConfigRow },
): Promise<string> {
  if (!supabaseAdmin) return 'none'
  const { nodes, edges } = preloaded ?? await fetchBrainRows(userId, brainId)
  // ...
  const cfg = preloaded?.cfg ?? await getBrainConfigForUser(userId)
  // ... rest unchanged (refStamp still needs its own entities query — keep it)
}

export async function compileBrain(
  userId: string, brainId: string,
  preloaded?: { nodes: BrainNodeRow[]; edges: BrainEdgeRow[]; cfg: BrainConfigRow },
): Promise<CompiledBrain & { version: string }> {
  const version = await computeBrainVersion(userId, brainId, preloaded)
  // ...cache lookup unchanged...
  // on MISS:
  const { nodes, edges } = preloaded ?? await fetchBrainRows(userId, brainId)
  const compileNodes = await resolveNodes(userId, nodes)
  const cfg = preloaded?.cfg ?? await getBrainConfigForUser(userId)
  // ...
}
```

- [ ] **Step 2: Pass preloaded data from `listBrain`**

```typescript
export async function listBrain(userId: string, brainId: string) {
  const { nodes, edges } = await fetchBrainRows(userId, brainId)
  const cfg = await getBrainConfigForUser(userId)
  const compiled = await compileBrain(userId, brainId, { nodes, edges, cfg })
  // remove the now-redundant standalone `getBrainConfigForUser` call below;
  // reuse `cfg` for budget.limit / perNodeCap.
}
```

Delete `listBrain`'s separate `const cfg = await getBrainConfigForUser(userId)` that came *after* compile — reuse the one fetched up front.

- [ ] **Step 3: Verify with the probes**

Reload. Expected: `compile.computeBrainVersion` drops sharply (no longer re-fetches rows+config — only the `refStamp` entities query remains), `compile.fetchBrainRows` and `compile.getConfig` on miss drop to ~0. `listBrain TOTAL` should fall from ~1350ms toward ~700–800ms on a miss.

Callers that pass no `preloaded` (chainRouter, recompile action) still work — the params are optional. Grep `compileBrain(` and `computeBrainVersion(` to confirm all call sites still compile.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/services/brainStore.ts
git commit -m "perf(brain): thread preloaded nodes/edges/cfg into compile — kill redundant fetches"
```

---

### Task 5: Batch the `resolveNodes` workspace N+1

`resolveNodes` (line ~192) runs 2 sequential queries **per workspace node** inside a loop (children + task count). Batch them across all workspace refs.

**Files:** Modify `src/lib/bot/services/brainStore.ts`

- [ ] **Step 1: Collect workspace entity ids, then two batched queries**

Before the loop, gather all resolved workspace entity ids. Replace the per-node `Promise.all([children, tasks])` with two `.in('parent_id', wsIds)` / grouped `.in('entity_id', wsIds)` queries run once, then look up per node from the grouped results. Children: `.select('parent_id, title').in('parent_id', wsIds).eq('owner_id', userId).eq('brain_only', false)` then group by `parent_id` (cap 11 per group in JS). Task counts: one grouped query, or `.select('entity_id').in('entity_id', wsIds)` and tally in JS.

- [ ] **Step 2: Verify**

`compile.resolveNodes` should drop from ~260ms toward ~80ms (one batched entity query + one batched task query, regardless of workspace count). Add a workspace node to the brain and confirm its child-count pill still renders correctly.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/services/brainStore.ts
git commit -m "perf(brain): batch resolveNodes workspace child/task queries (kill N+1)"
```

---

### Task 6: Memoize `getBrainConfigForUser` per request

After Task 4 the config is fetched once in `listBrain` and threaded through. Confirm no remaining duplicate call in a single request path; if the recompile action or another path still double-fetches, wrap config in a per-request cache (a `Map` keyed by userId passed through, or accept it's already down to 1 after Task 4 and skip). This is the smallest lever — do it only if the probes still show config being hit more than once.

**Files:** Modify `src/lib/bot/services/brainStore.ts` (only if needed)

- [ ] **Step 1: Re-check probes after Task 4** — if `getBrainConfigForUser` appears only once per request, mark this task done-by-Task-4 and move on.

- [ ] **Step 2 (if still duplicated): commit any dedup applied.**

---

## Task 7: Remove instrumentation, final measurement

**Files:** Modify `src/lib/bot/services/brainStore.ts`, `src/app/api/ai/user-brain/route.ts`

- [ ] **Step 1: Capture the final numbers first**

With all tiers in, reload + change a pill + create a node. Record the `[brain-perf]` lines. Target: background GET well under ~600ms; perceived edit latency instant (optimistic paint, no loader).

- [ ] **Step 2: Strip every `[brain-perf]` line and the `authedUserIdInner` wrapper**

Remove the timing wrappers added in commit `9ff68bc` and the `_mark` blocks. Restore `authedUserId` to its original single-function form.

- [ ] **Step 3: Verify clean**

Run: `git grep -n "brain-perf" src/` → expect no results. `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/services/brainStore.ts src/app/api/ai/user-brain/route.ts
git commit -m "chore(brain): remove [brain-perf] instrumentation after latency work"
```

---

## Verification (run after EACH task, not just typecheck)

**This latency has been wrongly declared fixed twice on typecheck alone. Typecheck is necessary but NEVER sufficient here.** Each task's verify step means:

1. `npx tsc --noEmit` clean, AND
2. Re-run the `[brain-perf]` logs in the browser and **diff the numbers** against the baseline in this plan, AND
3. Confirm in-app feel (edit paints instantly, no full-screen loader, no flicker-back).

**Success criteria:**
- Create node / label / priority / tag / lifecycle: instant optimistic paint, zero full-screen loader.
- Rapid edits fire **one** coalesced reconcile GET, not N.
- Background reconcile GET: **< ~600ms** (from ~1350ms), driven by Tier 2.

## Self-Review Notes
- **Tier 1 is the perceived-latency fix; Tier 2 makes the background cheap.** If short on time, Tier 1 alone gets edits to "instant"; Tier 2 is what stops the reconcile from being a heavy background cost and speeds first-load/brain-switch.
- **Correctness held:** recompile-on-write is preserved (required for chat pipeline); we only move it off the blocking path and stop redundantly recomputing it.
- **Coverage:** create (T2), delete (T3), label/priority/tag/lifecycle (already optimistic; T1 fixes their reconcile storm), edges (already optimistic; T1 coalesces). Brain-meta rename/default/icon deliberately left blocking (rare, needs list refresh).
