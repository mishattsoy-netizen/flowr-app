// src/lib/bot/outputGuard.test.ts
import { describe, it, expect } from 'vitest'
import { sanitizeOutput, SANITIZE_PATTERNS } from './outputGuard'

describe('sanitizeOutput', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeOutput('')).toBe('')
  })

  it('passes through clean text unchanged', () => {
    const clean = 'Hello! Here is your answer.\n\nIt has multiple paragraphs.'
    expect(sanitizeOutput(clean)).toBe(clean)
  })

  it('strips [SEARCH] query prefixes', () => {
    const input = '[SEARCH] hottest AI news June 21 2026\n\nHere is the actual answer.'
    expect(sanitizeOutput(input)).toBe('Here is the actual answer.')
  })

  it('strips [THINK CHAIN DIRECTION] blocks', () => {
    const input = '[THINK CHAIN DIRECTION]\nReviewed: search, vision\nGap found: none\nDirection: Answer directly\n\nHere is the actual answer.'
    expect(sanitizeOutput(input)).toBe('Here is the actual answer.')
  })

  it('strips [SESSION MEMORY SUMMARY] blocks', () => {
    const input = 'Answer start.\n\n[SESSION MEMORY SUMMARY]\nUser likes dark mode.\nPrevious topic: coding.\n\nAnswer continues.'
    expect(sanitizeOutput(input)).toBe('Answer start.\n\nAnswer continues.')
  })

  it('strips [SEARCH DATA] blocks', () => {
    const input = '[SEARCH DATA]\nResult 1: ...\nResult 2: ...\n\nBased on my research, here is the answer.'
    expect(sanitizeOutput(input)).toBe('Based on my research, here is the answer.')
  })

  it('strips [SEARCH DATA: model-id] variant', () => {
    const input = '[SEARCH DATA: tavily-search]\nResult 1: ...\n\nThe answer is 42.'
    expect(sanitizeOutput(input)).toBe('The answer is 42.')
  })

  it('strips [VISION_CONTEXT]...[/VISION_CONTEXT] paired blocks', () => {
    const input = 'Before.\n[VISION_CONTEXT]The image shows a cat.[/VISION_CONTEXT]\nAfter.'
    expect(sanitizeOutput(input)).toBe('Before.\n\nAfter.')
  })

  it('strips <thought>...</thought> XML tags', () => {
    const input = '<thought>I need to think about this carefully.</thought>\n\nThe answer is 42.'
    expect(sanitizeOutput(input)).toBe('The answer is 42.')
  })

  it('strips <thinking>...</thinking> XML tags', () => {
    const input = '<thinking>Let me reason step by step.</thinking>\n\nHere is my conclusion.'
    expect(sanitizeOutput(input)).toBe('Here is my conclusion.')
  })

  it('strips [CONTEXT: ...] inline hints', () => {
    const input = '[CONTEXT: An image is present earlier in the conversation.]\nUser asked about weather.'
    expect(sanitizeOutput(input)).toBe('User asked about weather.')
  })

  it('strips [INTERNAL]...[/INTERNAL] paired blocks', () => {
    const input = 'Start.\n[INTERNAL]Debug info here.[/INTERNAL]\nEnd.'
    expect(sanitizeOutput(input)).toBe('Start.\n\nEnd.')
  })

  it('strips multiple different blocks in one response', () => {
    const input = [
      '[THINK CHAIN DIRECTION]',
      'Direction: be concise',
      '',
      '[SESSION MEMORY SUMMARY]',
      'User prefers short answers.',
      '',
      'The actual response the user should see.',
    ].join('\n')
    expect(sanitizeOutput(input)).toBe('The actual response the user should see.')
  })

  it('is idempotent — calling twice gives the same result', () => {
    const input = '[SEARCH DATA]\ndata\n\nClean text.'
    const first = sanitizeOutput(input)
    const second = sanitizeOutput(first)
    expect(first).toBe(second)
  })

  it('does not corrupt partial brackets that are user content', () => {
    const input = 'Use array[0] to access the first element.'
    expect(sanitizeOutput(input)).toBe('Use array[0] to access the first element.')
  })

  it('collapses excessive newlines left by removed blocks', () => {
    const input = 'Paragraph 1.\n\n[SEARCH DATA]\nstuff\n\n\n\nParagraph 2.'
    const result = sanitizeOutput(input)
    expect(result).not.toContain('\n\n\n')
  })

  it('SANITIZE_PATTERNS is a non-empty array', () => {
    expect(SANITIZE_PATTERNS.length).toBeGreaterThan(10)
    for (const [pattern, desc] of SANITIZE_PATTERNS) {
      expect(pattern).toBeInstanceOf(RegExp)
      expect(desc).toBeTruthy()
    }
  })
})

