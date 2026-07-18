import { describe, it, expect } from 'vitest'
import { compileBrainDocument, brainVersionKey } from './brainCompiler'
import type { CompileNode, CompileEdge, BrainConfigRow } from './brainTypes'

const cfg: BrainConfigRow = { tier: 'test', token_limit: 10000, per_node_cap: 2000 }

const memory = (over: Partial<CompileNode> = {}): CompileNode => ({
  id: over.id ?? 'm1', type: 'memory', label: null, content: 'likes espresso',
  section_id: null, priority: 0, pinned: false, enabled: true,
  created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z',
  resolved: null, tag_name: null, active_from: null, active_until: null, ...over,
})

describe('compileBrainDocument', () => {
  it('returns empty compiled text for an empty brain (no [BRAIN] wrapper)', () => {
    const out = compileBrainDocument([], [], cfg)
    expect(out.compiled).toBe('')
    expect(out.tokenCount).toBe(0)
  })

  it('renders a memory node inside the [BRAIN] wrapper', () => {
    const out = compileBrainDocument([memory()], [], cfg)
    expect(out.compiled).toContain('[BRAIN]')
    expect(out.compiled).toContain('- likes espresso')
    expect(out.compiled).toContain('[/BRAIN]')
  })

  it('excludes disabled nodes entirely', () => {
    const out = compileBrainDocument([memory({ enabled: false })], [], cfg)
    expect(out.compiled).toBe('')
  })

  it('reports unresolved ref nodes as broken and excludes them', () => {
    const node = memory({ id: 'e1', type: 'entity', content: null, resolved: null })
    const out = compileBrainDocument([node], [], cfg)
    expect(out.brokenNodeIds).toEqual(['e1'])
    expect(out.compiled).toBe('')
  })

  it('groups nodes under their section heading, rest under Unsorted', () => {
    const section = memory({ id: 's1', type: 'section', label: 'Profile', content: null })
    const inSection = memory({ id: 'm2', content: 'works remotely', section_id: 's1' })
    const loose = memory({ id: 'm3', content: 'night owl' })
    const out = compileBrainDocument([section, inSection, loose], [], cfg)
    expect(out.compiled.indexOf('## Profile')).toBeGreaterThan(-1)
    expect(out.compiled.indexOf('- works remotely')).toBeGreaterThan(out.compiled.indexOf('## Profile'))
    expect(out.compiled.indexOf('## Unsorted')).toBeGreaterThan(-1)
    expect(out.compiled.indexOf('- night owl')).toBeGreaterThan(out.compiled.indexOf('## Unsorted'))
  })

  it('truncates entity markdown at the per-node cap with a marker', () => {
    const longLines = Array.from({ length: 500 }, (_, i) => `line ${i} of a long note body`).join('\n')
    const node = memory({
      id: 'e1', type: 'entity', content: null,
      resolved: { title: 'Big note', markdown: longLines },
    })
    const out = compileBrainDocument([node], [], { ...cfg, per_node_cap: 100 })
    expect(out.compiled).toContain('[truncated]')
    expect(out.compiled).not.toContain('line 499')
  })

  it('drops lowest-priority, longest-untouched nodes first when over budget, never pinned ones', () => {
    const keepPinned = memory({ id: 'p1', content: 'PINNED '.repeat(30), pinned: true, priority: 0 })
    const keepHigh   = memory({ id: 'h1', content: 'HIGH '.repeat(30), priority: 5 })
    const dropOld    = memory({ id: 'd1', content: 'OLD '.repeat(30), priority: 0, updated_at: '2026-01-01T00:00:00Z' })
    // costs at chars/3.5: pinned ~61, high ~44, old ~35 tokens.
    // limit 110 fits pinned+high (105) but not all three (140) → only d1 drops.
    const out = compileBrainDocument([keepPinned, keepHigh, dropOld], [], { ...cfg, token_limit: 110 })
    expect(out.droppedNodeIds).toEqual(['d1'])
    expect(out.compiled).toContain('PINNED')
    expect(out.compiled).toContain('HIGH')
  })

  it('renders an edge as a plain sentence only when both endpoints are kept', () => {
    const a = memory({ id: 'a', label: 'Trading journal', content: 'daily log' })
    const b = memory({ id: 'b', label: 'Risk rules', content: 'max 2% per trade' })
    const edges: CompileEdge[] = [{ from_node: 'a', to_node: 'b', label: 'check rules before logging trades' }]
    const out = compileBrainDocument([a, b], edges, cfg)
    expect(out.compiled).toContain('- Connection between "Trading journal" and "Risk rules": check rules before logging trades')
    const dropped = compileBrainDocument([a], edges, cfg)
    expect(dropped.compiled).not.toContain('Connection between')
  })

  it('is deterministic — identical input produces identical bytes', () => {
    const nodes = [memory({ id: 'm1' }), memory({ id: 'm2', content: 'second' })]
    expect(compileBrainDocument(nodes, [], cfg).compiled)
      .toBe(compileBrainDocument(nodes, [], cfg).compiled)
  })

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
})

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
    const active = memory({
      id: 'a1', content: 'trip fact',
      active_from: '2026-07-10T00:00:00Z', active_until: '2026-07-25T00:00:00Z',
    })
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
    expect(out.compiled).not.toMatch(/\[[^\]]+\]\n- loose fact/)
    expect(out.compiled).toContain('- loose fact')
    expect(out.compiled).not.toContain('[loose')
  })

  it('does not let grouping remove a cross-group edge from the block', () => {
    const a = memory({ id: 'a', content: 'A', tag_name: 'X' })
    const b = memory({ id: 'b', content: 'B', tag_name: 'Y' })
    const edges = [{ from_node: 'a', to_node: 'b', label: 'relates to' }]
    const out = compileBrainDocument([a, b], edges, cfg)
    expect(out.compiled).toContain('relates to')
  })
})

describe('brainVersionKey', () => {
  it('is stable for identical parts and changes when any part changes', () => {
    expect(brainVersionKey(['a', 1, 'b'])).toBe(brainVersionKey(['a', 1, 'b']))
    expect(brainVersionKey(['a', 1, 'b'])).not.toBe(brainVersionKey(['a', 2, 'b']))
  })
})
