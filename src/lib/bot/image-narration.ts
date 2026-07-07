import { logger } from '../logger'
import { getRouterChain, IntentCategory } from '../router-config'
import { runGoogle } from './providers/google'
import { runCloudflare } from './providers/cloudflare'
import { runOpenRouter } from './providers/openrouter'
import { runGroq } from './providers/groq'
import { getChainPrompt } from './prompts'

export async function narrateGeneratedImage(
  imageBuffer: Buffer,
  context?: any
): Promise<{ description: string; modelId: string; provider: string } | null> {
  const chainCategory: IntentCategory = 'VISION'
  const systemPrompt = getChainPrompt('image_narration')

  const { chain } = await getRouterChain(chainCategory, 'default')
  if (!chain || chain.length === 0) {
    logger.warn(`No ${chainCategory} chain available for image narration`)
    return null
  }

  const prompt = 'Describe this image in detail (250-700 characters).'

  // Strip onChunk so narration tokens don't leak into the user-facing chat stream
  // (the narration is returned as image_description, not as message content).
  const subContext = { ...(context || {}), onChunk: undefined }

  for (const model of chain) {
    if (!model.is_enabled) continue

    try {
      let response: any = null
      const provider = model.provider.toLowerCase()

      if (provider === 'google' || provider === 'gemini') {
        response = await runGoogle(model.id, prompt, systemPrompt, imageBuffer, subContext, [])
      } else if (provider === 'cloudflare') {
        response = await runCloudflare(model.id, prompt, subContext?.aiApiKey, systemPrompt, [], 'VISION')
      } else if (provider === 'openrouter') {
        response = await runOpenRouter(model.id, prompt, systemPrompt, [], subContext?.aiApiKey, { ...subContext, openrouterProvider: model.openrouter_provider }, imageBuffer)
      } else if (provider === 'groq') {
        response = await runGroq(model.id, prompt, systemPrompt, subContext?.aiApiKey, subContext, [], imageBuffer)
      }

      if (response) {
        const description = typeof response === 'object' ? response.content : response
        if (description && description.length >= 10) {
          logger.info(`Narrated image using ${model.id}: ${description.slice(0, 50)}...`)
          return { description: description.trim(), modelId: model.id, provider: model.provider }
        }
      }
    } catch (e: any) {
      logger.warn(`Narration failed with ${model.id}: ${e.message}`)
    }
  }

  return null
}
