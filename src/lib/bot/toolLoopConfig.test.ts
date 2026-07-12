import { describe, it, expect } from 'vitest'
import {
  resolveMaxToolHops,
  MAX_TOOL_HOPS_SMART,
  MAX_TOOL_HOPS_LIGHT,
  toolCallKey,
  checkRepeatedFailure,
  recordToolFailure,
} from './toolLoopConfig'

describe('resolveMaxToolHops', () => {
  it('gives smart tier the higher ceiling', () => {
    expect(resolveMaxToolHops({ toolTier: 'smart' })).toBe(MAX_TOOL_HOPS_SMART)
  })
  it('gives light tier the tight ceiling', () => {
    expect(resolveMaxToolHops({ toolTier: 'light' })).toBe(MAX_TOOL_HOPS_LIGHT)
  })
  it('defaults to the tight ceiling for unknown/missing tier (preserves legacy 4)', () => {
    expect(resolveMaxToolHops({})).toBe(MAX_TOOL_HOPS_LIGHT)
    expect(resolveMaxToolHops(undefined)).toBe(MAX_TOOL_HOPS_LIGHT)
  })
})

describe('toolCallKey', () => {
  it('is stable regardless of argument key order', () => {
    expect(toolCallKey('create_content', { a: 1, b: 2 }))
      .toBe(toolCallKey('create_content', { b: 2, a: 1 }))
  })
  it('distinguishes different tools with identical args', () => {
    expect(toolCallKey('create_content', { id: 'x' }))
      .not.toBe(toolCallKey('delete_content', { id: 'x' }))
  })
  it('distinguishes different args for the same tool', () => {
    expect(toolCallKey('create_content', { title: 'a' }))
      .not.toBe(toolCallKey('create_content', { title: 'b' }))
  })
})

describe('checkRepeatedFailure', () => {
  it('returns null for a call that has not failed before', () => {
    const failed = new Map<string, string>()
    expect(checkRepeatedFailure('create_content', { title: 'x' }, failed)).toBe(null)
  })

  it('intercepts an identical call that already failed, and surfaces the original error', () => {
    const failed = new Map<string, string>()
    recordToolFailure('create_content', { title: 'x' }, 'permission denied', failed)

    const result = checkRepeatedFailure('create_content', { title: 'x' }, failed)
    expect(result).not.toBe(null)
    expect(result!.repeated_call).toBe(true)
    expect(result!.error).toContain('permission denied')
    expect(result!.error).toContain('already failed')
  })

  it('does NOT intercept a different call to the same tool (model may retry differently)', () => {
    const failed = new Map<string, string>()
    recordToolFailure('create_content', { title: 'x' }, 'boom', failed)
    expect(checkRepeatedFailure('create_content', { title: 'different' }, failed)).toBe(null)
  })

  it('does NOT intercept a call that previously SUCCEEDED (re-reads stay legal)', () => {
    const failed = new Map<string, string>()
    // nothing recorded — a success is never recorded
    expect(checkRepeatedFailure('list_content', { searchQuery: 'tasks' }, failed)).toBe(null)
  })

  it('matches irrespective of arg key ordering', () => {
    const failed = new Map<string, string>()
    recordToolFailure('update_content', { id: '1', title: 't' }, 'not found', failed)
    expect(checkRepeatedFailure('update_content', { title: 't', id: '1' }, failed)).not.toBe(null)
  })
})
