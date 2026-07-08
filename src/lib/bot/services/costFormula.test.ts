import { describe, it, expect } from 'vitest'
import { computeModelCost } from './costFormula'

describe('computeModelCost', () => {
  it('computes plain cost with no cache tokens', () => {
    const cost = computeModelCost({
      prompt_tokens: 1000,
      completion_tokens: 500,
      prompt_cost: 0.000001,
      completion_cost: 0.000002,
    })
    expect(cost).toBeCloseTo(1000 * 0.000001 + 500 * 0.000002, 10)
  })

  it('discounts cache_read_tokens at cache_read_cost when configured', () => {
    const cost = computeModelCost({
      prompt_tokens: 1000,
      completion_tokens: 0,
      cache_read_tokens: 800,
      prompt_cost: 0.000001,
      completion_cost: 0.000002,
      cache_read_cost: 0.0000001,
    })
    // (1000 - 800) fresh tokens at full price + 800 cache-read tokens at discount
    expect(cost).toBeCloseTo(200 * 0.000001 + 800 * 0.0000001, 10)
  })

  it('falls back to full prompt_cost for cache_read_tokens when cache_read_cost is not configured', () => {
    const cost = computeModelCost({
      prompt_tokens: 1000,
      completion_tokens: 0,
      cache_read_tokens: 800,
      prompt_cost: 0.000001,
      completion_cost: 0.000002,
    })
    // No discount configured -> behaves like today (no regression)
    expect(cost).toBeCloseTo(1000 * 0.000001, 10)
  })

  it('applies cache_write_cost to cache_creation_tokens when configured', () => {
    const cost = computeModelCost({
      prompt_tokens: 1000,
      completion_tokens: 0,
      cache_creation_tokens: 300,
      prompt_cost: 0.000001,
      completion_cost: 0.000002,
      cache_write_cost: 0.0000005,
    })
    expect(cost).toBeCloseTo(1000 * 0.000001 + 300 * 0.0000005, 10)
  })

  it('treats missing prompt_cost/completion_cost as zero (dev-phase free models)', () => {
    const cost = computeModelCost({ prompt_tokens: 1000, completion_tokens: 500 })
    expect(cost).toBe(0)
  })

  it('never returns a negative cost even if cache_read_tokens exceeds prompt_tokens', () => {
    const cost = computeModelCost({
      prompt_tokens: 100,
      completion_tokens: 0,
      cache_read_tokens: 500,
      prompt_cost: 0.000001,
      cache_read_cost: 0.0000001,
    })
    expect(cost).toBeGreaterThanOrEqual(0)
  })
})
