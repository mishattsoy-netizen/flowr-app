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
