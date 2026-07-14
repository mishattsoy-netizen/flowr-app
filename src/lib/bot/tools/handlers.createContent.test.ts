import { describe, it, expect, vi, beforeEach } from 'vitest'

// Captures the row create_content actually sends to Supabase, so we can assert
// on the persisted note body rather than just the tool's success return value.
const insertedRows: any[] = []

vi.mock('../../supabase', () => {
  const builder = (table: string) => ({
    insert: (row: any) => {
      insertedRows.push({ table, row })
      return Promise.resolve({ error: null })
    },
    // create_content's dedup pre-check, awaited as a thenable. Resolving to no
    // rows keeps the handler on the insert path.
    select: () => {
      const q: any = {
        eq: () => q,
        gte: () => q,
        is: () => q,
        limit: () => q,
        order: () => q,
        single: () => Promise.resolve({ data: null, error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: any) => resolve({ data: [], error: null }),
      }
      return q
    },
  })
  return { supabaseAdmin: { from: (table: string) => builder(table) } }
})

// activeSpaceId short-circuits resolveSpaceId's profile/space lookups.
const ctx = { userId: '11111111-1111-1111-1111-111111111111', sessionId: 'temp', activeSpaceId: 'space-1' }

async function createNote(args: Record<string, unknown>) {
  const { toolHandlers } = await import('./handlers')
  const result = await toolHandlers.create_content({ type: 'note', title: 'T', ...args }, ctx)
  const row = insertedRows.find(r => r.table === 'entities')?.row
  return { result, row }
}

describe('create_content: note body', () => {
  beforeEach(() => { insertedRows.length = 0 })

  it('persists a body when the model supplies markdown via `content`', async () => {
    const { result, row } = await createNote({ content: '# Reasons\n\nNo privacy policy' })
    expect(result.success).toBe(true)
    expect(row.content.length).toBeGreaterThan(0)
  })

  // Regression test for a live bug (2026-07-14): the tool schema advertises
  // `blocks` as an alternative to `content` for notes, but the handler read
  // only `content` — so a model that chose blocks got a note with an empty
  // body while the tool still returned success and the bot reported the note
  // as created with all its sections.
  it('persists a body when the model supplies structured `blocks` instead', async () => {
    const { result, row } = await createNote({
      blocks: [
        { type: 'text', style: 'heading', content: 'No Privacy Policy' },
        { type: 'text', content: 'GDPR fines go up to €20 million' },
      ],
    })
    expect(result.success).toBe(true)
    expect(row.content).toHaveLength(2)
    expect(JSON.stringify(row.content)).toContain('GDPR fines')
  })

  // The tool schema described heading/subheading/mono as block TYPES, but they
  // are styles on a 'text' block — normalizeBlocks silently dropped any block
  // whose type wasn't recognized, so every heading the model wrote vanished
  // from the note. The schema is corrected; blocks stay tolerant of the alias.
  it('keeps heading blocks the model sends as a bare `type` instead of a style', async () => {
    const { row } = await createNote({
      blocks: [
        { type: 'heading', content: 'No Cookie Consent' },
        { type: 'bulletList', content: 'Trackers need consent in the EU' },
      ],
    })
    expect(row.content).toHaveLength(2)
    expect(row.content[0]).toMatchObject({ type: 'text', style: 'heading', content: 'No Cookie Consent' })
  })

  it('keeps table payloads instead of persisting an empty table block', async () => {
    const { row } = await createNote({
      blocks: [{ type: 'table', content: '', tableData: [['Risk', 'Fine'], ['No policy', '€20M']] }],
    })
    expect(row.content[0].tableData).toEqual([['Risk', 'Fine'], ['No policy', '€20M']])
  })

  it('stamps last_modified so the note does not render as Jan 1 1970', async () => {
    const { row } = await createNote({ content: 'body' })
    expect(row.last_modified).toBeGreaterThan(1_700_000_000_000)
  })
})
