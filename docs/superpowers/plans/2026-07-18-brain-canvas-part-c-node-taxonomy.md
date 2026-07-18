# Brain Canvas Part C — Node Taxonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three node-taxonomy features to the brain canvas — Custom tags (color + reusable name, bot-visible via compiler grouping), Memory (brain-only) node type, and temporary lifecycle (start/end dates with read-time expiry) — plus the per-kind details-panel fields, workspace-description editing, and local-only exclusion from the add-node picker.

**Architecture:** Governed by two rules from the spec's §4C intro, repeated here because every task depends on them:

> **Two-row model:** A Note/Memory canvas node = a `brain_nodes` row (`type='entity'`) → `ref_id` → an `entities` row. `brain_only` lives on the **entity** (visibility). `tag_color`/`tag_name`/`active_from`/`active_until` live on the **brain_node**. Every create/delete/visibility op touches both rows.

> **New-column threading chain** (per new `brain_nodes` column): (1) migration → (2) `BrainNodeRow` type → (3) node-reading SELECT (`fetchBrainRows`) → (4) `UPDATABLE_NODE_FIELDS` if editable → (5) `CompileNode` type + its builder (`resolveNodes`, `brainStore.ts:187-191`) if the compiler reads it → (6) `compileBrainDocument`.

**Tech Stack:** Supabase migrations, TypeScript service layer, the pure `compileBrainDocument` compiler (vitest-tested), React panel fields, client sync layer.

