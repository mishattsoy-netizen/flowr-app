import { classifyIntent } from './classifier'
import { getRouterChain, Platform } from '../router-config'
import { logger } from '../logger'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { runHuggingFace } from './providers/huggingface'
import { runWebSearchChain } from './providers/tavily'
import { runCloudflare } from './providers/cloudflare'
import { runPollinations } from './providers/pollinations'
import { getConversationMemory } from './memory'

export interface ChainResponse {
  type: 'text' | 'photo'
  content: string | Buffer
  usage_type?: 'chat' | 'tool' | 'search' | 'vision'
  model?: string
}

export async function runChain(
  prompt: string,
  inputBuffer?: Buffer,
  context?: { chatId?: number; userId?: string; platform?: Platform; aiApiKey?: string; activeEntityId?: string; activeWorkspaceId?: string; classificationModelId?: string }
): Promise<ChainResponse> {
  const platform: Platform = context?.platform ?? 'telegram'
  const history = context?.chatId ? await getConversationMemory(context.chatId) : []

  // 1. Specialized Vision Flow (Buffer or URL)
  let activeBuffer = inputBuffer
  if (!activeBuffer && (prompt.includes('http://') || prompt.includes('https://'))) {
    const urlMatch = prompt.match(/(https?:\/\/[^\s]+?\.(jpe?g|png|webp|gif|bmp|svg|tiff|avif))(\?[^\s]*)?/i)
    if (urlMatch) {
      try {
        logger.info(`Detected image URL: ${urlMatch[0]}, fetching...`)
        const res = await fetch(urlMatch[0])
        if (res.ok) {
          activeBuffer = Buffer.from(await res.arrayBuffer())
          logger.info(`Successfully fetched image, size: ${activeBuffer.length} bytes`)
        } else {
          logger.warn(`Failed to fetch image URL: ${res.status} ${res.statusText}`)
        }
      } catch (e: any) {
        logger.error(`Error fetching image URL: ${e.message}`)
      }
    }
  }

  if (activeBuffer) {
    const modelId = 'gemini-1.5-flash-latest'
    logger.info(`Routing to Vision Flow using ${modelId}`)
    const visionRes = await runGoogle(modelId, prompt || "Analyze this image.", undefined, activeBuffer, context as any, history)
    return { type: 'text', content: visionRes || "Analyzer failed.", usage_type: 'vision', model: modelId }
  }

  // 2. Standard Routing Flow
  const category = await classifyIntent(prompt, context?.aiApiKey, context?.classificationModelId, platform)
  let { chain, system_prompt } = await getRouterChain(category, platform)

  // Fallback to local default if Supabase routing is empty/failed
  if (!chain || chain.length === 0) {
    const { DEFAULT_FLOW_ROUTER_CONFIG } = require('../../data/store.constants')
    const categoryConfig = DEFAULT_FLOW_ROUTER_CONFIG.categories.find((c: any) => 
      c.key.toUpperCase() === category || c.key === category.toLowerCase()
    )
    if (categoryConfig) {
      chain = categoryConfig.models.map((m: any) => ({
        id: m.id,
        provider: m.provider,
        is_enabled: m.enabled
      }))
    }
  }

  // 3. Ensure System Prompt for Tool Calling
  if (!system_prompt && category === 'TOOL_CALLING') {
    system_prompt = "You are a workspace assistant. You can list, create, update, and delete notes/folders. When a user asks to modify a note by title, use list_notes first to find its ID. Always confirm actions."
  }
  if (!system_prompt && category === 'IMAGE_GEN') {
    system_prompt = "You are a creative artist. Generate high-quality images based on user prompts."
  }

  let finalUsageType: 'chat' | 'tool' | 'search' | 'vision' = 'chat'
  if (category === 'WEB_SEARCH') finalUsageType = 'search'
  if (category === 'TOOL_CALLING') finalUsageType = 'tool'

  for (const modelConfig of chain) {
    if (!modelConfig.is_enabled) continue

    try {
      logger.info(`Attempting model: ${modelConfig.id} (${modelConfig.provider}) for ${category}`)
      let response: string | Buffer | null = null

      switch (modelConfig.provider as string) {
        case 'google':
          response = await runGoogle(modelConfig.id, prompt, system_prompt, undefined, context as any, history)
          break
        case 'groq':
          response = await runGroq(modelConfig.id, prompt, system_prompt, context?.aiApiKey, context)
          break
        case 'huggingface':
          response = await runHuggingFace(modelConfig.id, prompt, context?.aiApiKey)
          break
        case 'cloudflare':
          response = await runCloudflare(modelConfig.id, prompt, context?.aiApiKey)
          break
        case 'vault':
          if (modelConfig.id === 'tavily-search') response = await runWebSearchChain(prompt, context as any)
          break
        case 'pollinations':
          response = await runPollinations(prompt)
          break
      }

      if (response) {
        // If we're in IMAGE_GEN category, we expect a Buffer. 
        // If we get a string (refusal/description), we continue to the next model or fallback.
        if (category === 'IMAGE_GEN' && typeof response === 'string') {
          logger.info(`Model ${modelConfig.id} returned text for IMAGE_GEN. Skipping to next fallback.`)
          continue
        }

        return {
          type: category === 'IMAGE_GEN' ? 'photo' : 'text',
          content: response as any,
          usage_type: finalUsageType,
          model: modelConfig.id
        }
      }
    } catch (error: any) {
      logger.warn(`Failure [${modelConfig.id}]: ${error.message}`)
    }
  }

  // Final Fallback for Image Gen if everything failed
  if (category === 'IMAGE_GEN') {
    logger.info("Triggering final Pollinations fallback for IMAGE_GEN")
    const fallbackRes = await runPollinations(prompt)
    if (fallbackRes) return { type: 'photo', content: fallbackRes, usage_type: 'chat', model: 'pollinations-fallback' }
  }

  return { type: 'text', content: "⚡ *System Overload*", usage_type: 'chat' }
}
