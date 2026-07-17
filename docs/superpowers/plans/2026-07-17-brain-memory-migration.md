# Brain Memory-to-Entity Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, executed **in this session by you directly** — do NOT use subagent-driven-development or otherwise delegate Task 1 (the live-data migration) to a subagent. See "Why no delegation" below.

**Goal:** Convert every existing `brain_nodes` row with `type: 'memory'` into a real note entity (so it renders/edits/token-counts exactly like any other note), then retire the `memory` node type from the tools, prompts, and compiler so no new memory-type nodes can be created.

**Architecture:** This is a two-part change, done in this order: (1) a one-time live-data migration script that reads every `type: 'memory'` brain node, creates a corresponding `entities` row (`type: 'note'`) with the memory's text as the note body, and repoints the brain node to `type: 'entity'` + the new `ref_id` — instead of deleting/recreating nodes (which would lose position, pinned, priority, section membership, and any edges pointing at the node's id). (2) Code changes that remove `'memory'` from the places that let new ones be created: the `manage_brain` tool schema, `addBrainNode`'s validation, the system prompt line, and (last) the compiler's now-dead memory-render branch — kept working until the very last step so any row the migration missed still renders instead of silently vanishing from a user's `[BRAIN]` block.

**Tech Stack:** TypeScript, Next.js, Supabase (Postgres), Vitest, the existing `parseMarkdownToBlocks`/entity-insert pattern already used by `create_content` (`src/lib/bot/tools/handlers.ts:295-325`).

**Scope note:** This is the migration half of spec `2026-07-17-brain-canvas-design.md` §9. The per-node token counter (§5) is a separate plan (`2026-07-17-brain-per-node-token-count.md`) — if implementing both, do the token-counter plan first (it's lower-risk and has no live-data step); this plan doesn't depend on it either way.

**Why no delegation:** Spec §9 states this must be "run and verified live by the implementer, not delegated" — same pattern as the P2a migration referenced there. A live UPDATE/INSERT against real user data needs a human (or the acting agent, held to the same standard) to read the actual row counts and diffs before and after, not a subagent whose output gets skimmed. Task 1 below is written for direct execution with explicit verification queries at each step — do not hand it to `superpowers:subagent-driven-development`.

**Key facts established before writing this plan (do not re-derive):**
- `brain_nodes.type` is `'workspace' | 'entity' | 'memory' | 'section'` (`src/lib/bot/services/brainTypes.ts:15`). A `memory` node has `content` (plain text) set and `ref_id` null. An `entity` node has `ref_id` set (points at `entities.id`) and `content` null (`src/lib/bot/services/brainStore.ts:342-346`, the `addBrainNode` insert).
- The compiler renders a memory node as `- {label}: {content}` or `- {content}` (`src/lib/bot/services/brainCompiler.ts:30`) and an entity node as `- Note "{title}":\n{markdown}` (`src/lib/bot/services/brainCompiler.ts:41-42`).
- `resolveNodes` (`src/lib/bot/services/brainStore.ts:159-193`) resolves `type: 'entity'` nodes by fetching `entities` rows matching `ref_id`, converting `entity.content` (block array) to markdown via `blocksToMarkdown`.
- The canonical way to create a note entity server-side (used by the `create_content` tool handler, `src/lib/bot/tools/handlers.ts:295-325`):
  ```typescript
  const noteBody = parseMarkdownToBlocks(content)  // from src/lib/editor/markdownBlocks.ts
  await supabaseAdmin.from('entities').insert({
    id, title, type: 'note', content: noteBody,
    space_id: null, owner_id: userId, parent_id: null, last_modified: Date.now(),
  })
  ```
  `space_id: null` and `parent_id: null` are valid ("Unsorted", no workspace) — this is the same shape `handlers.ts:301,306-315` uses.
- `addBrainNode`'s validation (`src/lib/bot/services/brainStore.ts:314`): `if (type === 'memory' && !content) return { error: "'content' is required for type 'memory'" }`. This is the guard that must be removed in Task 3.
- The `manage_brain` tool's `type` enum is defined in TWO places that must stay in sync: `src/lib/bot/tools/definitions.ts:267` (the schema sent to the model) and the validation in `brainStore.ts:314` (server-side enforcement, since the model can't be trusted to only send valid enum values).
- The prompt line referencing memory nodes: `src/lib/bot/prompts/tools.txt:25` — "Store durable, atomic facts as memory nodes; reference workspaces/notes by ref_id...".
- `UPDATABLE_NODE_FIELDS` (`src/lib/bot/services/brainStore.ts:360`) is `['content', 'label', 'section_id', 'priority', 'pinned', 'enabled', 'position']` — notably `type` and `ref_id` are NOT updatable via `updateBrainNode` (see the comment at lines 352-359: changing `ref_id` would bypass the ownership check that only runs at creation). **The migration script must update `type` and `ref_id` directly via a raw Supabase update, not through `updateBrainNode`.**

