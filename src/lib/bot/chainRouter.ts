import { classifyIntentWithModel } from './classifier'
import { getRouterChain, getFallbackModes } from '../router-config'
import type { BotMode } from '@/data/store.types'
import { getProviderKeys } from '../vault'
import { logger } from '../logger'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { runHuggingFace, runHuggingFaceText } from './providers/huggingface'
import { runWebSearchChain } from './providers/tavily'
import { runDuckDuckGoSearchChain } from './providers/duckduckgo'
import { runCloudflare } from './providers/cloudflare'
import { runPollinations, runPollinationsText } from './providers/pollinations'
import { runOpenRouter } from './providers/openrouter'
import { runOllama } from './providers/ollama'
import { getConversationMemory, getWebConversationMemory } from './memory'
import { supabaseAdmin } from '../supabase'
import { getCompiledPrompt } from './compilePrompt'
import { getSessionState, updateSessionState, estimateTokens, summarizeSession } from './context'

function trackModelUsage(p_model_id: string, p_provider: string) {
  supabaseAdmin.rpc('increment_model_usage', { p_model_id, p_provider })
    .then(({ error }: { error: any }) => { if (error) logger.warn(`Usage track failed [${p_model_id}]: ${error.message}`) })
}

// Simple circuit breaker to skip models that failed recently
const FAILURE_CACHE_MS = 60000 // 1 minute
const modelFailureCache: Record<string, number> = {}

export function markModelFailed(modelId: string) {
  modelFailureCache[modelId] = Date.now()
  logger.warn(`Model ${modelId} marked as failed. Skipping for ${FAILURE_CACHE_MS/1000}s.`)
}

export function isModelFailed(modelId: string): boolean {
  const failedAt = modelFailureCache[modelId]
  if (!failedAt) return false
  if (Date.now() - failedAt > FAILURE_CACHE_MS) {
    delete modelFailureCache[modelId]
    return false
  }
  return true
}

export interface RoutingTrace {
  model: string
  category?: string
  key: string
  success: boolean
}

export interface ChainResponse {
  type: 'text' | 'photo'
  content: string | Buffer
  usage_type?: 'chat' | 'tool' | 'search' | 'vision' | 'image'
  model?: string
  model_chain?: string
  status?: 'success' | 'error'
  classification_trace?: any[]
  routing_trace?: RoutingTrace[]
  citations?: string[]
  tokens_used?: number
}

