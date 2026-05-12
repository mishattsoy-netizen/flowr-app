import { classifyIntentWithModel } from './classifier'
import { runAdvisor } from './advisor'
import { getRouterChain, getFallbackModes, IntentCategory } from '../router-config'
import type { BotMode } from '@/data/store.types'
import { getProviderKeys } from '../vault'
import { logger } from '../logger'
import { runGoogle } from './providers/google'
import { runOpenRouter } from './providers/openrouter'
import { runGroq } from './providers/groq'
import { runOllama } from './providers/ollama'
import { runHuggingFace, runHuggingFaceText } from './providers/huggingface'
import { runWebSearchChain } from './providers/tavily'
import { runDuckDuckGoSearchChain } from './providers/duckduckgo'
import { runCloudflare } from './providers/cloudflare'
import { runPollinations, runPollinationsText } from './providers/pollinations'
import { runSiliconFlow, runSiliconFlowText } from './providers/siliconflow'
import { getImageDimensions } from './image-utils'
import { runHuggingFaceUpscale } from './providers/huggingface'
import { getConversationMemory, getWebConversationMemory } from './memory'
import { supabaseAdmin } from '../supabase'
import { getCompiledPrompt } from './compilePrompt'
import { getSessionState, updateSessionState, estimateTokens, summarizeSession } from './context'
import { planChainSequence } from './orchestrator'
import { executePipeline, PipelineStep, StatusCallback } from './pipeline'
import { runThinkChain } from './thinkChain'
import { getPipelineSettings } from '../router-config'
import { expandImagePrompt } from './prompt-expansion'
import { TraceCollector } from './tracing'

async function trackModelUsage(p_model_id: string, p_provider: string) {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // 1. Check if we need a global reset for the day
    const { data: model } = await supabaseAdmin
      .from('models')
      .select('last_reset_date')
      .eq('id', p_model_id)
      .single()

    if (model && model.last_reset_date !== today) {
      logger.info(`[RPD] New day detected (${today}). Resetting all model usage...`)
      await supabaseAdmin
        .from('models')
        .update({ 
          usage_today: 0, 
          last_reset_date: today 
        })
        .neq('last_reset_date', today) // Only reset those not yet reset
    }

    // 2. Increment usage
    const { error } = await supabaseAdmin.rpc('increment_model_usage', { p_model_id, p_provider })
    if (error) throw error
  } catch (error: any) {
    logger.warn(`Usage track failed [${p_model_id}]: ${error.message}`)
  }
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
  actualProvider?: string
  status?: string
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
  pipeline_steps?: PipelineStep[]
  advisor_questions?: string
  text_content?: string
  image_description?: string
  trace?: any[]
  step_traces?: import('./tracing').StepTrace[]
}