import { stripToolAnnotations, hasUngroundedActionClaim } from './outputGuard'

describe('stripToolAnnotations', () => {
  it('removes [Tools: ...] blocks anywhere in the message', () => {
    const dirty = 'Created it.\n\n[Tools: create_content(title="x") → ok]\n\nAnything else?'
    expect(stripToolAnnotations(dirty)).toBe('Created it.\n\nAnything else?')
  })
  it('leaves clean content untouched', () => {
    expect(stripToolAnnotations('All done ✅')).toBe('All done ✅')
  })
})

describe('hasUngroundedActionClaim', () => {
  it('flags completed-action claims when no tools ran', () => {
    expect(hasUngroundedActionClaim('The note has been permanently deleted.', [])).toBe(true)
    expect(hasUngroundedActionClaim('I have already deleted those items for you.', undefined)).toBe(true)
    expect(hasUngroundedActionClaim('✅ Task successfully created.', [])).toBe(true)
  })
  it('accepts claims when tools ran', () => {
    expect(hasUngroundedActionClaim('The note has been deleted.', [{ tool: 'delete_content', success: true }])).toBe(false)
  })
  it('does not flag offers, questions, or future tense', () => {
    expect(hasUngroundedActionClaim('I can delete it if you confirm.', [])).toBe(false)
    expect(hasUngroundedActionClaim('Should I create the task?', [])).toBe(false)
    expect(hasUngroundedActionClaim('Please confirm you want this deleted.', [])).toBe(false)
  })
  it('does not flag historical prose about non-app entities', () => {
    expect(hasUngroundedActionClaim('The company was created in 2019 by two founders.', [])).toBe(false)
    expect(hasUngroundedActionClaim('The file was moved to a new data center last year.', [])).toBe(false)
  })
  it('flags a claim when the mutating tool RAN but FAILED', () => {
    expect(hasUngroundedActionClaim('The note has been created.', [
      { tool: 'create_content', success: false, error: 'permission denied' },
    ])).toBe(true)
  })
  it('flags a claim when only a READ succeeded (reads do not ground mutations)', () => {
    expect(hasUngroundedActionClaim('I have created the task.', [
      { tool: 'list_content', success: true },
    ])).toBe(true)
  })
  it('accepts a claim when one mutation succeeded even if another failed', () => {
    expect(hasUngroundedActionClaim('The task has been created.', [
      { tool: 'create_content', success: false },
      { tool: 'create_content', success: true },
    ])).toBe(false)
  })
  it('accepts when a mutation ran and the provider omitted the success flag', () => {
    expect(hasUngroundedActionClaim('The note has been updated.', [
      { tool: 'update_content' },
    ])).toBe(false)
  })
  it('flags a claim when delete_content only returned a dry-run (pending_confirmation), not an actual delete', () => {
    expect(hasUngroundedActionClaim('The task has been deleted.', [
      { tool: 'delete_content', status: 'pending_confirmation', items_to_delete: [{ id: 'task-1', title: 'x' }] },
    ])).toBe(true)
  })
  it('flags a claim when update_content only returned a dry-run (pending_confirmation), not an actual replace', () => {
    expect(hasUngroundedActionClaim('The note has been updated.', [
      { tool: 'update_content', status: 'pending_confirmation', item: { id: 'e-1', title: 'x' } },
    ])).toBe(true)
  })
})

describe('hasUngroundedActionClaim — extended verbs', () => {
  const readOnly = [{ tool: 'list_content', success: true }]

  it('catches "I\'ve placed it in a quote block" with no write call', () => {
    const reply = "It's right at the top of the note. I've placed it in a quote block immediately below the title."
    expect(hasUngroundedActionClaim(reply, readOnly)).toBe(true)
  })

  it('catches "I added the balance to your note"', () => {
    expect(hasUngroundedActionClaim('I added the balance to your note.', readOnly)).toBe(true)
  })

  it('catches "has been saved to the folder"', () => {
    expect(hasUngroundedActionClaim('The report has been saved to the folder.', readOnly)).toBe(true)
  })

  it('does not flag prose without app entities', () => {
    expect(hasUngroundedActionClaim('The company was created in 2019 and has been renamed twice.', readOnly)).toBe(false)
  })

  it('does not flag when a mutation succeeded', () => {
    const calls = [{ tool: 'update_content', success: true }]
    expect(hasUngroundedActionClaim('I added the balance to your note.', calls)).toBe(false)
  })
})
