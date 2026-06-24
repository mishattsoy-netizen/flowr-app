import { classifyIntentWithModel } from './classifier'
import { sanitizeOutput } from './outputGuard'
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
import { runExaSearchChain } from './providers/exa'
import { runDeepResearchChain } from './providers/deepResearch'
import { extractContent, formatExtractedPages } from './providers/content-extract'
import { runCloudflare } from './providers/cloudflare'
import { runPollinations, runPollinationsText } from './providers/pollinations'
import { runSiliconFlow, runSiliconFlowText } from './providers/siliconflow'
import { runNvidia } from './providers/nvidia'
import { getConversationMemory, getWebConversationMemory } from './memory'
import { supabaseAdmin } from '../supabase'
import { getCompiledPrompt, getInternalPrompt } from './compilePrompt'
import { getSessionState, updateSessionState, estimateTokens, summarizeSession } from './context'
import type { StatusCallback, PipelineStep } from './pipeline'
import { runThinkChain } from './thinkChain'
import { getPipelineSettings } from '../router-config'
import { expandImagePrompt } from './prompt-expansion'
import { TraceCollector } from './tracing'
import { buildTranscript } from './transcript'
import { getAiUserDescription, getAiCreatorInfo } from '@/app/settings/ai/actions'

function logCost(cost: {
  model_id: string; provider: string; prompt_cost: number; completion_cost: number;
  total_cost: number; prompt_tokens: number; completion_tokens: number;
}) {
  if (!supabaseAdmin) return
  // Only insert fields that exist on cost_log table
  const { chain, subprovider, ...safe } = cost as any
  supabaseAdmin.from('cost_log').insert(safe)
    .then(({ error }: { error: any }) => { if (error) logger.warn(`[CostLog] insert failed: ${error.message}`) })
    .catch((err: any) => logger.warn(`[CostLog] error: ${err?.message ?? String(err)}`))
}

async function trackModelUsage(p_model_id: string, p_provider: string) {
  try {
    const today = new Date().toISOString().split('T')[0]

    // 1. Check if we need a global reset for the day
    const { data: model, error: fetchError } = await supabaseAdmin
      .from('models')
      .select('last_reset_date')
      .eq('id', p_model_id)
      .maybeSingle()

    if (!fetchError && model && model.last_reset_date !== today) {
      logger.info(`[RPD] New day detected (${today}). Resetting all model usage...`)
      await supabaseAdmin
        .from('models')
        .update({
          usage_today: 0,
          last_reset_date: today
        })
        .neq('last_reset_date', today)
    }

    // 2. Increment usage (creates or updates the model row)
    const { error } = await supabaseAdmin.rpc('increment_model_usage', { p_model_id, p_provider })
    if (error) throw error
  } catch (error: any) {
    logger.warn(`Usage track failed [${p_model_id}]: ${error.message}`)
  }
}


// Generates alternative search queries when initial search fails


// Augments search query with context from conversation history
function augmentSearchQuery(originalQuery: string, history: any[]): string {
  if (!history || history.length === 0) return originalQuery
  
  // Collect unique nouns/entities from the last N user messages
  const lastUserMsgs = history
    .filter(h => h.role === "user" || h.role === "human")
    .slice(-3)
    .map(h => {
      const text = h.parts?.[0]?.text || h.content || ""
      return text.slice(0, 200) // keep it short
    })
  
  if (lastUserMsgs.length === 0) return originalQuery
  
  // If the current query is very short or ambiguous, append context
  const queryWords = originalQuery.split(/s+/).length
  if (queryWords <= 5) {
    // Find the most distinct entity from recent history not in the current query
    const queryLower = originalQuery.toLowerCase()
    for (const msg of lastUserMsgs.reverse()) {
      const msgLower = msg.toLowerCase()
      // Extract first sentence or key entity
      const firstSentence = msg.split(/[.?!]/)[0].trim()
      if (firstSentence && !queryLower.includes(firstSentence.slice(0, 20).toLowerCase())) {
        const keyEntity = firstSentence.replace(/^(who is|what is|tell me about|compare|find)s+/i, "").slice(0, 60)
        if (keyEntity && keyEntity.length > 3) {
          return originalQuery + " " + keyEntity
        }
      }
    }
  }
  
  return originalQuery
}


function generateOptimizedQuery(originalPrompt: string): string[] {
  const queries: string[] = [originalPrompt]
  
  // If comparison format, generate individual entity queries
  const compareMatch = originalPrompt.match(/compare\s+(.+?)\s+(?:and|vs|with|versus)\s+(.+)/i)
  if (compareMatch) {
    const a = compareMatch[1].trim().replace(/^(?:the|a|an)\s+/i, '').slice(0, 100)
    const b = compareMatch[2].trim().replace(/^(?:the|a|an)\s+/i, '').slice(0, 100)
    queries.push(`${a} specifications capabilities`)
    queries.push(`${b} specifications capabilities`)
  }
  
  // Strip conversational framing
  const stripped = originalPrompt.replace(/^(?:can you|could you|i want to know|tell me about|what about|how about|what is|what are|do you know)\s+/i, '').trim()
  if (stripped !== originalPrompt && stripped.length > 5) {
    queries.push(stripped)
  }
  
  return queries
}
// Circuit breaker — cooldown duration depends on failure severity, with exponential backoff on repeats.
// hard:  auth / quota / 4xx — model is genuinely unavailable, back off long.
// soft:  5xx / timeout / empty / network — transient, retry sooner.
const COOLDOWN_HARD_MS = [60_000, 300_000, 900_000] // 1m → 5m → 15m
const COOLDOWN_SOFT_MS = [5_000, 15_000, 60_000]    // 5s → 15s → 1m
const STREAK_RESET_MS = 10 * 60_000 // failure streak resets after 10m of quiet

type FailureKind = 'hard' | 'soft'
interface FailureEntry { failedAt: number; expiresAt: number; streak: number; kind: FailureKind }
const modelFailureCache: Record<string, FailureEntry> = {}

function classifyError(errMsg: string): FailureKind {
  const m = errMsg.toLowerCase()
  if (m.includes('401') || m.includes('403') || m.includes('429') || m.includes('quota') ||
      m.includes('unauthorized') || m.includes('forbidden') || m.includes('invalid api key') ||
      m.includes('permission')) return 'hard'
  if (/\b4\d\d\b/.test(m) && !m.includes('408')) return 'hard' // 4xx except request-timeout
  return 'soft'
}

export function markModelFailed(modelId: string, errMsg = '') {
  const kind = classifyError(errMsg)
  const prev = modelFailureCache[modelId]
  const now = Date.now()
  const continuing = prev && (now - prev.failedAt) < STREAK_RESET_MS
  const streak = continuing ? Math.min(prev.streak + 1, 3) : 1
  const table = kind === 'hard' ? COOLDOWN_HARD_MS : COOLDOWN_SOFT_MS
  const cooldownMs = table[Math.min(streak - 1, table.length - 1)]
  modelFailureCache[modelId] = { failedAt: now, expiresAt: now + cooldownMs, streak, kind }
  logger.warn(`Model ${modelId} cooldown (${kind}, streak=${streak}, ${cooldownMs / 1000}s). Reason: ${errMsg || 'unspecified'}`)
}

export function isModelFailed(modelId: string): boolean {
  const entry = modelFailureCache[modelId]
  if (!entry) return false
  if (Date.now() >= entry.expiresAt) {
    delete modelFailureCache[modelId]
    return false
  }
  return true
}

export function getModelCooldownRemaining(modelId: string): number {
  const entry = modelFailureCache[modelId]
  if (!entry) return 0
  return Math.max(0, entry.expiresAt - Date.now())
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
  advisor_state?: string
  text_content?: string
  image_description?: string
  image_prompt?: string
  trace?: any[]
  step_traces?: import('./tracing').StepTrace[]
  transcript_md?: string
  captured_tool_calls?: any[]
}