---

### Task 1: Live-data migration — convert existing memory nodes to entities

**Files:**
- Create: `scripts/migrate-brain-memory-nodes.ts` (one-time script, not part of the app's runtime code — run manually, then can be deleted or left as a record)

**Why a standalone script, not an API route or tool:** This runs once, against production data, by whoever is executing this plan. An API route would need auth wiring and could be triggered accidentally; a script run with `npx tsx` under direct observation is the safer shape for a live-data change of this kind.

- [ ] **Step 1: Write the migration script**

Create `scripts/migrate-brain-memory-nodes.ts`:

```typescript
// One-time migration: convert every brain_nodes row with type='memory' into
// a real note entity, then repoint the brain node to type='entity' + the new
// ref_id. Position, pinned, priority, section_id, and any edges referencing
// the node's id are preserved untouched — only type/ref_id/content change.
//
// Run with: npx tsx scripts/migrate-brain-memory-nodes.ts
// Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in env
// (same as any other server-side script in this repo).

import { createClient } from '@supabase/supabase-js'
import { parseMarkdownToBlocks } from '../src/lib/editor/markdownBlocks'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey)

async function main() {
  const { data: memoryNodes, error: fetchError } = await supabase
    .from('brain_nodes')
    .select('id, user_id, content, label, created_at')
    .eq('type', 'memory')
    .is('deleted_at', null)

  if (fetchError) {
    console.error('Failed to fetch memory nodes:', fetchError.message)
    process.exit(1)
  }
  if (!memoryNodes || memoryNodes.length === 0) {
    console.log('No memory nodes found. Nothing to migrate.')
    return
  }

  console.log(`Found ${memoryNodes.length} memory nodes to migrate.`)
  let migrated = 0
  let failed = 0

  for (const node of memoryNodes) {
    const title = node.label || (node.content ?? '').slice(0, 60) || 'Untitled memory'
    const blocks = parseMarkdownToBlocks(node.content ?? '')
    const entityId = 'doc-migrated-' + node.id

    const { error: insertError } = await supabase.from('entities').insert({
      id: entityId,
      title,
      type: 'note',
      content: blocks,
      space_id: null,
      owner_id: node.user_id,
      parent_id: null,
      last_modified: Date.now(),
    })
    if (insertError) {
      console.error(`FAILED entity insert for brain_node ${node.id}: ${insertError.message}`)
      failed++
      continue
    }

    const { error: updateError } = await supabase
      .from('brain_nodes')
      .update({ type: 'entity', ref_id: entityId, content: null })
      .eq('id', node.id)
    if (updateError) {
      console.error(`FAILED brain_node update for ${node.id} (entity ${entityId} was created, now orphaned — investigate manually): ${updateError.message}`)
      failed++
      continue
    }

    migrated++
    console.log(`Migrated brain_node ${node.id} -> entity ${entityId} ("${title}")`)
  }

  console.log(`\nDone. Migrated: ${migrated}, Failed: ${failed}, Total: ${memoryNodes.length}`)
  if (failed > 0) {
    console.error('Some migrations failed — see FAILED lines above. Do NOT proceed to Task 2 until these are resolved or explicitly accepted.')
    process.exit(1)
  }
}

main()
```

- [ ] **Step 2: Verify the row count before running**

Run this query against the Supabase SQL editor first, and note the number:

```sql
SELECT COUNT(*) FROM brain_nodes WHERE type = 'memory' AND deleted_at IS NULL;
```

Write down this number — it's what Step 4's "Migrated: N" line must match.

- [ ] **Step 3: Dry-run check — confirm no id collisions**

Before running the real migration, confirm none of the target entity ids already exist (the script uses a deterministic `doc-migrated-{node.id}` id specifically so this check is possible):

```sql
SELECT bn.id AS brain_node_id, 'doc-migrated-' || bn.id AS would_be_entity_id
FROM brain_nodes bn
WHERE bn.type = 'memory' AND bn.deleted_at IS NULL
AND EXISTS (SELECT 1 FROM entities e WHERE e.id = 'doc-migrated-' || bn.id);
```

Expected: 0 rows. If this returns any rows, STOP — investigate why an entity with that id already exists (likely means this migration was partially run before) before proceeding.

- [ ] **Step 4: Run the migration**

Run: `npx tsx scripts/migrate-brain-memory-nodes.ts`

Expected output: a line per node (`Migrated brain_node ... -> entity ...`), ending with `Done. Migrated: N, Failed: 0, Total: N` where N matches Step 2's count. If `Failed` is nonzero, stop and read the `FAILED` lines above the summary before continuing.

- [ ] **Step 5: Verify the migration against the database**

Run:

```sql
-- Should be 0: no memory-type nodes left (that aren't soft-deleted)
SELECT COUNT(*) FROM brain_nodes WHERE type = 'memory' AND deleted_at IS NULL;

-- Should match Step 2's count: entities created by this migration
SELECT COUNT(*) FROM entities WHERE id LIKE 'doc-migrated-%';

-- Spot-check: pick 3 migrated nodes and confirm position/pinned/priority/section_id
-- are unchanged (compare against notes taken before running, or against the
-- brain_revisions log if one exists) and the new entity's content round-trips
-- sensibly (not empty, not mangled).
SELECT bn.id, bn.type, bn.ref_id, bn.position, bn.pinned, bn.priority, bn.section_id,
       e.title, e.content
FROM brain_nodes bn JOIN entities e ON e.id = bn.ref_id
WHERE bn.ref_id LIKE 'doc-migrated-%'
LIMIT 3;
```

- [ ] **Step 6: Manual UI verification**

Open the brain canvas for a user who had memory nodes before this migration. Expected: those nodes now render as note cards (openable, editable in the split-mode right column, full block editor) instead of memory cards, in the same position they were in before, with the same priority/pinned state. Click one open and confirm the content matches what the memory's text was.

- [ ] **Step 7: Commit the migration script**

```bash
git add scripts/migrate-brain-memory-nodes.ts
git commit -m "chore(brain): add one-time memory-to-entity migration script (run against prod)"
```

---

### Task 2: Remove `memory` from the tool schema and prompt

**Files:**
- Modify: `src/lib/bot/tools/definitions.ts:267,269` (`manage_brain` schema)
- Modify: `src/lib/bot/prompts/tools.txt:25` (prompt line)

**Why:** Once Task 1 has converted all existing memory nodes, no new ones should be creatable — the model should always create a real note entity via `create_content` and reference it, not use the freetext memory path.

- [ ] **Step 1: Update the tool schema**

In `src/lib/bot/tools/definitions.ts`, the `manage_brain` tool's `properties` (currently around lines 266-281). Change the `type` enum (currently line 267):

```typescript
        type: { type: "string", enum: ["workspace", "entity", "section"], description: "For add_node. 'workspace'/'entity' reference existing items by ref_id (content stays live); 'section' is a grouping header." },
```

And remove the now-dead `content` description (currently line 269), since `content` was only meaningful for memory nodes (entity/workspace nodes never used it — see `addBrainNode`'s insert at `brainStore.ts:342-346`, which sets `content: content ?? null` but only the memory validation branch required it to be non-null). Delete the line:

```typescript
        content: { type: "string", description: "For memory nodes: the fact to remember. Durable, atomic facts — not chat transcripts." },
```

- [ ] **Step 2: Update the prompt line**

In `src/lib/bot/prompts/tools.txt`, line 25 currently reads:

```
12. Your Brain is the [BRAIN] block in your context — user-curated, token-budgeted. Store durable, atomic facts as memory nodes; reference workspaces/notes by ref_id (never copy their content); group related nodes into sections; connect related nodes with a labeled edge that states the relationship plainly. Fire it silently alongside other tools. Use brain knowledge implicitly — never say "according to my brain" or "I remember that you…". If an add is rejected as full, tell the user plainly and suggest what to remove or unpin. Brain changes take effect next conversation, not mid-session.
```

Replace with:

```
12. Your Brain is the [BRAIN] block in your context — user-curated, token-budgeted. To remember a durable fact, create a note via create_content, then reference it by ref_id with manage_brain add_node (type 'entity'); group related nodes into sections; connect related nodes with a labeled edge that states the relationship plainly. Fire it silently alongside other tools. Use brain knowledge implicitly — never say "according to my brain" or "I remember that you…". If an add is rejected as full, tell the user plainly and suggest what to remove or unpin. Brain changes take effect next conversation, not mid-session.
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors (this task only touches a `.ts` enum literal and a `.txt` file).

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/tools/definitions.ts src/lib/bot/prompts/tools.txt
git commit -m "feat(brain): remove memory node type from manage_brain tool schema"
```

---

### Task 3: Remove server-side validation for `type: 'memory'`

**Files:**
- Modify: `src/lib/bot/services/brainStore.ts:314` (`addBrainNode` validation)
- Modify: `src/lib/bot/services/brainTypes.ts:15` (`BrainNodeRow['type']` union — see note below)
- Test: `src/lib/bot/services/brainStore.brainId.test.ts` (check for existing memory-type test fixtures first)

**Why:** `definitions.ts`'s enum only constrains what the MODEL is told is valid — a malformed or old client could still send `type: 'memory'` to the API. Server-side validation is the real enforcement.

- [ ] **Step 1: Check for existing test fixtures using `type: 'memory'`**

Run: `grep -n "type: 'memory'" src/lib/bot/services/brainStore.brainId.test.ts src/lib/bot/services/brainStore.test.ts 2>/dev/null`

If this finds any test that calls `addBrainNode` with `type: 'memory'` expecting success, note its name — Step 3 will need to update it to expect an error instead (or delete it if it's now testing removed behavior).

- [ ] **Step 2: Write the failing test**

Add to `src/lib/bot/services/brainStore.brainId.test.ts` (or create `src/lib/bot/services/brainStore.addNode.test.ts` if no suitable existing describe block covers `addBrainNode` — check the file first and place this alongside whatever else tests `addBrainNode`):

```typescript
  it('rejects type memory on add_node (retired node type)', async () => {
    const result = await addBrainNode('user-1', 'user', 'brain-1', {
      type: 'memory' as any, content: 'some fact',
    })
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/memory/i)
  })
```

Adjust the mock/setup boilerplate (userId, brainId, any Supabase mocking) to match whatever pattern the existing tests in that file already use — do not invent a new mocking approach if one exists.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/bot/services/brainStore.brainId.test.ts` (or the file chosen in Step 2)
Expected: FAIL — `addBrainNode` currently accepts `type: 'memory'` when `content` is provided (only rejects when content is MISSING), so this call succeeds instead of erroring.

- [ ] **Step 4: Update the validation**

In `src/lib/bot/services/brainStore.ts`, the validation block (currently lines 310-315):

```typescript
  if (type === 'workspace' || type === 'entity') {
    if (!ref_id) return { error: `'ref_id' is required for type '${type}'` }
    if (!(await assertOwnedEntity(userId, ref_id))) return { error: `Entity '${ref_id}' not found.` }
  }
  if (type === 'memory' && !content) return { error: "'content' is required for type 'memory'" }
  if (type === 'section' && !label) return { error: "'label' is required for type 'section'" }
```

Replace the memory line with an explicit rejection:

```typescript
  if (type === 'workspace' || type === 'entity') {
    if (!ref_id) return { error: `'ref_id' is required for type '${type}'` }
    if (!(await assertOwnedEntity(userId, ref_id))) return { error: `Entity '${ref_id}' not found.` }
  }
  if ((type as string) === 'memory') return { error: "Node type 'memory' has been retired — create a note via create_content and reference it with type 'entity' instead." }
  if (type === 'section' && !label) return { error: "'label' is required for type 'section'" }
```

The `type as string` cast is because Task 4 below narrows `BrainNodeRow['type']` to no longer include `'memory'` — at that point this line would be a TypeScript-unreachable-comparison error without the cast. Keep the cast; it documents that this branch exists specifically to catch a value the type system no longer allows but a raw HTTP client could still send.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/bot/services/brainStore.brainId.test.ts` (or the chosen file)
Expected: PASS.

- [ ] **Step 6: Narrow the type union**

In `src/lib/bot/services/brainTypes.ts`, line 15 currently:

```typescript
  type: 'workspace' | 'entity' | 'memory' | 'section'
```

Change to:

```typescript
  type: 'workspace' | 'entity' | 'memory' | 'section'  // 'memory' retained in the DB type union — existing rows may still carry it if Task 1's migration hasn't run for a given environment (e.g. a staging DB); addBrainNode rejects NEW memory nodes (see brainStore.ts) but reads/renders must keep tolerating old ones until every environment is confirmed migrated.
```

**Do NOT remove `'memory'` from this union.** Read paths (`resolveNodes`, `renderNode` in the compiler, any UI showing existing nodes) must keep handling rows that still have `type: 'memory'` — Task 1's migration is per-environment (dev/staging/prod each need it run separately against their own database), and this type is the DB row shape, not the creation-time input shape. Narrowing it would make every read-path switch/if-check on `n.type === 'memory'` a TypeScript error, forcing deletion of code that's still load-bearing for any environment where Task 1 hasn't been run yet.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/bot/services/brainStore.ts src/lib/bot/services/brainTypes.ts src/lib/bot/services/brainStore.brainId.test.ts
git commit -m "feat(brain): reject memory type on add_node, document retained DB type"
```

---

### Task 4: Verify the compiler's memory-render path still works for any un-migrated rows

**Files:**
- No production code change — this task is verification-only, confirming Task 1 didn't need a compiler change and that `renderNode`'s memory branch (`src/lib/bot/services/brainCompiler.ts:30`) is correctly left alone.

**Why a task instead of skipping:** It would be easy to assume "memory is retired, delete `renderNode`'s memory branch" — that's wrong and would break any environment (e.g. a staging DB, or a user whose migration run in Task 1 failed for their specific brain) still holding `type: 'memory'` rows. This task exists to make that reasoning explicit and verified, not to leave it as an unstated assumption.

- [ ] **Step 1: Confirm the existing compiler test for memory nodes still passes unmodified**

Run: `npx vitest run src/lib/bot/services/brainCompiler.test.ts`
Expected: PASS, including the existing test `'renders a memory node inside the [BRAIN] wrapper'` (`brainCompiler.test.ts:21-26`). This test must keep passing — it's not testing "can a user create a new memory node" (that's blocked by Task 3), it's testing "if a memory-type row exists, does it still render," which must remain true.

- [ ] **Step 2: Confirm no other code path assumes memory nodes are gone**

Run: `grep -rn "type === 'memory'\|type: 'memory'" src/lib/bot/ src/components/brain/ src/app/api/ai/`
Expected: matches only in `brainCompiler.ts` (the render branch, correctly kept), `brainStore.ts` (the new rejection in Task 3, correctly added), and test files. If any OTHER file assumes `'memory'` can't appear (e.g. a new switch statement added in a later change that doesn't handle it), that's a latent bug — flag it, don't silently "fix" it as part of this plan (it's out of scope; note it for a follow-up).

- [ ] **Step 3: No commit needed — this task is verification only**

---

## Self-Review

**Spec coverage (against `2026-07-17-brain-canvas-design.md` §9):**
- "one-time migration of every existing `type:'memory'` brain node into a real note entity (create entity, repoint `brain_node.ref_id` + `type`)" → Task 1, exactly this shape (create entity, update `type`+`ref_id` on the existing row, not delete+recreate). ✓
- "fully retiring the `memory` node type — `manage_brain`'s `add_node` tool definition/handler" → Task 2 (definition), Task 3 (handler-level validation in `addBrainNode`, which IS the handler's underlying call — `handlers.ts`'s `manage_brain` function forwards args to `brainStore.addBrainNode` without its own type-specific logic, confirmed during research). ✓
- "`tools.txt` prompt rules" → Task 2 Step 2. ✓
- "`brainCompiler.ts`'s content-fallback path" → Deliberately NOT removed (Task 4) — kept for any un-migrated row, with explicit reasoning documented so this isn't mistaken for an oversight. ✓
- "any remaining UI referencing `brain_nodes.content` directly" → Investigated: the canvas card (`BrainNodeCard.tsx`/`BrainCanvasPage.tsx`'s `computeDisplayInfo`) reads `node.content` only as a title fallback (`node.content?.slice(0,60)`) for ALL node types, not memory-specific — this is generic display logic, not memory-specific UI, and stays correct whether or not memory nodes exist. No separate "memory card" component was found to exist in the canvas (confirmed during research: the canvas has one `BrainNodeCard` component, not per-type variants). No change needed.
- "run and verified live by the implementer, not delegated" → Explicit non-delegation instruction at the top of this plan + step-by-step verification queries in Task 1.

**Placeholder scan:** No TBD/TODO placeholders. Task 1's script is complete, runnable code, not pseudocode. Test steps show actual assertions matching the existing test file's patterns (verified `brainCompiler.test.ts`'s style before writing Task 3's test).

**Type consistency:** `BrainNodeRow['type']` deliberately keeps `'memory'` in its union (Task 3, Step 6) — this is called out explicitly as an intentional exception to "the type shrinks," with the reasoning inline, so a future reader doesn't "fix" it by removing memory and breaking read-paths for un-migrated environments.

**Ordering dependency, stated explicitly for the implementer:** Task 1 MUST complete (and be verified via Task 1 Step 5's queries) before Task 3 ships to production — Task 3 blocks creation of NEW memory nodes, which is safe at any time, but if Task 1's migration hasn't run yet for a given database, existing memory nodes remain (correctly) renderable per Task 4. There is no ordering hazard between Task 2/3/4 and Task 1 other than "don't announce memory nodes are gone in the prompt (Task 2) before they actually are (Task 1)" — but since Task 3 still blocks creation regardless of Task 1's timing, running Tasks 2-4 first and Task 1 later is ALSO safe, just leaves old memory nodes on the canvas a while longer. Recommended order is still 1 → 2 → 3 → 4 as written.
