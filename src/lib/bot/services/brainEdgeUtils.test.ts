import { describe, it, expect } from 'vitest'
import {
  isSameNodePair,
  hasEdgeBetween,
  undirectedPairKey,
  partitionDuplicateEdges,
} from './brainEdgeUtils'

describe('isSameNodePair', () => {
  it('matches same direction', () => {
    expect(isSameNodePair('a', 'b', 'a', 'b')).toBe(true)
  })

  it('matches reverse direction', () => {
    expect(isSameNodePair('a', 'b', 'b', 'a')).toBe(true)
  })

  it('rejects a different pair', () => {
    expect(isSameNodePair('a', 'b', 'a', 'c')).toBe(false)
    expect(isSameNodePair('a', 'b', 'c', 'd')).toBe(false)
  })
})

describe('hasEdgeBetween', () => {
  const edges = [
    { from_node: 'a', to_node: 'b' },
    { from_node: 'c', to_node: 'd' },
  ]

  it('finds same-direction edge', () => {
    expect(hasEdgeBetween(edges, 'a', 'b')).toBe(true)
  })

  it('finds reverse-direction edge', () => {
    expect(hasEdgeBetween(edges, 'b', 'a')).toBe(true)
  })

  it('returns false for unconnected pair', () => {
    expect(hasEdgeBetween(edges, 'a', 'c')).toBe(false)
  })

  it('returns false for empty list', () => {
    expect(hasEdgeBetween([], 'a', 'b')).toBe(false)
  })
})

describe('undirectedPairKey', () => {
  it('is order-independent', () => {
    expect(undirectedPairKey('a', 'b')).toBe(undirectedPairKey('b', 'a'))
  })
})

describe('partitionDuplicateEdges', () => {
  it('keeps unique pairs untouched', () => {
    const edges = [
      { id: '1', from_node: 'a', to_node: 'b', created_at: '2026-01-01' },
      { id: '2', from_node: 'c', to_node: 'd', created_at: '2026-01-02' },
    ]
    const { keep, removeIds } = partitionDuplicateEdges(edges)
    expect(keep).toHaveLength(2)
    expect(removeIds).toEqual([])
  })

  it('keeps oldest of same-direction duplicates', () => {
    const edges = [
      { id: 'new', from_node: 'a', to_node: 'b', created_at: '2026-01-03' },
      { id: 'old', from_node: 'a', to_node: 'b', created_at: '2026-01-01' },
      { id: 'mid', from_node: 'a', to_node: 'b', created_at: '2026-01-02' },
    ]
    const { keep, removeIds } = partitionDuplicateEdges(edges)
    expect(keep.map(e => e.id)).toEqual(['old'])
    expect(removeIds.sort()).toEqual(['mid', 'new'])
  })

  it('treats reverse-direction as the same pair', () => {
    const edges = [
      { id: 'ab', from_node: 'a', to_node: 'b', created_at: '2026-01-01' },
      { id: 'ba', from_node: 'b', to_node: 'a', created_at: '2026-01-02' },
    ]
    const { keep, removeIds } = partitionDuplicateEdges(edges)
    expect(keep.map(e => e.id)).toEqual(['ab'])
    expect(removeIds).toEqual(['ba'])
  })
})