export async function runChain(
  prompt: string,
  inputBuffer?: Buffer | Buffer[],
  context?: {
    chatId?: number;
    userId?: string;
    aiApiKey?: string;
    activeEntityId?: string;
    activeChatId?: string | null;
    activeWorkspaceId?: string;
    classificationModelId?: string;
    temperature?: number;
    mode?: BotMode;
    intentTag?: string | null;
    replyContext?: any;
    thinkingEnabled?: boolean;
    advisorEnabled?: boolean;
    pendingAdvisorState?: import('./advisor').AdvisorState | null;
    onStatus?: StatusCallback;
    onChunk?: (chunk: string) => void;
    vision_notes?: string;
    _forcedCategory?: IntentCategory;
    _triggerType?: string;
    _triggerValue?: string;
    _skipSessionSummary?: boolean;
    _visionImageDescription?: string | null;
    isTempChat?: boolean;
    clientHistory?: any[];
  }
): Promise<ChainResponse> {
  const tracer = new TraceCollector()

  // Inject current date context to help bot understand knowledge cutoff and current time
  const now = new Date()
  let dateContext = `[CURRENT CONTEXT]\nDate: ${now.toDateString()}\nTime: ${now.toLocaleTimeString()}\n`

  // 0. Prefetch independent config in parallel
  const sessionId = context?.chatId?.toString()
    || (context?.activeChatId ? `chat:${context.activeChatId}` : null)
    || (context?.isTempChat ? `temp:${crypto.randomUUID()}` : null)
    || context?.activeEntityId
    || 'global'
  const [sessionState, globalPrompt, fallbackModes, pipelineSettings, userDescription, creatorInfo] = await Promise.all([
    getSessionState(sessionId),
    getCompiledPrompt(context?.mode ?? 'default'),
    getFallbackModes(),
    getPipelineSettings(),
    context?.userId ? getAiUserDescription(context.userId) : null,
    context?.userId ? getAiCreatorInfo(context.userId) : null,
  ])

  const historyLimit = pipelineSettings.historyLimit ?? 20

  let history: any[] = []
  if (context?.chatId) {
    history = await getConversationMemory(context.chatId, historyLimit)
  } else if (context?.userId && context.userId !== 'anonymous' && !context?.isTempChat && context?.activeChatId) {
    // Only fetch DB history when we have a real chatId to scope the query.
    // Without activeChatId the query returns messages from ALL the user's chats (cross-chat leakage).
    // Temp chats and chatId-less requests fall through to clientHistory below.
    history = await getWebConversationMemory(context.userId, historyLimit, context.activeChatId)
  }
  // Fallback to client-provided history when DB lookup returns nothing
  // (anonymous users, temp chats, or missing message_logs rows)
  if (history.length === 0 && context?.clientHistory && context.clientHistory.length > 0) {
    history = context.clientHistory.slice(-historyLimit)
  }
  let currentSummary = sessionState?.distilled_summary || null

  // Pre-request compaction: if cumulative tokens exceed threshold and no summary exists,
  // compact before processing this request so it benefits from trimmed context.
  if (sessionState && !currentSummary && history.length >= 5
    && sessionState.token_usage_total > sessionState.context_limit * sessionState.compaction_threshold) {
    logger.info(`Pre-request compaction for ${sessionId} (${sessionState.token_usage_total}/${sessionState.context_limit})`)
    await summarizeSession(sessionId, history, null)
    const updated = await getSessionState(sessionId)
    if (updated?.distilled_summary) {
      currentSummary = updated.distilled_summary
      sessionState.distilled_summary = updated.distilled_summary
      sessionState.token_usage_total = updated.token_usage_total ?? sessionState.token_usage_total
    }
  }

  // 1. Specialized Vision Flow (Buffer or URL)
  let activeBuffers = Array.isArray(inputBuffer) ? inputBuffer : (inputBuffer ? [inputBuffer] : [])

  // Advisor pre-flight — runs before classification if enabled and no image attached
  if (context?.advisorEnabled && activeBuffers.length === 0) {
    const availableTools = ['web_search', 'deep_research', 'image_gen', 'tool_calling']
    const historyForAdvisor = (!pipelineSettings.historyEnabledCategories || pipelineSettings.historyEnabledCategories.includes('ADVISOR')) ? history : []
    const pendingState = context?.pendingAdvisorState ?? null
    const advisorResult = await runAdvisor(
      prompt,
      context?.mode ?? 'default',
      context?.thinkingEnabled ?? false,
      availableTools,
      context,
      historyForAdvisor,
      pendingState
    )

    logger.info(`[Advisor gate] phase=${advisorResult.phase} hasQuestions=${!!advisorResult.questions} hasState=${!!advisorResult.state} questionsPreview="${(advisorResult.questions || '').slice(0, 200).replace(/\n/g, '\\n')}"`)

    if (advisorResult.phase === 'planning') {
      const advisorStateJson = advisorResult.state ? JSON.stringify(advisorResult.state) : undefined
      return {
        type: 'text',
        content: advisorResult.questions || '',
        usage_type: 'chat',
        model_chain: 'advisor → (awaiting user response)',
        status: 'success',
        advisor_questions: advisorResult.questions || '',
        advisor_state: advisorStateJson,
      }
    }

    if (advisorResult.phase === 'ready' && advisorResult.state) {
      // Inject finalized brief, constraints, and plan into the system prompt for execution
      const readyBlocks: string[] = []
      if (advisorResult.finalizedBrief) {
        readyBlocks.push(`[FINALIZED BRIEF]\n${advisorResult.finalizedBrief}`)
      }
      if (advisorResult.gatheredConstraintsList && advisorResult.gatheredConstraintsList.length > 0) {
        readyBlocks.push(`[GATHERED CONSTRAINTS]\n${advisorResult.gatheredConstraintsList.map((c, i) => `${i + 1}. ${c}`).join('\n')}`)
      }
      if (advisorResult.approvedPlan) {
        readyBlocks.push(`[APPROVED PLAN]\n${advisorResult.approvedPlan}`)
      }
      if (readyBlocks.length > 0) {
        dateContext = `[ADVISOR PREPARATION]\n${readyBlocks.join('\n\n')}\n\n` + dateContext
      }
    }
    // phase === 'pass': fall through to normal execution
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
  let triggerInfo: { type: string, value: string } | null = (context?._triggerType)
    ? { type: context._triggerType, value: context._triggerValue || '' }
    : null
  let classificationTrace: any[] = []

  // Resolve pipeline settings and thinking toggle
  const thinkingEnabled = context?.thinkingEnabled ?? pipelineSettings.thinkingToggleDefault
  const onStatus: StatusCallback = context?.onStatus ?? (() => { })

  const getStatusLabel = (chain: string, fallback?: string) => {
    const custom = pipelineSettings.statusMessages?.[chain]
    return custom ? `${custom.emoji} ${custom.label}`.trim() : (fallback || 'Working...')
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

    // System Instructions = Persona + Date + Global Rules (respect pipeline settings)
    const visionGlobalEnabled = pipelineSettings.globalPromptEnabledCategories
      ? pipelineSettings.globalPromptEnabledCategories.includes('VISION')
      : true
    const systemPromptCombined = [
      visionSystemPrompt,
      dateContext,
      visionGlobalEnabled ? globalPrompt : null
    ].filter(Boolean).join("\n\n")

    // User Prompt = User Message or Default Trigger
    const activePrompt = prompt || "Analyze these images according to your instructions and provide a response."

    if (!prompt) {
      logger.info('Vision request received with no text, using default trigger.')
    }

    for (const modelConfig of visionChain) {
      if (!modelConfig.is_enabled) continue
      const visionT0 = Date.now()
      const visionTraceMeta = {
        chain: 'VISION',
        model: modelConfig.id,
        provider: modelConfig.provider,
        input_system: systemPromptCombined,
        input_user: activePrompt,
        input_history_count: history.length,
      }
      try {
        logger.info(`Routing vision to: ${modelConfig.id} (${modelConfig.provider}) — with ${activeBuffers.length} images`)

        let visionRes: any = null

        // Never stream the vision chain — its output contains the [VISION_CONTEXT]
        // block that must be stripped server-side before reaching the user.
        const visionContext = context ? { ...context, onChunk: undefined } : context

        switch (modelConfig.provider.toLowerCase()) {
          case 'google':
          case 'gemini':
            // Strip 'google/' prefix if user added it, as SDK doesn't always like it
            const sanitizedId = modelConfig.id.replace(/^google\//, '')
            visionRes = await runGoogle(sanitizedId, activePrompt, systemPromptCombined, activeBuffers, visionContext as any, history)
            break
          case 'openrouter':
            visionRes = await runOpenRouter(modelConfig.id, activePrompt, systemPromptCombined, history, context?.aiApiKey, { openrouterProvider: modelConfig.openrouter_provider, sessionId }, activeBuffers)
            break
          case 'groq':
            visionRes = await runGroq(modelConfig.id, activePrompt, systemPromptCombined, context?.aiApiKey, visionContext, history, activeBuffers)
            break
          case 'nvidia':
            visionRes = await runNvidia(modelConfig.id, activePrompt, systemPromptCombined, history, context?.aiApiKey, visionContext, activeBuffers)
            break
          default:
            logger.warn(`Vision provider ${modelConfig.provider} not specifically handled in router. Falling back to runGoogle.`)
            visionRes = await runGoogle(modelConfig.id, activePrompt, systemPromptCombined, activeBuffers, visionContext as any, history)
        }

        if (visionRes) {
          const visionUsage = typeof visionRes === 'object' ? (visionRes as any).usage : undefined
          const visionReasoning = typeof visionRes === 'object' ? (visionRes as any).reasoning : undefined
          const outputContent = typeof visionRes === 'object' ? visionRes.content : visionRes
          const visionCost = (visionUsage?.prompt_tokens ?? 0) * (modelConfig.prompt_cost ?? 0)
                           + (visionUsage?.completion_tokens ?? 0) * (modelConfig.completion_cost ?? 0)
          tracer.recordSuccess({
            ...visionTraceMeta,
            output: outputContent,
            prompt_tokens: visionUsage?.prompt_tokens,
            completion_tokens: visionUsage?.completion_tokens,
            total_tokens: visionUsage?.total_tokens,
            cache_read_input_tokens: visionUsage?.cache_read_input_tokens,
            cost: visionCost > 0 ? visionCost : undefined,
            reasoning: visionReasoning,
          }, Date.now() - visionT0)
          await trackModelUsage(modelConfig.id, modelConfig.provider).catch(() => {})
          logCost({
            model_id: modelConfig.id,
            provider: modelConfig.provider,
            prompt_cost: (visionUsage?.prompt_tokens ?? 0) * (modelConfig.prompt_cost ?? 0),
            completion_cost: (visionUsage?.completion_tokens ?? 0) * (modelConfig.completion_cost ?? 0),
            total_cost: visionCost,
            prompt_tokens: visionUsage?.prompt_tokens ?? 0,
            completion_tokens: visionUsage?.completion_tokens ?? 0,
            chain: 'VISION',
            subprovider: (visionRes as any)?.provider ?? null,
          } as any)
          visionTrace.push({ model: modelConfig.id, provider: modelConfig.provider, status: 'success' })
          let content = typeof visionRes === 'object' ? visionRes.content : visionRes

          // Parse [VISION_CONTEXT] block emitted by vision model in ANSWER MODE
          // This block contains the full digital twin and is stripped from user-facing output
          let visionContextTwin: string | null = null
          const vcMatch = content.match(/\[VISION_CONTEXT\]([\s\S]*?)\[\/VISION_CONTEXT\]/)
          if (vcMatch) {
            const raw = vcMatch[1].trim()
            try {
              const vcData = JSON.parse(raw)
              if (vcData.digital_twin) visionContextTwin = vcData.digital_twin
            } catch {
              // Long verbatim twins often break strict JSON (unescaped newlines/quotes).
              // Fall back to extracting the digital_twin value, then the whole block.
              const dtMatch = raw.match(/"digital_twin"\s*:\s*"([\s\S]*)"\s*}?\s*$/)
              if (dtMatch) {
                visionContextTwin = dtMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim()
              } else {
                visionContextTwin = raw.replace(/^\{?\s*"?digital_twin"?\s*:?\s*"?/, '').replace(/"?\s*\}?$/, '').trim() || null
              }
            }
            content = content.replace(/\[VISION_CONTEXT\][\s\S]*?\[\/VISION_CONTEXT\]/, '').trim()
          }

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
            triggerInfo = { type: 'vision', value: modelConfig.id }

            // If vision model already produced the final answer, return it directly
            if (metadata.logic_nature === 'FAST_SIMPLE' && metadata.next_instructions) {
              const fastSimpleTwin = metadata.digital_twin ? String(metadata.digital_twin) : null
              if (context && fastSimpleTwin) {
                context.vision_notes = `[VISION DATA - DIGITAL TWIN]\n${fastSimpleTwin}`
                context._visionImageDescription = fastSimpleTwin
              }
              const sanitizedInstructions = sanitizeOutput(metadata.next_instructions)
              trackModelUsage(modelConfig.id, modelConfig.provider)
              return {
                type: 'text',
                content: sanitizedInstructions,
                usage_type: 'vision',
                model: modelConfig.id,
                model_chain: `vision → ${modelConfig.id}`,
                status: 'success',
                image_description: fastSimpleTwin ?? String(sanitizedInstructions).slice(0, 600),
                trace: visionTrace,
                step_traces: tracer.all.length > 0 ? tracer.all : undefined,
                transcript_md: buildTranscript({
                  prompt: activePrompt,
                  history,
                  context,
                  category: 'VISION',
                  systemPrompt: systemPromptCombined,
                  globalPrompt,
                  dateContext,
                  currentSummary,
                  replyContext: (context as any)?.replyContext,
                  thinkingEnabled: (context as any)?.thinkingEnabled,
                  advisorEnabled: (context as any)?.advisorEnabled,
                  mode: (context as any)?.mode,
                  stepTraces: tracer.all.length > 0 ? tracer.all : undefined,
                  finalContent: sanitizedInstructions,
                  finalModel: modelConfig.id,
                  tokensUsed: (visionUsage as any)?.total_tokens,
                  providerUsage: visionUsage as any,
                  providerReasoning: visionReasoning as any,
                  chainDuration: Date.now() - visionT0,
                  usageType: 'vision',
                  modelChain: `vision → ${modelConfig.id}`,
                }),
              } as any
            }

            if (context) {
              context.vision_notes = `[VISION DATA - DIGITAL TWIN]\n${metadata.digital_twin || ''}\n\n[VISION INSTRUCTIONS]\n${metadata.next_instructions || ''}`
              context._visionImageDescription = metadata.digital_twin || null
            }
            forcedCategory = metadata.logic_nature

            trackModelUsage(modelConfig.id, modelConfig.provider)
            classificationTrace.push({ model: modelConfig.id, provider: modelConfig.provider, chain: 'VISION', status: 'success' })
            break // Exit vision loop and proceed to main routing
          }

          if (context && visionContextTwin) {
            context.vision_notes = `[VISION DATA - DIGITAL TWIN]\n${visionContextTwin}`
            context._visionImageDescription = visionContextTwin
          }
          const sanitizedContent = typeof content === 'string' ? sanitizeOutput(content) : content
          trackModelUsage(modelConfig.id, modelConfig.provider)
          return {
            type: 'text',
            content: sanitizedContent,
            usage_type: 'vision',
            model: modelConfig.id,
            model_chain: `vision → ${modelConfig.id}`,
            status: 'success',
            image_description: visionContextTwin ?? undefined,
            trace: visionTrace,
            step_traces: tracer.all.length > 0 ? tracer.all : undefined,
            transcript_md: buildTranscript({
              prompt: activePrompt,
              history,
              context,
              category: 'VISION',
              systemPrompt: systemPromptCombined,
              globalPrompt: pipelineSettings.globalPromptEnabledCategories?.includes('VISION') ? globalPrompt : undefined,
              dateContext,
              currentSummary,
              replyContext: (context as any)?.replyContext,
              thinkingEnabled: (context as any)?.thinkingEnabled,
              advisorEnabled: (context as any)?.advisorEnabled,
              mode: (context as any)?.mode,
              stepTraces: tracer.all.length > 0 ? tracer.all : undefined,
              finalContent: sanitizedContent,
              finalModel: modelConfig.id,
              tokensUsed: (visionUsage as any)?.total_tokens,
              providerUsage: visionUsage as any,
              providerReasoning: visionReasoning as any,
              chainDuration: Date.now() - visionT0,
              usageType: 'vision',
              modelChain: `vision → ${modelConfig.id}`,
            }),
          } as any
        } else {
          tracer.recordFailed({ ...visionTraceMeta, error: 'Empty response' }, Date.now() - visionT0)
          visionTrace.push({ model: modelConfig.id, provider: modelConfig.provider, status: 'failed', error: 'Empty response' })
        }
      } catch (e: any) {
        logger.warn(`Vision failure [${modelConfig.id}]: ${e.message}`)
        tracer.recordFailed({ ...visionTraceMeta, error: e.message }, Date.now() - visionT0)
        visionTrace.push({ model: modelConfig.id, provider: modelConfig.provider, status: 'failed', error: e.message })
      }
    }

    // If we have a forced category from vision metadata, skip the return and continue to main router
    if (!forcedCategory) {
      if (visionChain.length === 0) {
        logger.error('VISION chain is empty — add models via Admin > Router > VISION')
      }
      onStatus({ chain: 'VISION', status: 'failed', label: getStatusLabel('VISION', 'Vision Failed'), goal: 'Processing visual input' })
      return {
        type: 'text',
        content: "⚡ *Vision Analysis Failed* — Check your model IDs and API keys in the Router.",
        usage_type: 'vision',
        model_chain: 'vision → (none)',
        status: 'error',
        trace: visionTrace,
        transcript_md: buildTranscript({
          prompt: activePrompt,
          history,
          context,
          category: 'VISION',
          systemPrompt: systemPromptCombined,
          globalPrompt: pipelineSettings.globalPromptEnabledCategories?.includes('VISION') ? globalPrompt : undefined,
          dateContext,
          currentSummary,
          replyContext: (context as any)?.replyContext,
          thinkingEnabled: (context as any)?.thinkingEnabled,
          advisorEnabled: (context as any)?.advisorEnabled,
          mode: (context as any)?.mode,
          stepTraces: tracer.all.length > 0 ? tracer.all : undefined,
          finalContent: "⚡ *Vision Analysis Failed* — Check your model IDs and API keys in the Router.",
          usageType: 'vision',
          modelChain: 'vision → (none)',
        }),
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
    if (classifyRes.trigger_type) {
      triggerInfo = { type: classifyRes.trigger_type, value: classifyRes.trigger_value || '' }
    }

    if (!rawCategory) {
      onStatus({ chain: 'CLASSIFIER', status: 'failed', goal: 'Classifying intent' })
      logger.error(`Classification failed: ${classifyError ?? 'unknown reason'}`)
      return {
        type: 'text',
        content: "⚡ *System Overload*",
        usage_type: 'chat',
        model_chain: 'classifier → (failed)',
        status: 'error',
        step_traces: tracer.all.length > 0 ? tracer.all : undefined,
        classification_trace: classificationTrace,
      } as any
    }
    onStatus({ chain: 'CLASSIFIER', status: 'done', goal: 'Classifying intent' })
  }

  // Normalize legacy / internal categories
  if (rawCategory === 'FAST_SIMPLE') rawCategory = 'REGULAR'
  if (rawCategory === 'MEDIUM_THINKING') rawCategory = 'COMPLEX'
  if (rawCategory === 'TOOLS') rawCategory = 'COMPLEX'

  let category: IntentCategory = rawCategory
  logger.info(`[Router] Starting runChain for category: ${category} | prompt: "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"`)

  const routingTrace: RoutingTrace[] = []

  // If classified as ADVISOR, fallback to COMPLEX to actually process the query
  if (category === 'ADVISOR') {
    category = 'COMPLEX'
  }

  let { chain, system_prompt: routerOverridePrompt, temperature, thinking_budget } = await getRouterChain(category)

  // Fetch internal pipeline prompt if available (from Admin > Bot > Global)
  const internalPipelinePrompt = await getInternalPrompt(category, context?.mode ?? 'default')

  // UNIFICATION: Global Bot Prompt + Internal Pipeline Prompt + Router Override
  // Order: 1. Global (Rules/Personality) 2. Internal (Instructions) 3. Router Override (Specific overrides)
  let finalSysPrompt = dateContext

  // Only inject global prompt if the category is enabled in pipeline settings.
  // When no admin setting exists, default to ALL categories (original behavior).
  // The admin can configure exclusions via Pipeline Settings → Global Prompt Enabled Categories.
  const isGlobalPromptEnabled = pipelineSettings.globalPromptEnabledCategories
    ? pipelineSettings.globalPromptEnabledCategories.includes(category)
    : true

  if (globalPrompt && isGlobalPromptEnabled) finalSysPrompt += "\n\n" + globalPrompt
  // Inject user's personal description if available
  if (userDescription) {
    finalSysPrompt += `\n\n[ABOUT THE USER]\nThe following is what the user has shared about themselves. Use this information to personalize your responses and understand who they are:\n${userDescription}\n`
  }
  if (creatorInfo) {
    finalSysPrompt += `\n\n[ABOUT THE CREATOR]\n${creatorInfo}\n`
  }
  // Skip internal pipeline prompt for chains that have their own router override —
  // the router prompt already contains [ANSWER MODE] instructions and mixing both
  // causes the model to default to PIPELINE structured output instead of user-facing answers.
  const PIPELINE_PROMPT_CHAINS = ['WEB_SEARCH', 'RESEARCH']
  if (internalPipelinePrompt && !PIPELINE_PROMPT_CHAINS.includes(category)) finalSysPrompt += "\n\n" + internalPipelinePrompt
  if (routerOverridePrompt) finalSysPrompt += "\n\n" + routerOverridePrompt

  // Deduplicate [RESTRICTIONS] — the compiled global prompt already contains it,
  // and it may also appear in the router override or internal prompt.
  // Keep only the first occurrence to save tokens.
  let restrictionsDeduped = false
  finalSysPrompt = finalSysPrompt.replace(/^\[RESTRICTIONS\][\s\S]*?(?=\n\n\[|$)/gm, (match) => {
    if (restrictionsDeduped) return ''
    restrictionsDeduped = true
    return match
  })

  let system_prompt = finalSysPrompt

  if (context?.vision_notes) {
    system_prompt = `[VISION DATA]\n${context.vision_notes}\n\n` + system_prompt
  }

  // Inject global session summary if available.
  // Skip for WEB_SEARCH/RESEARCH and fallbacks from those chains — poisoned summaries override search results.
  const skipSummary = category === 'WEB_SEARCH' || category === 'RESEARCH' || context?._skipSessionSummary || context?.isTempChat
  if (currentSummary && !skipSummary) {
    system_prompt = `[SESSION MEMORY SUMMARY]\n${currentSummary}\n\n` + system_prompt
  }

  if (context?.replyContext?.attentionBlock) {
    system_prompt = context.replyContext.attentionBlock + "\n\n" + (system_prompt || "")
  }

  let finalUsageType: 'chat' | 'tool' | 'search' | 'vision' | 'image' = 'chat'
  if (category === 'WEB_SEARCH' || category === 'RESEARCH') finalUsageType = 'search'
  if (category === 'TOOLS') finalUsageType = 'tool'
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
      if (thinkResult.correctedContext) {
        // Inject search results from thinking pass so subsequent models in the chain have context
        system_prompt = `[SEARCH DATA]\n${thinkResult.correctedContext}\n\n` + system_prompt
      }
    } catch (e: any) {
      logger.warn(`Single-chain think pre-pass failed: ${e.message}`)
    }
  }

  // ── Iterative search for RESEARCH ──
  let activePromptForGen = prompt
  if (category === 'RESEARCH') {
    onStatus({ chain: 'RESEARCH', goal: 'Running iterative web research', status: 'running', label: getStatusLabel('RESEARCH') })
    const researchResult = await runDeepResearchChain(prompt, context)
    if (!researchResult.researchText.includes('Search failed')) {
      activePromptForGen = researchResult.researchText
    }
    if (researchResult.gapTrace.length > 0) {
      routingTrace.push(...researchResult.gapTrace)
    }
    onStatus({ chain: 'RESEARCH', goal: 'Running iterative web research', status: 'done' })
  }

  // ── WEB_SEARCH: read pasted page URLs directly instead of keyword-searching for them ──
  // Image URLs are handled earlier by the vision flow; here we fetch non-image pages
  // (articles, docs) and inject their content as [SEARCH DATA] so the synthesis model
  // answers from the actual page. Downstream search providers skip when [SEARCH DATA] is present.
  if (category === 'WEB_SEARCH' && !system_prompt.includes('[SEARCH DATA]') && /https?:\/\//i.test(prompt)) {
    const urls = (prompt.match(/https?:\/\/[^\s<>"')]+/gi) || [])
      .filter(u => !/\.(jpe?g|png|webp|gif|bmp|svg|tiff|avif)(\?|$)/i.test(u))
      .slice(0, 3)
    if (urls.length > 0) {
      onStatus({ chain: 'WEB_SEARCH', goal: 'Reading linked page(s)', status: 'running', label: getStatusLabel('WEB_SEARCH', 'Reading page') })
      try {
        const pages = await extractContent(urls, context)
        const formatted = formatExtractedPages(pages)
        if (formatted) {
          system_prompt = `${system_prompt}\n\n[SEARCH DATA]\n${formatted}\n\n`
          logger.info(`[WEB_SEARCH] Injected extracted content for ${pages.filter(p => p.content).length}/${urls.length} pasted URL(s)`)
          routingTrace.push({ model: 'content-extract', category, key: 'URL_FETCH', success: true })
        } else {
          logger.warn(`[WEB_SEARCH] URL fetch returned no content for: ${urls.join(', ')}`)
        }
      } catch (e: any) {
        logger.warn(`[WEB_SEARCH] URL fetch failed: ${e.message}`)
      }
      onStatus({ chain: 'WEB_SEARCH', goal: 'Reading linked page(s)', status: 'done' })
    }
  }

  // ── WEB_SEARCH/RESEARCH: foreground the uploaded image's digital twin ──
  // When the user compares something in their screenshot against an external entity
  // ("how does the cheapest one in my screenshot compare to gemini 3.1 flash lite"),
  // the search step fetches the external entity, but the synthesis model also needs the
  // image's own contents. Burying the twin in `history` makes a small synthesis model
  // ignore it (it relabels the image as the searched product). Instead we extract the
  // twin from history and inject it as a prominent, labeled [IMAGE FACTS] block so the
  // model treats it as authoritative for what the image contains. The reconciliation
  // rule in the chain prompt tells it: [IMAGE FACTS] = image truth, [SEARCH DATA] = the
  // external entity, keep them separate.
  if ((category === 'WEB_SEARCH' || category === 'RESEARCH') && !system_prompt.includes('[IMAGE FACTS]')) {
    const twinEntry = [...history].reverse().find(h => {
      if (h?.role !== 'user' && h?.role !== 'human') return false
      const t = h?.content || h?.parts?.[0]?.text || ''
      return /\[VISION CONTEXT|\[Image[: \]]|data:image|\[Image attached\]/i.test(t)
    })
    if (twinEntry) {
      const twinText = (twinEntry.content || twinEntry.parts?.[0]?.text || '').trim()
      if (twinText) {
        system_prompt = `${system_prompt}\n\n[IMAGE FACTS — the user's uploaded image, AUTHORITATIVE for what the image contains]\n${twinText}\n\n`
        logger.info(`[${category}] Injected [IMAGE FACTS] from digital twin (${twinText.length} chars)`)
      }
    }
  }

  // ── Prompt Expansion for IMAGE_GEN ──
  if (category === 'IMAGE_GEN') {
    onStatus({ chain: 'IMAGE_GEN', goal: 'Expanding prompt with context', status: 'running', label: getStatusLabel('IMAGE_GEN') })
    const expansionT0 = Date.now()
    const { getSubchainConfig } = await import('../subchain-config')
    const expanderCfg = await getSubchainConfig('prompt_expander')
    const expansionResult = await expandImagePrompt(prompt, history, context)
    activePromptForGen = expansionResult.expanded
    if (expansionResult.modelId) {
      routingTrace.push({ model: expansionResult.modelId, category: 'FAST_SIMPLE', key: 'PROMPT_EXPANSION', success: true })
      tracer.recordSuccess({
        chain: 'PROMPT_EXPANSION',
        model: expansionResult.modelId,
        provider: expansionResult.provider ?? 'unknown',
        input_system: expanderCfg?.system_prompt,
        input_user: prompt,
        output: activePromptForGen,
      }, Date.now() - expansionT0)
    }
    onStatus({ chain: 'IMAGE_GEN', goal: 'Expanding prompt with context', status: 'done' })
  }

  // ── Status label for text-processing categories ──
  const STATUS_CATEGORIES = ['REGULAR', 'COMPLEX', 'CODING', 'TOOLS', 'ADVISOR', 'AUDIO', 'WEB_SEARCH']
  if (STATUS_CATEGORIES.includes(category)) {
    onStatus({
      chain: category,
      goal: `Processing ${category.toLowerCase()} request`,
      status: 'running',
      label: getStatusLabel(category),
    })
  }

  logger.info(`[${category}] Chain models: [${uniqueChain.map(m => `${m.id}(${m.provider},en=${m.is_enabled},paid=${m.is_paid})`).join(', ')}]`)

  modelLoop: for (const modelConfig of uniqueChain) {


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


    // ── WEB_SEARCH/RESEARCH: inject [SEARCH FAILED] if all search engines exhausted ──
    const SEARCH_CHAIN_CATEGORIES: string[] = ['WEB_SEARCH', 'RESEARCH']
    if (SEARCH_CHAIN_CATEGORIES.includes(category) && !modelConfig.id.includes('search') && modelConfig.provider !== 'core' && modelConfig.provider !== 'tavily' && !system_prompt.includes('[SEARCH DATA]') && !system_prompt.includes('[SEARCH FAILED]')) {
      logger.info(`All search engines exhausted for ${category} — injecting [SEARCH FAILED] before text model ${modelConfig.id}`)
      system_prompt += `\n\n[SEARCH FAILED]\nAll search attempts returned no results. Acknowledge your knowledge cutoff, provide what you know from training (labeled as pre-cutoff knowledge), and suggest the user retry searching in a few minutes.\n\n`
    }
    if (isModelFailed(modelConfig.id)) {
      const remainingS = Math.ceil(getModelCooldownRemaining(modelConfig.id) / 1000)
      logger.info(`Skipping ${modelConfig.id} — in cooldown (${remainingS}s remaining)`)
      routingTrace.push({ model: modelConfig.id, category, key: `COOLDOWN ${remainingS}s`, success: false, status: 'cooldown' })
      continue
    }

    let key = modelConfig.provider === 'google' ? 'GEMINI' : modelConfig.provider.toUpperCase()
    if (modelConfig.id.includes('tavily')) key = 'TAVILY'
    if (modelConfig.id.includes('exa')) key = 'EXA'
    let providerKeys: string[] = []

    providerKeys = prefetchedKeys[key] ?? []

    if (providerKeys.length === 0 && context?.aiApiKey) {
      providerKeys = [context.aiApiKey]
    }

    // core/tavily providers fetch their own keys internally — skip the key gate for them
    const isKeylessProvider = modelConfig.provider === 'core' || modelConfig.provider === 'tavily' || modelConfig.provider === 'exa'
    if (providerKeys.length === 0 && !isKeylessProvider) {
      logger.warn(`No API keys for ${modelConfig.id} (${key}) — skipping`)
      routingTrace.push({ model: modelConfig.id, category, key: 'NO_KEY', success: false })
      continue
    }
    if (isKeylessProvider && providerKeys.length === 0) providerKeys = ['none']

    const exhaustionKey = `${key}:${modelConfig.id}`
    const startIndex = triedKeysCount[exhaustionKey] || 0
    let tracePushed = false

    try {
      keyLoop: for (let k = startIndex; k < providerKeys.length; k++) {
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
            sessionId,
            useTools: ['REGULAR', 'COMPLEX', 'CODING', 'TOOLS', 'ADVISOR'].includes(category),
            // Ground a Gemini step only when no search engine has fed it data yet.
            // [SEARCH DATA] is injected once tavily/exa run, so a Gemini model placed
            // ABOVE the search engine self-grounds, while one BELOW it synthesizes the
            // injected results instead — avoiding the free-tier grounding-quota 429.
            // Also acts as a fallback: if the search engine failed (no [SEARCH DATA]),
            // a downstream Gemini still self-grounds rather than answering blind.
            useGrounding: (category === 'WEB_SEARCH' || category === 'RESEARCH')
              && modelConfig.provider === 'gemini'
              && !system_prompt.includes('[SEARCH DATA]'),
            aiApiKey: activeKey || undefined,
            usedKeyIndex: k + 1,
            temperature: typeof temperature === 'number' ? temperature : undefined,
            thinkingBudget: thinking_budget,
            setSynthesisModel: (m: string) => { usedSynthesisModel = m }
          }

          // Only stream tokens for COMPLEX and REGULAR chains. All other chains
          // (vision, search, image gen, tools, advisor, coding) buffer their full
          // response so post-processing (e.g. stripping [VISION_CONTEXT]) runs before
          // anything reaches the user.
          const TEXT_STREAM_CATEGORIES = ['COMPLEX', 'REGULAR']
          if (!TEXT_STREAM_CATEGORIES.includes(category)) {
            routeContext.onChunk = undefined
          }

          // WEB_SEARCH/RESEARCH: pass a SHORT tail of history for follow-up context
          // ("the cheapest one", "compare it to X" depend on the prior turns). The twin's
          // image content is already foregrounded as [IMAGE FACTS] above, so history is
          // only for conversational coherence. Poison-control (prior model answers must
          // not override fresh search results) is handled by the chain prompt's rule
          // "[SEARCH DATA] wins on facts" — not by cutting history entirely.
          let historyForChain = (category === 'WEB_SEARCH' || category === 'RESEARCH')
            ? history.slice(-4)
            : (!pipelineSettings.historyEnabledCategories || pipelineSettings.historyEnabledCategories.includes(category)) ? history : []

          // When session summary exists, trim raw history — the summary carries prior context.
          // Keep only the last few messages for immediate conversational coherence (Claude Code style).
          if (currentSummary && historyForChain.length > 5) {
            historyForChain = historyForChain.slice(-5)
          }

          // ── Token Limit Application ──
          // Skip token limits for search chains — raw results must pass through unmodified.
          const SEARCH_CHAINS = ['WEB_SEARCH', 'RESEARCH']
          const enabledCats: string[] = pipelineSettings.tokenLimitEnabledCategories ?? []
          const isTokenLimitEnabled = enabledCats.length > 0
            ? enabledCats.includes(category)
            : !SEARCH_CHAINS.includes(category)
          if (isTokenLimitEnabled) {
            // Apply Output Limit (max_tokens)
            if (pipelineSettings.outputTokenLimit > 0) {
              routeContext.max_tokens = pipelineSettings.outputTokenLimit
            }
            
            // Apply Input Limit (Hard trimming)
            if (pipelineSettings.inputTokenLimit > 0) {
              const currentPromptTokens = estimateTokens(system_prompt + activePromptForGen)
              const budgetForHistory = pipelineSettings.inputTokenLimit - currentPromptTokens
              
              if (budgetForHistory <= 0) {
                // If system+user already exceeds limit, we can't send any history
                logger.warn(`[TokenGuard] System+User prompt (${currentPromptTokens} tokens) exceeds Input Limit (${pipelineSettings.inputTokenLimit}). Sending empty history.`)
                historyForChain = []
              } else {
                // Remove history messages from oldest to newest until it fits in the budget
                let currentHistory = [...historyForChain]
                while (currentHistory.length > 0) {
                  const historyTokens = estimateTokens(JSON.stringify(currentHistory))
                  if (historyTokens <= budgetForHistory) break
                  currentHistory.shift() 
                }
                if (currentHistory.length !== historyForChain.length) {
                  logger.info(`[TokenGuard] Trimmed history from ${historyForChain.length} to ${currentHistory.length} messages to fit ${pipelineSettings.inputTokenLimit} token limit.`)
                }
                historyForChain = currentHistory
              }
            }
          }

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
              case 'gemini':
                response = await runGoogle(modelConfig.id, activePromptForGen, system_prompt, undefined, routeContext, historyForChain)
                break
              case 'groq':
                response = await runGroq(modelConfig.id, activePromptForGen, system_prompt, activeKey || context?.aiApiKey, routeContext, historyForChain)
                break
              case 'huggingface':
                if (category === 'IMAGE_GEN') {
                  response = await runHuggingFace(modelConfig.id, activePromptForGen, activeKey || context?.aiApiKey)
                } else {
                  response = await runHuggingFaceText(modelConfig.id, activePromptForGen, system_prompt, historyForChain, activeKey || context?.aiApiKey, routeContext)
                }
                break
              case 'cloudflare':
                response = await runCloudflare(modelConfig.id, activePromptForGen, activeKey || context?.aiApiKey, system_prompt, historyForChain, category, routeContext)
                break
              case 'core':
              case 'exa':
              case 'tavily': {
                // If we already have search data (from Thinking pass, Web Search, or Deep Research), skip redundant search
                // Note: Deep Research results are often in activePromptForGen instead of system_prompt
                const hasSearchData =
                  system_prompt.includes('[SEARCH DATA:') ||
                  system_prompt.includes('[SEARCH DATA]\n') ||
                  system_prompt.includes('[SEARCH RESULTS') ||
                  system_prompt.includes('RESEARCH FINDINGS:') ||
                  activePromptForGen.includes('RESEARCH FINDINGS:')

                if (hasSearchData) {
                  logger.info(`Skipping redundant search for ${modelConfig.id} - data already present from prior pass.`)
                  continue modelLoop
                }

                const SEARCH_FAILURE_STRINGS = ['search failed', 'unavailable', 'could not retrieve', 'failed to retrieve', 'unable to find', 'no results']
                let searchResult: string | null = null
                // Augment search query with conversation context for disambiguation
                const searchQuery = augmentSearchQuery(prompt, history)
                if (modelConfig.id.includes('tavily')) searchResult = await runWebSearchChain(searchQuery, routeContext, system_prompt)
                else if (modelConfig.id.includes('duckduckgo')) searchResult = await runDuckDuckGoSearchChain(searchQuery, routeContext, system_prompt)
                else if (modelConfig.id.includes('exa')) searchResult = await runExaSearchChain(searchQuery, routeContext, system_prompt)
                else {
                  // Fallback: try based on provider name if ID doesn't match
                  if (modelConfig.provider === 'tavily') searchResult = await runWebSearchChain(searchQuery, routeContext, system_prompt)
                  else if (modelConfig.provider === 'exa') searchResult = await runExaSearchChain(searchQuery, routeContext, system_prompt)
                }

                let isSearchFailure = !searchResult || SEARCH_FAILURE_STRINGS.some(f => searchResult!.toLowerCase().includes(f))

                if (isSearchFailure) {
                  // Retry with optimized query (one retry per engine)
                  const altQueries = generateOptimizedQuery(searchQuery)
                  for (const altQuery of altQueries) {
                    if (altQuery === searchQuery) continue
                    logger.info(`Retrying ${modelConfig.id} with optimized query: "${altQuery}"`)
                    let retryResult: string | null = null
                    if (modelConfig.id.includes('tavily')) retryResult = await runWebSearchChain(altQuery, routeContext, system_prompt)
                    else if (modelConfig.id.includes('duckduckgo')) retryResult = await runDuckDuckGoSearchChain(altQuery, routeContext, system_prompt)
                    else if (modelConfig.id.includes('exa')) retryResult = await runExaSearchChain(altQuery, routeContext, system_prompt)
                    
                    const retryFailed = !retryResult || SEARCH_FAILURE_STRINGS.some(f => retryResult!.toLowerCase().includes(f))
                    if (!retryFailed) {
                      searchResult = retryResult
                      isSearchFailure = false
                      logger.info(`Retry succeeded for ${modelConfig.id} with query: "${altQuery}"`)
                      break
                    }
                  }
                }

                if (isSearchFailure) {
                  const displayKey = routeContext.usedKeyIndex ? `${key} ${routeContext.usedKeyIndex}` : `${key} 1`
                  routingTrace.push({ model: modelConfig.id, category, key: displayKey, success: false, status: 'empty' })
                  tracer.recordFailed({ ...traceMeta, error: 'search failed to retrieve results' }, Date.now() - t0)
                  break
                }

                // Success: update system_prompt for the next model and set response to trigger success path
                system_prompt = `${system_prompt}\n\n[SEARCH DATA: ${modelConfig.id}]\n${searchResult}\n\n`
                response = { content: searchResult }
                break
              }
              case 'pollinations':
                if (category === 'IMAGE_GEN') {
                  response = await runPollinations(activePromptForGen, modelConfig.id)
                } else {
                  response = await runPollinationsText(modelConfig.id, activePromptForGen, system_prompt, historyForChain, activeKey || providerKeys[0], routeContext)
                }
                break
              case 'openrouter':
                if (modelConfig.openrouter_provider) routeContext.openrouterProvider = modelConfig.openrouter_provider
                response = await runOpenRouter(modelConfig.id, activePromptForGen, system_prompt, historyForChain, activeKey || context?.aiApiKey || providerKeys[0], routeContext)
                break
              case 'local':
              case 'ollama':
              case 'ollama(my pc)':
                response = await runOllama(modelConfig.id, activePromptForGen, system_prompt, historyForChain, temperature, routeContext)
                break
              case 'siliconflow':
                if (category === 'IMAGE_GEN') {
                  response = await runSiliconFlow(modelConfig.id, activePromptForGen, activeKey || providerKeys[0])
                } else {
                  response = await runSiliconFlowText(modelConfig.id, activePromptForGen, system_prompt, historyForChain, activeKey || providerKeys[0], routeContext)
                }
                break
              case 'nvidia':
                response = await runNvidia(modelConfig.id, activePromptForGen, system_prompt, historyForChain, activeKey || providerKeys[0], routeContext)
                break
            }
          } catch (providerErr: any) {
            tracer.recordFailed({ ...traceMeta, error: providerErr?.message }, Date.now() - t0)
            throw providerErr
          }

          if (response) {
            let finalContent = response
            let citations: string[] | undefined = undefined
            let providerUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } | undefined
            let providerReasoning: string | undefined
            let capturedToolCalls: any[] | undefined = undefined

            if (typeof response === 'object' && !Buffer.isBuffer(response) && 'content' in response) {
              finalContent = (response as any).content
              citations = (response as any).citations
              providerUsage = (response as any).usage
              providerReasoning = (response as any).reasoning
              capturedToolCalls = (response as any).capturedToolCalls
            }

            if (capturedToolCalls && capturedToolCalls.length > 0) {
              onStatus({
                chain: category,
                goal: `Executed ${capturedToolCalls.length} tool(s)`,
                status: 'done',
                label: getStatusLabel('TOOLS', '🔧 Tools used')
              })
            }

            // ── Grounding guard: a WEB_SEARCH/RESEARCH Gemini step that was asked to ground
            // but returned no citations means grounding silently no-op'd. Accepting it lets
            // the model answer from training and fabricate source pills. Treat as a failed
            // search attempt and fall through to the next chain model (tavily/duckduckgo)
            // — which will inject [SEARCH DATA], or trip the [SEARCH FAILED] path. ──
            if (
              (category === 'WEB_SEARCH' || category === 'RESEARCH') &&
              routeContext.useGrounding &&
              (!citations || citations.length === 0) &&
              !system_prompt.includes('[SEARCH DATA]')
            ) {
              logger.warn(`[GroundingGuard] ${modelConfig.id} produced no grounding citations for WEB_SEARCH — discarding ungrounded answer and falling through to search providers`)
              const displayKey = routeContext.usedKeyIndex ? `${key} ${routeContext.usedKeyIndex}` : `${key} 1`
              routingTrace.push({ model: modelConfig.id, category, key: `${displayKey} (no grounding)`, success: false })
              tracer.recordFailed({ ...traceMeta, error: 'grounding requested but no citations returned' }, Date.now() - t0)
              continue modelLoop
            }

            // For WEB_SEARCH/RESEARCH search steps, we DON'T return.
            // We've already updated system_prompt and recorded trace inside the switch.
            // We just need to move to the next model in the modelLoop (the synthesis LLM).
            if ((modelConfig.provider === 'tavily' || modelConfig.id.includes('search')) && (category === 'WEB_SEARCH' || category === 'RESEARCH')) {
              // Record success for the search step itself
              const displayKey = routeContext.usedKeyIndex ? `${key} ${routeContext.usedKeyIndex}` : `${key} 1`
              routingTrace.push({ model: modelConfig.id, category, key: displayKey, success: true })
              tracer.recordSuccess({
                ...traceMeta,
                output: (response as any).content || '[search results]',
              }, Date.now() - t0)
              
              // Move to the next model in the chain (synthesis)
              break keyLoop
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
            const actualCost = (providerUsage?.prompt_tokens ?? 0) * (modelConfig.prompt_cost ?? 0)
                              + (providerUsage?.completion_tokens ?? 0) * (modelConfig.completion_cost ?? 0)
            tracer.recordSuccess({
              ...traceMeta,
              output: typeof finalContent === 'string' ? finalContent : '[binary]',
              prompt_tokens: providerUsage?.prompt_tokens,
              completion_tokens: providerUsage?.completion_tokens,
              total_tokens: providerUsage?.total_tokens,
              cache_read_input_tokens: providerUsage?.cache_read_input_tokens,
              cost: actualCost > 0 ? actualCost : undefined,
              reasoning: providerReasoning,
            }, Date.now() - t0)
            if (usedSynthesisModel) {
              routingTrace.push({ model: usedSynthesisModel, category, key: 'GEMINI 1', success: true })
            }
            await trackModelUsage(modelConfig.id, modelConfig.provider).catch(() => {})
            logCost({
              model_id: modelConfig.id,
              provider: modelConfig.provider,
              prompt_cost: (providerUsage?.prompt_tokens ?? 0) * (modelConfig.prompt_cost ?? 0),
              completion_cost: (providerUsage?.completion_tokens ?? 0) * (modelConfig.completion_cost ?? 0),
              total_cost: actualCost,
              prompt_tokens: providerUsage?.prompt_tokens ?? 0,
              completion_tokens: providerUsage?.completion_tokens ?? 0,
              chain: category,
              subprovider: (response as any)?.provider ?? null,
            } as any)

            let imageDescription: string | undefined = undefined
            if (category === 'IMAGE_GEN') {
              try {
                let processingBuffer: Buffer | null = Buffer.isBuffer(finalContent) ? finalContent : null
                if (!processingBuffer && typeof finalContent === 'string') {
                  const contentStr: string = finalContent
                  if (contentStr.startsWith('data:')) {
                    // data:image/png;base64,...  or  data:image/jpeg;base64,...
                    const b64 = contentStr.includes(';base64,') ? contentStr.split(';base64,')[1] : contentStr.split(',')[1]
                    if (b64) {
                      processingBuffer = Buffer.from(b64, 'base64')
                      logger.info(`Converted data: URL to buffer for processing (${processingBuffer.length} bytes)`)
                    }
                  } else if (contentStr.startsWith('http') || contentStr.includes('.ai/')) {
                    logger.info(`Fetching remote image for processing: ${contentStr.slice(0, 50)}...`)
                    const fetchRes = await fetch(contentStr)
                    if (fetchRes.ok) {
                      processingBuffer = Buffer.from(await fetchRes.arrayBuffer())
                    } else {
                      logger.warn(`Failed to fetch remote image for processing: ${fetchRes.status}`)
                    }
                  }
                }
                if (processingBuffer) {

                  try {
                    const { narrateGeneratedImage } = await import('./image-narration')
                    const { getSubchainConfig } = await import('../subchain-config')
                    const narrationCfg = await getSubchainConfig('image_narration')
                    const narrateT0 = Date.now()
                    const narrateRes = await narrateGeneratedImage(processingBuffer, context)
                    if (narrateRes) {
                      imageDescription = narrateRes.description
                      routingTrace.push({ model: narrateRes.modelId, category: 'VISION', key: 'NARRATION', success: true })
                      tracer.recordSuccess({
                        chain: 'IMAGE_NARRATION',
                        model: narrateRes.modelId,
                        provider: narrateRes.provider,
                        input_system: narrationCfg?.system_prompt,
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
            if (triggerInfo) {
              const displayType = triggerInfo.type.toUpperCase().replace(/_/g, ' ')
              chainParts.push(`${displayType}|${triggerInfo.value}|true`)
            }
            if (classificationTrace && classificationTrace.length > 0) {
              classificationTrace.forEach(t => {
                chainParts.push(`${t.model}|${t.key || 'DEFAULT'}|${t.success ? 'true' : 'false'}`)
              })
            } else if (classifierModel && !triggerInfo) {
              chainParts.push(classifierModel)
            }
            if (category) chainParts.push(category)
            routingTrace.forEach(r => {
              chainParts.push([r.model, r.key, r.success ? 'true' : 'false', r.actualProvider || ''].join('|'))
            })
            const detailedModelChain = chainParts.join(' → ')

            // Update token usage
            if (typeof finalContent === 'string') {
              const sid = sessionId
              
              const historyWithResponse = [
                ...history,
                { role: 'model', parts: [{ text: finalContent || '' }] }
              ];
              
              let activeHistoryText = prompt || '';
              let activeImageCount = 0;
              
              if (inputBuffer) {
                activeImageCount += Array.isArray(inputBuffer) ? inputBuffer.length : 1;
              }
              
              const limitHistory = currentSummary ? historyWithResponse.slice(-5) : historyWithResponse;
              for (const h of limitHistory) {
                const partText = h.parts?.[0]?.text || h.content || '';
                activeHistoryText += partText;
                
                if (partText) {
                  const matches1 = partText.match(/\[Image:/g)?.length || 0;
                  const matches2 = partText.match(/\[Image attached\]/g)?.length || 0;
                  const matches3 = partText.match(/\[VISION CONTEXT - DIGITAL TWIN\]/g)?.length || 0;
                  activeImageCount += (matches1 + matches2 + matches3);
                }
              }
              
              const summaryTokens = currentSummary ? estimateTokens(currentSummary) : 0;
              const totalUsage = summaryTokens + estimateTokens(activeHistoryText) + (activeImageCount * 258);
              
              const limit = sessionState?.context_limit ?? 32000
              const threshold = sessionState?.compaction_threshold ?? 0.8
              if (totalUsage > limit * threshold) {
                logger.info(`Context limit (${Math.round(threshold * 100)}%) reached for ${sid}. Triggering summarization...`)
                summarizeSession(sid, history, currentSummary)
              } else {
                updateSessionState(sid, { token_usage_total: totalUsage, context_limit: limit, compaction_threshold: threshold })
              }
            }

            if (typeof finalContent === 'string') {
              finalContent = sanitizeOutput(finalContent)
            }

            // If citations are missing or empty, extract them from the [SEARCH DATA] in system_prompt
            if (!citations || citations.length === 0) {
              const extractedCitations: string[] = [];
              const urlRegex = /URL:\s*(https?:\/\/[^\s\n]+)/g;
              let match;
              while ((match = urlRegex.exec(system_prompt || '')) !== null) {
                extractedCitations.push(match[1]);
              }
              if (extractedCitations.length > 0) {
                citations = Array.from(new Set(extractedCitations));
              }
            }

            const transcript_md = buildTranscript({
              prompt,
              history: history,
              context,
              category,
              classificationTrace,
              routingTrace,
              systemPrompt: system_prompt,
              globalPrompt: (globalPrompt as string) || undefined,
              internalPrompt: (internalPipelinePrompt as string) || undefined,
              routerPrompt: (routerOverridePrompt as string) || undefined,
              dateContext,
              currentSummary,
              visionNotes: (context as any)?.vision_notes,
              replyContext: (context as any)?.replyContext,
              thinkingEnabled: (context as any)?.thinkingEnabled,
              advisorEnabled: (context as any)?.advisorEnabled,
              mode: (context as any)?.mode,
              stepTraces: tracer.all.length > 0 ? tracer.all : undefined,
              pipelineSteps: thinkPipelineStepsPrepass.length > 0 ? thinkPipelineStepsPrepass : undefined,
              finalContent: typeof finalContent === 'string' ? finalContent : '[image]',
              finalModel: modelConfig.id,
              citations,
              tokensUsed: providerUsage?.total_tokens ?? (typeof finalContent === 'string' ? estimateTokens(prompt + (finalContent as string) + (system_prompt || '')) : undefined),
              providerUsage,
              providerReasoning,
              chainDuration: Date.now() - t0,
              usageType: finalUsageType,
              modelChain: detailedModelChain,
            })

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
              tokens_used: providerUsage?.total_tokens ?? (typeof finalContent === 'string' ? estimateTokens(prompt + (finalContent as string) + (system_prompt || '')) : undefined),
              image_description: imageDescription || (context as any)?._visionImageDescription,
              image_prompt: category === 'IMAGE_GEN' ? activePromptForGen : undefined,
              pipeline_steps: thinkPipelineStepsPrepass.length > 0 ? thinkPipelineStepsPrepass : undefined,
              step_traces: tracer.all.length > 0 ? tracer.all : undefined,
              captured_tool_calls: capturedToolCalls,
              transcript_md,
            }
          } else {
            const lastTried = triedKeysCount[exhaustionKey] ?? 0
            const displayKey = routeContext.usedKeyIndex ? `${key} ${routeContext.usedKeyIndex}` : `${key} ${lastTried + 1}`
            const wasSkipped = startIndex >= providerKeys.length
            if (wasSkipped) {
              logger.info(`Skipping ${modelConfig.id} — all ${key} keys already exhausted`)
            } else {
              triedKeysCount[exhaustionKey] = lastTried + 1
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
          const lastTried = triedKeysCount[exhaustionKey] ?? 0
          if (isKeyExhausted) {
            logger.warn(`[KeyRotation] Key ${lastTried + 1} exhausted for ${modelConfig.id} — trying next key`)
            triedKeysCount[exhaustionKey] = lastTried + 1
          } else {
            markModelFailed(modelConfig.id, errMsg)
          }
          routingTrace.push({ model: modelConfig.id, category, key: `${key} ${lastTried + 1}`, success: false })
          tracePushed = true
          logger.warn(`Failure with key ${lastTried + 1} for [${modelConfig.id}]: ${error.message}`)
          if (fallbackMode !== 'api_key_first') {
            throw error
          }
        }
      }
    } catch (outerError: any) {
      logger.error(`[ROUTING FAILURE] Category ${category} | Model ${modelConfig.id} failed: ${outerError.message}`)
      if (!tracePushed) {
        const displayKey = (context as any)?.usedKeyIndex ? `${key} ${(context as any).usedKeyIndex}` : `${key} 1`
        routingTrace.push({ model: modelConfig.id, category, key: displayKey, success: false })
      }
      continue
    }
  }

  // All models in the chain exhausted — fall back to COMPLEX if not already there
  if (category !== 'COMPLEX' && category !== 'REGULAR') {
    logger.warn(`[Fallback] All models exhausted for ${category} — retrying with COMPLEX`)
    const searchCategories = ['WEB_SEARCH', 'RESEARCH']
    const fallbackResult = await runChain(prompt, inputBuffer, {
      ...context,
      _forcedCategory: 'COMPLEX',
      // Strip session summary from fallback when search chain failed — prevents poisoned context
      ...(searchCategories.includes(category) ? { _skipSessionSummary: true } : {}),
    })
    // Merge failed WEB_SEARCH routing trace into fallback result so admin logs show all attempted models
    if (routingTrace.length > 0 && fallbackResult.routing_trace) {
      fallbackResult.routing_trace = [...routingTrace, ...fallbackResult.routing_trace]
    } else if (routingTrace.length > 0) {
      fallbackResult.routing_trace = [...routingTrace, ...(fallbackResult.routing_trace || [])]
    }
    if (tracer.all.length > 0) {
      fallbackResult.step_traces = [...tracer.all, ...(fallbackResult.step_traces || [])]
    }
    return fallbackResult
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

