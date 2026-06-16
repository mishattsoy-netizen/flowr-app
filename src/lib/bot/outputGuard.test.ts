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
