export interface ModelCostInput {
  prompt_tokens: number
  completion_tokens: number
  cache_read_tokens?: number
  cache_creation_tokens?: number
  prompt_cost?: number | null
  completion_cost?: number | null
  cache_read_cost?: number | null
  cache_write_cost?: number | null
}

export function computeModelCost(input: ModelCostInput): number {
  const promptCost = input.prompt_cost ?? 0
  const completionCost = input.completion_cost ?? 0
  const cacheReadCost = input.cache_read_cost ?? promptCost
  const cacheWriteCost = input.cache_write_cost ?? promptCost

  const cacheReadTokens = Math.min(input.cache_read_tokens ?? 0, input.prompt_tokens)
  const freshPromptTokens = Math.max(0, input.prompt_tokens - cacheReadTokens)
  const cacheCreationTokens = input.cache_creation_tokens ?? 0

  return freshPromptTokens * promptCost
    + cacheReadTokens * cacheReadCost
    + cacheCreationTokens * cacheWriteCost
    + input.completion_tokens * completionCost
}
