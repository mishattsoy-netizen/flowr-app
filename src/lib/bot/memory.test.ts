import { describe, it, expect } from 'vitest'
import { stripToolSummary } from './memory'

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
