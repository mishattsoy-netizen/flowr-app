import { describe, it, expect } from 'vitest'
import { collapseUntitledNotes } from './collapseUntitled'

const note = (id: string, title: string) =>
  ({ id, title, type: 'note', description: null, parent_id: null, last_modified: 1 })

describe('collapseUntitledNotes', () => {
  it('collapses multiple root-level "New Note" items into a count', () => {
    const items = [note('a', 'New Note'), note('b', 'New Note'), note('c', 'Real Note')]
    const { items: out, collapsedCount } = collapseUntitledNotes(items)
    expect(collapsedCount).toBe(2)
    expect(out).toHaveLength(1)
    expect(out[0].title).toBe('Real Note')
  })

  it('keeps a single "New Note" (may be the one the user means)', () => {
    const items = [note('a', 'New Note'), note('c', 'Real Note')]
    const { items: out, collapsedCount } = collapseUntitledNotes(items)
    expect(collapsedCount).toBe(0)
    expect(out).toHaveLength(2)
  })

  it('never collapses non-note types or titled items', () => {
    const items = [
      { ...note('a', 'New Note'), type: 'folder' },
      { ...note('b', 'New Note'), type: 'folder' },
    ]
    expect(collapseUntitledNotes(items).collapsedCount).toBe(0)
  })
})
