import { estimateTokens } from '../context'
import type { BrainConfigRow, CompileEdge, CompileNode, CompiledBrain } from './brainTypes'

/** Stable djb2 hash → short base36 key. Pure; used for the compile cache key. */
export function brainVersionKey(parts: (string | number)[]): string {
  const s = parts.join('|')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

function nodeTitle(n: CompileNode): string {
  return n.resolved?.title ?? n.label ?? (n.content ?? '').slice(0, 40)
}

function truncateAtLines(markdown: string, capTokens: number): string {
  if (estimateTokens(markdown) <= capTokens) return markdown
  const lines = markdown.split('\n')
  let out = ''
  for (const line of lines) {
    const candidate = out ? out + '\n' + line : line
    if (estimateTokens(candidate) > capTokens) break
    out = candidate
  }
  return out + '\n[truncated]'
}

function renderNode(n: CompileNode, cap: number): string {
  if (n.type === 'section') return `## ${n.label ?? 'Section'}`
  if (n.type === 'memory') return n.label ? `- ${n.label}: ${n.content ?? ''}` : `- ${n.content ?? ''}`
  if (n.type === 'workspace') {
    const r = n.resolved!
    const desc = r.description || n.label || ''
    const children = r.childTitles ?? []
    const shown = children.slice(0, 10).join(', ')
    const more = children.length > 10 ? `, +${children.length - 10} more` : ''
    const contains = children.length > 0 ? ` Contains: ${shown}${more}.` : ''
    return `- Workspace "${r.title}": ${desc}. ${r.noteCount ?? 0} notes, ${r.taskCount ?? 0} tasks.${contains}`
  }
  // entity
  const r = n.resolved!
  return `- Note "${r.title}":\n${truncateAtLines(r.markdown, cap)}`
}

function isInactive(n: CompileNode, nowMs: number): boolean {
  if (n.active_from && Date.parse(n.active_from) > nowMs) return true // scheduled
  if (n.active_until && Date.parse(n.active_until) < nowMs) return true // dead
  return false
}

/**
 * Pure compile: nodes/edges → one [BRAIN] text block, budget enforced.
 * Deterministic: same input, same bytes (spec §4). The budget drop policy
 * (spec §5): never drop pinned; drop priority ASC, then updated_at ASC.
 * Temporary lifecycle (§4C.3): drop scheduled/dead nodes at read time.
 * Named tags (§4C.1): group under [tagName] headings; edges cross groups freely.
 */
export function compileBrainDocument(
  nodes: CompileNode[],
  edges: CompileEdge[],
  config: BrainConfigRow,
  now: Date = new Date()
): CompiledBrain {
  const enabled = nodes.filter(n => n.enabled)
  const nowMs = now.getTime()
  const expiredNodeIds = enabled.filter(n => isInactive(n, nowMs)).map(n => n.id)
  // Broken refs among all enabled (incl. lifecycle-inactive) so UI can still
  // score token cost for scheduled/dead nodes.
  const brokenNodeIds = enabled
    .filter(n => (n.type === 'workspace' || n.type === 'entity') && !n.resolved)
    .map(n => n.id)
  // Scoreable = every enabled non-section non-broken node — even if lifecycle
  // currently excludes it from the compiled block (UI usage bars need a cost).
  const scoreable = enabled.filter(n =>
    n.type !== 'section' && !brokenNodeIds.includes(n.id))

  const rendered = new Map<string, string>()
  for (const n of scoreable) rendered.set(n.id, renderNode(n, config.per_node_cap))
  const cost = (id: string) => estimateTokens(rendered.get(id) ?? '')
  const perNodeTokens: Record<string, number> = {}
  for (const n of scoreable) perNodeTokens[n.id] = cost(n.id)

  // Compile only lifecycle-active nodes.
  const active = enabled.filter(n => !isInactive(n, nowMs))
  const sections = active.filter(n => n.type === 'section')
  const renderable = active.filter(n =>
    n.type !== 'section' && !brokenNodeIds.includes(n.id))

  // Budget: pinned always kept; drop the cheapest-to-lose until under limit.
  const pinnedTotal = renderable.filter(n => n.pinned).reduce((s, n) => s + cost(n.id), 0)
  const droppable = renderable
    .filter(n => !n.pinned)
    .sort((a, b) => a.priority - b.priority || a.updated_at.localeCompare(b.updated_at))
  let total = pinnedTotal + droppable.reduce((s, n) => s + cost(n.id), 0)
  const droppedNodeIds: string[] = []
  for (const n of droppable) {
    if (total <= config.token_limit) break
    droppedNodeIds.push(n.id)
    total -= cost(n.id)
  }
  const kept = renderable.filter(n => !droppedNodeIds.includes(n.id))
  if (kept.length === 0) {
    return { compiled: '', tokenCount: 0, droppedNodeIds, brokenNodeIds, perNodeTokens, expiredNodeIds }
  }

  // Grouping (deterministic): sections by created_at; nodes by priority DESC, created_at ASC.
  // Named tags: within ungrouped nodes, emit [tagName] headings for tag_name != null.
  const keptIds = new Set(kept.map(n => n.id))
  const byGroup = (list: CompileNode[]) =>
    [...list].sort((a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at))
  const sortedSections = [...sections].sort((a, b) => a.created_at.localeCompare(b.created_at))

  const parts: string[] = ['[BRAIN]', 'This is your knowledge base about the user, curated by them and by you.', '']
  const grouped = new Set<string>()
  for (const s of sortedSections) {
    const members = byGroup(kept.filter(n => n.section_id === s.id))
    if (members.length === 0) continue
    parts.push(renderNode(s, config.per_node_cap))
    for (const m of members) { parts.push(rendered.get(m.id)!); grouped.add(m.id) }
    parts.push('')
  }
  const unsorted = byGroup(kept.filter(n => !grouped.has(n.id)))
  if (unsorted.length > 0) {
    if (sortedSections.some(s => kept.some(n => n.section_id === s.id))) parts.push('## Unsorted')

    // Tag grouping among unsorted: named tags first (stable order by name), then untagged.
    const tagMap = new Map<string, CompileNode[]>()
    const untagged: CompileNode[] = []
    for (const m of unsorted) {
      const tag = m.tag_name?.trim() || null
      if (tag) {
        const list = tagMap.get(tag) ?? []
        list.push(m)
        tagMap.set(tag, list)
      } else {
        untagged.push(m)
      }
    }
    const tagNames = [...tagMap.keys()].sort((a, b) => a.localeCompare(b))
    for (const tag of tagNames) {
      const members = tagMap.get(tag)!
      parts.push(`[${tag}]`)
      for (const m of members) parts.push(rendered.get(m.id)!)
    }
    for (const m of untagged) parts.push(rendered.get(m.id)!)
    parts.push('')
  }

  const titleOf = (id: string) => { const n = kept.find(k => k.id === id); return n ? nodeTitle(n) : null }
  const edgeLines = [...edges]
    .filter(e => keptIds.has(e.from_node) && keptIds.has(e.to_node))
    .map(e => e.label?.trim()
      ? `- Connection between "${titleOf(e.from_node)}" and "${titleOf(e.to_node)}": ${e.label}`
      : `- "${titleOf(e.from_node)}" and "${titleOf(e.to_node)}" are related.`)
  if (edgeLines.length > 0) { parts.push('## Connections'); parts.push(...edgeLines); parts.push('') }

  parts.push('[/BRAIN]')
  const compiled = parts.join('\n')
  return {
    compiled,
    tokenCount: estimateTokens(compiled),
    droppedNodeIds,
    brokenNodeIds,
    perNodeTokens,
    expiredNodeIds,
  }
}
