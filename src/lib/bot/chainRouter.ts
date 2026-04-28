import { classifyIntentWithModel } from './classifier'
import { getRouterChain, Platform } from '../router-config'
import { logger } from '../logger'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { runHuggingFace } from './providers/huggingface'
import { runWebSearchChain } from './providers/tavily'
import { runCloudflare } from './providers/cloudflare'
import { runPollinations } from './providers/pollinations'
import { getConversationMemory, getWebConversationMemory } from './memory'
import { supabaseAdmin } from '../supabase'

function trackModelUsage(modelId: string, provider: string) {
  supabaseAdmin.rpc('increment_model_usage', { p_model_id: modelId, p_provider: provider })
    .then(({ error }: { error: any }) => { if (error) logger.warn(`Usage track failed [${modelId}]: ${error.message}`) })
}

export interface ChainResponse {
  type: 'text' | 'photo'
  content: string | Buffer
  usage_type?: 'chat' | 'tool' | 'search' | 'vision' | 'image'
  model?: string
  model_chain?: string
  status?: 'success' | 'error'
}

export async function runChain(
  prompt: string,
  inputBuffer?: Buffer,
  context?: { chatId?: number; userId?: string; platform?: Platform; aiApiKey?: string; activeEntityId?: string; activeWorkspaceId?: string; classificationModelId?: string; agentEnabled?: boolean }
): Promise<ChainResponse> {
  const platform: Platform = context?.platform ?? 'telegram'
  let history: any[] = []
  if (context?.chatId) {
    history = await getConversationMemory(context.chatId)
  } else if (context?.userId && context.userId !== 'anonymous') {
    history = await getWebConversationMemory(context.userId)
  }

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
    // Look up VISION chain from DB — configure models via Router admin
    let { chain: visionChain } = await getRouterChain('VISION', platform)
    if (visionChain.length === 0 && platform !== 'telegram') {
      const tgVision = await getRouterChain('VISION', 'telegram')
      visionChain = tgVision.chain
    }

    let activePrompt = prompt;
    if (!activePrompt && activeBuffer) {
      if (history.length > 0) {
        activePrompt = "The user sent an image without a prompt. Analyze the conversation history and this image to understand what the user likely wants. If there is a clear task (e.g., 'extract text', 'describe this', 'summarize'), perform it. If the intent is unclear, describe the image and ask how you can help.";
      } else {
        activePrompt = "Analyze this image and decide how to answer by yourself. Describe it and ask how I can help.";
      }
    }

    for (const modelConfig of visionChain) {
      if (!modelConfig.is_enabled) continue
      try {
        logger.info(`Routing vision to: ${modelConfig.id} (${modelConfig.provider})`)
        const visionRes = await runGoogle(modelConfig.id, activePrompt, undefined, activeBuffer, context as any, history)
        if (visionRes) {
          trackModelUsage(modelConfig.id, modelConfig.provider)
          return { type: 'text', content: visionRes, usage_type: 'vision', model: modelConfig.id, model_chain: `vision → ${modelConfig.id}`, status: 'success' }
        }
      } catch (e: any) {
        logger.warn(`Vision failure [${modelConfig.id}]: ${e.message}`)
      }
    }

    if (visionChain.length === 0) logger.warn('No VISION chain configured in DB. Add models via Router admin.')
    return { type: 'text', content: "Vision chain is empty. Configure models in the VISION router.", usage_type: 'vision', model_chain: 'vision → (none)', status: 'error' }
  }

  // 2. Standard Routing Flow
  const { category: rawCategory, classifierModel } = await classifyIntentWithModel(prompt, context?.aiApiKey, context?.classificationModelId, platform)
  let category = rawCategory

  // Agent mode: override non-specific categories to TOOL_CALLING so the full tool loop engages
  if (context?.agentEnabled && (category === 'FAST_SIMPLE' || category === 'MEDIUM_THINKING')) {
    logger.info(`Agent mode active: overriding ${category} → TOOL_CALLING`)
    category = 'TOOL_CALLING'
  }
  let { chain, system_prompt } = await getRouterChain(category, platform)
  // Try telegram chain as fallback if no app-specific chain configured
  if ((!chain || chain.length === 0) && platform !== 'telegram') {
    const tgFallback = await getRouterChain(category, 'telegram')
    if (tgFallback.chain.length > 0) {
      chain = tgFallback.chain
      system_prompt = tgFallback.system_prompt
    }
  }

  // 3. Ensure System Prompt for Tool Calling
  if (!system_prompt && category === 'TOOL_CALLING') {
    system_prompt = "You are a workspace assistant. You can list, create, update, and delete notes/folders. When a user asks to modify a note by title, use list_notes first to find its ID. Always confirm actions."
  }
  if (!system_prompt && category === 'IMAGE_GEN') {
    system_prompt = "You are a creative artist. Generate high-quality images based on user prompts."
  }

  // Global constraint to prevent leaking internal reasoning/analysis
  system_prompt = "CRITICAL: Provide ONLY the final answer. NEVER output internal reasoning, analysis, planning, or drafting. Do not use headers like '*Neutrality:*', '*Final version plan:*', or '*Self-Correction:*'. Jump directly to the response.\n\n" + (system_prompt || "");

  let finalUsageType: 'chat' | 'tool' | 'search' | 'vision' | 'image' = 'chat'
  if (category === 'WEB_SEARCH') finalUsageType = 'search'
  if (category === 'TOOL_CALLING') finalUsageType = 'tool'
  if (category === 'IMAGE_GEN') finalUsageType = 'image'

  for (const modelConfig of chain) {
    if (!modelConfig.is_enabled) continue

    try {
      logger.info(`Attempting model: ${modelConfig.id} (${modelConfig.provider}) for ${category}`)
      let response: string | Buffer | null = null

      switch (modelConfig.provider as string) {
        case 'google':
          response = await runGoogle(modelConfig.id, prompt, system_prompt, undefined, { ...context as any, useTools: category === 'TOOL_CALLING' }, history)
          break
        case 'groq':
          response = await runGroq(modelConfig.id, prompt, system_prompt, context?.aiApiKey, { ...context, useTools: category === 'TOOL_CALLING' }, history)
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

        trackModelUsage(modelConfig.id, modelConfig.provider)
        return {
          type: category === 'IMAGE_GEN' ? 'photo' : 'text',
          content: response as any,
          usage_type: finalUsageType,
          model: modelConfig.id,
          model_chain: `${classifierModel} → ${modelConfig.id}`,
          status: 'success'
        }
      }
    } catch (error: any) {
      logger.warn(`Failure [${modelConfig.id}]: ${error.message}`)
    }
  }

  return { type: 'text', content: "⚡ *System Overload*", usage_type: 'chat', model_chain: classifierModel, status: 'error' }
}