**Spec:** `docs/superpowers/specs/2026-07-18-brain-canvas-details-design.md` §4C, §4.2A, §4.2B. **Depends on Part B** (extends `DetailsMode`'s `PART-C-FIELDS` insertion point).

---

## File Structure

- `supabase/migrations/20260718110000_brain_node_taxonomy.sql` — `brain_nodes.tag_color/tag_name/active_from/active_until` + `entities.brain_only` (create)
- `src/lib/bot/services/brainTypes.ts` — extend `BrainNodeRow` + `CompileNode` (modify)
- `src/lib/bot/services/brainStore.ts` — SELECT columns, `UPDATABLE_NODE_FIELDS`, `resolveNodes` builder, `listBrain` (tags in node data), Memory-delete path, entity-description write, distinct-tags query (modify)
- `src/lib/bot/services/brainCompiler.ts` — expiry drop predicate + named-tag grouping (modify)
- `src/lib/bot/services/brainCompiler.test.ts` — tests for expiry + grouping (modify)
- `src/app/api/ai/user-brain/route.ts` — Memory-delete, description-write, distinct-tags actions (modify)
- `src/lib/bot/tools/definitions.ts` + `handlers.ts` — `brain_only` on `create_content`, `active_from`/`active_until` on `add_node` (modify)
- `src/lib/loadFromSQLite.ts`, `src/lib/sync.ts`, `src/lib/canvasSync.ts` — carry `brain_only` into the client store (modify)
- `src/components/dashboard/Dashboard.tsx`, `src/components/folder/FolderView.tsx`, sidebar/tree — exclude `brain_only` (modify)
- `src/components/brain/canvas/AddExistingEntityPopover.tsx` — exclude local-only (modify)
- `src/components/brain/canvas/DetailsMode.tsx` — Type/Tag/Lifecycle rows + per-kind branching (modify)
- `src/components/brain/canvas/WorkspaceDescriptionPopup.tsx` — shared title+description popup (create)
- `src/components/brain/canvas/BrainNodeCard.tsx` — tag border + dead/temporary styles (modify)

---

## Task 1: Migration — taxonomy columns

**Files:**
- Create: `supabase/migrations/20260718110000_brain_node_taxonomy.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Brain node taxonomy (spec 2026-07-18-brain-canvas-details-design.md §4C).
-- Custom tag (color + optional name) and temporary lifecycle live on the
-- brain_node (they describe the canvas node). brain_only lives on the entity
-- (it describes the note's workspace visibility) — two-row model, §4C intro.
ALTER TABLE brain_nodes ADD COLUMN IF NOT EXISTS tag_color    text;
ALTER TABLE brain_nodes ADD COLUMN IF NOT EXISTS tag_name     text;
ALTER TABLE brain_nodes ADD COLUMN IF NOT EXISTS active_from  timestamptz;
ALTER TABLE brain_nodes ADD COLUMN IF NOT EXISTS active_until timestamptz;

ALTER TABLE entities ADD COLUMN IF NOT EXISTS brain_only boolean NOT NULL DEFAULT false;
-- Every workspace/unsorted list filters this out; index the common case.
CREATE INDEX IF NOT EXISTS idx_entities_not_brain_only
  ON entities(owner_id) WHERE brain_only = false;
```

- [ ] **Step 2: Apply + verify**

**No CLI** — apply by hand via Supabase Dashboard → SQL Editor (paste the file, execute), same as every migration in this repo (see `supabase/run_in_supabase_sql_editor.sql`). Ask the user to run it if you lack dashboard access.
Then verify columns exist (in the SQL Editor): `SELECT column_name FROM information_schema.columns WHERE table_name='brain_nodes' AND column_name IN ('tag_color','tag_name','active_from','active_until');` → 4 rows; and the same for `entities.brain_only`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260718110000_brain_node_taxonomy.sql
git commit -m "feat(brain): taxonomy migration — tag/lifecycle columns + entities.brain_only"
```

---

## Task 2: Thread new columns through types + read/write chain

**Files:**
- Modify: `src/lib/bot/services/brainTypes.ts` (`BrainNodeRow`, `CompileNode`)
- Modify: `src/lib/bot/services/brainStore.ts` (SELECT, `UPDATABLE_NODE_FIELDS`, `resolveNodes` builder)

- [ ] **Step 1: Extend `BrainNodeRow`**

In `brainTypes.ts`, add to `BrainNodeRow` (the interface with `priority`, `pinned`, `enabled`, `position`, etc.):

```typescript
  tag_color: string | null
  tag_name: string | null
  active_from: string | null
  active_until: string | null
```

- [ ] **Step 2: Extend `CompileNode`**

In `brainTypes.ts`, add to `CompileNode` (the compiler-ready shape):

```typescript
  tag_name: string | null       // named tag → grouping heading in the compiled block
  active_from: string | null
  active_until: string | null
```

(Only `tag_name` is needed by the compiler for grouping — `tag_color` is UI-only, so it's not on `CompileNode`.)

- [ ] **Step 3: Confirm the node SELECT carries the new columns**

`fetchBrainRows` (the function that reads `brain_nodes`) — check whether it uses `select('*')` or an explicit column list. Read it (grep `fetchBrainRows` in `brainStore.ts`). If `select('*')`, no change (new columns come automatically). If an explicit list, add `tag_color, tag_name, active_from, active_until`.

- [ ] **Step 4: Add editable fields to the whitelist**

In `brainStore.ts:378`, extend `UPDATABLE_NODE_FIELDS`:

```typescript
const UPDATABLE_NODE_FIELDS = ['content', 'label', 'section_id', 'priority', 'pinned', 'enabled', 'position', 'tag_color', 'tag_name', 'active_from', 'active_until'] as const
```

(This is what lets `updateBrainNode` accept tag/lifecycle edits from the panel — the mass-assignment guard iterates this exact list.)

- [ ] **Step 5: Pass new fields into the `CompileNode` builder**

In `resolveNodes` (`brainStore.ts:187-191`), the `out.push({...})` builds each `CompileNode`. Add:

```typescript
      tag_name: n.tag_name, active_from: n.active_from, active_until: n.active_until,
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: TS errors ONLY where `CompileNode` is constructed in tests (the `memory()` factory in `brainCompiler.test.ts` now misses required fields) — fixed in Task 3. No errors in `brainStore.ts` itself.

- [ ] **Step 7: Commit**

```bash
git add src/lib/bot/services/brainTypes.ts src/lib/bot/services/brainStore.ts
git commit -m "feat(brain): thread tag/lifecycle columns through types + read/update chain"
```

---

## Task 3: Compiler — read-time expiry drop

The pure-function seam. TDD here.

**Files:**
- Modify: `src/lib/bot/services/brainCompiler.test.ts`
- Modify: `src/lib/bot/services/brainCompiler.ts`

- [ ] **Step 1: Update the `memory()` test factory**

In `brainCompiler.test.ts`, the `memory()` factory (lines 7-12) now misses the new `CompileNode` fields. Add defaults:

```typescript
  resolved: null, tag_name: null, active_from: null, active_until: null, ...over,
```

- [ ] **Step 2: Write the failing expiry tests**

Add to `brainCompiler.test.ts`:

```typescript
describe('temporary lifecycle', () => {
  const NOW = new Date('2026-07-18T12:00:00Z')

  it('drops a node whose active_until is in the past (dead)', () => {
    const dead = memory({ id: 'd1', content: 'expired fact', active_until: '2026-07-01T00:00:00Z' })
    const out = compileBrainDocument([dead], [], cfg, NOW)
    expect(out.compiled).toBe('')
    expect(out.expiredNodeIds).toEqual(['d1'])
  })

  it('drops a scheduled node whose active_from is in the future', () => {
    const future = memory({ id: 'f1', content: 'not yet', active_from: '2026-08-01T00:00:00Z' })
    const out = compileBrainDocument([future], [], cfg, NOW)
    expect(out.compiled).toBe('')
    expect(out.expiredNodeIds).toEqual(['f1'])
  })

  it('keeps an active temporary node (now within window)', () => {
    const active = memory({ id: 'a1', content: 'trip fact', active_from: '2026-07-10T00:00:00Z', active_until: '2026-07-25T00:00:00Z' })
    const out = compileBrainDocument([active], [], cfg, NOW)
    expect(out.compiled).toContain('- trip fact')
    expect(out.expiredNodeIds).toEqual([])
  })

  it('keeps a permanent node (no active_until)', () => {
    const perm = memory({ id: 'p1', content: 'always', active_until: null })
    const out = compileBrainDocument([perm], [], cfg, NOW)
    expect(out.compiled).toContain('- always')
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/bot/services/brainCompiler.test.ts`
Expected: FAIL — `compileBrainDocument` takes 3 args / `expiredNodeIds` undefined.

- [ ] **Step 4: Implement expiry in the compiler**

In `brainCompiler.ts`, `compileBrainDocument` (line 50): add an optional `now` param (default `new Date()`), compute expired nodes among `enabled`, exclude them from `renderable`, and return `expiredNodeIds`.

```typescript
export function compileBrainDocument(
  nodes: CompileNode[],
  edges: CompileEdge[],
  config: BrainConfigRow,
  now: Date = new Date()
): CompiledBrain {
  const enabled = nodes.filter(n => n.enabled)
  const nowMs = now.getTime()
  const isInactive = (n: CompileNode): boolean => {
    if (n.active_from && Date.parse(n.active_from) > nowMs) return true       // scheduled
    if (n.active_until && Date.parse(n.active_until) < nowMs) return true      // dead
    return false
  }
  const expiredNodeIds = enabled.filter(isInactive).map(n => n.id)
  const active = enabled.filter(n => !isInactive(n))
  const brokenNodeIds = active
    .filter(n => (n.type === 'workspace' || n.type === 'entity') && !n.resolved)
    .map(n => n.id)
  const sections = active.filter(n => n.type === 'section')
  const renderable = active.filter(n =>
    n.type !== 'section' && !brokenNodeIds.includes(n.id))
  // ... rest unchanged (rendered map, budget drop, grouping) ...
```

Add `expiredNodeIds` to the returned object in every `return` of this function (the empty-brain early return and the final return). Add `expiredNodeIds: string[]` to the `CompiledBrain` interface in `brainTypes.ts`.

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/lib/bot/services/brainCompiler.test.ts`
Expected: PASS (all, including pre-existing tests — the added `now` param defaults, so old 3-arg calls still compile).

- [ ] **Step 6: Thread `expiredNodeIds` out through compile/cache/list**

Two separate concerns: the CLIENT needs the dead/scheduled set for dimming; the AI CACHE must not serve a dead node as alive.

- **`CompiledBrain.expiredNodeIds` is OPTIONAL, not required.** `compileBrain` constructs `CompiledBrain`-shaped objects at three return sites: the fresh-compile return (line 248, spreads `result` — carries it), the cache-hit branch (`brainStore.ts:229-233`), and the `!supabaseAdmin` early return (222). Making the field required breaks the latter two. Declare `expiredNodeIds?: string[]` on the interface; the cache path simply omits it. The client gets expiry from `listBrain` (below), not from the cache.
- **Client set — computed fresh in `listBrain`:** add `expiredNodeIds: nodes.filter(isInactiveRow(new Date())).map(n => n.id)` to `listBrain`'s return, using a small local helper mirroring the compiler's `isInactive` predicate (scheduled OR past `active_until`). Independent of the cache — the canvas dims from live node data, always current.
- **Cache correctness — event-time boundary in the version key (NOT a day-bucket).** A node expiring by clock alone changes compiled output with no node edit, so the version key must change exactly when the active set changes. A coarse day-bucket has up to ~24h latency (a node dies at 2pm but the AI keeps receiving it until UTC midnight — and session pinning holds the stale version for the whole conversation). Instead, in `computeBrainVersion` (`brainStore.ts:202`, which already fetches `nodes`), compute the next lifecycle boundary and fold it into the key:

```typescript
  // Next moment the active-node set changes (any future active_from/active_until).
  // Folding it into the version key makes the compile cache invalidate exactly
  // when a node crosses into/out of its window — no daily latency, and a node
  // that dies mid-day busts the cache on the next request, not next midnight.
  const now = Date.now()
  const boundaries = nodes
    .flatMap(n => [n.active_from, n.active_until])
    .filter((t): t is string => !!t)
    .map(t => Date.parse(t))
    .filter(ms => ms > now)
  const nextBoundary = boundaries.length ? Math.min(...boundaries) : 0
```

Append `nextBoundary` to the existing `brainVersionKey([brainId, nodes.length, ...])` input array. Brains with no temporary nodes get `nextBoundary = 0` — their key is unchanged, so no needless cache churn. When `now` passes `nextBoundary`, that timestamp is no longer `> now`, the min recomputes to the next boundary (or 0), the key changes, and the next request recompiles with the dead node dropped.
- **Session pinning caveat (document, don't fix):** a session pins one compiled version for its lifetime (prompt-cache stability). A node dying mid-conversation stays in that session's context until its next turn recompiles/repins — acceptable and consistent with the existing pinning contract. New turns/sessions pick up the boundary-busted version. No change needed; noted so it isn't mistaken for a bug later.

- [ ] **Step 7: Typecheck + full compiler test run**

Run: `npx tsc --noEmit && npx vitest run src/lib/bot/services/brainCompiler.test.ts`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add src/lib/bot/services/brainCompiler.ts src/lib/bot/services/brainCompiler.test.ts src/lib/bot/services/brainTypes.ts src/lib/bot/services/brainStore.ts
git commit -m "feat(brain): read-time temporary-node expiry in the compiler + client expired set"
```

---

## Task 4: Compiler — named-tag grouping

**Files:**
- Modify: `src/lib/bot/services/brainCompiler.test.ts`
- Modify: `src/lib/bot/services/brainCompiler.ts`

- [ ] **Step 1: Write the failing grouping tests**

```typescript
describe('named-tag grouping', () => {
  it('groups named-tag nodes under a [tag] heading', () => {
    const a = memory({ id: 'a', content: 'entry rules', tag_name: 'Trading' })
    const b = memory({ id: 'b', content: 'exit rules', tag_name: 'Trading' })
    const out = compileBrainDocument([a, b], [], cfg)
    expect(out.compiled).toContain('[Trading]')
    expect(out.compiled.indexOf('- entry rules')).toBeGreaterThan(out.compiled.indexOf('[Trading]'))
  })

  it('leaves untagged and color-only nodes ungrouped (no heading, no extra tokens)', () => {
    const untagged = memory({ id: 'u', content: 'loose fact', tag_name: null })
    const out = compileBrainDocument([untagged], [], cfg)
    expect(out.compiled).not.toContain('[')  // no tag heading bracket
    expect(out.compiled).toContain('- loose fact')
  })

  it('does not let grouping remove a cross-group edge from the block', () => {
    const a = memory({ id: 'a', content: 'A', tag_name: 'X' })
    const b = memory({ id: 'b', content: 'B', tag_name: 'Y' })
    const edges = [{ from_node: 'a', to_node: 'b', label: 'relates to' }]
    const out = compileBrainDocument([a, b], edges, cfg)
    expect(out.compiled).toContain('relates to')  // edge survives cross-group
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/bot/services/brainCompiler.test.ts -t "named-tag grouping"`
Expected: FAIL.

- [ ] **Step 3: Implement grouping**

In `brainCompiler.ts`, in the grouping phase (the section that currently emits `## section` headings and an `## Unsorted` group, ~lines 86-110), add a tag-grouping layer **for nodes that have `tag_name` set**: emit a `[tagName]` heading before that tag's nodes. Rules (spec §4C.1): only `tag_name != null` groups; color-only/untagged render as today; **edges are compiled from the `edges` array independently** — do not gate edge rendering on grouping (verify the existing edge-rendering code path is untouched by this change). Keep the budget-drop policy unchanged; emit a tag heading only if ≥1 of its nodes survived the budget cut.

- [ ] **Step 4: Run to verify pass + full suite**

Run: `npx vitest run src/lib/bot/services/brainCompiler.test.ts`
Expected: PASS (new + all existing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/services/brainCompiler.ts src/lib/bot/services/brainCompiler.test.ts
git commit -m "feat(brain): named-tag grouping in compiled block (edges cross groups freely)"
```

---

## Task 5: `brain_only` — sync layer + client store

The highest-bug-risk change (§4C.2 blast radius). Do the sync/store threading first, then the filters (Task 6), so the filters have data to filter on.

**Files:**
- Modify: `src/lib/loadFromSQLite.ts`, `src/lib/sync.ts`, `src/lib/canvasSync.ts`

- [ ] **Step 1: Grep the entity shape in the client store**

Run: `git grep -n "brain_only\|syncMode\|last_modified" src/lib/sync.ts src/lib/loadFromSQLite.ts src/data/store*` and read how an entity row is shaped in the client store (find the type/interface for a stored entity).

- [ ] **Step 2: Carry `brain_only` into the store**

Add `brain_only?: boolean` to the client entity type. In `sync.ts` (the `select('*')` from `entities` at ~line 258/316 already pulls the column since Task 1 added it) confirm it flows into the store mapping; if any mapping explicitly lists columns, add `brain_only`. Do the same for `loadFromSQLite.ts` (desktop local load) and `canvasSync.ts` if it mirrors entity rows.

- [ ] **Step 3: Verify data presence**

Add a temporary log in a view after sync: confirm entities now carry `brain_only` (false for all existing). Remove the log.

- [ ] **Step 4: Commit**

```bash
git add src/lib/loadFromSQLite.ts src/lib/sync.ts src/lib/canvasSync.ts
git commit -m "feat(brain): carry entities.brain_only into the client store/sync layer"
```

---

## Task 6: `brain_only` — exclude from every view

**Files:**
- Modify: `src/components/dashboard/Dashboard.tsx`, `src/components/folder/FolderView.tsx`, sidebar/workspace tree, and the bot `list_content` path

- [ ] **Step 1: Enumerate the filter sites (checklist)**

Run: `git grep -n "type === 'note'\|type === 'workspace'\|\.filter(" src/components/dashboard/Dashboard.tsx src/components/folder/FolderView.tsx src/components/layout/Sidebar.tsx src/components/brain/canvas/BrainSidebarContent.tsx`
Confirm each place that renders a list of entities in a workspace/unsorted context.

- [ ] **Step 2: Add the exclusion filter at each site**

At every workspace/unsorted list render, add `.filter(e => !e.brain_only)`. The **brain canvas** and **BrainSidebarContent** must NOT filter it out (Memory nodes still show on the canvas — that's the whole point). Only workspace/unsorted/dashboard/folder views exclude it.

- [ ] **Step 3: Exclude from bot `list_content`**

In `handlers.ts`, the `list_content` action reads entities via `supabaseAdmin.from('entities')`. Add `.eq('brain_only', false)` to that query so the bot never surfaces Memory notes as workspace content. (Grep `list_content` in `handlers.ts` for the exact query.)

- [ ] **Step 3b: Exclude Memory notes from the compiler's workspace child count**

`resolveNodes` (`brainStore.ts:178`) counts a workspace's children with `.eq('parent_id', ent.id)` and no `brain_only` filter. A note that became a Memory keeps its `parent_id`, so it would inflate that workspace's `noteCount`/`childTitles` in the compiled block. Add `.eq('brain_only', false)` to that children query (line 178) so a Memory note never counts toward or appears in its former workspace's brain-block summary. This is the one server-side compiler site the blast-radius checklist must also cover.

- [ ] **Step 4: Verify no leak**

Manually: create a note, set an entity's `brain_only=true` via SQL, reload. It must vanish from dashboard/folder/sidebar/unsorted AND not appear in an AI `list_content` result, but still be reachable on the brain canvas.

Run the checklist grep once more to confirm no workspace-list site was missed:
`git grep -n "brain_only" src/components/ src/lib/`

- [ ] **Step 5: Commit**

```bash
git add src/components/ src/lib/bot/tools/handlers.ts
git commit -m "feat(brain): exclude brain_only entities from all workspace/unsorted/bot views"
```

---

## Task 7: Details panel — Type / Custom tag / Lifecycle rows + per-kind branching

**Files:**
- Modify: `src/components/brain/canvas/DetailsMode.tsx` (the `PART-C-FIELDS` insertion point from Part B)

- [ ] **Step 1: Add the three field rows for Note/Memory nodes**

At the `{/* PART-C-FIELDS */}` marker, add:
- **Type** pill (Note/Memory): toggles the entity's `brain_only` via a new `set_brain_only` action (Task 9). Note→Memory and back. Deleting a Memory needs the confirm path (Task 8).
- **Custom tag**: swatch (dot in `tag_color` + `tag_name` if set). Click → reusable tag picker: a dropdown of the user's distinct `(tag_color, tag_name)` combos (fetched via a `brain_tags` action, Task 9) + a "new tag" affordance. Commits both fields via `update_node`.
- **Lifecycle**: always visible, shows "Permanent" by default. Click → the **same calendar popup used in the tasks panel** (locate it: `git grep -n "DatePicker\|calendar\|dueDate" src/components/`), optional start + required end. Commits `active_from`/`active_until` via `update_node`. Clearing end → back to Permanent.

- [ ] **Step 2: Per-kind branching (§4.2A)**

Branch `DetailsMode` on the focused node's `type`:
- **workspace**: show Priority, Custom tag, Lifecycle, and a **Description** preview (faded) — NO Type row, NO Workspace-reassign row. Header usage bar = `descriptionChars / 500` (not perNodeCap). "Open editor" → opens `WorkspaceDescriptionPopup` (Task 8).
- **section**: only the editable title, no field rows.
- **entity** (Note/Memory): the full set from Step 1 + Part B's Priority/Workspace.

- [ ] **Step 3: Typecheck + visual check**

Run: `npx tsc --noEmit`, then in-app: focus a note (all rows), a workspace (description + no Type/reassign), a section (title only). Toggle Type, set a tag, set a temporary window.

- [ ] **Step 4: Commit**

```bash
git add src/components/brain/canvas/DetailsMode.tsx
git commit -m "feat(brain): details panel Type/Tag/Lifecycle rows + per-kind field branching"
```

---

## Task 8: Workspace description popup + Memory-delete confirm

**Files:**
- Create: `src/components/brain/canvas/WorkspaceDescriptionPopup.tsx`
- Modify: the workspace page header (grep to locate the sync-mode picker + "+" button) — add the description button
- Modify: `src/components/brain/canvas/BrainCanvasPage.tsx` or the delete flow — Memory-delete confirmation

- [ ] **Step 1: Build the shared popup**

`WorkspaceDescriptionPopup.tsx`: props `{ workspaceId, initialTitle, initialDescription, onSave, onCancel }`. Renders a title input, a description textarea, an `x / 500` character counter (block input past 500), Save/Cancel. `onSave` calls a new `set_workspace_description` action (Task 9) writing `entities.title` + `entities.description`.

- [ ] **Step 2: Add the header entry point**

Find the workspace page header (sync-mode picker + "+" button). Add a description button next to them that opens `WorkspaceDescriptionPopup` for the current workspace.

- [ ] **Step 3: Wire the details-panel entry point**

In `DetailsMode` (workspace branch, Task 7 step 2), "Open editor" opens the **same** `WorkspaceDescriptionPopup` — one shared component, both entry points.

- [ ] **Step 4: Memory-delete confirmation**

In the node-delete flow (context menu / panel), branch on whether the focused/target node is a Memory (its entity's `brain_only === true`):
- Note → existing `remove_node` (soft-delete brain_node only). Unchanged.
- Memory → show a confirm dialog ("This memory is only in your brain — deleting it is permanent."). On confirm, call a new `delete_memory_node` action (Task 9) that soft-deletes the brain_node AND deletes the entity.

- [ ] **Step 5: Typecheck + verify**

Run: `npx tsc --noEmit`. In-app: edit a workspace description from the header and from the panel (same popup, 500-char counter works); delete a Note (survives in workspace) vs a Memory (confirm dialog, gone everywhere).

- [ ] **Step 6: Commit**

```bash
git add src/components/brain/canvas/WorkspaceDescriptionPopup.tsx src/components/brain/canvas/BrainCanvasPage.tsx <workspace header file>
git commit -m "feat(brain): workspace description popup + permanent Memory-delete confirm"
```

---

## Task 9: Backend actions — brain_only toggle, tags, description, memory-delete

**Files:**
- Modify: `src/lib/bot/services/brainStore.ts` (new functions)
- Modify: `src/app/api/ai/user-brain/route.ts` (new actions)

- [ ] **Step 1: Add service functions**

```typescript
// Toggle an entity's brain_only (Note <-> Memory).
export async function setEntityBrainOnly(userId: string, entityId: string, brainOnly: boolean): Promise<{ success: true } | { error: string }> {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  const { data, error } = await supabaseAdmin.from('entities')
    .update({ brain_only: brainOnly }).eq('id', entityId).eq('owner_id', userId).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: `Entity '${entityId}' not found.` }
  return { success: true }
}

// Distinct (color,name) tag combos across the user's brain nodes, for the picker.
export async function getBrainTags(userId: string): Promise<{ tag_color: string; tag_name: string | null }[]> {
  if (!supabaseAdmin) return []
  const { data } = await supabaseAdmin.from('brain_nodes')
    .select('tag_color, tag_name').eq('user_id', userId).is('deleted_at', null).not('tag_color', 'is', null)
  const seen = new Map<string, { tag_color: string; tag_name: string | null }>()
  for (const r of (data ?? []) as any[]) {
    const key = `${r.tag_color}|${r.tag_name ?? ''}`
    if (!seen.has(key)) seen.set(key, { tag_color: r.tag_color, tag_name: r.tag_name ?? null })
  }
  return [...seen.values()]
}

// Workspace title + description (entities.description had no write path before).
export async function setWorkspaceDescription(userId: string, entityId: string, title: string, description: string): Promise<{ success: true } | { error: string }> {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  const desc = (description ?? '').slice(0, 500)
  const { data, error } = await supabaseAdmin.from('entities')
    .update({ title, description: desc }).eq('id', entityId).eq('owner_id', userId).eq('type', 'workspace').select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: `Workspace '${entityId}' not found.` }
  return { success: true }
}

