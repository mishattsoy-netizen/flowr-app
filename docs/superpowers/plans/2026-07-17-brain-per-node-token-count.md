# Brain Per-Node Token Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each brain node's real budget token cost as a pill on its canvas card, matching the brain-wide budget meter exactly.

**Architecture:** `compileBrainDocument` already computes each node's rendered token cost internally (via its `cost(id)` helper) but only returns the brain-wide total. Expose that per-node map as a new field on `CompiledBrain`, persist it in the existing `brain_compiles` cache row (so it survives cache hits without recompute), thread it through `listBrain` → the brain API GET → `useBrainData` → `BrainNodeCard`, and render it as a footer pill. This is the accurate number (the actual rendered+truncated cost the budget uses), not a raw content estimate.

**Tech Stack:** TypeScript, React, Next.js API routes, Supabase (Postgres), Vitest.

**Scope note:** This is the token-count half of the two deferred items in `docs/superpowers/specs/2026-07-17-brain-canvas-design.md` §5. The memory→entity migration (§9) is a separate plan (`2026-07-17-brain-memory-migration.md`) and is NOT touched here.

**Key facts established before writing this plan (do not re-derive):**
- `estimateTokens(text)` = `Math.ceil(text.length / 3.5)` (`src/lib/bot/context.ts:19-24`). The budget meter uses this; per-node pills must use the same path so they're consistent.
- `compileBrainDocument` (`src/lib/bot/services/brainCompiler.ts:50-115`) builds `rendered: Map<string,string>` (per-node rendered text) and `cost = (id) => estimateTokens(rendered.get(id) ?? '')` at lines 63-65. Only `renderable` nodes (not sections, not broken ref nodes) are in `rendered`.
- `compileBrain` (`src/lib/bot/services/brainStore.ts:203-228`) caches compile output in the `brain_compiles` Postgres table and returns the CACHED row on a version hit WITHOUT recomputing. So any new per-node data must be persisted in that table too, or a cache hit will lack it.
- `listBrain` (`src/lib/bot/services/brainStore.ts:424-450`) returns the object the canvas GET spreads; it already surfaces `budget: { used, limit, dropped, broken }`.
- The canvas GET (`src/app/api/ai/user-brain/route.ts:45-50`) returns `{ ...state, brains }`.
- `useBrainData` (`src/components/brain/canvas/useBrainData.ts`) types the response as `BrainCanvasState` and caches it per-brain in the Zustand store. **DO NOT modify the caching architecture in this file — only add a field to the type and pass it through.**
- `BrainNodeCard`'s display info is computed in `computeDisplayInfo` (`src/components/brain/canvas/BrainCanvasPage.tsx:21-61`) and rendered via the `NodeDisplayInfo` interface (`src/components/brain/canvas/BrainNodeCard.tsx:10-20`). The footer currently renders only a priority pill (`BrainNodeCard.tsx:182-189`).

---

### Task 1: Expose per-node token cost from the pure compiler

**Files:**
- Modify: `src/lib/bot/services/brainTypes.ts:76-81` (add field to `CompiledBrain`)
- Modify: `src/lib/bot/services/brainCompiler.ts:80,114` (return the map)
- Test: `src/lib/bot/services/brainCompiler.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/bot/services/brainCompiler.test.ts` inside the `describe('compileBrainDocument', ...)` block:

```typescript
  it('returns per-node token counts for rendered nodes', () => {
    const a = memory({ id: 'm1', content: 'likes espresso' })
    const b = memory({ id: 'm2', content: 'a much longer memory string that costs more tokens than the first one does' })
    const out = compileBrainDocument([a, b], [], cfg)
    expect(out.perNodeTokens.m1).toBeGreaterThan(0)
    expect(out.perNodeTokens.m2).toBeGreaterThan(out.perNodeTokens.m1)
  })

  it('omits sections and broken ref nodes from perNodeTokens', () => {
    const section = memory({ id: 's1', type: 'section', label: 'Profile', content: null })
    const broken = memory({ id: 'e1', type: 'entity', content: null, resolved: null })
    const ok = memory({ id: 'm1', content: 'kept' })
    const out = compileBrainDocument([section, broken, ok], [], cfg)
    expect(out.perNodeTokens.m1).toBeGreaterThan(0)
    expect(out.perNodeTokens.s1).toBeUndefined()
    expect(out.perNodeTokens.e1).toBeUndefined()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bot/services/brainCompiler.test.ts`
