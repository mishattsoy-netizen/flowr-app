import { describe, it, expect } from 'vitest'
import { resolveChainWithFallback } from './router-config'
import type { RouterModel } from './router-config'

const modelA: RouterModel = { id: 'model-a', provider: 'google', is_enabled: true }
const modelB: RouterModel = { id: 'model-b', provider: 'groq', is_enabled: true }

describe('resolveChainWithFallback', () => {
  it('uses the pro chain when it has enabled models', () => {
    const result = resolveChainWithFallback(
      { chain: [modelA] },
      { chain: [modelB] }
    )
    expect(result.chain).toEqual([modelA])
  })

  it('falls back to default when pro chain is empty', () => {
    const result = resolveChainWithFallback(
      { chain: [] },
      { chain: [modelB] }
    )
    expect(result.chain).toEqual([modelB])
  })

  it('falls back to default when pro chain is undefined (no row exists)', () => {
    const result = resolveChainWithFallback(
      undefined,
      { chain: [modelB] }
    )
    expect(result.chain).toEqual([modelB])
  })

  it('returns empty when both are empty', () => {
    const result = resolveChainWithFallback(
      { chain: [] },
      { chain: [] }
    )
    expect(result.chain).toEqual([])
  })

  it('preserves temperature and thinking_budget from the chosen chain', () => {
    const result = resolveChainWithFallback(
      { chain: [modelA], temperature: 0.9, thinking_budget: 'high' },
      { chain: [modelB], temperature: 0.5 }
    )
    expect(result.temperature).toBe(0.9)
    expect(result.thinking_budget).toBe('high')
  })
})