// Permanent Memory delete: soft-delete the brain_node AND delete the entity.
export async function deleteMemoryNode(userId: string, brainId: string, nodeId: string, entityId: string): Promise<{ success: true } | { error: string }> {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  const rem = await removeBrainNodes(userId, 'user', brainId, [nodeId])
  if ('error' in rem) return rem
  const { error } = await supabaseAdmin.from('entities').delete().eq('id', entityId).eq('owner_id', userId).eq('brain_only', true)
  if (error) return { error: error.message }
  return { success: true }
}
```

(`deleteMemoryNode` guards `.eq('brain_only', true)` so it can never hard-delete a normal workspace-visible note even if mis-called.)

- [ ] **Step 2: Add the API actions**

In `route.ts`, import the four functions and add cases:

```typescript
      case 'set_brain_only':
        return NextResponse.json(await setEntityBrainOnly(userId, body.entity_id, body.brain_only))
      case 'brain_tags':
        return NextResponse.json(await getBrainTags(userId))
      case 'set_workspace_description':
        return NextResponse.json(await setWorkspaceDescription(userId, body.entity_id, body.title, body.description))
      case 'delete_memory_node':
        return NextResponse.json(await deleteMemoryNode(userId, body.brain_id, body.node_id, body.entity_id))
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/services/brainStore.ts src/app/api/ai/user-brain/route.ts
git commit -m "feat(brain): actions for brain_only toggle, tags, ws description, memory-delete"
```

---

## Task 10: Bot tools — brain_only on create_content, lifecycle on add_node

**Files:**
- Modify: `src/lib/bot/tools/definitions.ts`, `src/lib/bot/tools/handlers.ts`

- [ ] **Step 1: Add `brain_only` to `create_content`**

In `definitions.ts` `create_content` (line 38), add a note-field param:

```typescript
        brain_only: { type: "boolean", description: "For notes: if true, the note is a brain-only Memory — visible only in the brain canvas, hidden from all workspaces and Unsorted. Use for things the user wants remembered but not filed as a normal note (e.g. temporary context)." },