export async function runChain(
  prompt: string,
  inputBuffer?: Buffer | Buffer[],
  context?: { 
    chatId?: number; 
    userId?: string; 
    aiApiKey?: string; 
    activeEntityId?: string; 
    activeWorkspaceId?: string; 
    classificationModelId?: string; 
    temperature?: number; 
    mode?: BotMode; 
    intentTag?: string | null; 
    replyContext?: any; 
    thinkingEnabled?: boolean; 
    advisorEnabled?: boolean; 
    onStatus?: StatusCallback;
    vision_notes?: string;
    _forcedCategory?: IntentCategory;
  }
): Promise<ChainResponse> {
  const tracer = new TraceCollector()

  // Inject current date context to help bot understand knowledge cutoff and current time
  const now = new Date()
  const dateContext = `[CURRENT CONTEXT]\nDate: ${now.toDateString()}\nTime: ${now.toLocaleTimeString()}\n`
  
  // 0. Prefetch independent config in parallel
  const sessionId = context?.chatId?.toString() || context?.activeEntityId || 'global'
  const [sessionState, globalPrompt, fallbackModes, pipelineSettings] = await Promise.all([
    getSessionState(sessionId),
    getCompiledPrompt(context?.mode ?? 'default'),
    getFallbackModes(),
    getPipelineSettings(),
  ])

  const historyLimit = pipelineSettings.historyLimit ?? 20

  let history: any[] = []
  if (context?.chatId) {
    history = await getConversationMemory(context.chatId, historyLimit)
  } else if (context?.userId && context.userId !== 'anonymous') {
    history = await getWebConversationMemory(context.userId, historyLimit)
  }
  const currentSummary = sessionState?.distilled_summary || null

  // 1. Specialized Vision Flow (Buffer or URL)
  let activeBuffers = Array.isArray(inputBuffer) ? inputBuffer : (inputBuffer ? [inputBuffer] : [])

  // Advisor pre-flight — runs before classification if enabled and no image attached
  if (context?.advisorEnabled && activeBuffers.length === 0) {
    const availableTools = ['web_search', 'deep_research', 'image_gen', 'tool_calling']
    const historyForAdvisor = (!pipelineSettings.historyEnabledCategories || pipelineSettings.historyEnabledCategories.includes('ADVISOR')) ? history : []
    const advisorResult = await runAdvisor(
      prompt,
      context?.mode ?? 'default',
      context?.thinkingEnabled ?? false,
      availableTools,
      context,
      historyForAdvisor
    )
    if (advisorResult.shouldAsk && advisorResult.questions) {
      return {
        type: 'text',
        content: advisorResult.questions,
        usage_type: 'chat',
        model_chain: 'advisor → (awaiting user response)',
        status: 'success',
        advisor_questions: advisorResult.questions,
      }
    }
  }

  // 1. Specialized Vision Flow (Buffer or URL)
  let activeBuffer = activeBuffers[0]
  if (activeBuffers.length === 0 && (prompt.includes('http://') || prompt.includes('https://'))) {
    const urlMatch = prompt.match(/(https?:\/\/[^\s]+?\.(jpe?g|png|webp|gif|bmp|svg|tiff|avif))(\?[^\s]*)?/i)
    if (urlMatch) {
      try {
        logger.info(`Detected image URL: ${urlMatch[0]}, fetching...`)
        const res = await fetch(urlMatch[0])
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer())
          activeBuffer = buf
          activeBuffers = [buf]
          logger.info(`Successfully fetched image, size: ${buf.length} bytes`)
        } else {
          logger.warn(`Failed to fetch image URL: ${res.status} ${res.statusText}`)
        }
      } catch (e: any) {
        logger.error(`Error fetching image URL: ${e.message}`)
      }
    }
  }

  // 2. Standard Routing Flow
  let forcedCategory: any = context?._forcedCategory ?? null
  let classificationTrace: any[] = []

  // Resolve pipeline settings and thinking toggle
  const thinkingEnabled = context?.thinkingEnabled ?? pipelineSettings.thinkingToggleDefault
  const onStatus: StatusCallback = context?.onStatus ?? (() => {})

  const getStatusLabel = (chain: string, fallback?: string) => {
    const custom = pipelineSettings.statusMessages?.[chain]
    return custom ? `${custom.emoji} ${custom.label}`.trim() : (fallback || 'Working')
  }

  if (activeBuffer) {
    onStatus({
      chain: 'VISION',
      goal: 'Processing visual input',
      label: getStatusLabel('VISION', 'Scanning Image'),
      status: 'running'
    })

    // Look up VISION chain from DB — configure models via Router admin
    const { chain: visionChain, system_prompt: visionSystemPrompt } = await getRouterChain('VISION')
    const visionTrace: any[] = []

    // System Instructions = Persona + Date + Global Rules
    const systemPromptCombined = [
      visionSystemPrompt,
      dateContext,
      globalPrompt
    ].filter(Boolean).join("\n\n")

    // User Prompt = User Message or Default Trigger
    const activePrompt = prompt || "Analyze these images according to your instructions and provide a response."

    if (!prompt) {
      logger.info('Vision request received with no text, using default trigger.')
    }

    for (const modelConfig of visionChain) {
      if (!modelConfig.is_enabled) continue
      try {
        logger.info(`Routing vision to: ${modelConfig.id} (${modelConfig.provider}) — with ${activeBuffers.length} images`)
        
        let visionRes: any = null

        switch (modelConfig.provider.toLowerCase()) {
          case 'google':
          case 'gemini':
            // Strip 'google/' prefix if user added it, as SDK doesn't always like it
            const sanitizedId = modelConfig.id.replace(/^google\//, '')
            visionRes = await runGoogle(sanitizedId, activePrompt, systemPromptCombined, activeBuffers, context as any, history)
            break
          case 'openrouter':
            visionRes = await runOpenRouter(modelConfig.id, activePrompt, systemPromptCombined, history, context?.aiApiKey, modelConfig.openrouter_provider, activeBuffers)
            break
          case 'groq':
            visionRes = await runGroq(modelConfig.id, activePrompt, systemPromptCombined, context?.aiApiKey, context, history, activeBuffers)
            break
          default:
            logger.warn(`Vision provider ${modelConfig.provider} not specifically handled in router. Falling back to runGoogle.`)
            visionRes = await runGoogle(modelConfig.id, activePrompt, systemPromptCombined, activeBuffers, context as any, history)
        }

        if (visionRes) {
          visionTrace.push({ model: modelConfig.id, provider: modelConfig.provider, status: 'success' })
          let content = typeof visionRes === 'object' ? visionRes.content : visionRes
          
          // Check for JSON metadata (The "Autonomous Brain" logic)
          let metadata: any = null
          try {
            // Try to find JSON in the content (it might be wrapped in ```json ... ```)
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              metadata = JSON.parse(jsonMatch[0])
            }
          } catch (e) {
            // Not a JSON handoff, treat as normal text
          }

          if (metadata && metadata.logic_nature) {
            logger.info(`Vision-First Orchestration triggered: ${metadata.logic_nature}`)

            // If vision model already produced the final answer, return it directly
            if (metadata.logic_nature === 'FAST_SIMPLE' && metadata.next_instructions) {
              trackModelUsage(modelConfig.id, modelConfig.provider)
              return {
                type: 'text',
                content: metadata.next_instructions,
                usage_type: 'vision',
                model: modelConfig.id,
                model_chain: `vision → ${modelConfig.id}`,
                status: 'success',
                trace: visionTrace
              } as any
            }

            if (context) {
              context.vision_notes = `[VISION DATA - DIGITAL TWIN]\n${metadata.digital_twin || ''}\n\n[VISION INSTRUCTIONS]\n${metadata.next_instructions || ''}`
            }
            forcedCategory = metadata.logic_nature

            trackModelUsage(modelConfig.id, modelConfig.provider)
            classificationTrace.push({ model: modelConfig.id, provider: modelConfig.provider, chain: 'VISION', status: 'success' })
            break // Exit vision loop and proceed to main routing
          }

          trackModelUsage(modelConfig.id, modelConfig.provider)
          return { 
            type: 'text', 
            content, 
            usage_type: 'vision', 
            model: modelConfig.id, 
            model_chain: `vision → ${modelConfig.id}`, 
            status: 'success',
            trace: visionTrace
          } as any
        } else {
           visionTrace.push({ model: modelConfig.id, provider: modelConfig.provider, status: 'failed', error: 'Empty response' })
        }
      } catch (e: any) {
        logger.warn(`Vision failure [${modelConfig.id}]: ${e.message}`)
        visionTrace.push({ model: modelConfig.id, provider: modelConfig.provider, status: 'failed', error: e.message })
      }
    }

    // If we have a forced category from vision metadata, skip the return and continue to main router
    if (!forcedCategory) {
      if (visionChain.length === 0) {
        logger.error('VISION chain is empty — add models via Admin > Router > VISION')
      }
      onStatus({ chain: 'VISION', status: 'failed', label: 'Vision Failed', goal: 'Processing visual input' })
      return { 
        type: 'text', 
        content: "⚡ *Vision Analysis Failed* — Check your model IDs and API keys in the Router.", 
        usage_type: 'vision', 
        model_chain: 'vision → (none)', 
        status: 'error',
        trace: visionTrace
      }
    }
  }

  // 2. Standard Routing Flow
  let rawCategory: any = forcedCategory
  let classifierModel: string | null = forcedCategory ? 'Vision Classifier' : null
  let classifyError: string | null = null

  if (!forcedCategory) {
    onStatus({
      chain: 'CLASSIFIER',
      goal: 'Classifying intent',
      label: getStatusLabel('CLASSIFIER'),
      status: 'running'
    })
    const historyForClassifier = (!pipelineSettings.historyEnabledCategories || pipelineSettings.historyEnabledCategories.includes('CLASSIFIER')) ? history : []
    const classifyRes = await classifyIntentWithModel(prompt, context?.aiApiKey, context?.classificationModelId, context?.mode ?? 'default', context?.intentTag ?? null, historyForClassifier, context?.replyContext ?? null, tracer)
    rawCategory = classifyRes.category
    classifierModel = classifyRes.classifierModel
    classificationTrace = classifyRes.trace
    classifyError = classifyRes.error ?? null

    if (!rawCategory) {
      onStatus({ chain: 'CLASSIFIER', status: 'failed', goal: 'Classifying intent' })
      logger.error(`Classification failed: ${classifyError ?? 'unknown reason'}`)
      return { type: 'text', content: "⚡ *System Overload*", usage_type: 'chat', model_chain: 'classifier → (failed)', status: 'error' }
    }
    onStatus({ chain: 'CLASSIFIER', status: 'done', goal: 'Classifying intent' })
  }

  // MULTI_CHAIN path — orchestrator plans and executes a chain sequence
  if (rawCategory === 'MULTI_CHAIN' && pipelineSettings.orchestratorEnabled) {
    onStatus({ chain: 'ORCHESTRATOR', goal: 'Planning chain sequence', status: 'running', label: getStatusLabel('ORCHESTRATOR') })

    const plan = await planChainSequence(
      prompt,
      history,
      context?.replyContext,
      currentSummary,
      pipelineSettings.maxPipelineSteps,
      context?.vision_notes,
      tracer
    )

    if (plan) {
      onStatus({ chain: 'ORCHESTRATOR', goal: 'Planning chain sequence', status: 'done' })

      const pipelineContext = { ...context, history }
      const pipelineResult = await executePipeline(plan, prompt, pipelineContext as any, onStatus, tracer)

      let finalAccumulated = pipelineResult.accumulatedContext
      const imageDescription = pipelineResult.image_description
      let thinkDirection = ''
      const thinkSteps: PipelineStep[] = []

      if (thinkingEnabled) {
        const thinkResult = await runThinkChain(
          prompt,
          finalAccumulated,
          history,
          currentSummary,
          context?.replyContext,
          context as any,
          onStatus,
          tracer
        )
        thinkDirection = thinkResult.direction
        if (thinkResult.correctedContext) finalAccumulated = thinkResult.correctedContext
        thinkSteps.push(...thinkResult.steps)
      }

      // Use orchestrator's planned final output chain (last step), fallback to COMPLEX_THINKING
      const TEXT_CHAINS: IntentCategory[] = ['FAST_SIMPLE', 'MEDIUM_THINKING', 'COMPLEX_THINKING']
      const plannedFinalChain = plan.steps.length > 0
        ? plan.steps[plan.steps.length - 1]
        : 'COMPLEX_THINKING'
      const finalChainType: IntentCategory = TEXT_CHAINS.includes(plannedFinalChain as IntentCategory)
        ? plannedFinalChain as IntentCategory
        : 'COMPLEX_THINKING'

      let { chain: finalChain, system_prompt: finalSysPrompt } = await getRouterChain(finalChainType)

      finalSysPrompt = dateContext + '\n\n' + (finalSysPrompt || '')
      if (currentSummary) finalSysPrompt = `[SESSION MEMORY SUMMARY]\n${currentSummary}\n\n` + finalSysPrompt
      if (globalPrompt) finalSysPrompt = globalPrompt + '\n\n' + finalSysPrompt
      if (context?.replyContext?.attentionBlock) finalSysPrompt = context.replyContext.attentionBlock + '\n\n' + finalSysPrompt
      if (finalAccumulated) finalSysPrompt = `[PIPELINE CONTEXT]\n${finalAccumulated}\n\n` + finalSysPrompt
      if (thinkDirection) finalSysPrompt = `[THINK CHAIN DIRECTION]\n${thinkDirection}\n\n` + finalSysPrompt
      if (context?.vision_notes) finalSysPrompt = `[VISION DATA]\n${context.vision_notes}\n\n` + finalSysPrompt

      const finalOutputStep: PipelineStep = { chain: finalChainType, goal: 'Write final answer', status: 'running', label: getStatusLabel(finalChainType) }
      onStatus(finalOutputStep)

      for (const modelConfig of finalChain) {
        if (!modelConfig.is_enabled) continue
        try {
          const provider = modelConfig.provider.toLowerCase()
          let response: any = null

          if (provider === 'google') {
            response = await runGoogle(modelConfig.id, prompt, finalSysPrompt, undefined, context as any, history)
          } else if (provider === 'groq') {
            response = await runGroq(modelConfig.id, prompt, finalSysPrompt, undefined, context as any, history)
          } else if (provider === 'openrouter') {
            const keys = await getProviderKeys('OPENROUTER')
            response = await runOpenRouter(modelConfig.id, prompt, finalSysPrompt, history, context?.aiApiKey || keys[0], modelConfig.openrouter_provider || undefined)
          }

          if (response) {
            const content = typeof response === 'object' ? response.content : response
            finalOutputStep.status = 'done'
            onStatus({ ...finalOutputStep })

            const allSteps = [...pipelineResult.steps, ...thinkSteps, finalOutputStep]
            return {
              type: pipelineResult.imageBuffer ? 'photo' : 'text',
              content: pipelineResult.imageBuffer ?? content,
              text_content: pipelineResult.imageBuffer ? content : undefined,
              usage_type: 'chat',
              model: modelConfig.id,
              model_chain: `orchestrator → ${allSteps.map(s => s.chain).join(' → ')}${imageDescription ? ' → VISION' : ''}`,
              status: 'success',
              classification_trace: classificationTrace,
              pipeline_steps: allSteps,
              image_description: imageDescription,
              step_traces: tracer.all.length > 0 ? tracer.all : undefined,
            }
          }
        } catch (e: any) {
          logger.warn(`Final output chain ${modelConfig.id} failed: ${e.message}`)
        }
      }

      return { type: 'text', content: '⚡ *System Overload*', usage_type: 'chat', status: 'error', classification_trace: classificationTrace }
    }

    // Orchestrator failed — fall through to COMPLEX_THINKING
    logger.error('Orchestrator failed to produce a plan — falling back to COMPLEX_THINKING')
  }

  // Single-chain path
  let category: IntentCategory = (rawCategory === 'MULTI_CHAIN') ? 'COMPLEX_THINKING' : rawCategory
  logger.info(`[Router] Starting runChain for category: ${category} | prompt: "${prompt.slice(0, 50)}..."`)

  const routingTrace: RoutingTrace[] = []

  // Explicit ADVISOR intent override — if classified as advisor, force execution
  if (category === 'ADVISOR') {
    const availableTools = ['web_search', 'deep_research', 'image_gen', 'tool_calling']
    const advisorResult = await runAdvisor(prompt, context?.mode ?? 'default', context?.thinkingEnabled ?? false, availableTools, context)
    if (advisorResult.shouldAsk && advisorResult.questions) {
      return {
        type: 'text',
        content: advisorResult.questions,
        usage_type: 'chat',
        model_chain: 'classifier → advisor → (awaiting user response)',
        status: 'success',
        advisor_questions: advisorResult.questions,
      }
    }
    // If PASS, fallback to complex thinking to actually process the user query
    category = 'COMPLEX_THINKING'
  }

  let { chain, system_prompt, temperature } = await getRouterChain(category)

  if (context?.vision_notes) {
    system_prompt = `${context.vision_notes}\n\n${system_prompt}`
  }

  if (!system_prompt && (category === 'TOOL_CALLING' || category === 'IMAGE_GEN')) {
    logger.error(`No system_prompt configured for "${category}" chain — set it in Admin > Router > ${category}`)
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

  if (context?.replyContext?.attentionBlock) {
    system_prompt = context.replyContext.attentionBlock + "\n\n" + (system_prompt || "")
  }

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

  // deduplicate chain by model ID to prevent redundant attempts (with trimming and case-insensitivity)
  const uniqueChain = []
  const seenModelIds = new Set<string>()
  for (const m of (chain || [])) {
    const trimmedId = m.id.trim().toLowerCase()
    if (!m.is_enabled || seenModelIds.has(trimmedId)) continue
    seenModelIds.add(trimmedId)
    uniqueChain.push(m)
  }

  // ── Think Chain (pre-pass) — runs before the model loop so THINKING appears first in trace ──
  let thinkPipelineStepsPrepass: import('./pipeline').PipelineStep[] = []
  if (thinkingEnabled && category !== 'IMAGE_GEN') {
    try {
      const thinkResult = await runThinkChain(prompt, '', history, currentSummary, context?.replyContext, context as any, onStatus, tracer)
      thinkPipelineStepsPrepass = thinkResult.steps
      if (thinkResult.direction) {
        system_prompt = `[THINK CHAIN DIRECTION]\n${thinkResult.direction}\n\n` + system_prompt
      }
    } catch (e: any) {
      logger.warn(`Single-chain think pre-pass failed: ${e.message}`)
    }
  }

  // ── Prompt Expansion for IMAGE_GEN ──
  let activePromptForGen = prompt
  if (category === 'IMAGE_GEN') {
    onStatus({ chain: 'IMAGE_GEN', goal: 'Expanding prompt with context', status: 'running', label: '🧠 Thinking' })
    const expansionT0 = Date.now()
    const expansionResult = await expandImagePrompt(prompt, history, context)
    activePromptForGen = expansionResult.expanded
    if (expansionResult.modelId) {
      routingTrace.push({ model: expansionResult.modelId, category: 'FAST_SIMPLE', key: 'PROMPT_EXPANSION', success: true })
      tracer.recordSuccess({
        chain: 'FAST_SIMPLE',
        model: expansionResult.modelId,
        provider: expansionResult.provider ?? 'unknown',
        input_user: prompt,
        output: activePromptForGen,
      }, Date.now() - expansionT0)
    }
    onStatus({ chain: 'IMAGE_GEN', goal: 'Expanding prompt with context', status: 'done' })
  }

  for (const modelConfig of uniqueChain) {

    // ── CostGuard: project cost from prompt + estimated completion tokens ──
    if (modelConfig.is_paid && (modelConfig.prompt_cost || modelConfig.completion_cost)) {
      const promptTokens = Math.ceil((prompt?.length || 0) / 4)
      const sysPromptTokens = Math.ceil((system_prompt?.length || 0) / 4)
      // Estimate completion output at 1/3 of total input (rough heuristic)
      const estimatedCompletionTokens = Math.ceil((promptTokens + sysPromptTokens) / 3)
      const promptCost = (modelConfig.prompt_cost ?? 0) * promptTokens
      const sysPromptCost = (modelConfig.prompt_cost ?? 0) * sysPromptTokens
      const completionCost = (modelConfig.completion_cost ?? 0) * estimatedCompletionTokens
      const projectedCost = promptCost + sysPromptCost + completionCost

      logger.info(`[CostGuard] ${modelConfig.id}: ~${promptTokens + sysPromptTokens} input + ~${estimatedCompletionTokens} output tokens → projected $${projectedCost.toFixed(6)}`)

      if (projectedCost > 0.50) {
        logger.warn(`[CostGuard] Skipping ${modelConfig.id} - projected cost $${projectedCost.toFixed(4)} exceeds limit $0.50`)
        routingTrace.push({ model: modelConfig.id, category, key: 'SKIPPED_COST', success: false })
        continue
      }
    }

    if (isModelFailed(modelConfig.id)) {
      logger.info(`Skipping failed model: ${modelConfig.id}`)
      routingTrace.push({ model: modelConfig.id, category, key: 'SKIPPED', success: false })
      continue
    }

    let key = modelConfig.provider === 'google' ? 'GEMINI' : modelConfig.provider.toUpperCase()
    if (modelConfig.id.includes('tavily')) key = 'TAVILY'
    let providerKeys: string[] = []

    providerKeys = prefetchedKeys[key] ?? []

    if (providerKeys.length === 0 && context?.aiApiKey) {
      providerKeys = [context.aiApiKey]
    }

    if (providerKeys.length === 0) {
      logger.warn(`No API keys for ${modelConfig.id} (${key}) — skipping`)
      routingTrace.push({ model: modelConfig.id, category, key: 'NO_KEY', success: false })
      continue
    }

    const startIndex = triedKeysCount[key] || 0

    try {
      for (let k = startIndex; k < providerKeys.length; k++) {
        const activeKey = providerKeys[k]

        if (k === providerKeys.length - 1 && providerKeys.length > 1) {
          logger.warn(`[KeyExhaustion] On last key (${k + 1}/${providerKeys.length}) for ${modelConfig.id}`)
        }

        try {
          logger.info(`Attempting model: ${modelConfig.id} (${modelConfig.provider}) for ${category}, API key index: ${k + 1}`)
          let response: any = null
          let usedSynthesisModel = ''

          const routeContext: any = {
            ...(context || {}),
            useTools: category === 'TOOL_CALLING',
            aiApiKey: activeKey || undefined,
            usedKeyIndex: k + 1,
            temperature: typeof temperature === 'number' ? temperature : undefined,
            setSynthesisModel: (m: string) => { usedSynthesisModel = m }
          }

          const historyForChain = (!pipelineSettings.historyEnabledCategories || pipelineSettings.historyEnabledCategories.includes(category)) ? history : []

          const traceMeta = {
            chain: category,
            model: modelConfig.id,
            provider: modelConfig.provider,
            key: `${key} ${k + 1}`,
            input_system: system_prompt,
            input_user: activePromptForGen,
            input_history_count: historyForChain.length,
          }
          const t0 = Date.now()

          try {
            switch (modelConfig.provider.toLowerCase()) {
              case 'google':
                response = await runGoogle(modelConfig.id, activePromptForGen, system_prompt + "\n\n" + (globalPrompt || ''), undefined, { ...context, temperature } as any, historyForChain)
                break
              case 'groq':
                response = await runGroq(modelConfig.id, activePromptForGen, system_prompt, activeKey || context?.aiApiKey, routeContext, historyForChain)
                break
              case 'huggingface':
                if (category === 'IMAGE_GEN') {
                  response = await runHuggingFace(modelConfig.id, activePromptForGen, activeKey || context?.aiApiKey)
                } else {
                  response = await runHuggingFaceText(modelConfig.id, activePromptForGen, system_prompt, historyForChain, activeKey || context?.aiApiKey)
                }
                break
              case 'cloudflare':
                response = await runCloudflare(modelConfig.id, activePromptForGen, activeKey || context?.aiApiKey, system_prompt, historyForChain, category)
                break
              case 'vault':
                if (modelConfig.id === 'tavily-search') response = await runWebSearchChain(activePromptForGen, routeContext)
                if (modelConfig.id === 'duckduckgo-search') response = await runDuckDuckGoSearchChain(activePromptForGen, routeContext)
                break
              case 'pollinations':
                if (category === 'IMAGE_GEN') {
                  response = await runPollinations(activePromptForGen, modelConfig.id)
                } else {
                  response = await runPollinationsText(modelConfig.id, activePromptForGen, system_prompt, historyForChain, activeKey || providerKeys[0])
                }
                break
              case 'openrouter':
                console.log(`[DEBUG chainRouter] openrouter_provider value:`, modelConfig.openrouter_provider, `| model:`, modelConfig.id, `| category:`, category)
                response = await runOpenRouter(modelConfig.id, activePromptForGen, system_prompt, historyForChain, activeKey || context?.aiApiKey || providerKeys[0], modelConfig.openrouter_provider || undefined)
                break
              case 'local':
              case 'ollama':
              case 'ollama(my pc)':
                response = await runOllama(modelConfig.id, activePromptForGen, system_prompt, historyForChain, temperature)
                break
              case 'siliconflow':
                if (category === 'IMAGE_GEN') {
                  response = await runSiliconFlow(modelConfig.id, activePromptForGen, activeKey || providerKeys[0])
                } else {
                  response = await runSiliconFlowText(modelConfig.id, activePromptForGen, system_prompt, historyForChain, activeKey || providerKeys[0])
                }
                break
            }
          } catch (providerErr: any) {
            tracer.recordFailed({ ...traceMeta, error: providerErr?.message }, Date.now() - t0)
            throw providerErr
          }

          if (response) {
            let finalContent = response
            let citations: string[] | undefined = undefined

            if (typeof response === 'object' && !Buffer.isBuffer(response) && 'content' in response) {
              finalContent = (response as any).content
              citations = (response as any).citations
            }

            if (category === 'IMAGE_GEN' && typeof finalContent === 'string') {
              const looksLikeImage =
                finalContent.startsWith('data:image') ||
                finalContent.startsWith('http') ||
                finalContent.includes('![') ||
                finalContent.includes('.ai/') ||
                finalContent.includes('.com/') ||
                finalContent.includes('.org/')

              if (!looksLikeImage) {
                logger.warn(`[IMAGE_GEN ERROR] Model ${modelConfig.id} returned non-image text. Content: "${finalContent.slice(0, 100)}...". Skipping to next fallback.`)
                const displayKey = routeContext.usedKeyIndex ? `${key} ${routeContext.usedKeyIndex}` : `${key} 1`
                routingTrace.push({ model: modelConfig.id, category, key: displayKey, success: false })
                tracer.recordFailed({ ...traceMeta, error: 'non-image text returned' }, Date.now() - t0)
                continue
              }
            }

            const displayKey = routeContext.usedKeyIndex ? `${key} ${routeContext.usedKeyIndex}` : `${key} 1`
            routingTrace.push({ model: modelConfig.id, category, key: displayKey, success: true, actualProvider: (response as any).provider })
            tracer.recordSuccess({ ...traceMeta, output: typeof finalContent === 'string' ? finalContent : '[binary]' }, Date.now() - t0)
            if (usedSynthesisModel) {
              routingTrace.push({ model: usedSynthesisModel, category, key: 'GEMINI 1', success: true })
            }
            trackModelUsage(modelConfig.id, modelConfig.provider)

            let imageDescription: string | undefined = undefined
            if (category === 'IMAGE_GEN') {
              try {
                let processingBuffer: Buffer | null = Buffer.isBuffer(finalContent) ? finalContent : null
                if (!processingBuffer && typeof finalContent === 'string' && (finalContent.startsWith('http') || finalContent.includes('.ai/'))) {
                  logger.info(`Fetching remote image for processing: ${finalContent.slice(0, 50)}...`)
                  const fetchRes = await fetch(finalContent)
                  if (fetchRes.ok) {
                    processingBuffer = Buffer.from(await fetchRes.arrayBuffer())
                  } else {
                    logger.warn(`Failed to fetch remote image for processing: ${fetchRes.status}`)
                  }
                }
                if (processingBuffer) {
                  try {
                    logger.info(`Checking if upscale is needed for generated image...`)
                    const upscaleT0 = Date.now()
                    const { buffer, modelChain: upscaleChain, failedModels: upscaleFailed } = await runUpscaleChain(processingBuffer)
                    for (const failed of upscaleFailed ?? []) {
                      routingTrace.push({ model: failed.id, category: 'IMAGE_UPSCALE', key: 'HF', success: false })
                      tracer.recordFailed({ chain: 'IMAGE_UPSCALE', model: failed.id, provider: failed.provider, error: failed.error })
                    }
                    if (upscaleChain) {
                      logger.info(`[Upscale] Chain complete: ${upscaleChain}`)
                      processingBuffer = buffer
                      if (Buffer.isBuffer(finalContent)) finalContent = buffer
                      const upscalePart = upscaleChain.split(' → ')[1] || 'upscaler'
                      const upscaleModelId = upscalePart.split('|')[0]
                      routingTrace.push({ model: upscaleModelId, category: 'IMAGE_UPSCALE', key: 'HF', success: true })
                      tracer.recordSuccess({
                        chain: 'IMAGE_UPSCALE',
                        model: upscaleModelId,
                        provider: 'huggingface',
                      }, Date.now() - upscaleT0)
                    }
                  } catch (e: any) {
                    logger.warn(`Auto-upscale in runChain failed: ${e.message}`)
                  }
                  try {
                    const { narrateGeneratedImage } = await import('./image-narration')
                    const narrateT0 = Date.now()
                    const narrateRes = await narrateGeneratedImage(processingBuffer, context)
                    if (narrateRes) {
                      imageDescription = narrateRes.description
                      routingTrace.push({ model: narrateRes.modelId, category: 'VISION', key: 'NARRATION', success: true })
                      tracer.recordSuccess({
                        chain: 'VISION',
                        model: narrateRes.modelId,
                        provider: narrateRes.provider,
                        output: narrateRes.description,
                      }, Date.now() - narrateT0)
                    }
                  } catch (err) {
                    logger.warn(`Narration failed: ${err instanceof Error ? err.message : String(err)}`)
                  }
                }
              } catch (processingErr: any) {
                logger.warn(`Image post-processing error: ${processingErr.message}`)
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
            routingTrace.forEach(r => {
              chainParts.push([r.model, r.key, r.success ? 'true' : 'false', r.actualProvider || ''].join('|'))
            })
            const detailedModelChain = chainParts.join(' → ')

            // Update token usage
            if (typeof finalContent === 'string') {
              const sid = context?.chatId?.toString() || context?.activeEntityId || 'global'
              const newTokens = estimateTokens(prompt + (finalContent || '') + (system_prompt || ''))
              const totalUsage = (sessionState?.token_usage_total || 0) + newTokens
              const limit = sessionState?.context_limit ?? 32000
              const threshold = sessionState?.compaction_threshold ?? 0.8
              if (totalUsage > limit * threshold) {
                logger.info(`Context limit (${Math.round(threshold * 100)}%) reached for ${sid}. Triggering summarization...`)
                summarizeSession(sid, history, currentSummary)
              } else {
                updateSessionState(sid, { token_usage_total: totalUsage, context_limit: limit, compaction_threshold: threshold })
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
              tokens_used: typeof finalContent === 'string' ? estimateTokens(prompt + finalContent + (system_prompt || '')) : undefined,
              image_description: imageDescription,
              pipeline_steps: thinkPipelineStepsPrepass.length > 0 ? thinkPipelineStepsPrepass : undefined,
              step_traces: tracer.all.length > 0 ? tracer.all : undefined,
            }
          } else {
            const lastTried = triedKeysCount[key] ?? 0
            const displayKey = routeContext.usedKeyIndex ? `${key} ${routeContext.usedKeyIndex}` : `${key} ${lastTried + 1}`
            const wasSkipped = startIndex >= providerKeys.length
            if (wasSkipped) {
              logger.info(`Skipping ${modelConfig.id} — all ${key} keys already exhausted`)
            } else {
              triedKeysCount[key] = lastTried + 1
              routingTrace.push({ model: modelConfig.id, category, key: displayKey, success: false, status: 'empty' })
              tracer.recordFailed({ ...traceMeta, error: 'empty response' }, Date.now() - t0)
            }
            if (fallbackMode !== 'api_key_first') {
              throw new Error(`Model ${modelConfig.id} returned empty response (exhausted keys)`)
            }
          }
        } catch (error: any) {
          const errMsg = error.message || ''
          const isKeyExhausted = errMsg.includes('KEY_EXHAUSTED:')
          const lastTried = triedKeysCount[key] ?? 0
          if (isKeyExhausted) {
            logger.warn(`[KeyRotation] Key ${lastTried + 1} exhausted for ${modelConfig.id} — trying next key`)
            triedKeysCount[key] = lastTried + 1
          } else {
            markModelFailed(modelConfig.id)
          }
          routingTrace.push({ model: modelConfig.id, category, key: `${key} ${lastTried + 1}`, success: false })
          logger.warn(`Failure with key ${lastTried + 1} for [${modelConfig.id}]: ${error.message}`)
          if (fallbackMode !== 'api_key_first') {
            throw error
          }
        }
      }
    } catch (outerError: any) {
      logger.error(`[ROUTING FAILURE] Category ${category} | Model ${modelConfig.id} failed: ${outerError.message}`)
      const displayKey = (context as any)?.usedKeyIndex ? `${key} ${(context as any).usedKeyIndex}` : `${key} 1`
      routingTrace.push({ model: modelConfig.id, category, key: displayKey, success: false })
      continue
    }
  }

  // All models in the chain exhausted — fall back to COMPLEX_THINKING if not already there
  if (category !== 'COMPLEX_THINKING' && category !== 'MEDIUM_THINKING' && category !== 'FAST_SIMPLE') {
    logger.warn(`[Fallback] All models exhausted for ${category} — retrying with COMPLEX_THINKING`)
    return runChain(prompt, inputBuffer, { ...context, _forcedCategory: 'COMPLEX_THINKING' })
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
    routing_trace: routingTrace,
    step_traces: tracer.all.length > 0 ? tracer.all : undefined,
  }
}

/**
 * Executes the IMAGE_UPSCALE chain on a provided image buffer.
 * Only upscales if dimensions are below 2000px.
 */
export async function runUpscaleChain(
  imageBuffer: Buffer,
  context?: { aiApiKey?: string }
): Promise<{ buffer: Buffer; modelChain?: string; failedModels?: Array<{ id: string; provider: string; error: string }> }> {
  // 1. Check dimensions
  const dims = getImageDimensions(imageBuffer)
  logger.info(`[Upscale] Checking image dimensions: ${dims ? `${dims.width}x${dims.height}` : 'unknown'}`)
  if (dims && dims.width >= 2000 && dims.height >= 2000) {
    logger.info(`[Upscale] Skipping: Image already large enough.`)
    return { buffer: imageBuffer }
  }

  // 2. Fetch the chain
  const { chain } = await getRouterChain('IMAGE_UPSCALE')
  logger.info(`[Upscale] Chain fetched: ${chain?.length || 0} models found.`)
  if (!chain || chain.length === 0) {
    logger.info('[Upscale] No models configured. Skipping.')
    return { buffer: imageBuffer }
  }

  const failedModels: Array<{ id: string; provider: string; error: string }> = []

  // 3. Iterate models
  for (const modelConfig of chain) {
    if (!modelConfig.is_enabled) {
      logger.info(`[Upscale] Skipping disabled model: ${modelConfig.id}`)
      continue
    }

    try {
      logger.info(`[Upscale] Attempting with: ${modelConfig.id} (${modelConfig.provider})`)
      let upscaled: Buffer | null = null

      const provider = modelConfig.provider.toLowerCase()
      if (provider === 'huggingface') {
        upscaled = await runHuggingFaceUpscale(modelConfig.id, imageBuffer, context?.aiApiKey)
      }

      if (upscaled) {
        logger.info(`[Upscale] SUCCESS with ${modelConfig.id}`)
        return { buffer: upscaled, modelChain: `IMAGE_UPSCALE → ${modelConfig.id}`, failedModels }
      } else {
        logger.warn(`[Upscale] Model ${modelConfig.id} returned no data.`)
        failedModels.push({ id: modelConfig.id, provider: modelConfig.provider, error: 'empty response' })
      }
    } catch (err: any) {
      logger.warn(`[Upscale] Failed for ${modelConfig.id}: ${err.message}`)
      failedModels.push({ id: modelConfig.id, provider: modelConfig.provider, error: err.message })
    }
  }

  return { buffer: imageBuffer, failedModels }
}
