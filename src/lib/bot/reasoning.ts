/**
 * Helper to map and translate unified thinking budgets to provider-specific configuration fields.
 */

export function toGeminiThinkingBudget(budget: string | number | undefined): number | undefined {
  if (budget === undefined) return undefined
  if (typeof budget === 'number') {
    return budget
  }
  const parsed = parseInt(budget, 10)
  if (!isNaN(parsed)) {
    return parsed
  }
  const lower = budget.toLowerCase()
  switch (lower) {
    case 'off':
      return 0
    case 'low':
      return 1024
    case 'medium':
      return 2048
    case 'high':
      return 4096
    default:
      return undefined
  }
}

export interface OpenRouterReasoningConfig {
  reasoning_effort?: 'low' | 'medium' | 'high'
  reasoning?: {
    effort?: 'low' | 'medium' | 'high'
    max_tokens?: number
  }
}

export function toOpenRouterReasoning(budget: string | number | undefined): OpenRouterReasoningConfig | undefined {
  if (budget === undefined) return undefined
  
  if (typeof budget === 'number') {
    return {
      reasoning: { max_tokens: budget }
    }
  }
  
  const parsed = parseInt(budget, 10)
  if (!isNaN(parsed)) {
    return {
      reasoning: { max_tokens: parsed }
    }
  }

  const lower = budget.toLowerCase()
  if (lower === 'off') {
    return undefined
  }

  const effort = (lower === 'low' || lower === 'medium' || lower === 'high') ? (lower as 'low' | 'medium' | 'high') : 'medium'

  return {
    reasoning_effort: effort,
    reasoning: { effort }
  }
}