```

In `handlers.ts` `create_content` note branch (the `entities.insert` at ~line 281/306), set `brain_only: args.brain_only === true`.

- [ ] **Step 2: Add `active_from`/`active_until` to `add_node`**

In `definitions.ts` the `add_node`/`manage_brain` tool params (near line 267), add:

```typescript
        active_from: { type: "string", description: "For add_node: ISO date/time this node becomes active in the brain. Optional; omit for immediately active." },
        active_until: { type: "string", description: "For add_node: ISO date/time this node stops being fed into the brain (becomes a dimmed 'dead' node on the canvas). Set this to make the node temporary." },
```

In `handlers.ts` the `add_node` path (whatever calls `addBrainNode`), pass `active_from`/`active_until` through to the insert. Confirm `addBrainNode` accepts them (it inserts a `brain_nodes` row — add the two fields to its insert payload if not covered by a spread).

- [ ] **Step 3: Update the tool prompt text if present**

If `src/lib/bot/prompts/tools.txt` documents the create→add_node flow, add a line noting the Japan-trip pattern (create_content with brain_only, then add_node with active_until). Grep: `git grep -n "add_node\|create_content" src/lib/bot/prompts/`.

- [ ] **Step 4: Typecheck + a manual bot check**

Run: `npx tsc --noEmit`. Then in the assistant, ask "remember I'm in Japan until July 25, but don't file it as a note" and confirm the bot creates a brain_only + temporary node (visible on canvas, absent from unsorted).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/tools/definitions.ts src/lib/bot/tools/handlers.ts src/lib/bot/prompts/tools.txt
git commit -m "feat(brain): bot can create brain_only + temporary notes (create_content + add_node params)"
```

