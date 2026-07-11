import { describe, it, expect } from 'vitest'
import { stripToolSummary, resolveTwinForUserMessage } from './memory'

// Regression for the imitation-loop bug: buildToolSummary() (route.ts /
// webhook/route.ts) appends "\n\n[Tools: name(args) → result]" to the
// assistant content stored in message_logs. That same content is replayed
// as the model's own prior turn via getConversationMemory/
// getWebConversationMemory. Left unstripped, the model learns to emit
// "[Tools: ...]" as plain text instead of issuing real tool calls, which
// broke UI artifact rendering and leaked the annotation into Telegram
// messages.
describe('stripToolSummary', () => {
  it('removes a trailing single-tool summary', () => {
    const input = 'Created your task.\n\n[Tools: create_content(title="Buy milk") → id=task-1783]'
    expect(stripToolSummary(input)).toBe('Created your task.')
  })

  it('removes a trailing multi-tool summary', () => {
    const input = 'Done.\n\n[Tools: list_content(query="tasks") → 5 items | create_content(type="note") → ok]'
    expect(stripToolSummary(input)).toBe('Done.')
  })

  it('leaves content without a tool summary untouched', () => {
    const input = 'Just a normal reply with no tools used.'
    expect(stripToolSummary(input)).toBe(input)
  })

  it('does not touch bracketed text that is not a trailing tool summary', () => {
    const input = 'Check out [Tools: for the job] at the hardware store.'
    expect(stripToolSummary(input)).toBe(input)
  })
})

// Regression: the twin (image description) was previously always pulled from
// the FOLLOWING row regardless of role, which attached other people's images
// to unrelated messages (transcript 2026-07-10T14-47-19 — "generate image of
// michael jackson" carried a twin describing an unrelated portrait, and an
// empty message got answered with a description of a Dubai skyline).
describe('resolveTwinForUserMessage', () => {
  it('prefers the twin stored on the user row itself', () => {
    const msg = { role: 'user', context_messages: { image_description: 'own twin' } }
    const next = { role: 'model', context_messages: { image_description: 'other twin' } }
    expect(resolveTwinForUserMessage(msg, next)).toBe('own twin')
  })
  it('falls back to the following model row when own row has none', () => {
    const msg = { role: 'user', context_messages: null }
    const next = { role: 'model', context_messages: { image_description: 'legacy twin' } }
    expect(resolveTwinForUserMessage(msg, next)).toBe('legacy twin')
  })
  it('never borrows a twin from a following USER row', () => {
    const msg = { role: 'user', context_messages: null }
    const next = { role: 'user', context_messages: { image_description: 'someone elses' } }
    expect(resolveTwinForUserMessage(msg, next)).toBe(null)
  })
  it('returns null when no twin exists anywhere', () => {
    expect(resolveTwinForUserMessage({ role: 'user' }, { role: 'model' })).toBe(null)
  })
})
