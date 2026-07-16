# Brain P2a — Multi-Brain Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn "brain" from an implicit one-per-user thing into a real, nameable entity a user can have several of (Main, Trading, Studying, ...), each with its own nodes/edges, selectable via a pill in the message bar before or during a chat session.

**Architecture:** A new `brains` table becomes the owning parent of `brain_nodes`/`brain_edges` (both gain a `brain_id` column). `bot_session_states` gains `active_brain_id`. Every `brainStore.ts` function that reads/writes brain data gets scoped to a specific `brain_id`, validated against `user_id` via a new `assertOwnedBrain` chokepoint — the same ownership-validation pattern P1 already uses for entities. The bot pipeline resolves which brain is active for a session and passes that into the existing compile/inject machinery unchanged. A message-bar pill lets the user pick a brain before the first message of a new chat, or swap mid-session (which repins, same mechanism as the existing `refresh` op). Spec: `docs/superpowers/specs/2026-07-16-brain-presets-design.md`.

**Tech Stack:** Next.js (App Router), TypeScript, Supabase (Postgres + RLS), Vitest, Zustand store, existing Brain P1 pipeline (`src/lib/bot/services/brainStore.ts`, `src/lib/bot/tools/handlers.ts`, `src/app/api/ai/user-brain/route.ts`, `src/components/brain/BrainPanel.tsx`).

## Global Constraints

- **Never stage or commit files you didn't change for this plan.** The owner works in parallel in the same tree. `git add` only the exact paths each task's commit step lists. Never run `git checkout`/`restore`/`reset`/`clean`. Run `git status --short` before AND after each task to confirm.
- **`brain_id` isolation is the security-critical property of this whole plan** (spec §3) — a node in Brain A must never leak into Brain B's compiled `[BRAIN]` block for the same user. Every brainStore function that touches `brain_nodes`/`brain_edges` MUST filter by `brain_id` in addition to `user_id`. Task 2's isolation test is the hard gate for this — it must genuinely fail before the fix and genuinely pass after, not just "look reasonable."
- **The pill swap must repin, not just retarget.** `getBrainBlockForSession` (existing P1 code) short-circuits on `pinned_brain_version` if it's already set. Setting `active_brain_id` alone, without also overwriting `pinned_brain_version`, leaves a session silently serving the OLD brain's compiled text forever. Every swap path (Task 2's `switchActiveBrain`, called via Task 6's pill) MUST update both fields together in one operation.
- **No DB triggers.** This codebase has no `on_auth_user_created`/`handle_new_user` trigger pattern anywhere (verified against the full migration history). A user's default "Main" brain is lazily get-or-created on first touch (mirrors `brainStore.ts`'s existing `getBrainConfigForUser` fallback pattern), never created via a signup trigger.
- **No new-chat landing page exists.** `startNewChat()` (in `src/data/store.ts`) just clears client state; the chat row is created lazily on first send inside `sendAIMessage`. There is nothing to put "pick a brain" cards on before that point — the pill (Task 6) is the only brain-selection surface, usable both before and after a session exists.
- Existing test baseline before this plan starts: **459 passing** (`npx vitest run`) — confirm this exact number in Task 1 before making any change, since it's the baseline every later task's count builds on.
- `tsc --noEmit` must be clean after every task.
- `manage_brain` (the bot tool) gets **no new `brain_id` parameter** — it always operates on the session's `active_brain_id`. Do not add cross-brain addressing to the tool in this plan; that was an explicit owner decision (spec §4).

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260716120000_brain_presets.sql` (create) | `brains` table; `brain_id` on `brain_nodes`/`brain_edges` (nullable → backfilled → NOT NULL); `active_brain_id` on `bot_session_states`; backfill existing users into one "Main" brain each |
| `src/lib/bot/services/brainTypes.ts` (modify) | Add `BrainRow` interface; add `brain_id` to `BrainNodeRow`/`BrainEdgeRow` |
| `src/lib/bot/services/brainStore.ts` (modify) | `assertOwnedBrain`, `getOrCreateDefaultBrain`, `listUserBrains`, `deleteBrain`, `switchActiveBrain`; every existing CRUD/compile function gains a `brainId` parameter and filter |
| `src/lib/bot/services/brainStore.brainId.test.ts` (create) | The isolation test (hard gate) + ownership/last-brain-delete-guard tests |
| `src/lib/bot/context.ts` (modify) | `SessionState.active_brain_id` |
| `src/lib/bot/chainRouter.ts` (modify) | Resolve the session's active brain (lazy-create default if needed) before calling `getBrainBlockForSession` |
| `src/lib/bot/tools/handlers.ts` (modify) | `manage_brain` resolves `brainId` from the session's active brain instead of implicitly "the user's brain" |
| `src/app/api/ai/user-brain/route.ts` (modify) | All actions take a `brain_id`; new `list_brains`, `create_brain`, `update_brain`, `delete_brain`, `switch_active_brain` actions |
| `src/app/api/ai/chat/route.ts` (modify) | Accept `activeBrainId` from the request body, pass through to `runChain`'s context |
| `src/data/store.ts` (modify) | `activeBrainId` client state; include it in the `/api/ai/chat` POST body |
| `src/components/assistant/AIAssistant.tsx` (modify) | The brain pill in the Right Actions row |
| `src/components/brain/BrainPanel.tsx` (modify) | Brain switcher/list at the top; all mutate calls pass `brain_id` |

---

### Task 1: Migration — `brains` table, `brain_id` columns, backfill

**Files:**
- Create: `supabase/migrations/20260716120000_brain_presets.sql`

**⚠️ This task is HIGH BLAST RADIUS — it runs a schema migration against a live, already-populated database.** Per this plan's global constraints, this task should be reviewed by the plan owner before the `supabase db push` step runs, even if the code-writing part is delegated. Do not run the push yourself without explicit confirmation from whoever is supervising this plan.

**Interfaces:**
- Produces: `brains` table; `brain_nodes.brain_id`, `brain_edges.brain_id` (NOT NULL after backfill); `bot_session_states.active_brain_id`.

- [ ] **Step 1: Confirm the test baseline before touching anything**

Run: `npx vitest run 2>&1 | tail -5`
Expected: `459 passing` (or note the actual number if different — this is your baseline, not a hardcoded requirement of this plan).

- [ ] **Step 2: Write the migration**

The critical ordering constraint: you CANNOT add a `NOT NULL` column to an already-populated table in one step — every existing row would violate the constraint immediately. The column must be added nullable, backfilled, THEN altered to NOT NULL.

```sql
-- Brain P2a (spec: docs/superpowers/specs/2026-07-16-brain-presets-design.md).
-- Makes "brain" a first-class, nameable entity a user can have several of,
-- instead of one implicit brain per user (P1). Every existing brain_nodes/
-- brain_edges row gets backfilled into an auto-created "Main" brain per user.