Expected: FAIL — `perNodeTokens` is undefined on the result (property does not exist).

- [ ] **Step 3: Add the field to the `CompiledBrain` type**

In `src/lib/bot/services/brainTypes.ts`, change the `CompiledBrain` interface (currently lines 76-81):

```typescript
export interface CompiledBrain {
  compiled: string          // '' when the brain is empty — no [BRAIN] block injected
  tokenCount: number
  droppedNodeIds: string[]  // enabled nodes excluded by the budget
  brokenNodeIds: string[]   // ref nodes whose entity is gone/unowned
  perNodeTokens: Record<string, number>  // rendered token cost per renderable node id (excludes sections + broken refs)
}
```

- [ ] **Step 4: Populate and return the map in the compiler**

In `src/lib/bot/services/brainCompiler.ts`, build the map from the existing `rendered`/`cost` machinery. Right after the loop that fills `rendered` (currently line 64), add:

```typescript
  const perNodeTokens: Record<string, number> = {}
  for (const n of renderable) perNodeTokens[n.id] = cost(n.id)
```

Then add `perNodeTokens` to BOTH return statements. The early empty-return (currently line 80):

```typescript
  if (kept.length === 0) return { compiled: '', tokenCount: 0, droppedNodeIds, brokenNodeIds, perNodeTokens }
```

And the final return (currently line 114):

```typescript
  return { compiled, tokenCount: estimateTokens(compiled), droppedNodeIds, brokenNodeIds, perNodeTokens }
```

Note: `perNodeTokens` covers ALL renderable nodes (including ones later dropped by the budget), so a dropped node's card can still show what it *would* cost. That's intentional and matches "how big is this node" semantics.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/bot/services/brainCompiler.test.ts`
Expected: PASS (all tests in the file, including the two new ones).

- [ ] **Step 6: Commit**

```bash
git add src/lib/bot/services/brainTypes.ts src/lib/bot/services/brainCompiler.ts src/lib/bot/services/brainCompiler.test.ts
git commit -m "feat(brain): expose per-node token cost from compiler"
```

---

### Task 2: Persist and rehydrate per-node tokens through the compile cache

**Files:**
- Modify: `src/lib/bot/services/brainStore.ts:203-228` (`compileBrain` — cache read + write)

**Why:** `compileBrain` returns the cached `brain_compiles` row on a version hit without recomputing. Add a `per_node_tokens` JSON column to that table so the map survives cache hits.

- [ ] **Step 1: Add the DB column (migration)**

This is a live-data change — run it against the Supabase database used by this project. In the Supabase SQL editor (or a migration file if the project uses them — check `supabase/migrations/` first), run:

```sql
ALTER TABLE brain_compiles
  ADD COLUMN IF NOT EXISTS per_node_tokens JSONB NOT NULL DEFAULT '{}'::jsonb;
```

Existing cached rows get `{}` — harmless: cards on those brains show no token pill until the next recompile (any node edit) repopulates it. Verify the column exists:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'brain_compiles' AND column_name = 'per_node_tokens';
```

Expected: one row returned.

- [ ] **Step 2: Read the column on cache hit**

In `src/lib/bot/services/brainStore.ts`, the cache-read select (currently line 207) and the cache-hit return (currently lines 210-213). Change the select to include the new column and the return to surface it:

```typescript
  const { data: cached } = await supabaseAdmin
    .from('brain_compiles').select('compiled, token_count, dropped_node_ids, broken_node_ids, per_node_tokens')
    .eq('user_id', userId).eq('version', version).maybeSingle()
  if (cached) {
    return {
      compiled: cached.compiled, tokenCount: cached.token_count, version,
      droppedNodeIds: cached.dropped_node_ids ?? [], brokenNodeIds: cached.broken_node_ids ?? [],
      perNodeTokens: cached.per_node_tokens ?? {},
    }
  }
```

- [ ] **Step 3: Write the column on cache miss**