export async function runChain(
  prompt: string,
  inputBuffer?: Buffer,
  context?: { chatId?: number; userId?: string; aiApiKey?: string; activeEntityId?: string; activeWorkspaceId?: string; classificationModelId?: string; temperature?: number; mode?: BotMode; intentTag?: string | null }
): Promise<ChainResponse> {
  let history: any[] = []
  if (context?.chatId) {
    history = await getConversationMemory(context.chatId)
  } else if (context?.userId && context.userId !== 'anonymous') {
    history = await getWebConversationMemory(context.userId)
  }

  // Inject current date context to help bot understand knowledge cutoff and current time
  const now = new Date()
  const dateContext = `[CURRENT CONTEXT]\nDate: ${now.toDateString()}\nTime: ${now.toLocaleTimeString()}\n`

  // 0. Prefetch independent config in parallel
  const sessionId = context?.chatId?.toString() || context?.activeEntityId || 'global'
  const [sessionState, globalPrompt, fallbackModes] = await Promise.all([
    getSessionState(sessionId),
    getCompiledPrompt(context?.mode ?? 'default'),
    getFallbackModes(),
  ])
  const currentSummary = sessionState?.distilled_summary || null

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
    let { chain: visionChain } = await getRouterChain('VISION')

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
        const visionRes = await runGoogle(modelConfig.id, activePrompt, dateContext + "\n\nYou are a vision assistant.", activeBuffer, context as any, history)
        if (visionRes) {
          trackModelUsage(modelConfig.id, modelConfig.provider)
          return { type: 'text', content: visionRes, usage_type: 'vision', model: modelConfig.id, model_chain: `vision → ${modelConfig.id}`, status: 'success' }
        }
      } catch (e: any) {
        logger.warn(`Vision failure [${modelConfig.id}]: ${e.message}`)
      }
    }

    if (visionChain.length === 0) {
      logger.warn('No VISION chain configured in DB. Add models via Router admin.')
      return { type: 'text', content: "Vision chain is empty. Configure models in the VISION router.", usage_type: 'vision', model_chain: 'vision → (none)', status: 'error' }
    }
    
    return { type: 'text', content: "Vision failed. The configured models are either unreachable or do not support these images. Check your Router config and model IDs.", usage_type: 'vision', model_chain: 'vision → (none)', status: 'error' }
  }

  // 2. Standard Routing Flow
  const { category: rawCategory, classifierModel, trace: classificationTrace } = await classifyIntentWithModel(prompt, context?.aiApiKey, context?.classificationModelId, context?.mode ?? 'default', context?.intentTag ?? null)
  let category = rawCategory
  const routingTrace: RoutingTrace[] = []

  let { chain, system_prompt, temperature } = await getRouterChain(category)

  // 3. Ensure System Prompt for Tool Calling
  if (!system_prompt && category === 'TOOL_CALLING') {
    system_prompt = "You are a workspace assistant. You can list, create, update, and delete notes/folders. When a user asks to modify a note by title, use list_notes first to find its ID. Always confirm actions."
  }
  if (!system_prompt && category === 'IMAGE_GEN') {
    system_prompt = "You are a creative artist. Generate high-quality images based on user prompts."
  }

  // Inject current date context to help bot understand knowledge cutoff and current time
  system_prompt = dateContext + "\n\n" + (system_prompt || "")

  // Inject distilled session summary if available
  if (currentSummary) {
    system_prompt = `[SESSION MEMORY SUMMARY]\n${currentSummary}\n\n` + system_prompt
  }

  // Inject global compiled prompt (settings + brain entries) as prefix
  if (globalPrompt) {
    system_prompt = globalPrompt + "\n\n" + (system_prompt || "")
  }

  // Global constraint to prevent leaking internal reasoning/analysis
  system_prompt = "CRITICAL: Provide ONLY the final answer. NEVER output internal reasoning, analysis, planning, or drafting. Do not use headers like '*Neutrality:*', '*Final version plan:*', or '*Self-Correction:*'. Jump directly to the response.\n" +
                  "When you use a tool or perform a search, always synthesize and summarize the tool results into a natural, complete, and helpful answer to the user's question. Do NOT output raw tool results verbatim.\n\n" + (system_prompt || "");

  let finalUsageType: 'chat' | 'tool' | 'search' | 'vision' | 'image' = 'chat'
  if (category === 'WEB_SEARCH' || category === 'DEEP_RESEARCH') finalUsageType = 'search'
  if (category === 'TOOL_CALLING') finalUsageType = 'tool'
  if (category === 'IMAGE_GEN') finalUsageType = 'image'

  const fallbackMode = fallbackModes[category] || 'model_first'
  const triedKeysCount: Record<string, number> = {}

  // Prefetch vault keys for all unique providers in this chain
  const uniqueProviderKeys = [...new Set(
    chain
      .filter(m => m.is_enabled)
      .map(m => {
        if (m.id.includes('tavily')) return 'TAVILY'
        return m.provider === 'google' ? 'GEMINI' : m.provider.toUpperCase()
      })
  )]
  const prefetchedKeys = Object.fromEntries(
    await Promise.all(
      uniqueProviderKeys.map(async k => [k, await getProviderKeys(k)] as [string, string[]])
    )
  )

  for (const modelConfig of chain) {
    if (!modelConfig.is_enabled) continue
    if (isModelFailed(modelConfig.id)) {
      logger.info(`Skipping failed model: ${modelConfig.id}`)
      routingTrace.push({ model: modelConfig.id, category, key: 'SKIPPED', success: false })
      continue
    }

    let key = modelConfig.provider === 'google' ? 'GEMINI' : modelConfig.provider.toUpperCase()
    if (modelConfig.id.includes('tavily')) key = 'TAVILY'
    let providerKeys: string[] = []

    providerKeys = prefetchedKeys[key] ?? []

    if (providerKeys.length === 0) {
      providerKeys = [context?.aiApiKey || '']
    }

    const startIndex = triedKeysCount[key] || 0

    try {
      for (let k = startIndex; k < providerKeys.length; k++) {
        const activeKey = providerKeys[k]

        try {
          logger.info(`Attempting model: ${modelConfig.id} (${modelConfig.provider}) for ${category}, API key index: ${k + 1}`)
          let response: string | Buffer | null = null

          let usedSynthesisModel = ''
          const routeContext: any = { 
            ...(context || {}), 
            useTools: category === 'TOOL_CALLING', 
            aiApiKey: activeKey || undefined,
            usedKeyIndex: k + 1,
            temperature: typeof temperature === 'number' ? temperature : undefined,
            setSynthesisModel: (m: string) => { usedSynthesisModel = m }
          }

          switch (modelConfig.provider.toLowerCase() as string) {
            case 'google':
              response = await runGoogle(modelConfig.id, prompt, system_prompt, undefined, routeContext, history)
              break
            case 'groq':
              response = await runGroq(modelConfig.id, prompt, system_prompt, activeKey || context?.aiApiKey, routeContext, history)
              break
            case 'huggingface':
              if (category === 'IMAGE_GEN') {
                response = await runHuggingFace(modelConfig.id, prompt, activeKey || context?.aiApiKey)
              } else {
                response = await runHuggingFaceText(modelConfig.id, prompt, system_prompt, history, activeKey || context?.aiApiKey)
              }
              break
            case 'cloudflare':
              response = await runCloudflare(modelConfig.id, prompt, activeKey || context?.aiApiKey)
              break
            case 'vault':
              if (modelConfig.id === 'tavily-search') response = await runWebSearchChain(prompt, routeContext)
              if (modelConfig.id === 'duckduckgo-search') response = await runDuckDuckGoSearchChain(prompt, routeContext)
              break
            case 'pollinations':
              if (category === 'IMAGE_GEN') {
                response = await runPollinations(prompt, modelConfig.id)
              } else {
                response = await runPollinationsText(modelConfig.id, prompt, system_prompt, history, activeKey || providerKeys[0])
              }
              break
            case 'openrouter':
              response = await runOpenRouter(modelConfig.id, prompt, system_prompt, history, activeKey || providerKeys[0])
              break
            case 'local':
            case 'ollama':
            case 'ollama(my pc)':
              response = await runOllama(modelConfig.id, prompt, system_prompt, history, temperature)
              break
          }

          if (response) {
            let finalContent = response
            let citations: string[] | undefined = undefined

            if (typeof response === 'object' && !Buffer.isBuffer(response) && 'content' in response) {
              finalContent = (response as any).content
              citations = (response as any).citations
            }

            if (category === 'IMAGE_GEN' && typeof finalContent === 'string') {
              logger.info(`Model ${modelConfig.id} returned text for IMAGE_GEN. Skipping to next fallback.`)
              const displayKey = routeContext.usedKeyIndex ? `${key} ${routeContext.usedKeyIndex}` : `${key} 1`
              routingTrace.push({ model: modelConfig.id, category, key: displayKey, success: false })
              continue
            }

            const displayKey = routeContext.usedKeyIndex ? `${key} ${routeContext.usedKeyIndex}` : `${key} 1`
            routingTrace.push({ model: modelConfig.id, category, key: displayKey, success: true })
            if (usedSynthesisModel) {
              routingTrace.push({ model: usedSynthesisModel, category, key: 'GEMINI 1', success: true })
            }
            trackModelUsage(modelConfig.id, modelConfig.provider)

            const chainParts: string[] = []
            
            // Add classification trace to chain parts
            if (classificationTrace && classificationTrace.length > 0) {
              classificationTrace.forEach(t => {
                chainParts.push(`${t.model}|${t.key || 'DEFAULT'}|${t.success ? 'true' : 'false'}`)
              })
            } else if (classifierModel) {
              chainParts.push(classifierModel)
            }

            if (category) chainParts.push(category)
            routingTrace.forEach(r => chainParts.push(`${r.model}|${r.key}|${r.success ? 'true' : 'false'}`))
            const detailedModelChain = chainParts.join(' → ')

            // BACKGROUND: Update token usage and check for summarization trigger
            if (typeof finalContent === 'string') {
              const sessionId = (context?.chatId?.toString() || context?.activeEntityId || 'global')

              const newTokens = estimateTokens(prompt + finalContent + (system_prompt || ''))
              const totalUsage = (sessionState?.token_usage_total || 0) + newTokens
              const limit = sessionState?.context_limit ?? 32000
              const threshold = sessionState?.compaction_threshold ?? 0.8

              if (totalUsage > limit * threshold) {
                logger.info(`Context limit (${Math.round(threshold * 100)}%) reached for ${sessionId}. Triggering summarization...`)
                summarizeSession(sessionId, history, currentSummary)
              } else {
                updateSessionState(sessionId, { 
                  token_usage_total: totalUsage,
                  context_limit: limit,
                  compaction_threshold: threshold
                })
              }
            }

            return {
              type: category === 'IMAGE_GEN' ? 'photo' : 'text',
              content: finalContent as any,
              usage_type: finalUsageType,
              model: modelConfig.id,
              model_chain: detailedModelChain,
              status: 'success',
              classification_trace: classificationTrace,
              routing_trace: routingTrace,
              citations,
              tokens_used: (typeof finalContent === 'string') ? estimateTokens(prompt + finalContent + (system_prompt || '')) : undefined
            }
          } else {
            triedKeysCount[key] = k + 1
            const displayKey = routeContext.usedKeyIndex ? `${key} ${routeContext.usedKeyIndex}` : `${key} 1`
            routingTrace.push({ model: modelConfig.id, category, key: displayKey, success: false })
            if (fallbackMode !== 'api_key_first') {
              throw new Error(`Model ${modelConfig.id} returned empty response`)
            }
          }
        } catch (error: any) {
          markModelFailed(modelConfig.id)
          triedKeysCount[key] = k + 1
          routingTrace.push({ model: modelConfig.id, category, key: `${key} ${k + 1}`, success: false })
          logger.warn(`Failure with key ${k + 1} for [${modelConfig.id}]: ${error.message}`)
          if (fallbackMode !== 'api_key_first') {
            throw error
          }
        }
      }
    } catch (outerError: any) {
      logger.warn(`Fallback triggered to next model due to: ${outerError.message}`)
      continue
    }
  }

  const chainParts: string[] = []
  if (classificationTrace && classificationTrace.length > 0) {
    classificationTrace.forEach(t => {
      chainParts.push(`${t.model}|${t.key || 'DEFAULT'}|${t.success ? 'true' : 'false'}`)
    })
  } else if (classifierModel) {
    chainParts.push(classifierModel)
  }
  if (category) chainParts.push(category)
  routingTrace.forEach(r => chainParts.push(`${r.model}|${r.key}|${r.success ? 'true' : 'false'}`))
  const detailedModelChain = chainParts.join(' → ')

  return { 
    type: 'text', 
    content: "⚡ *System Overload*", 
    usage_type: 'chat', 
    model_chain: detailedModelChain, 
    status: 'error',
    classification_trace: classificationTrace,
    routing_trace: routingTrace
  }
}
