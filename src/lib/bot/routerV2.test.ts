import { describe, it, expect } from 'vitest'
import { parseClassifierV2Output, selectTier, resolveThinkingLevel } from './routerV2'

describe('parseClassifierV2Output', () => {
  it('parses clean JSON', () => {
    expect(parseClassifierV2Output('{"category":"PRIMARY","complexity":"hard","action":true}'))
      .toEqual({ category: 'PRIMARY', complexity: 'hard', action: true })
  })
  it('parses JSON wrapped in fences/preamble', () => {
    const raw = 'Here you go:\n```json\n{"category": "WEB_SEARCH", "complexity": "normal", "action": false}\n```'
    expect(parseClassifierV2Output(raw))
      .toEqual({ category: 'WEB_SEARCH', complexity: 'normal', action: false })
  })
  it('salvages a bare category word (defaults: normal, action=true)', () => {
    expect(parseClassifierV2Output('PRIMARY'))
      .toEqual({ category: 'PRIMARY', complexity: 'normal', action: true })
    expect(parseClassifierV2Output('Category: IMAGE_GEN'))
      .toEqual({ category: 'IMAGE_GEN', complexity: 'normal', action: true })
  })
  it('normalizes invalid flag values to safe defaults', () => {
    expect(parseClassifierV2Output('{"category":"PRIMARY","complexity":"extreme","action":"yes"}'))
      .toEqual({ category: 'PRIMARY', complexity: 'normal', action: true })
  })
  it('returns null when no category is recognizable', () => {
    expect(parseClassifierV2Output('I am not sure')).toBe(null)
    expect(parseClassifierV2Output('')).toBe(null)
  })
})

describe('selectTier', () => {
  it('action requests go Smart', () => {
    expect(selectTier({ action: true, complexity: 'normal', extendedThinking: false })).toBe('smart')
  })
  it('hard requests go Smart', () => {
    expect(selectTier({ action: false, complexity: 'hard', extendedThinking: false })).toBe('smart')
  })
  it('extended thinking goes Smart', () => {
    expect(selectTier({ action: false, complexity: 'normal', extendedThinking: true })).toBe('smart')
  })
  it('plain chat goes Light', () => {
    expect(selectTier({ action: false, complexity: 'normal', extendedThinking: false })).toBe('light')
  })
})

describe('resolveThinkingLevel', () => {
  it('toggle forces high', () => {
    expect(resolveThinkingLevel({ complexity: 'normal', thinkingToggle: true })).toBe('high')
  })
  it('hard complexity auto-escalates to high', () => {
    expect(resolveThinkingLevel({ complexity: 'hard', thinkingToggle: false })).toBe('high')
  })
  it('defaults to medium', () => {
    expect(resolveThinkingLevel({ complexity: 'normal', thinkingToggle: false })).toBe('medium')
  })
})