In the same function, the upsert (currently lines 223-226). Add `per_node_tokens`:

```typescript
  await supabaseAdmin.from('brain_compiles').upsert({
    user_id: userId, version, compiled: result.compiled, token_count: result.tokenCount,
    dropped_node_ids: result.droppedNodeIds, broken_node_ids: result.brokenNodeIds,
    per_node_tokens: result.perNodeTokens,
  })
```

The early no-`supabaseAdmin` return (currently line 205) also needs the field for type-correctness:

```typescript
  if (!supabaseAdmin) return { compiled: '', tokenCount: 0, droppedNodeIds: [], brokenNodeIds: [], perNodeTokens: {}, version }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors in `brainStore.ts` (the `CompiledBrain` return shape now matches).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/services/brainStore.ts
git commit -m "feat(brain): persist per-node tokens in compile cache"
```

---

### Task 3: Surface per-node tokens in the brain API response

**Files:**
- Modify: `src/lib/bot/services/brainStore.ts:442-449` (`listBrain` return)

**Why:** `listBrain` already calls `compileBrain` (line 426) and returns the object the canvas GET spreads. Add the map to its return under `budget` sibling.

- [ ] **Step 1: Add `perNodeTokens` to `listBrain`'s return**

In `src/lib/bot/services/brainStore.ts`, the `listBrain` return (currently lines 442-449). `compiled` is already in scope (line 426). Add the field:

```typescript
  return {
    brainId, nodes, edges, deletedNodes, availableWorkspaces,
    compiledPreview: compiled.compiled,
    budget: {
      used: compiled.tokenCount, limit: cfg.token_limit,
      dropped: compiled.droppedNodeIds, broken: compiled.brokenNodeIds,
    },
    perNodeTokens: compiled.perNodeTokens,
  }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/services/brainStore.ts
git commit -m "feat(brain): return per-node tokens from listBrain"
```

---

### Task 4: Type the field in the canvas data hook

**Files:**
- Modify: `src/components/brain/canvas/useBrainData.ts:39-48` (`BrainCanvasState` interface)

**Why:** The canvas GET returns `{ ...state, brains }`; `useBrainData` types that as `BrainCanvasState`. Add the field so it flows through the store cache to consumers. **DO NOT touch the caching logic in this file** — only the interface.

- [ ] **Step 1: Add `perNodeTokens` to `BrainCanvasState`**

In `src/components/brain/canvas/useBrainData.ts`, the `BrainCanvasState` interface (currently lines 39-48). Add:

```typescript
export interface BrainCanvasState {
  brainId: string;
  nodes: BrainCanvasNode[];
  edges: BrainCanvasEdge[];
  compiledPreview: string;
  deletedNodes: BrainCanvasNode[];
  availableWorkspaces: { id: string; title: string }[];
  budget: { used: number; limit: number; dropped: string[]; broken: string[] };
  brains: BrainMeta[];
  perNodeTokens: Record<string, number>;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors. (The field is optional-in-practice — a cache-hit brain compiled before the column existed returns `{}`, which is a valid `Record<string, number>`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/brain/canvas/useBrainData.ts
git commit -m "feat(brain): type perNodeTokens in canvas state"
```

---

### Task 5: Render the token pill on the node card

**Files:**
- Modify: `src/components/brain/canvas/BrainNodeCard.tsx:10-20` (`NodeDisplayInfo` — add optional field)
- Modify: `src/components/brain/canvas/BrainNodeCard.tsx:182-189` (footer pills)
- Modify: `src/components/brain/canvas/BrainCanvasPage.tsx:21-61` (`computeDisplayInfo` signature + call site)

**Why:** The card renders from `NodeDisplayInfo`, built in `computeDisplayInfo`. Thread the per-node token number in and render it beside the priority pill.

- [ ] **Step 1: Add an optional `tokenCount` to `NodeDisplayInfo`**

In `src/components/brain/canvas/BrainNodeCard.tsx`, the `NodeDisplayInfo` interface (currently lines 10-20). Add:

```typescript
export interface NodeDisplayInfo {
  typeIcon: React.ReactNode;
  parentLabel: string;
  ageLabel: string;
  title: string;
  preview?: string;
  priority: number;
  typeLabel?: string;
  tokenCount?: number;  // budget token cost for this node; undefined for sections/broken refs
}
```

