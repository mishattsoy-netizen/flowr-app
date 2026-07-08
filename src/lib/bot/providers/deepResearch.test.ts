import { describe, it, expect } from 'vitest'
import { buildPlannerPrompt, buildChecklist, parsePlannerOutput } from './deepResearch'

describe('buildPlannerPrompt', () => {
  it('embeds the planner system prompt and the user question', () => {
    const result = buildPlannerPrompt('best 10 llms under $20', 'PLANNER INSTRUCTIONS HERE')
    expect(result).toContain('PLANNER INSTRUCTIONS HERE')
    expect(result).toContain('best 10 llms under $20')
  })
})

describe('parsePlannerOutput', () => {
  it('parses a well-formed planner JSON response', () => {
    const raw = '{"queries": ["a", "b"], "mustInclude": ["Claude"], "constraints": ["under $20"]}'
    const result = parsePlannerOutput(raw, 'fallback query')
    expect(result).toEqual({ queries: ['a', 'b'], mustInclude: ['Claude'], constraints: ['under $20'] })
  })

  it('extracts JSON embedded in surrounding text', () => {
    const raw = 'Here is the plan:\n{"queries": ["x"], "mustInclude": [], "constraints": []}\nDone.'
    const result = parsePlannerOutput(raw, 'fallback query')
    expect(result.queries).toEqual(['x'])
  })

  it('caps queries at 3 even if the model returns more', () => {
    const raw = '{"queries": ["a", "b", "c", "d", "e"], "mustInclude": [], "constraints": []}'
    const result = parsePlannerOutput(raw, 'fallback query')
    expect(result.queries).toHaveLength(3)
  })

  it('falls back to a single query built from the original prompt when parsing fails', () => {
    const result = parsePlannerOutput('not json at all', 'fallback query')
    expect(result).toEqual({ queries: ['fallback query'], mustInclude: [], constraints: [] })
  })

  it('falls back when the model returns null/empty response', () => {
    const result = parsePlannerOutput(null, 'fallback query')
    expect(result).toEqual({ queries: ['fallback query'], mustInclude: [], constraints: [] })
  })

  it('falls back to the original query when queries array is empty', () => {
    const raw = '{"queries": [], "mustInclude": [], "constraints": []}'
    const result = parsePlannerOutput(raw, 'fallback query')
    expect(result.queries).toEqual(['fallback query'])
  })

  it('falls back completely, discarding mustInclude/constraints, when queries array is empty', () => {
    const raw = '{"queries": [], "mustInclude": ["Claude"], "constraints": ["under $20"]}'
    const result = parsePlannerOutput(raw, 'fallback query')
    expect(result).toEqual({ queries: ['fallback query'], mustInclude: [], constraints: [] })
  })
})

describe('buildChecklist', () => {
  it('returns empty string when there is nothing to check', () => {
    expect(buildChecklist({ queries: ['x'], mustInclude: [], constraints: [] })).toBe('')
  })

  it('formats mustInclude and constraints into a checklist block', () => {
    const result = buildChecklist({
      queries: ['x'],
      mustInclude: ['Claude'],
      constraints: ['under $20/month', 'output as a table'],
    })
    expect(result).toContain('Claude')
    expect(result).toContain('under $20/month')
    expect(result).toContain('output as a table')
  })
})
