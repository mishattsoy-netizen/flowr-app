import { describe, it, expect } from 'vitest'
import { reattachBlockIds } from './reattachBlockIds'

const b = (id: string, type: string, content: string, extra: object = {}) =>
  ({ id, type, content, ...extra }) as any

describe('reattachBlockIds', () => {
  it('keeps every old ID when only one block content changed', () => {
    const oldB = [b('a', 'text', 'Title'), b('b', 'table', ''), b('c', 'text', 'net ~−$4,865')]
    const newB = [b('x', 'text', 'Title'), b('y', 'table', ''), b('z', 'text', 'net -$4,699.07')]
    const out = reattachBlockIds(oldB, newB)
    expect(out.map(x => x.id)).toEqual(['a', 'b', 'c'])
    expect(out[2].content).toBe('net -$4,699.07')
  })

  it('keeps new IDs for inserted blocks and old IDs around them', () => {
    const oldB = [b('a', 'text', 'one'), b('c', 'text', 'three')]
    const newB = [b('x', 'text', 'one'), b('y', 'text', 'two'), b('z', 'text', 'three')]
    const out = reattachBlockIds(oldB, newB)
    expect(out[0].id).toBe('a')
    expect(out[2].id).toBe('c')
    expect(out[1].id).toBe('y')
  })

  it('never assigns the same old ID twice', () => {
    const oldB = [b('a', 'text', 'dup')]
    const newB = [b('x', 'text', 'dup'), b('y', 'text', 'dup')]
    const out = reattachBlockIds(oldB, newB)
    const ids = out.map(x => x.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('does not reuse an ID across different block types', () => {
    const oldB = [b('a', 'text', 'same')]
    const newB = [b('x', 'quote', 'same')]
    const out = reattachBlockIds(oldB, newB)
    expect(out[0].id).toBe('x')
  })
})
