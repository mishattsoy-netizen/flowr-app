import { logger } from '../logger'
import { getRouterChain } from '../router-config'
import { getProviderKeys } from '../vault'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { runOpenRouter } from './providers/openrouter'

const EXPANSION_SYSTEM_PROMPT = `You are a professional image prompt engineer. 
Your task is to take the user's current request and the conversation history, and generate a single, highly detailed, descriptive image generation prompt.

Rules:
1. Focus on: subject, style, lighting, composition, mood, and camera specifications.
2. The user might use words like "that", "this", "it", or refer to previous topics (like characters or locations mentioned earlier) — use the history to resolve these references into concrete descriptions.
3. If the user asks for "realistic", "photorealistic", "movie scene", or "cinematic", ensure the prompt describes:
   - Specific lighting (e.g., "volumetric lighting", "golden hour", "dramatic shadows").
   - Camera specs (e.g., "shot on 35mm lens", "f/1.8", "depth of field").
   - Texture details (e.g., "intricate skin textures", "highly detailed fabric").
   - 8k resolution, Unreal Engine 5 render style, or cinematic color grading.
4. If the user refers to a character like "Darth Maul", include their iconic features (e.g., "red and black facial tattoos", "yellow eyes", "black robes") to ensure the image model captures them correctly.
5. Output ONLY the descriptive prompt. No explanations, no intro text.
6. Keep the prompt in English, even if the user request is in another language.`

/**
 * Uses a text model to expand a short user request + conversation history 
 * into a detailed image generation prompt.
 */
export async function expandImagePrompt(
  prompt: string,
  history: any[],
  context: any
): Promise<{ expanded: string, modelId?: string, provider?: string }> {
  // 1. Get a fast model (e.g. from FAST_SIMPLE chain)
  const { chain } = await getRouterChain('FAST_SIMPLE')
  const model = chain.find(m => m.is_enabled)
  if (!model) {
    logger.warn('No FAST_SIMPLE model available for prompt expansion')
    return { expanded: prompt }
  }

  try {
    let response: any = null
    const provider = model.provider.toLowerCase()
    const expansionPrompt = `User Request: "${prompt}"\n\nGenerate a detailed image prompt based on this and the provided conversation history.`

    if (provider === 'google') {
      response = await runGoogle(model.id, expansionPrompt, EXPANSION_SYSTEM_PROMPT, undefined, context || {}, history)
    } else if (provider === 'groq') {
      response = await runGroq(model.id, expansionPrompt, EXPANSION_SYSTEM_PROMPT, context?.aiApiKey, context || {}, history)
    } else if (provider === 'openrouter') {
      const keys = await getProviderKeys('OPENROUTER')
      response = await runOpenRouter(model.id, expansionPrompt, EXPANSION_SYSTEM_PROMPT, history, context?.aiApiKey || keys[0], model.openrouter_provider || undefined)
    }

    if (response) {
      const expanded = typeof response === 'object' ? response.content : response
      if (expanded && expanded.length > 5) {
        logger.info(`Expanded image prompt: "${prompt}" -> "${expanded.slice(0, 100)}..."`)
        return { expanded: expanded.trim(), modelId: model.id, provider: model.provider }
      }
    }
  } catch (e: any) {
    logger.warn(`Failed to expand image prompt: ${e.message}, using original: "${prompt}"`)
  }
  return { expanded: prompt, modelId: model.id, provider: model.provider }
}
