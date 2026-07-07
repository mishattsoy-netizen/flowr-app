import { logger } from '../logger'
import { getRouterChain, IntentCategory } from '../router-config'
import { getProviderKeys } from '../vault'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { runOpenRouter } from './providers/openrouter'
import { getChainPrompt } from './prompts'

export async function expandImagePrompt(
  prompt: string,
  history: any[],
  context: any
): Promise<{ expanded: string; modelId?: string; provider?: string }> {
  const chainCategory: IntentCategory = 'REGULAR'
  const systemPrompt = getChainPrompt('prompt_expander')

  const { chain } = await getRouterChain(chainCategory, 'default')
  if (!chain || chain.length === 0) {
    logger.warn(`No ${chainCategory} chain available for prompt expansion`)
    return { expanded: prompt }
  }

  const expansionPrompt = `User Request: "${prompt}"\n\nGenerate a detailed image prompt based on this and the provided conversation history.`

  // Strip onChunk so the expanded prompt isn't streamed to the user as chat content.
  const subContext = { ...(context || {}), onChunk: undefined }

  for (const model of chain) {
    if (!model.is_enabled) continue

    try {
      let response: any = null
      const provider = model.provider.toLowerCase()

      if (provider === 'google' || provider === 'gemini') {
        response = await runGoogle(model.id, expansionPrompt, systemPrompt, undefined, subContext, history)
      } else if (provider === 'groq') {
        response = await runGroq(model.id, expansionPrompt, systemPrompt, subContext?.aiApiKey, subContext, history)
      } else if (provider === 'openrouter') {
        const keys = await getProviderKeys('OPENROUTER')
        response = await runOpenRouter(model.id, expansionPrompt, systemPrompt, history, subContext?.aiApiKey || keys[0], { ...subContext, openrouterProvider: model.openrouter_provider })
      } else if (provider === 'pollinations') {
        const { runPollinationsText } = await import('./providers/pollinations')
        response = await runPollinationsText(model.id, expansionPrompt, systemPrompt, history, subContext?.aiApiKey)
      }

      if (response) {
        const expanded = typeof response === 'object' ? response.content : response
        if (expanded && expanded.length > 5) {
          logger.info(`Expanded image prompt: "${prompt}" -> "${expanded.slice(0, 100)}..."`)
          return { expanded: expanded.trim(), modelId: model.id, provider: model.provider }
        }
      }
    } catch (e: any) {
      logger.warn(`Prompt expansion failed with ${model.id}: ${e.message}`)
    }
  }

  logger.warn(`All ${chainCategory} models exhausted for prompt expansion, using original: "${prompt}"`)
  return { expanded: prompt }
}