- [ ] **Step 2: Populate `tokenCount` in `computeDisplayInfo`**

In `src/components/brain/canvas/BrainCanvasPage.tsx`, `computeDisplayInfo` currently takes `(node, entities)`. Add a third parameter for the token map and set the field on both return objects.

Change the signature (currently line 21-24):

```typescript
function computeDisplayInfo(
  node: BrainCanvasNode,
  entities: Array<{ id: string; type: string; title?: string; parentId?: string | null; lastModified?: number }>,
  perNodeTokens: Record<string, number>,
): NodeDisplayInfo {
```

In the `section` early-return object (currently lines 26-34), add:

```typescript
      tokenCount: undefined,
```

In the final return object (currently lines 52-60), add:

```typescript
    tokenCount: perNodeTokens[node.id],
```

- [ ] **Step 3: Pass the map at the `computeDisplayInfo` call site**

In `src/components/brain/canvas/BrainCanvasPage.tsx`, the `nodeInfos` useMemo (currently lines 148-156) calls `computeDisplayInfo(node, entities)`. Change it to pass the map from state, and add the dependency:

```typescript
  const nodeInfos = useMemo(() => {
    if (!state) return new Map<string, NodeDisplayInfo>();
    const map = new Map<string, NodeDisplayInfo>();
    for (const node of state.nodes) {
      if (!node.enabled) continue;
      map.set(node.id, computeDisplayInfo(node, entities, state.perNodeTokens ?? {}));
    }
    return map;
  }, [state, entities]);
```

- [ ] **Step 4: Render the pill in the footer**

In `src/components/brain/canvas/BrainNodeCard.tsx`, the footer (currently lines 178-190) renders the priority pill. Add a token pill after it, inside the same footer `div`, right after the closing `</span>` of the priority pill:

```tsx
        {display.tokenCount != null && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-medium shrink-0 bg-[var(--bone-8)] text-[var(--bone-60)]">
            {display.tokenCount} tok
          </span>
        )}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Run the dev server, open the brain canvas. Expected: each memory/entity card shows a `N tok` pill next to its priority pill; section cards show no token pill. The sum of visible token pills for enabled, non-dropped nodes should approximately equal the budget meter's "used" figure (approximately, because the meter also counts the `[BRAIN]` wrapper, section headings, and connection lines, which aren't per-node).

- [ ] **Step 7: Commit**

```bash
git add src/components/brain/canvas/BrainNodeCard.tsx src/components/brain/canvas/BrainCanvasPage.tsx
git commit -m "feat(brain): show per-node token pill on canvas card"
```

---

## Self-Review

**Spec coverage (against `2026-07-17-brain-canvas-design.md` §5 "Per-node token count"):**
- "The token-count pill ships once that's computed/cached" → Tasks 1-2 compute (surface existing cost) + cache (persist in `brain_compiles`). ✓
- "until then the footer shows priority only" → Task 5 renders the token pill alongside the existing priority pill. ✓
- Accuracy requirement (owner chose "actual budget cost", not raw content estimate) → uses the compiler's real `cost(id)` = rendered+truncated `estimateTokens`, the same path the budget meter uses. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases" placeholders. Every code step shows the actual code. Test steps show actual assertions.

**Type consistency:** `perNodeTokens: Record<string, number>` is the identical name and shape across `CompiledBrain` (Task 1), `compileBrain` return (Task 2), `listBrain` return (Task 3), `BrainCanvasState` (Task 4), and the `computeDisplayInfo` param (Task 5). The card field is `tokenCount?: number` (Task 5) — deliberately named differently because it's a single node's value, not the map.

**One risk flagged for the implementer:** Task 2's migration adds a NOT NULL column with a default, so existing cached rows are valid but empty (`{}`). Those brains show no token pills until their next recompile (triggered by any node edit, since that changes the version key). If you want existing brains to show tokens immediately, delete their `brain_compiles` rows after the migration to force a fresh compile: `DELETE FROM brain_compiles;` (safe — it's a pure cache, rebuilt on next read). Confirm with the owner before running a global cache clear.