---

## Task 11: Local-only exclusion from add-node picker

**Files:**
- Modify: `src/components/brain/canvas/AddExistingEntityPopover.tsx`

- [ ] **Step 1: Add the filter link**

In the `candidates` `useMemo` filter chain (lines 27-31), add:

```typescript
      .filter(e => e.syncMode !== 'local-only')
```

- [ ] **Step 2: Verify**

Confirm `e.syncMode` is the actual field name on the store entity (grep `syncMode` in the store type; if it's `sync_mode` or nested, match it). In-app on desktop: a local-only note no longer appears in the "add existing entity" picker.

- [ ] **Step 3: Commit**

```bash
git add src/components/brain/canvas/AddExistingEntityPopover.tsx
git commit -m "feat(brain): exclude local-only notes from the add-node picker"
```

---

## Task 12: Canvas card styles — tag border, temporary, dead

**Files:**
- Modify: `src/components/brain/canvas/BrainNodeCard.tsx`

- [ ] **Step 1: Tag border (§4C.1 / §3.7)**

When a node has `tag_color` set and is NOT selected/highlighted, its idle border uses `tag_color` instead of `--bone-10`. Selected/highlighted still overrides to the accent ring (read the existing border logic — the `--bone-10` vs `--accent` switch — and add the tag branch between them: selection wins > tag color > default).

- [ ] **Step 2: Dead + temporary styles (§4C.3)**

Using the client `expiredNodeIds` set (from `listBrain`, Task 3 step 6) threaded into card props:
- **Dead** (in `expiredNodeIds` because past `active_until`): dimmed / monochrome, static (no shimmer).
- **Active temporary** (has `active_until` in the future): a subtle temporary marker (e.g. a small clock/countdown badge).
- **Scheduled** (has `active_from` in the future): a distinct "pending" style.

Distinguish dead vs scheduled by comparing `active_from`/`active_until` to now in the card (both are in `expiredNodeIds` but their styling differs). Keep it minimal — dimmed-monochrome for dead is the one firm commitment; the others can be a small badge.

- [ ] **Step 3: Verify**

In-app: tag a node (border color changes), set a past `active_until` (node dims), a future window (badge), a future start (pending style).

- [ ] **Step 4: Commit**

```bash
git add src/components/brain/canvas/BrainNodeCard.tsx
git commit -m "feat(brain): canvas card styles for tag border, temporary, and dead nodes"
```

---

## Self-Review Notes (Part C)

- **Spec coverage:** §4C.1 tags (Tasks 1,2,4,7,9,12), §4C.2 Memory type + blast radius (Tasks 1,5,6,7,8,9), §4C.3 lifecycle (Tasks 1,2,3,7,12), §4C.4 bot flow (Task 10), §4C.5 local-only exclusion (Task 11), §4.2A per-kind (Task 7), §4.2B workspace description (Tasks 8,9).
- **Two-row model honored:** `brain_only` writes to `entities` (Task 9 `setEntityBrainOnly`), tag/lifecycle to `brain_nodes` (Task 2 whitelist). Memory-delete touches both rows (Task 9 `deleteMemoryNode`).
- **Threading chain per column:** Task 2 does all of migration→type→SELECT→whitelist→CompileNode→builder for the 4 brain_nodes columns; the compiler read (step 6) is Tasks 3-4.
- **Highest risk (brain_only leak):** Tasks 5→6 ordered so filters have data; Task 6 step 4 is an explicit no-leak verification with a re-grep.
- **Cache correctness for expiry:** Task 3 step 6 addresses the "dead node stays cached as alive" trap via a conditional day-bucket in the version key — flagged explicitly because it's the non-obvious failure mode.
- **Type consistency:** `expiredNodeIds` added to `CompiledBrain` (Task 3) and surfaced on `listBrain`; `tag_name`/`active_from`/`active_until` on both `BrainNodeRow` and `CompileNode`; the `memory()` test factory updated (Task 3 step 1) so all compiler tests compile.
- **Ordering vs Parts A/B:** depends on Part B (`DetailsMode` `PART-C-FIELDS` marker, Task 7). The "Nodes by custom tag" section in Part A Task 7 lights up once Task 2 here ships.