CREATE TABLE IF NOT EXISTS brains (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  title       text NOT NULL,
  description text,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brains_user ON brains(user_id);
-- At most one default brain per user (the lazy get-or-create's read-first
-- check relies on there being an unambiguous "the" default to find).
CREATE UNIQUE INDEX IF NOT EXISTS idx_brains_one_default_per_user
  ON brains(user_id) WHERE is_default = true;

-- Step A: add brain_id NULLABLE first — cannot be NOT NULL yet, the tables
-- already have rows with no brain_id value to satisfy that constraint.
ALTER TABLE brain_nodes ADD COLUMN IF NOT EXISTS brain_id uuid REFERENCES brains(id) ON DELETE CASCADE;
ALTER TABLE brain_edges ADD COLUMN IF NOT EXISTS brain_id uuid REFERENCES brains(id) ON DELETE CASCADE;

-- Step B: create one "Main" brain per distinct user_id that currently owns
-- brain_nodes or brain_edges rows (a user with zero existing brain content
-- gets their Main brain lazily on first touch instead — see
-- getOrCreateDefaultBrain in brainStore.ts, Task 2 — so this backfill only
-- needs to cover users who already have data to preserve).
INSERT INTO brains (user_id, title, is_default)
SELECT DISTINCT user_id, 'Main', true
FROM (
  SELECT user_id FROM brain_nodes
  UNION
  SELECT user_id FROM brain_edges
) existing_users
WHERE NOT EXISTS (
  SELECT 1 FROM brains b WHERE b.user_id = existing_users.user_id AND b.is_default = true
);

-- Step C: backfill brain_id on every existing row to point at that user's
-- new Main brain.
UPDATE brain_nodes bn
SET brain_id = b.id
FROM brains b
WHERE b.user_id = bn.user_id AND b.is_default = true AND bn.brain_id IS NULL;

UPDATE brain_edges be
SET brain_id = b.id
FROM brains b
WHERE b.user_id = be.user_id AND b.is_default = true AND be.brain_id IS NULL;

-- Step D: NOW it's safe to enforce NOT NULL — every row has a value.
ALTER TABLE brain_nodes ALTER COLUMN brain_id SET NOT NULL;
ALTER TABLE brain_edges ALTER COLUMN brain_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_brain_nodes_brain ON brain_nodes(brain_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_brain_edges_brain ON brain_edges(brain_id) WHERE deleted_at IS NULL;

-- Session binding: which brain is active for this chat session. Nullable —
-- a session created before this migration, or one that hasn't sent its
-- first message yet, has no active brain assigned until chainRouter
-- resolves one (Task 3).
ALTER TABLE bot_session_states
  ADD COLUMN IF NOT EXISTS active_brain_id uuid REFERENCES brains(id);

-- Backfill: every existing session's active brain is that user's Main
-- brain (bot_session_states has no direct user_id column — join through
-- brain_nodes is wrong; instead this is intentionally left NULL here and
-- resolved lazily by chainRouter on next use, same as a brand-new session
-- would be. bot_session_states rows don't carry a stable user_id today, so
-- a blanket backfill isn't safe to do here — Task 3's runtime resolution
-- handles it correctly for every session regardless of migration timing).

ALTER TABLE brains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brains_own" ON brains;
CREATE POLICY "brains_own" ON brains
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

- [ ] **Step 3: Hand this file to the plan owner for review before running it**

Do NOT run `npx supabase db push` yourself. Report back with:
- The full migration file contents (above).
- Confirmation that `tsc --noEmit` is unaffected (this is pure SQL, no TypeScript yet).

Wait for explicit confirmation the migration has been applied to the live database before starting Task 2. If you are the plan owner running this yourself, apply it now with `npx supabase db push` and verify with:

```sql
SELECT count(*) FROM brains WHERE is_default = true;
SELECT count(*) FROM brain_nodes WHERE brain_id IS NULL;  -- must be 0
SELECT count(*) FROM brain_edges WHERE brain_id IS NULL;  -- must be 0
```

Expected: the first query returns the number of distinct users who had brain content before this migration; the second and third both return 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260716120000_brain_presets.sql
git commit -m "feat(brain): P2a migration — brains table, brain_id columns, backfill"
```

---

### Task 2: `brainStore.ts` — brain_id scoping + ownership + isolation test (TDD, hard gate)

**Files:**
- Modify: `src/lib/bot/services/brainTypes.ts`
- Modify: `src/lib/bot/services/brainStore.ts`
- Create: `src/lib/bot/services/brainStore.brainId.test.ts`

**⚠️ This task is the security-critical core of this plan (spec §3).** A missed `brain_id` filter anywhere means one brain's nodes leak into another brain's compiled prompt for the same user. Follow TDD exactly: write the isolation test FIRST, watch it fail for the right reason, then make it pass.

**Interfaces:**
- Consumes: nothing new — this modifies existing exports in place.
- Produces: `assertOwnedBrain(userId, brainId)`, `getOrCreateDefaultBrain(userId)`, `listUserBrains(userId)`, `createBrain(userId, title, description?)`, `updateBrainMeta(userId, brainId, updates)`, `deleteBrain(userId, brainId)`. Every existing function (`fetchBrainRows`, `resolveNodes` stays user-scoped since entities aren't brain-scoped, `computeBrainVersion`, `compileBrain`, `getBrainBlockForSession`, `addBrainNode`, `updateBrainNode`, `removeBrainNodes`, `restoreBrainNode`, `addBrainEdge`, `removeBrainEdge`, `listBrain`) gains a `brainId: string` parameter inserted right after `userId`.

- [ ] **Step 1: Add types**

In `src/lib/bot/services/brainTypes.ts`, add this new interface (put it right after the existing `BrainConfigRow` interface, before `CompileNode`):

```ts
export interface BrainRow {
  id: string
  user_id: string
  title: string
  description: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}
```

Then modify the existing `BrainNodeRow` and `BrainEdgeRow` interfaces to add `brain_id: string` as a field. The full updated file:

```ts
export interface BrainRow {
  id: string
  user_id: string
  title: string
  description: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface BrainNodeRow {
  id: string
  user_id: string
  brain_id: string
  type: 'workspace' | 'entity' | 'memory' | 'section'
  ref_id: string | null
  content: string | null
  label: string | null
  section_id: string | null
  priority: number
  pinned: boolean
  enabled: boolean
  created_by: 'user' | 'bot'
  position: { x: number; y: number } | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface BrainEdgeRow {
  id: string
  user_id: string
  brain_id: string
  from_node: string
  to_node: string
  label: string
  created_by: 'user' | 'bot'
  deleted_at: string | null
  created_at: string
}

export interface BrainConfigRow {
  tier: string
  token_limit: number
  per_node_cap: number
}

/** Node ready for the pure compiler: refs resolved (or null = broken). */
export interface CompileNode {
  id: string
  type: BrainNodeRow['type']
  label: string | null
  content: string | null
  section_id: string | null
  priority: number
  pinned: boolean
  enabled: boolean
  created_at: string
  updated_at: string
  resolved: null | {
    title: string
    markdown: string
    description?: string | null
    noteCount?: number
    taskCount?: number
    childTitles?: string[]
  }
}

export interface CompileEdge {
  from_node: string
  to_node: string
  label: string
}

export interface CompiledBrain {
  compiled: string          // '' when the brain is empty — no [BRAIN] block injected
  tokenCount: number
  droppedNodeIds: string[]  // enabled nodes excluded by the budget
  brokenNodeIds: string[]   // ref nodes whose entity is gone/unowned
}
```

- [ ] **Step 2: Write the failing isolation test**

Create `src/lib/bot/services/brainStore.brainId.test.ts`. This test requires a real Supabase connection (it exercises actual row isolation, not pure logic) — it's written to run against a test/dev Supabase project. If `supabaseAdmin` is not configured in the test environment, every test in this file will skip via the `describe.skipIf` guard below rather than false-pass.

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { supabaseAdmin } from '../../supabase'
import {
  getOrCreateDefaultBrain, createBrain, addBrainNode, listBrain, deleteBrain, assertOwnedBrain,
} from './brainStore'

// A fixed, obviously-fake UUID used only as a test fixture user — this test
// creates real rows against a real Supabase connection, so it needs a
// consistent userId to scope its own fixtures and clean up predictably.
const TEST_USER_ID = '99999999-9999-4999-8999-999999999999'

describe.skipIf(!supabaseAdmin)('brain_id isolation (P2a security gate)', () => {
  let brainA: string
  let brainB: string

  beforeAll(async () => {
    const main = await getOrCreateDefaultBrain(TEST_USER_ID)
    brainA = main.id
    const created = await createBrain(TEST_USER_ID, 'Test Brain B')
    if ('error' in created) throw new Error(created.error)
    brainB = created.id
  })

  it('a node added to Brain A does not appear when listing Brain B', async () => {
    const res = await addBrainNode(TEST_USER_ID, 'user', brainA, {
      type: 'memory', content: 'This fact belongs ONLY to Brain A.',
    })
    expect('id' in res).toBe(true)

    const stateB = await listBrain(TEST_USER_ID, brainB)
    const leaked = stateB.nodes.some(n => n.content === 'This fact belongs ONLY to Brain A.')
    expect(leaked).toBe(false)

    const stateA = await listBrain(TEST_USER_ID, brainA)
    const present = stateA.nodes.some(n => n.content === 'This fact belongs ONLY to Brain A.')
    expect(present).toBe(true)
  })

  it('assertOwnedBrain rejects a brain_id that does not belong to the user', async () => {
    const owned = await assertOwnedBrain(TEST_USER_ID, brainA)
    expect(owned).toBe(true)
    const notOwned = await assertOwnedBrain('11111111-1111-4111-8111-111111111111', brainA)
    expect(notOwned).toBe(false)
  })

  it('deleteBrain refuses to delete the last remaining brain', async () => {
    // brainA and brainB both exist for TEST_USER_ID at this point (from
    // beforeAll), so deleting brainB should succeed, but a second delete
    // attempting to remove the now-only-remaining brainA must fail.
    const resB = await deleteBrain(TEST_USER_ID, brainB)
    expect('success' in resB).toBe(true)

    const resA = await deleteBrain(TEST_USER_ID, brainA)
    expect('error' in resA).toBe(true)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails for the right reason**

Run: `npx vitest run src/lib/bot/services/brainStore.brainId.test.ts 2>&1 | tail -30`
Expected: FAIL — `getOrCreateDefaultBrain`, `createBrain`, `deleteBrain`, `assertOwnedBrain` are not exported yet, and `addBrainNode`/`listBrain` don't accept a `brainId` parameter yet. If `supabaseAdmin` is not configured in this environment, the whole suite will report 0 tests run (skipped) instead of a failure — if that happens, note it in your report and continue implementing anyway; the live isolation check becomes part of Task 7's live verification instead.

- [ ] **Step 4: Rewrite `brainStore.ts` with brain_id scoping throughout**

Replace the ENTIRE contents of `src/lib/bot/services/brainStore.ts` with:

```ts
import { supabaseAdmin } from '../../supabase'
import { logger } from '../../logger'
import { blocksToMarkdown } from '../../editor/markdownBlocks'
import { estimateTokens, updateSessionState } from '../context'
import { compileBrainDocument, brainVersionKey } from './brainCompiler'
import type { BrainRow, BrainConfigRow, BrainNodeRow, BrainEdgeRow, CompileNode, CompiledBrain } from './brainTypes'

// Fallback only for the case Supabase itself is unreachable (matches the
// 'free' row's values) — never used as a real tier name, since
// user_subscriptions.tier_id defaults to 'free' at the DB level and every
// user has exactly one row (verified in 20260707_credit_metering_schema.sql).
const FREE_TIER_FALLBACK: BrainConfigRow = { tier: 'free', token_limit: 2000, per_node_cap: 1000 }
const MAX_NODES_PER_USER = 500

export async function getBrainConfigForUser(userId: string): Promise<BrainConfigRow> {
  if (!supabaseAdmin) return FREE_TIER_FALLBACK
  const { data: sub } = await supabaseAdmin
    .from('user_subscriptions').select('tier_id').eq('user_id', userId).maybeSingle()
  const tier = sub?.tier_id ?? 'free'
  const { data } = await supabaseAdmin
    .from('brain_config').select('tier, token_limit, per_node_cap').eq('tier', tier).maybeSingle()
  return (data as BrainConfigRow) ?? FREE_TIER_FALLBACK
}

/**
 * Ownership validation (spec §6 — P1-blocking). The bot pipeline runs on the
 * service role, which bypasses RLS; entity ids are client-generated text. A
 * ref to another user's entity must be rejected at add time AND silently
 * excluded (broken) at compile time.
 */
async function assertOwnedEntity(userId: string, refId: string): Promise<boolean> {
  if (!supabaseAdmin) return false
  const { data } = await supabaseAdmin
    .from('entities').select('id').eq('id', refId).eq('owner_id', userId).maybeSingle()
  return !!data
}

/**
 * P2a's equivalent of assertOwnedEntity (spec §3): a brain_id the caller
 * doesn't own must behave exactly like a nonexistent one everywhere — never
 * a distinguishing error that would let a caller probe for other users'
 * brain ids.
 */
export async function assertOwnedBrain(userId: string, brainId: string): Promise<boolean> {
  if (!supabaseAdmin) return false
  const { data } = await supabaseAdmin
    .from('brains').select('id').eq('id', brainId).eq('user_id', userId).maybeSingle()
  return !!data
}

/**
 * Lazy get-or-create (spec §2, revised during P2a planning): this codebase
 * has no signup-time trigger anywhere, so a user's default "Main" brain is
 * created the first time anything touches their brain, not at account
 * creation. Two concurrent first-requests racing to create it is a known,
 * accepted edge case — worst case a brief duplicate is_default row; this
 * function always resolves to the OLDEST is_default row, so a race
 * self-heals on the next call rather than compounding.
 */
export async function getOrCreateDefaultBrain(userId: string): Promise<BrainRow> {
  if (!supabaseAdmin) {
    return { id: 'none', user_id: userId, title: 'Main', description: null, is_default: true, created_at: '', updated_at: '' }
  }
  const { data: existing } = await supabaseAdmin
    .from('brains').select('*').eq('user_id', userId).eq('is_default', true)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (existing) return existing as BrainRow

  const { data, error } = await supabaseAdmin
    .from('brains').insert({ user_id: userId, title: 'Main', is_default: true })
    .select('*').single()
  if (error) {
    // Race: another concurrent call created it first (unique index on
    // (user_id) WHERE is_default). Re-read instead of failing.
    const { data: retried } = await supabaseAdmin
      .from('brains').select('*').eq('user_id', userId).eq('is_default', true)
      .order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (retried) return retried as BrainRow
    throw new Error(`getOrCreateDefaultBrain failed: ${error.message}`)
  }
  return data as BrainRow
}

export async function listUserBrains(userId: string): Promise<BrainRow[]> {
  if (!supabaseAdmin) return []
  await getOrCreateDefaultBrain(userId) // guarantee at least one exists
  const { data } = await supabaseAdmin
    .from('brains').select('*').eq('user_id', userId).order('is_default', { ascending: false }).order('created_at')
  return (data ?? []) as BrainRow[]
}

export async function createBrain(
  userId: string, title: string, description?: string
): Promise<{ id: string } | { error: string }> {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  if (!title?.trim()) return { error: "'title' is required" }
  const { data, error } = await supabaseAdmin
    .from('brains').insert({ user_id: userId, title: title.trim(), description: description ?? null })
    .select('id').single()
  if (error) return { error: error.message }
  return { id: data.id }
}

export async function updateBrainMeta(
  userId: string, brainId: string, updates: { title?: string; description?: string }
): Promise<{ success: true } | { error: string }> {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  if (!(await assertOwnedBrain(userId, brainId))) return { error: `Brain '${brainId}' not found.` }
  const safeUpdates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (updates.title !== undefined) safeUpdates.title = updates.title
  if (updates.description !== undefined) safeUpdates.description = updates.description
  const { error } = await supabaseAdmin.from('brains').update(safeUpdates).eq('id', brainId).eq('user_id', userId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteBrain(userId: string, brainId: string): Promise<{ success: true } | { error: string }> {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  if (!(await assertOwnedBrain(userId, brainId))) return { error: `Brain '${brainId}' not found.` }
  const { count } = await supabaseAdmin.from('brains').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  if ((count ?? 0) <= 1) return { error: 'Cannot delete your only remaining brain.' }
  const { error } = await supabaseAdmin.from('brains').delete().eq('id', brainId).eq('user_id', userId)
  if (error) return { error: error.message }
  return { success: true }
}

async function logRevision(userId: string, actor: 'user' | 'bot', op: string, payload: any) {
  if (!supabaseAdmin) return
  const { error } = await supabaseAdmin.from('brain_revisions').insert({ user_id: userId, actor, op, payload })
  if (error) logger.error('brain revision log failed:', error)
}

async function fetchBrainRows(userId: string, brainId: string): Promise<{ nodes: BrainNodeRow[]; edges: BrainEdgeRow[] }> {
  if (!supabaseAdmin) return { nodes: [], edges: [] }
  const [n, e] = await Promise.all([
    supabaseAdmin.from('brain_nodes').select('*').eq('user_id', userId).eq('brain_id', brainId).is('deleted_at', null),
    supabaseAdmin.from('brain_edges').select('*').eq('user_id', userId).eq('brain_id', brainId).is('deleted_at', null),
  ])
  return { nodes: (n.data ?? []) as BrainNodeRow[], edges: (e.data ?? []) as BrainEdgeRow[] }
}

/** Resolve refs → CompileNode[]. Unowned/missing refs stay resolved:null (broken). Entities are NOT brain-scoped, only user-scoped — unchanged from P1. */
async function resolveNodes(userId: string, nodes: BrainNodeRow[]): Promise<CompileNode[]> {
  const refIds = nodes.filter(n => n.ref_id && (n.type === 'workspace' || n.type === 'entity')).map(n => n.ref_id!)
  let entityMap = new Map<string, any>()
  if (refIds.length > 0 && supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('entities').select('id, title, type, content, description')
      .in('id', refIds).eq('owner_id', userId)   // compile-time ownership check
    entityMap = new Map((data ?? []).map((e: any) => [e.id, e]))
  }
  const out: CompileNode[] = []
  for (const n of nodes) {
    let resolved: CompileNode['resolved'] = null
    const ent = n.ref_id ? entityMap.get(n.ref_id) : null
    if (n.type === 'entity' && ent) {
      resolved = { title: ent.title, markdown: blocksToMarkdown(ent.content || []) }
    } else if (n.type === 'workspace' && ent && supabaseAdmin) {
      // children by parent_id; tasks link via tasks.entity_id (verified in handlers.ts:257/:709)
      const [children, tasks] = await Promise.all([
        supabaseAdmin.from('entities').select('title').eq('parent_id', ent.id).eq('owner_id', userId).limit(11),
        supabaseAdmin.from('tasks').select('id', { count: 'exact', head: true }).eq('entity_id', ent.id).eq('owner_id', userId),
      ])
      resolved = {
        title: ent.title, markdown: '', description: ent.description,
        noteCount: (children.data ?? []).length, taskCount: tasks.count ?? 0,
        childTitles: (children.data ?? []).map((c: any) => c.title),
      }
    }
    out.push({
      id: n.id, type: n.type, label: n.label, content: n.content, section_id: n.section_id,
      priority: n.priority, pinned: n.pinned, enabled: n.enabled,
      created_at: n.created_at, updated_at: n.updated_at, resolved,
    })
  }
  return out
}

/**
 * Derived version key (spec §4): no stale flags, no write-path hooks — can't
 * go stale undetected. brain_id is included explicitly in the hash input
 * (P2a addition) so two structurally-identical brains (e.g. two empty ones)
 * never collide on the same brain_compiles cache row.
 */
export async function computeBrainVersion(userId: string, brainId: string): Promise<string> {
  if (!supabaseAdmin) return 'none'
  const { nodes, edges } = await fetchBrainRows(userId, brainId)
  const refIds = nodes.filter(n => n.ref_id).map(n => n.ref_id!)
  let refStamp = ''
  if (refIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('entities').select('last_modified').in('id', refIds)
      .order('last_modified', { ascending: false }).limit(1)
    refStamp = String(data?.[0]?.last_modified ?? '')
  }
  const cfg = await getBrainConfigForUser(userId)
  const nodeStamp = nodes.map(n => n.updated_at).sort().pop() ?? ''
  const edgeStamp = edges.map(e => e.created_at).sort().pop() ?? ''
  return brainVersionKey([brainId, nodes.length, edges.length, nodeStamp, edgeStamp, refStamp, cfg.token_limit, cfg.per_node_cap])
}

export async function compileBrain(userId: string, brainId: string): Promise<CompiledBrain & { version: string }> {
  const version = await computeBrainVersion(userId, brainId)
  if (!supabaseAdmin) return { compiled: '', tokenCount: 0, droppedNodeIds: [], brokenNodeIds: [], version }
  const { data: cached } = await supabaseAdmin
    .from('brain_compiles').select('compiled, token_count, dropped_node_ids, broken_node_ids')
    .eq('user_id', userId).eq('version', version).maybeSingle()
  if (cached) {
    return {
      compiled: cached.compiled, tokenCount: cached.token_count, version,
      droppedNodeIds: cached.dropped_node_ids ?? [], brokenNodeIds: cached.broken_node_ids ?? [],
    }
  }
  const { nodes, edges } = await fetchBrainRows(userId, brainId)
  const compileNodes = await resolveNodes(userId, nodes)
  const cfg = await getBrainConfigForUser(userId)
  const result = compileBrainDocument(
    compileNodes,
    edges.map(e => ({ from_node: e.from_node, to_node: e.to_node, label: e.label })),
    cfg
  )
  await supabaseAdmin.from('brain_compiles').upsert({
    user_id: userId, version, compiled: result.compiled, token_count: result.tokenCount,
    dropped_node_ids: result.droppedNodeIds, broken_node_ids: result.brokenNodeIds,
  })
  return { ...result, version }
}

/**
 * Session pinning (spec §4, load-bearing for prompt caching): a session locks
 * to one compiled brain version on its first turn and keeps it even if the
 * brain changes mid-conversation ("build a brain about X" fires 10+ ops —
 * without pinning every op busts the provider cache next turn). New sessions
 * pick up the latest brain. P2a: brainId is resolved by the caller
 * (chainRouter — see switchActiveBrain / getOrCreateDefaultBrain) BEFORE
 * this is called; this function only compiles+pins whatever brain it's given.
 */
export async function getBrainBlockForSession(
  sessionId: string,
  sessionState: { pinned_brain_version?: string | null } | null,
  userId: string | undefined,
  brainId: string
): Promise<string> {
  if (!userId || userId === 'anonymous' || !supabaseAdmin) return ''
  try {
    const pinned = sessionState?.pinned_brain_version
    if (pinned) {
      const { data } = await supabaseAdmin
        .from('brain_compiles').select('compiled')
        .eq('user_id', userId).eq('version', pinned).maybeSingle()
      if (data) return data.compiled
    }
    const result = await compileBrain(userId, brainId)
    await updateSessionState(sessionId, { pinned_brain_version: result.version, active_brain_id: brainId } as any)
    if (sessionState) (sessionState as any).pinned_brain_version = result.version
    // active_brain_id is intentionally NOT mirrored onto the in-memory
    // sessionState object here (unlike pinned_brain_version above) —
    // nothing later in this same request reads sessionState.active_brain_id
    // after this point, so it would be a no-op mutation. The NEXT request
    // re-fetches sessionState from the DB fresh via getSessionState and
    // picks up the persisted value correctly either way.
    return result.compiled
  } catch (e: any) {
    logger.error(`getBrainBlockForSession failed for ${sessionId}: ${e.message}`)
    return ''
  }
}

/**
 * Mid-session brain swap (spec §5). MUST update active_brain_id AND
 * pinned_brain_version together in one write — getBrainBlockForSession
 * short-circuits on an existing pin, so updating active_brain_id alone
 * would leave the session silently serving the OLD brain's compile forever.
 */
export async function switchActiveBrain(
  sessionId: string, userId: string, brainId: string
): Promise<{ success: true; version: string } | { error: string }> {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  if (!(await assertOwnedBrain(userId, brainId))) return { error: `Brain '${brainId}' not found.` }
  const compiled = await compileBrain(userId, brainId)
  await updateSessionState(sessionId, {
    active_brain_id: brainId, pinned_brain_version: compiled.version,
  } as any)
  return { success: true, version: compiled.version }
}

export async function addBrainNode(
  userId: string, actor: 'user' | 'bot', brainId: string,
  input: { type: BrainNodeRow['type']; ref_id?: string; content?: string; label?: string; section_id?: string; priority?: number; pinned?: boolean }
): Promise<{ id: string } | { error: string }> {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  if (!(await assertOwnedBrain(userId, brainId))) return { error: `Brain '${brainId}' not found.` }
  const { type, ref_id, content, label, section_id, priority, pinned } = input
  if (type === 'workspace' || type === 'entity') {
    if (!ref_id) return { error: `'ref_id' is required for type '${type}'` }
    if (!(await assertOwnedEntity(userId, ref_id))) return { error: `Entity '${ref_id}' not found.` }
  }
  if (type === 'memory' && !content) return { error: "'content' is required for type 'memory'" }
  if (type === 'section' && !label) return { error: "'label' is required for type 'section'" }

  const { count } = await supabaseAdmin.from('brain_nodes')
    .select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('brain_id', brainId).is('deleted_at', null)
  if ((count ?? 0) >= MAX_NODES_PER_USER) return { error: `Brain node cap (${MAX_NODES_PER_USER}) reached.` }

  // Budget pre-check — a cheap, deliberately approximate early-reject so the
  // bot doesn't spend a round-trip adding a node that's obviously already
  // way over. This is NOT the authoritative budget enforcement: for
  // workspace/entity refs, actual size is only known once resolveNodes()
  // pulls the real content at compile time (per spec §5, "content is
  // referenced not copied" — a note's size can change without any brain
  // edit). The real, server-owned invariant is compileBrainDocument's
  // deterministic drop policy (brainCompiler.ts) — a ref node can pass this
  // pre-check and still get dropped (or truncated at per_node_cap) at
  // compile time; that's expected, not a bug, and the UI surfaces it via
  // the "dropped"/broken badges (listBrain). Freetext memory/section nodes
  // ARE their full final size already, so this check is exact for them.
  const cfg = await getBrainConfigForUser(userId)
  const current = await compileBrain(userId, brainId)
  const approxCost = (type === 'workspace' || type === 'entity')
    ? Math.min(cfg.per_node_cap, 500) // refs: assume near-cap until resolved; never blocks a small brain
    : estimateTokens(content ?? label ?? '')
  if (current.tokenCount + approxCost > cfg.token_limit && !pinned) {
    return { error: `Brain is full (${current.tokenCount}/${cfg.token_limit} tokens). Remove or unpin something first, or ask the user to upgrade.` }
  }

  const { data, error } = await supabaseAdmin.from('brain_nodes').insert({
    user_id: userId, brain_id: brainId, type, ref_id: ref_id ?? null, content: content ?? null, label: label ?? null,
    section_id: section_id ?? null, priority: priority ?? 0, pinned: pinned ?? false, created_by: actor,
  }).select('id').single()
  if (error) return { error: error.message }
  await logRevision(userId, actor, 'add_node', { id: data.id, brain_id: brainId, ...input })
  return { id: data.id }
}

// NOTE: 'ref_id' is deliberately NOT in this Pick. addBrainNode's ownership
// check (assertOwnedEntity) only runs at creation — allowing ref_id to be
// changed here would let an update silently repoint a node at an
// unowned/foreign entity, bypassing that check entirely. If ref_id ever
// needs to be editable, re-run assertOwnedEntity on the new value first.
// 'brain_id' is ALSO deliberately excluded — moving a node between brains
// isn't a feature this plan implements; if it ever is, it needs its own
// assertOwnedBrain check on the NEW brain_id, mirroring the ref_id note above.
const UPDATABLE_NODE_FIELDS = ['content', 'label', 'section_id', 'priority', 'pinned', 'enabled', 'position'] as const

export async function updateBrainNode(
  userId: string, actor: 'user' | 'bot', brainId: string, nodeId: string,
  updates: Partial<Pick<BrainNodeRow, typeof UPDATABLE_NODE_FIELDS[number]>>
): Promise<{ success: true } | { error: string }> {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  // Mass-assignment guard: `updates` is typed as a Pick<> at compile time,
  // but every real caller passes it through from `any` (tool args from the
  // model, or raw JSON request bodies) — the Pick<> erases at runtime and
  // gives zero protection there. `{ ...updates }` would let an object
  // carrying e.g. `user_id` reassign this row to another user (the row
  // still matches .eq('user_id', userId) in the WHERE, but SET user_id
  // changes it going forward) — that node then compiles into the VICTIM's
  // [BRAIN] block with attacker-controlled content: cross-tenant prompt
  // injection. Whitelist explicitly so only these exact keys can ever
  // reach the update, regardless of what the caller's object contains.
  const safeUpdates: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const key of UPDATABLE_NODE_FIELDS) {
    if (updates[key] !== undefined) safeUpdates[key] = updates[key]
  }
  const { error, data } = await supabaseAdmin.from('brain_nodes')
    .update(safeUpdates)
    .eq('id', nodeId).eq('user_id', userId).eq('brain_id', brainId).is('deleted_at', null).select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: `Brain node '${nodeId}' not found.` }
  await logRevision(userId, actor, 'update_node', { id: nodeId, brain_id: brainId, updates: safeUpdates })
  return { success: true }
}

export async function removeBrainNodes(
  userId: string, actor: 'user' | 'bot', brainId: string, nodeIds: string[]
): Promise<{ success: true; removed: number } | { error: string }> {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin.from('brain_nodes')
    .update({ deleted_at: now, updated_at: now })
    .in('id', nodeIds).eq('user_id', userId).eq('brain_id', brainId).is('deleted_at', null).select('id')
  if (error) return { error: error.message }
  await logRevision(userId, actor, 'remove_nodes', { ids: nodeIds, brain_id: brainId })
  return { success: true, removed: data?.length ?? 0 }
}

export async function restoreBrainNode(userId: string, brainId: string, nodeId: string): Promise<{ success: true } | { error: string }> {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  const { data, error } = await supabaseAdmin.from('brain_nodes')
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq('id', nodeId).eq('user_id', userId).eq('brain_id', brainId).select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: `Brain node '${nodeId}' not found.` }
  await logRevision(userId, 'user', 'restore_node', { id: nodeId, brain_id: brainId })
  return { success: true }
}

export async function addBrainEdge(
  userId: string, actor: 'user' | 'bot', brainId: string, from: string, to: string, label: string
): Promise<{ id: string } | { error: string }> {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  if (!label?.trim()) return { error: "'label' is required — an unlabeled connection means nothing to you later." }
  const { data: endpoints } = await supabaseAdmin.from('brain_nodes')
    .select('id').in('id', [from, to]).eq('user_id', userId).eq('brain_id', brainId).is('deleted_at', null)
  if ((endpoints ?? []).length !== 2) return { error: 'Both endpoints must be existing brain nodes in the same brain.' }
  const { data, error } = await supabaseAdmin.from('brain_edges')
    .insert({ user_id: userId, brain_id: brainId, from_node: from, to_node: to, label, created_by: actor })
    .select('id').single()
  if (error) return { error: error.message }
  await logRevision(userId, actor, 'connect', { id: data.id, brain_id: brainId, from, to, label })
  return { id: data.id }
}

export async function removeBrainEdge(userId: string, actor: 'user' | 'bot', brainId: string, edgeId: string): Promise<{ success: true } | { error: string }> {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  const { data, error } = await supabaseAdmin.from('brain_edges')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', edgeId).eq('user_id', userId).eq('brain_id', brainId).is('deleted_at', null).select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: `Brain edge '${edgeId}' not found.` }
  await logRevision(userId, actor, 'disconnect', { id: edgeId, brain_id: brainId })
  return { success: true }
}

export async function listBrain(userId: string, brainId: string) {
  const { nodes, edges } = await fetchBrainRows(userId, brainId)
  const compiled = await compileBrain(userId, brainId)
  const cfg = await getBrainConfigForUser(userId)
  // Extras for the P1 panel: recently deleted nodes (restore surface, spec §8)
  // and the user's workspaces (the "add workspace to brain" picker).
  let deletedNodes: BrainNodeRow[] = []
  let availableWorkspaces: { id: string; title: string }[] = []
  if (supabaseAdmin) {
    const [del, ws] = await Promise.all([
      supabaseAdmin.from('brain_nodes').select('*').eq('user_id', userId).eq('brain_id', brainId)
        .not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(20),
      supabaseAdmin.from('entities').select('id, title').eq('owner_id', userId)
        .eq('type', 'workspace').order('title'),
    ])
    deletedNodes = (del.data ?? []) as BrainNodeRow[]
    availableWorkspaces = (ws.data ?? []) as { id: string; title: string }[]
  }
  return {
    brainId, nodes, edges, deletedNodes, availableWorkspaces,
    compiledPreview: compiled.compiled,
    budget: {
      used: compiled.tokenCount, limit: cfg.token_limit,
      dropped: compiled.droppedNodeIds, broken: compiled.brokenNodeIds,
    },
  }
}
```

- [ ] **Step 5: Run the isolation test again**

Run: `npx vitest run src/lib/bot/services/brainStore.brainId.test.ts 2>&1 | tail -30`
Expected: PASS (or, if `supabaseAdmin` is not configured in this environment, 0 tests run/skipped — note this explicitly in your report, it means the isolation test needs to run against a live Supabase connection as part of Task 7's live verification instead).

- [ ] **Step 6: Run tsc and the full suite**

Run: `npx tsc --noEmit 2>&1 | tail -40`
Expected: errors in every file that calls the now-changed brainStore functions with their OLD signatures (missing `brainId` argument) — `src/lib/bot/chainRouter.ts`, `src/lib/bot/tools/handlers.ts`, `src/app/api/ai/user-brain/route.ts`. This is EXPECTED at this point in the plan — those call sites get fixed in Tasks 3-5. Do not attempt to fix them here; just confirm the errors are ONLY in those three files (plus any test files) and nowhere else.

- [ ] **Step 7: Commit**

```bash
git add src/lib/bot/services/brainTypes.ts src/lib/bot/services/brainStore.ts src/lib/bot/services/brainStore.brainId.test.ts
git commit -m "feat(brain): scope brainStore.ts to brain_id, add ownership + isolation test"
```

Note in your report: tsc will show errors in chainRouter.ts/handlers.ts/route.ts until Tasks 3-5 land. This is expected — do not skip this commit waiting for a clean tsc; the isolation-critical change belongs in its own commit, separable from the call-site fixups.

---

### Task 3: Bot pipeline — resolve active brain per session

**Files:**
- Modify: `src/lib/bot/context.ts`
- Modify: `src/lib/bot/chainRouter.ts`

**Interfaces:**
- Consumes: `getOrCreateDefaultBrain`, `getBrainBlockForSession` (both from Task 2, now brain_id-aware).
- Produces: `SessionState.active_brain_id`; `chainRouter.ts` resolves which brain is active before calling `getBrainBlockForSession`.

- [ ] **Step 1: Add `active_brain_id` to `SessionState`**

In `src/lib/bot/context.ts`, modify the `SessionState` interface (currently at the top of the file) to add one field:

```ts
export interface SessionState {
  chat_id: string
  distilled_summary: string | null
  token_usage_total: number
  context_limit: number
  compaction_threshold: number
  last_summarized_at: string
  pending_action: { tool: string; args: Record<string, any>; dry_run_result: any; created_at: string; turn_seq?: number } | null
  turn_seq: number
  last_compacted_message_id: number | null
  pinned_brain_version: string | null
  active_brain_id: string | null
}
```

Then update all THREE fallback object literals in this file (the `temp`/`temp:` early return, the `!supabase` early return, and `baseState`'s default) to include `active_brain_id: null`. Find each occurrence of `pinned_brain_version: null` in this file and add `active_brain_id: null,` on the next line, in each of the three places.

- [ ] **Step 2: Run tsc to confirm only the expected error remains**

Run: `npx tsc --noEmit 2>&1 | tail -40`
Expected: `chainRouter.ts` and `handlers.ts` and `route.ts` still show the brainStore signature-mismatch errors from Task 2. `context.ts` itself should now be clean.

- [ ] **Step 3: Wire brain resolution into `chainRouter.ts`**

Find this existing block in `src/lib/bot/chainRouter.ts` (around line 507):

```ts
  const brainBlock = isGlobalPromptEnabled
    ? await (await import('./services/brainStore')).getBrainBlockForSession(sessionId, sessionState, context?.userId)
    : ''
```

Replace it with:

```ts
  let brainBlock = ''
  if (isGlobalPromptEnabled && context?.userId && context.userId !== 'anonymous') {
    const brainStore = await import('./services/brainStore')
    // Resolve which brain is active for this session. ORDER MATTERS:
    // sessionState.active_brain_id (server-persisted, set by
    // switchActiveBrain on an explicit pill swap — see Task 6) is checked
    // FIRST and wins whenever it's set. context.activeBrainId (whatever the
    // client happens to have in its local store, sent on every request per
    // Task 6 Step 1) is ONLY the fallback for the very first turn of a
    // brand-new session, where no server-side active_brain_id exists yet
    // to pin against. Reversing this order would let a stale/desynced
    // client-side value silently override an already-pinned session
    // without going through switchActiveBrain's repin — the exact "pin and
    // active_brain_id diverge" bug this plan's global constraints warn
    // about, just approached from the read side instead of the write side.
    const activeBrainId = sessionState?.active_brain_id
      || context?.activeBrainId
      || (await brainStore.getOrCreateDefaultBrain(context.userId)).id
    brainBlock = await brainStore.getBrainBlockForSession(sessionId, sessionState, context.userId, activeBrainId)
  }
```

- [ ] **Step 4: Run tsc**

Run: `npx tsc --noEmit 2>&1 | tail -40`
Expected: `handlers.ts` and `route.ts` still show errors (Tasks 4-5 fix those). `chainRouter.ts` should now be clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/context.ts src/lib/bot/chainRouter.ts
git commit -m "feat(brain): resolve session's active brain before compiling [BRAIN] block"
```

---

### Task 4: `manage_brain` tool — resolve brainId from the active session

**Files:**
- Modify: `src/lib/bot/tools/handlers.ts`

**Interfaces:**
- Consumes: `getOrCreateDefaultBrain` (Task 2); `getSessionState` (existing, now brain_id-aware via Task 3).
- Produces: no change to the tool's public shape — `manage_brain` still takes no `brain_id` parameter (spec §4, explicit owner decision). It resolves the active brain internally.

- [ ] **Step 1: Add brainId resolution at the top of the handler**

In `src/lib/bot/tools/handlers.ts`, find the `manage_brain` method (search for `async manage_brain(args: any, context: any) {`). Immediately after the existing anonymous-user check and the `VALID_OPS`/argument-shape validation block (i.e., right before the line `if (!supabaseAdmin) return { error: 'Supabase not configured' }` that comes right before `const brain = await import('../services/brainStore')`), insert brain resolution. The exact before/after:

Find this (appears twice in the file — once in the early multi-id-confirmed branch, once in the main body; you need to add resolution to BOTH, since each does its own `supabaseAdmin`/`brain` import block):

```ts
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    const brain = await import('../services/brainStore')
    const userId = context.userId as string
```

Replace it with:

```ts
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    const brain = await import('../services/brainStore')
    const userId = context.userId as string
    // manage_brain deliberately has NO brain_id parameter (spec §4, owner
    // decision) — it always targets the session's active brain, resolved
    // the same way chainRouter resolves it for prompt injection: explicit
    // active_brain_id on the session if set, else lazily get-or-create the
    // user's default "Main" brain.
    const { getSessionState } = await import('../context')
    const sessState = context?.sessionId ? await getSessionState(context.sessionId) : null
    const brainId = sessState?.active_brain_id || (await brain.getOrCreateDefaultBrain(userId)).id
```

And for the earlier multi-id-confirmed branch (search for `if (op === 'remove_node' && removeIds.length > 1 && confirmed === true) {`), find:

```ts
      if (!supabaseAdmin) return { error: 'Supabase not configured' }
      const brain = await import('../services/brainStore')
      const res = await brain.removeBrainNodes(context.userId, 'bot', removeIds)
```

Replace it with:

```ts
      if (!supabaseAdmin) return { error: 'Supabase not configured' }
      const brain = await import('../services/brainStore')
      const brainId = sessionState?.active_brain_id || (await brain.getOrCreateDefaultBrain(context.userId)).id
      const res = await brain.removeBrainNodes(context.userId, 'bot', brainId, removeIds)
```

(Note: this branch already has a `sessionState` variable in scope from a few lines above it — reuse it, do not re-declare.)

- [ ] **Step 2: Update every brainStore call site in this method to pass `brainId`**

Within the `switch (op)` block (same method), update each call to pass `brainId` as the argument right after `userId`/`actor`. Specifically:

- `brain.listBrain(userId)` → `brain.listBrain(userId, brainId)`
- `brain.addBrainNode(userId, 'bot', { ... })` → `brain.addBrainNode(userId, 'bot', brainId, { ... })`
- `brain.updateBrainNode(userId, 'bot', node_id, updates)` → `brain.updateBrainNode(userId, 'bot', brainId, node_id, updates)`
- The `supabaseAdmin.from('brain_nodes').select('id, type, label').in('id', ids).eq('user_id', userId).is('deleted_at', null)` query (inside the `remove_node` case, used to check for a section among targets) → add `.eq('brain_id', brainId)` to that query chain
- `brain.removeBrainNodes(userId, 'bot', ids)` (both occurrences in the `remove_node` case) → `brain.removeBrainNodes(userId, 'bot', brainId, ids)`
- `brain.addBrainEdge(userId, 'bot', from, to, sanitizeToolContent(edge_label))` → `brain.addBrainEdge(userId, 'bot', brainId, from, to, sanitizeToolContent(edge_label))`
- `brain.removeBrainEdge(userId, 'bot', edge_id)` → `brain.removeBrainEdge(userId, 'bot', brainId, edge_id)`
- `brain.compileBrain(userId)` (inside the `refresh` case) → `brain.compileBrain(userId, brainId)`

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit 2>&1 | tail -40`
Expected: `route.ts` still shows errors (Task 5 fixes that). `handlers.ts` should now be clean.

- [ ] **Step 4: Run the existing manage_brain gate tests**

Run: `npx vitest run src/lib/bot/tools/handlers.brain.test.ts 2>&1 | tail -30`
Expected: PASS — these tests use `sessionId: 'temp'`, which returns a real `SessionState` (with `active_brain_id: null`) without touching Supabase, so the gate/validation logic still runs identically to before. If any of these tests newly fail, read the failure carefully before assuming it's this task's fault — `getOrCreateDefaultBrain` returns a placeholder `{ id: 'none', ... }` when `supabaseAdmin` is unset (matches the existing `!supabaseAdmin` early-return pattern), so a `'temp'` session with no real Supabase connection should behave the same as before.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/tools/handlers.ts
git commit -m "feat(brain): manage_brain resolves brainId from session's active brain"
```

---

### Task 5: `user-brain` API route — brain_id everywhere + brain management actions

**Files:**
- Modify: `src/app/api/ai/user-brain/route.ts`

**Interfaces:**
- Consumes: `listUserBrains`, `createBrain`, `updateBrainMeta`, `deleteBrain`, `switchActiveBrain` (all from Task 2/3), plus the now-brainId-aware existing functions.
- Produces: `GET /api/ai/user-brain?brain_id=X` (brain_id optional — omit to default to the user's Main brain); `POST` gains `list_brains`, `create_brain`, `update_brain`, `delete_brain`, `switch_active_brain` actions; every existing action now expects a `brain_id` in the body.

- [ ] **Step 1: Replace the route file**

Replace the ENTIRE contents of `src/app/api/ai/user-brain/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSupabaseEnabled } from '@/lib/supabase'
import {
  listBrain, addBrainNode, updateBrainNode, removeBrainNodes,
  restoreBrainNode, addBrainEdge, removeBrainEdge, compileBrain,
  listUserBrains, createBrain, updateBrainMeta, deleteBrain,
  getOrCreateDefaultBrain, switchActiveBrain,
} from '@/lib/bot/services/brainStore'
import { logger } from '@/lib/logger'

async function authedUserId(req: NextRequest): Promise<string | null> {
  if (!isSupabaseEnabled) return null
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  )
  const { data } = await supabaseClient.auth.getUser()
  return data.user?.id ?? null
}

export async function GET(req: NextRequest) {
  try {
    const userId = await authedUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const requestedBrainId = searchParams.get('brain_id')
    const brainId = requestedBrainId || (await getOrCreateDefaultBrain(userId)).id
    const [state, brains] = await Promise.all([
      listBrain(userId, brainId),
      listUserBrains(userId),
    ])
    return NextResponse.json({ ...state, brains })
  } catch (e: any) {
    logger.error('user-brain GET failed:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await authedUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()

    switch (body.action) {
      case 'add_node':
        return NextResponse.json(await addBrainNode(userId, 'user', body.brain_id, body))
      case 'update_node':
        // Safe to pass body.updates straight through: updateBrainNode
        // whitelists to UPDATABLE_NODE_FIELDS internally (mass-assignment
        // guard, see brainStore.ts) — a raw JSON body can't smuggle
        // user_id/type/ref_id/brain_id/etc. into the SET clause. Do not add
        // a second whitelist here; one authoritative chokepoint is the point.
        return NextResponse.json(await updateBrainNode(userId, 'user', body.brain_id, body.node_id, body.updates ?? {}))
      case 'remove_node':
        return NextResponse.json(await removeBrainNodes(userId, 'user', body.brain_id, body.node_ids ?? [body.node_id]))
      case 'restore_node':
        return NextResponse.json(await restoreBrainNode(userId, body.brain_id, body.node_id))
      case 'connect':
        return NextResponse.json(await addBrainEdge(userId, 'user', body.brain_id, body.from, body.to, body.label))
      case 'disconnect':
        return NextResponse.json(await removeBrainEdge(userId, 'user', body.brain_id, body.edge_id))
      case 'recompile': {
        const compiled = await compileBrain(userId, body.brain_id)
        return NextResponse.json({ success: true, tokenCount: compiled.tokenCount, version: compiled.version })
      }
      case 'list_brains':
        return NextResponse.json({ brains: await listUserBrains(userId) })
      case 'create_brain':
        return NextResponse.json(await createBrain(userId, body.title, body.description))
      case 'update_brain':
        return NextResponse.json(await updateBrainMeta(userId, body.brain_id, { title: body.title, description: body.description }))
      case 'delete_brain':
        return NextResponse.json(await deleteBrain(userId, body.brain_id))
      case 'switch_active_brain':
        // sessionId here is the chat session's id (same format chainRouter
        // uses, e.g. "chat:<uuid>") — the client sends whatever it already
        // uses to identify the active chat.
        if (!body.session_id) return NextResponse.json({ error: "'session_id' is required" }, { status: 400 })
        return NextResponse.json(await switchActiveBrain(body.session_id, userId, body.brain_id))
      default:
        return NextResponse.json({ error: `Unknown action '${body.action}'` }, { status: 400 })
    }
  } catch (e: any) {
    logger.error('user-brain POST failed:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Run tsc**

Run: `npx tsc --noEmit 2>&1 | tail -40`
Expected: CLEAN. This was the last file with brainStore signature-mismatch errors from Task 2.

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run 2>&1 | tail -10`
Expected: same pass count as the Task 1 baseline (plus Task 2's new isolation test, if it ran rather than skipped) — no regressions.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ai/user-brain/route.ts
git commit -m "feat(brain): user-brain route — brain_id everywhere + brain CRUD actions"
```

---

### Task 6: Message-bar pill — pick/swap active brain

**Files:**
- Modify: `src/data/store.ts`
- Modify: `src/app/api/ai/chat/route.ts`
- Modify: `src/components/assistant/AIAssistant.tsx`

**Interfaces:**
- Consumes: `POST /api/ai/user-brain` with `action: 'list_brains'` and `action: 'switch_active_brain'` (Task 5).
- Produces: `activeBrainId` client store state; a pill UI control; `activeBrainId` flows into the `/api/ai/chat` request body → `runChain`'s `context.activeBrainId` (consumed by Task 3's chainRouter resolution).

- [ ] **Step 1: Add `activeBrainId` client state to the store**

In `src/data/store.ts`, find the `sendAIMessage` function's request body (search for `activeChatId: finalActiveChatId,` — there are two occurrences of the `/api/ai/chat` fetch in this file, one for the main flow and one for a secondary flow at a later line number; both need this same change). Add `activeBrainId: get().activeBrainId,` as a new line right after `activeChatId: finalActiveChatId,` in EACH of the two `body: JSON.stringify({...})` blocks that POST to `/api/ai/chat`.

Then find the store's Zustand state type/initial-state definition (search for `activeChatId: string | null,` near the top of the file, in the state interface) and add a matching field right after it:

```ts
  activeBrainId: string | null,
```

And in the initial state object (search for `activeChatId: null,` near where the store is initialized — NOT inside `startNewChat`, the actual `create()` initial state), add:

```ts
      activeBrainId: null,
```

Add a setter action. Find `setActiveChatId: (id) => set({ activeChatId: id }),` (in the actions section of the store) and add a new action right after it:

```ts
      setActiveBrainId: (id: string | null) => set({ activeBrainId: id }),
```

Also add `setActiveBrainId: (id: string | null) => void` to the store's action-type interface, next to wherever `setActiveChatId` is declared there.

- [ ] **Step 2: Accept `activeBrainId` in the chat API route**

In `src/app/api/ai/chat/route.ts`, find this line (search for `const { prompt, buffer, images,`):

```ts
  const { prompt, buffer, images, aiApiKey, activeEntityId, activeChatId, activeSpaceId, classificationModelId, mode, intentTag, replyContext, thinkingEnabled, advisorEnabled, pendingAdvisorState, isTempChat, clientHistory, pageContext, clientTime } = await req.json()
```

Replace it with:

```ts
  const { prompt, buffer, images, aiApiKey, activeEntityId, activeChatId, activeBrainId, activeSpaceId, classificationModelId, mode, intentTag, replyContext, thinkingEnabled, advisorEnabled, pendingAdvisorState, isTempChat, clientHistory, pageContext, clientTime } = await req.json()
```

Then find where `runChain` is called (search for `result = await runChain(`) and locate the context object passed as its second argument — it includes `activeChatId: activeChatId ?? null,` (around the line noted in this plan's research). Add `activeBrainId: activeBrainId ?? null,` as a new line right after it.

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit 2>&1 | tail -40`
Expected: CLEAN.

- [ ] **Step 4: Add the pill UI**

In `src/components/assistant/AIAssistant.tsx`, this is a larger addition. First, add imports. Find the existing `import { ... } from 'lucide-react'` line near the top and add `Brain` to the icon import list if it's not already there (check first — `BrainPanel.tsx` already imports `Brain` from `lucide-react`, so it exists as an export; just verify it's not already imported in THIS file before adding a duplicate).

Add these two hooks near the top of the component, alongside the other `useStore` calls (search for `const activeMode = useStore(state => state.activeMode)`):

```ts
  const activeBrainId = useStore(state => state.activeBrainId)
  const setActiveBrainId = useStore(state => state.setActiveBrainId)
```

Add local state for the brain list and the switcher's open/closed state, near the other `useState` declarations for `showModeMenu`:

```ts
  const [brains, setBrains] = useState<{ id: string; title: string; description: string | null; is_default: boolean }[]>([])
  const [showBrainMenu, setShowBrainMenu] = useState(false)
  const [brainMenuPos, setBrainMenuPos] = useState<{ bottom: number; right: number } | null>(null)
  const brainMenuBtnRef = useRef<HTMLButtonElement>(null)
```

Add a fetch-on-mount effect (near other `useEffect` hooks in the file):

```ts
  useEffect(() => {
    (async () => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (isSupabaseEnabled) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
        }
        const res = await fetch('/api/ai/user-brain', { method: 'POST', headers, body: JSON.stringify({ action: 'list_brains' }) })
        if (res.ok) {
          const data = await res.json()
          setBrains(data.brains ?? [])
          if (!activeBrainId && data.brains?.length > 0) {
            const main = data.brains.find((b: any) => b.is_default) ?? data.brains[0]
            setActiveBrainId(main.id)
          }
        }
      } catch { /* non-fatal — pill just won't populate this session */ }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

(Check the top of the file for existing `supabase`/`isSupabaseEnabled` imports from `@/lib/supabase` — `BrainPanel.tsx` uses the same import, `import { supabase, isSupabaseEnabled } from '@/lib/supabase'`. Add that import to this file if it's not already present.)

Add the switch handler, near `handleSend`:

```ts
  const handleSwitchBrain = async (brainId: string) => {
    setActiveBrainId(brainId)
    setShowBrainMenu(false)
    // Only repin an ALREADY-EXISTING session — a brand-new pending chat has
    // no session yet, so there's nothing to repin; the choice just rides
    // along in the first /api/ai/chat request body (Task 6 Step 1/2).
    const { activeChatId, pendingNewChat } = useStore.getState()
    if (!activeChatId || pendingNewChat) return
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (isSupabaseEnabled) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
      }
      const sessionId = `chat:${activeChatId}`
      await fetch('/api/ai/user-brain', {
        method: 'POST', headers,
        body: JSON.stringify({ action: 'switch_active_brain', session_id: sessionId, brain_id: brainId }),
      })
      const brainTitle = brains.find(b => b.id === brainId)?.title ?? 'a different brain'
      window.dispatchEvent(new CustomEvent('ai-brain-switched', { detail: { title: brainTitle } }))
    } catch (e) {
      console.error('Failed to switch active brain:', e)
    }
  }
```

Finally, add the pill button itself. In the "Right Actions" div (search for `{/* Right Actions */}`), add this as a new sibling right before the existing mode-selector `<div className="relative">` block:

```tsx
                <div className="relative">
                  <Tooltip content="Switch Brain">
                    <button
                      ref={brainMenuBtnRef}
                      onClick={() => {
                        if (brainMenuBtnRef.current) {
                          const r = brainMenuBtnRef.current.getBoundingClientRect()
                          setBrainMenuPos({ bottom: window.innerHeight - r.top + 8, right: window.innerWidth - r.right })
                        }
                        setShowBrainMenu(v => !v)
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-[8px]",
                        showBrainMenu
                          ? "bg-dark text-foreground"
                          : "text-bone-70 hover:text-foreground hover:bg-dark"
                      )}
                    >
                      <Brain className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline text-[13px] font-normal tracking-wide">
                        {brains.find(b => b.id === activeBrainId)?.title ?? 'Main'}
                      </span>
                    </button>
                  </Tooltip>

                  {showBrainMenu && brainMenuPos && createPortal(
                    <>
                      <div className="fixed inset-0 z-[140]" onClick={() => setShowBrainMenu(false)} />
                      <div
                        className="fixed z-[150] bg-[var(--color-panel)] border border-[var(--bone-12)] rounded-[var(--radius-regular)] overflow-hidden min-w-[200px] backdrop-blur-3xl shadow-2xl p-1 flex flex-col gap-[2px]"
                        style={{ bottom: brainMenuPos.bottom, right: brainMenuPos.right }}
                      >
                        {brains.map(b => (
                          <button
                            key={b.id}
                            onClick={() => handleSwitchBrain(b.id)}
                            className={cn(
                              'w-full flex items-center px-3 py-[4px] rounded-[var(--radius-medium)] text-[13.5px] text-left group transition-none text-[var(--bone-70)] hover:bg-[var(--bone-6)] hover:text-bone-100',
                              activeBrainId === b.id && 'bg-dark text-bone-100'
                            )}
                          >
                            <div className="flex flex-col">
                              <p className="tracking-wide">{b.title}</p>
                              {b.description && (
                                <p className="text-[12px] tracking-[0.06em] opacity-30 leading-none mt-0.5 line-clamp-1">{b.description}</p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>,
                    document.body
                  )}
                </div>
```

Check the existing mode-selector's portal call (a few lines below where you're inserting) for the exact `createPortal(..., document.body)` pattern already used in this file, and match it exactly — the plan's snippet above assumes `document.body` is the existing target, confirm this against the mode selector's own `createPortal` call before assuming it's correct.

- [ ] **Step 5: Add the "switched brain" chat divider**

Find where `ai-chat-sent` custom events are listened to or where system-style messages are inserted into `aiMessages` in this file or `store.ts` (search for `ai-chat-sent` in `AIAssistant.tsx` for the pattern, and search `chatMessagesMap` in `store.ts` for how messages get appended). Add a listener for the `ai-brain-switched` event dispatched in Step 4, and insert a lightweight system-style message. The simplest implementation — add this `useEffect` near the pill's other effects in `AIAssistant.tsx`:

```ts
  useEffect(() => {
    const handler = (e: Event) => {
      const title = (e as CustomEvent).detail?.title ?? 'a different brain'
      const { activeChatId } = useStore.getState()
      if (!activeChatId) return
      const dividerMessage: AIMessage = {
        id: generateId(),
        role: 'system',
        content: `Switched to ${title} brain`,
        timestamp: Date.now(),
      }
      useStore.setState(s => ({
        chatMessagesMap: { ...s.chatMessagesMap, [activeChatId]: [...(s.chatMessagesMap[activeChatId] || s.aiMessages), dividerMessage] },
        aiMessages: [...s.aiMessages, dividerMessage],
      }))
    }
    window.addEventListener('ai-brain-switched', handler)
    return () => window.removeEventListener('ai-brain-switched', handler)
  }, [])
```

`AIMessage.role` (defined in `src/data/store.types.ts`) is already typed as `'user' | 'assistant' | 'system' | 'tool'` — `'system'` is already a valid value, no type widening needed. Check `ChatMessage.tsx`'s existing role-based branching (search for `msg.role ===`) for whether a `'system'` rendering path already exists (it may, since the type already anticipates it). If one exists, reuse its styling. If not, add a minimal one: a small centered text divider, distinct from user/assistant bubbles.

- [ ] **Step 6: Run tsc and the full suite**

Run: `npx tsc --noEmit 2>&1 | tail -40 && npx vitest run 2>&1 | tail -10`
Expected: CLEAN; same pass count as before this task (this task is UI-only, no new automated tests — the pill's correctness is verified live in Task 7).

- [ ] **Step 7: Commit**

```bash
git add src/data/store.ts src/app/api/ai/chat/route.ts src/components/assistant/AIAssistant.tsx
git commit -m "feat(brain): message-bar pill for picking/swapping the active brain"
```

**⚠️ Before staging:** run `git diff src/data/store.ts src/components/assistant/AIAssistant.tsx` and confirm the diff contains ONLY the changes described above. The owner works in these files in parallel — if you see unrelated hunks, they were his; stage anyway (unavoidable in the same file) but say so explicitly in your report.

---

### Task 7: Brain page — brain switcher + scoped views

**Files:**
- Modify: `src/components/brain/BrainPanel.tsx`

**Interfaces:**
- Consumes: `GET /api/ai/user-brain?brain_id=X` (now returns `{ ...state, brains }`, Task 5); `POST` with `list_brains`/`create_brain`/`update_brain`/`delete_brain` actions.

- [ ] **Step 1: Add brain-switcher state and data**

In `src/components/brain/BrainPanel.tsx`, update the `BrainState` interface to include the new `brains` field returned by the GET route:

```ts
interface BrainMeta { id: string; title: string; description: string | null; is_default: boolean }
interface BrainState {
  brainId: string;
  nodes: BrainNode[]; edges: BrainEdge[]; compiledPreview: string;
  deletedNodes: BrainNode[];
  availableWorkspaces: { id: string; title: string }[];
  budget: { used: number; limit: number; dropped: string[]; broken: string[] };
  brains: BrainMeta[];
}
```

Add a `selectedBrainId` piece of local state, and change `load` to pass it as a query param:

```ts
  const [selectedBrainId, setSelectedBrainId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = selectedBrainId ? `?brain_id=${selectedBrainId}` : '';
    const res = await fetch(`/api/ai/user-brain${qs}`, { headers: await authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setState(data);
      if (!selectedBrainId) setSelectedBrainId(data.brainId);
    }
  }, [selectedBrainId]);

  useEffect(() => { load(); }, [load]);
```

(This replaces the existing `load` function and its `useEffect` — the rest of the component's `mutate` function needs one change too, see Step 2.)

- [ ] **Step 2: Pass `brain_id` on every mutation**

Update the `mutate` function to always include the currently-selected brain:

```ts
  const mutate = async (body: object) => {
    setBusy(true);
    try {
      await fetch('/api/ai/user-brain', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ brain_id: selectedBrainId, ...body }),
      });
      await load();
    } finally { setBusy(false); }
  };
```

- [ ] **Step 3: Add the brain switcher to the header**

In the panel's header (find the `<div className="flex items-center gap-2">` containing the `Brain` icon and `<h2>Brain</h2>`), replace the static heading with a dropdown selector:

```tsx
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-[var(--brand-blue)]" />
            <select
              value={selectedBrainId ?? ''}
              onChange={e => setSelectedBrainId(e.target.value)}
              className="bg-transparent text-base font-semibold text-foreground outline-none cursor-pointer"
            >
              {(state?.brains ?? []).map(b => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </div>
```

- [ ] **Step 4: Add create/rename/delete controls**

Add a small set of controls near the header's existing action buttons (the "View as bot sees it" / refresh / close row). Add a "New Brain" button and, for the currently selected non-default brain, a delete button:

```tsx
            <button
              onClick={async () => {
                const title = prompt('Name this brain (e.g. "Trading", "Studying"):');
                if (!title?.trim()) return;
                await mutate({ action: 'create_brain', title: title.trim() });
              }}
              className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--bone-10)] text-[var(--bone-60)] hover:text-foreground"
            >
              + New Brain
            </button>
            {state && !state.brains.find(b => b.id === selectedBrainId)?.is_default && (
              <button
                onClick={async () => {
                  if (!confirm('Delete this brain? Its nodes and edges will be removed.')) return;
                  const res = await fetch('/api/ai/user-brain', {
                    method: 'POST', headers: await authHeaders(),
                    body: JSON.stringify({ action: 'delete_brain', brain_id: selectedBrainId }),
                  });
                  if (res.ok) { setSelectedBrainId(null); await load(); }
                }}
                className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--bone-10)] text-red-400/70 hover:text-red-400"
              >
                Delete Brain
              </button>
            )}
```

Place these two buttons in the header's existing right-side button row, alongside "View as bot sees it" / refresh / close.

- [ ] **Step 5: Run tsc and the full suite**

Run: `npx tsc --noEmit 2>&1 | tail -40 && npx vitest run 2>&1 | tail -10`
Expected: CLEAN; same pass count as before this task.

- [ ] **Step 6: Commit**

```bash
git add src/components/brain/BrainPanel.tsx
git commit -m "feat(brain): brain switcher + create/delete in the Brain page"
```

---

### Task 8: Verification + spec update

- [ ] **Step 1: Full local verification**

Run each; all must pass:
1. `npx tsc --noEmit` — clean
2. `npx vitest run` — same or higher pass count than Task 1's recorded baseline
3. `grep -rn "brainStore" src/ --include="*.ts" --include="*.tsx" -l` — read through each result and confirm every call into a brainStore function that touches `brain_nodes`/`brain_edges` passes a `brainId` argument (no stale call sites left with the old signature — tsc would have caught most of this, but do a manual read to be sure nothing was silently cast to `any` around it)

- [ ] **Step 2: Report the live-verification gate (do NOT mark done)**

The following require the migration applied to the live DB (Task 1) and a real user session — list them in your report as REMAINING, owner-executed:
1. Two-brain isolation, live: create a memory node in Brain A via the panel, switch to Brain B via the pill, confirm a transcript's `[BRAIN]` block for a message sent while Brain B is active does NOT contain Brain A's node.
2. Last-brain-delete guard: attempt to delete a user's only brain via the panel's Delete Brain button — confirm it's either hidden (only default is left) or the request is rejected.
3. Pill swap correctness: start a session on Brain A, send a message, switch to Brain B via the pill mid-session, send another message — confirm the transcript shows the "Switched to Brain B" divider AND the second message's `[BRAIN]` block reflects Brain B's content, not Brain A's stale pin.
4. Cache behavior around a swap: OpenRouter logs should show a cache MISS on the swap turn (new brain = new prefix) and cache HITS on turns before and after the swap that don't involve a switch — matching spec §5's cost model exactly (same shape as P1's already-verified cache test).
5. `manage_brain` via chat correctly targets whichever brain is active for that session (ask the bot to remember something while Brain A is active, switch to Brain B, ask "what do you know" — the new fact should NOT appear).

- [ ] **Step 3: Update the spec (separate commit)**

In `docs/superpowers/specs/2026-07-16-brain-presets-design.md`: mark each section as implemented with a dated status line (§2 data model, §3 ownership, §4 tool scope, §5 session binding, §6 UI surfaces), explicit that live verification (this task's Step 2) is NOT yet done. In `docs/superpowers/specs/2026-07-11-bot-rework-design.md` §0: update the relevant row to note P2a is code-complete pending live verification.

```bash
git add docs/superpowers/specs/2026-07-16-brain-presets-design.md docs/superpowers/specs/2026-07-11-bot-rework-design.md
git commit -m "docs(spec): Brain P2a implemented — pending live verification"
```
