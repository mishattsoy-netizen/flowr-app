import { logger } from '../logger'
import { getRouterChain } from '../router-config'
import { runGoogle } from './providers/google'
import { runCloudflare } from './providers/cloudflare'
import { runOpenRouter } from './providers/openrouter'

const NARRATION_SYSTEM_PROMPT = `You are an expert image analyst and storyteller. 
Your task is to provide a detailed, vivid description of the provided image.

Rules:
1. Length: Minimum 250 characters, Maximum 700 characters.
2. Content: Describe the subject, environment, lighting, colors, and mood.
3. Tone: Professional, descriptive, and engaging.
4. Output ONLY the description. No intro like "The image shows..." or "Here is the description:".
5. Focus on what is actually present in the image.`

/**
 * Uses a Vision model to narrate/describe a generated image buffer.
 */
export async function narrateGeneratedImage(
  imageBuffer: Buffer,
  context?: any
): Promise<{ description: string; modelId: string; provider: string } | null> {
  // 1. Get a Vision model
  const { chain } = await getRouterChain('VISION')
  const model = chain.find(m => m.is_enabled)

  if (!model) {
    logger.warn('No VISION model available for image narration')
    return null
  }

  try {
    let response: any = null
    const provider = model.provider.toLowerCase()
    const prompt = "Describe this image in detail (250-700 characters)."

    if (provider === 'google' || provider === 'gemini') {
      response = await runGoogle(model.id, prompt, NARRATION_SYSTEM_PROMPT, imageBuffer, context, [])
    } else if (provider === 'cloudflare') {
      response = await runCloudflare(model.id, prompt, context?.aiApiKey, NARRATION_SYSTEM_PROMPT, [], 'VISION')
    } else if (provider === 'openrouter') {
      response = await runOpenRouter(model.id, prompt, NARRATION_SYSTEM_PROMPT, [], context?.aiApiKey, model.openrouter_provider || undefined, imageBuffer)
    }

    if (response) {
      const description = typeof response === 'object' ? response.content : response
      if (description && description.length >= 10) {
        logger.info(`Narrated image using ${model.id}: ${description.slice(0, 50)}...`)
        return { description: description.trim(), modelId: model.id, provider: model.provider }
      }
    }
  } catch (e: any) {
    logger.warn(`Failed to narrate image: ${e.message}`)
  }

  return null
}
