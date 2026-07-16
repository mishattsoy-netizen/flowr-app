import { classifyIntentWithModel, classifyIntentV2 } from './classifier'
import { selectTier, resolveThinkingLevel } from './routerV2'
import { resolveMaxToolHops as _resolveMaxToolHops } from './toolLoopConfig'
import { sanitizeOutput, stripToolAnnotations, hasUngroundedActionClaim } from './outputGuard'
import { runAdvisor } from './advisor'
import { getRouterChain, getFallbackModes, IntentCategory, DEFAULT_STATUS_MESSAGES } from '../router-config'
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
import { getSessionState, updateSessionState, estimateTokens, computeVisionTokenCredit } from './context'
import type { StatusCallback, PipelineStep } from './pipeline'
import { runThinkChain } from './thinkChain'
import { getPipelineSettings } from '../router-config'
import { TraceCollector } from './tracing'
import { buildTranscript } from './transcript'
import { executeProvider, executeVisionProvider, logCost, trackModelUsage } from './services/providerExecution'
import { buildSystemPrompt } from './services/promptBuilder'
import { getChainPrompt } from './prompts'
import { fetchConversationHistory, manageSessionCompaction, messagesAfterWatermark } from './services/memoryManager'
import { computeModelCost } from './services/costFormula'

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
  const queryWords = originalQuery.split(/\s+/).length
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
  total_cost_usd: number
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
    activeBrainId?: string | null;
    activeSpaceId?: string;
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
    pageContext?: { url: string, content: string, title?: string } | null;
    clientTime?: string;
    onEvent?: (event: any) => void;
  }
): Promise<ChainResponse> {
  const tracer = new TraceCollector()
  let totalCostUsd = 0

  // Inject current date context to help bot understand knowledge cutoff and current time
  const now = context?.clientTime ? new Date(context.clientTime) : new Date()
  let dateContext = `[CURRENT CONTEXT]\nDate: ${now.toDateString()}\nTime: ${now.toLocaleTimeString()}\n`

  // 0. Prefetch independent config in parallel
  const sessionId = (context?.activeChatId ? `chat:${context.activeChatId}` : null)
    || context?.chatId?.toString()
    || (context?.isTempChat ? `temp:${crypto.randomUUID()}` : null)
    || context?.activeEntityId
    || 'global'
  const [sessionState, fallbackModes, pipelineSettings] = await Promise.all([
    getSessionState(sessionId),
    getFallbackModes(),
    getPipelineSettings(),
  ])

  const historyLimit = pipelineSettings.historyLimit ?? 20

  const memoryContext = {
    chatId: context?.chatId,
    userId: context?.userId,
    isTempChat: context?.isTempChat,
    activeChatId: context?.activeChatId,
    clientHistory: context?.clientHistory,
    _triggerType: context?._triggerType
  }

  let history = await fetchConversationHistory(memoryContext, historyLimit)

  let currentSummary = sessionState?.distilled_summary || null
  const compactionResult = await manageSessionCompaction(sessionId, history, sessionState, memoryContext)
  currentSummary = compactionResult.currentSummary
  totalCostUsd += compactionResult.cost
  if (sessionState) {
    Object.assign(sessionState, compactionResult.updatedSessionState)
  }

  // Monotonic per-turn counter — lets delete_content/update_content's confirmed:true
  // gate require confirmation on the very next turn, deterministically, instead of
  // relying on a wall-clock TTL or on focus-shift detection (unreliable) to clear
  // pending_action. Bumped here, before any tool handler runs this turn, so a dry-run
  // issued THIS turn and confirmed NEXT turn sees exactly a +1 gap.
  if (sessionState) {
    sessionState.turn_seq = (sessionState.turn_seq ?? 0) + 1
    await updateSessionState(sessionId, { turn_seq: sessionState.turn_seq })
  }

  // 1. Specialized Vision Flow (Buffer or URL)
  let rawBuffers = Array.isArray(inputBuffer) ? inputBuffer : (inputBuffer ? [inputBuffer] : [])
  let activeBuffers: Buffer[] = []
  
  if (rawBuffers.length > 0) {
    try {
      const { resizeImageForApi } = await import('./image-resizer')
      activeBuffers = await Promise.all(rawBuffers.map(b => resizeImageForApi(b)))
    } catch (e: any) {
      logger.warn(`[Router] Failed to load or execute image-resizer, falling back to raw buffers: ${e.message}`)
      activeBuffers = rawBuffers
    }
  }

  // Advisor pre-flight — runs before classification if enabled and no image attached.
  // Under router v2, advisor behavior is inline in the PRIMARY prompt instead of a separate gate.
  if (context?.advisorEnabled && activeBuffers.length === 0 && !pipelineSettings.routerV2Enabled) {
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
        total_cost_usd: totalCostUsd,
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
    return DEFAULT_STATUS_MESSAGES[chain] || fallback || 'Working...'
  }

  // Buffers actually fed to PRIMARY as raw images this turn — populated below.
  // Text-doc attachments are never fed here (their transcript is authoritative);
  // visual attachments are fed here THIS turn only, then dropped from later turns
  // once their twin is in history. See spec "Core Model".
  let visualBuffersForPrimary: Buffer[] = []

  if (activeBuffer) {
    onStatus({
      chain: 'VISION',
      goal: 'Describing visual input',
      label: getStatusLabel('VISION', 'Scanning Image'),
      status: 'running'
    })

    try {
      const { narrateGeneratedImage, partitionNarrationResults } = await import('./image-narration')
      const narrationResults = await Promise.all(
        activeBuffers.map(buf => narrateGeneratedImage(buf, context))
      )
      const { visualBuffers, transcriptDescriptions, allDescriptions } = partitionNarrationResults(activeBuffers, narrationResults)
      visualBuffersForPrimary = visualBuffers

      // This turn's [VISION DATA] carries text-doc transcripts only — a visual
      // attachment's twin is deliberately excluded here since its raw pixels are
      // already in visualBuffersForPrimary; including both would pay twice for
      // the same information.
      if (transcriptDescriptions.length > 0) {
        const combined = transcriptDescriptions.join('\n\n')
        if (context) context.vision_notes = `[IMAGE DESCRIPTION]\n${combined}`
      }
      // Persisted as image_description so LATER turns (when the raw image is
      // gone) see every attachment's twin — transcript or visual — as text.
      if (allDescriptions.length > 0 && context) {
        context._visionImageDescription = allDescriptions.join('\n\n')
      }
    } catch (e: any) {
      logger.warn(`Image description failed: ${e.message}`)
    }

    onStatus({ chain: 'VISION', status: 'done', goal: 'Describing visual input' })
  }

  // 2. Standard Routing Flow
  let rawCategory: any = forcedCategory
  let classifierModel: string | null = forcedCategory ? 'Vision Classifier' : null
  let classifyError: string | null = null

  const routerV2 = pipelineSettings.routerV2Enabled === true
  let v2Flags: { complexity: 'normal' | 'hard'; action: boolean } | null = null

  if (!forcedCategory) {
    onStatus({
      chain: 'CLASSIFIER',
      goal: 'Classifying intent',
      label: getStatusLabel('CLASSIFIER'),
      status: 'running'
    })
    const historyForClassifier = (!pipelineSettings.historyEnabledCategories || pipelineSettings.historyEnabledCategories.includes('CLASSIFIER')) ? history.slice(-8) : []

    if (routerV2) {
      const v2res = await classifyIntentV2(prompt, context?.aiApiKey, context?.classificationModelId, context?.mode ?? 'default', context?.intentTag ?? null, historyForClassifier, context?.replyContext ?? null, tracer, activeBuffers.length)
      if (!v2res.classification) {
        onStatus({ chain: 'CLASSIFIER', status: 'failed', goal: 'Classifying intent' })
        logger.error(`Classification (v2) failed: ${v2res.error ?? 'unknown reason'}`)
        return {
          type: 'text',
          content: v2res.error ? `*System Overload* (${v2res.error})` : "*System Overload*",
          usage_type: 'chat',
          model_chain: 'classifier_v2 → (failed)',
          status: 'error',
          step_traces: tracer.all.length > 0 ? tracer.all : undefined,
          classification_trace: v2res.trace,
          total_cost_usd: totalCostUsd,
        } as any
      }
      rawCategory = v2res.classification.category
      v2Flags = { complexity: v2res.classification.complexity, action: v2res.classification.action }
      classifierModel = v2res.classifierModel
      classificationTrace = v2res.trace
      if (v2res.trigger_type) {
        triggerInfo = { type: v2res.trigger_type, value: v2res.trigger_value || '' }
      }
    } else {
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
          content: classifyError ? `*System Overload* (${classifyError})` : "*System Overload*",
          usage_type: 'chat',
          model_chain: 'classifier → (failed)',
          status: 'error',
          step_traces: tracer.all.length > 0 ? tracer.all : undefined,
          classification_trace: classificationTrace,
          total_cost_usd: totalCostUsd,
        } as any
      }
    }
    onStatus({ chain: 'CLASSIFIER', status: 'done', goal: 'Classifying intent' })
  }

  // Normalize legacy / internal categories
  if (rawCategory === 'FAST_SIMPLE') rawCategory = 'REGULAR'
  if (rawCategory === 'MEDIUM_THINKING') rawCategory = 'COMPLEX'
  // v2: vision-forced and legacy-shaped categories collapse onto PRIMARY
  if (routerV2 && (rawCategory === 'REGULAR' || rawCategory === 'COMPLEX' || rawCategory === 'CODING' || rawCategory === 'ADVISOR')) {
    rawCategory = 'PRIMARY'
  }


  let category: IntentCategory = rawCategory
  logger.info(`[Router] Starting runChain for category: ${category} | prompt: "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"`)

  const routingTrace: RoutingTrace[] = []

  // If classified as ADVISOR, fallback to COMPLEX to actually process the query
  if (category === 'ADVISOR') {
    category = 'COMPLEX'
  }

  // Hoist tier so it's accessible when building routeContext below.
  let primaryTier: 'smart' | 'light' | undefined
  let { chain, temperature, thinking_budget } = await (async () => {
    if (routerV2 && category === 'PRIMARY') {
      const routerMode = (context?.mode === 'pro' ? 'pro' : 'default') as 'pro' | 'default'
      const tier = activeBuffers.length > 0
        ? 'smart'
        : selectTier({
            action: v2Flags?.action ?? true,
            complexity: v2Flags?.complexity ?? 'normal',
            extendedThinking: thinkingEnabled,
          })
      primaryTier = tier
      const [smart, light] = await Promise.all([
        getRouterChain('PRIMARY_SMART', routerMode),
        getRouterChain('PRIMARY_LIGHT', routerMode),
      ])
      // Light escalates UP into Smart on exhaustion; Smart never falls to Light.
      const merged = tier === 'light' ? [...light.chain, ...smart.chain] : smart.chain
      return { chain: merged, temperature: smart.temperature, thinking_budget: undefined as any }
    }
    return getRouterChain(category, (context?.mode === 'pro' ? 'pro' : 'default'))
  })()
  if (!chain || chain.length === 0) {
    chain = [{ id: 'openai/gpt-4o-mini', provider: 'openrouter', openrouter_provider: 'openai', is_enabled: true } as any]
  }

  if (routerV2 && category === 'PRIMARY') {
    thinking_budget = resolveThinkingLevel({ complexity: v2Flags?.complexity ?? 'normal', thinkingToggle: thinkingEnabled })
  }

  // Fetch internal pipeline prompt if available (from Admin > Bot > Global)
  const isGlobalPromptEnabled = pipelineSettings.globalPromptEnabledCategories
    ? pipelineSettings.globalPromptEnabledCategories.includes(category)
    : true

  const skipSummary = category === 'WEB_SEARCH' || category === 'RESEARCH' || context?._skipSessionSummary || context?.isTempChat
  let brainBlock = ''
  if (isGlobalPromptEnabled && context?.userId && context.userId !== 'anonymous') {
    const brainStore = await import('./services/brainStore')
    // Resolve which brain is active for this session. ORDER MATTERS:
    // sessionState.active_brain_id (server-persisted, set by
    // switchActiveBrain on an explicit pill swap) is checked FIRST and wins
    // whenever it's set. context.activeBrainId (whatever the client happens
    // to have in its local store, sent on every request) is ONLY the
    // fallback for the very first turn of a brand-new session, where no
    // server-side active_brain_id exists yet to pin against. Reversing this
    // order would let a stale/desynced client-side value silently override
    // an already-pinned session without going through switchActiveBrain's
    // repin — the exact "pin and active_brain_id diverge" bug this plan's
    // global constraints warn about, just approached from the read side
    // instead of the write side.
    const activeBrainId = sessionState?.active_brain_id
      || context?.activeBrainId
      || (await brainStore.getOrCreateDefaultBrain(context.userId)).id
    brainBlock = await brainStore.getBrainBlockForSession(sessionId, sessionState, context.userId, activeBrainId)
  }
  let { staticPrompt: system_prompt, dynamicContext } = await buildSystemPrompt(category, {
    userId: context?.userId,
    pageContext: typeof context?.pageContext === 'object' ? JSON.stringify(context?.pageContext) : context?.pageContext,
    vision_notes: context?.vision_notes,
    replyContext: context?.replyContext,
    clientTime: context?.clientTime,
    isGlobalPromptEnabled: isGlobalPromptEnabled ?? true,
    skipSummary: !!skipSummary,
    currentSummary,
    pendingAction: sessionState?.pending_action,
    brainBlock,
  })

  // ── Telegram awareness — inject formatting & brevity rules ──
  if (context?._triggerType === 'telegram') {
    system_prompt += `

[TELEGRAM CHAT CONDUCT — STRICT]
You are responding inside Telegram messenger — the user reads your messages on their phone. FOLLOW these rules in every response:

FORMATTING (MANDATORY — apply to every answer you send):
- ALWAYS use Telegram markdown: *bold* for emphasis, \`code\` for IDs/commands/numbers, _italic_ for labels, [links](url) for sources.
- Use bullet points (•) for ALL lists — never use numbered lists unless the count matters.
- Use a leading emoji that matches the message mood: ✅ completion/success, ⚠️ warnings/cautions, ℹ️ info, 🎯 goals/achievements, 💡 tips/suggestions, 📋 status/summary, 🚀 progress, 🤔 questions, ❌ errors/failures, 🔍 search results.
- Exactly ONE lead emoji per message. Never zero, never more than one.
- NEVER use HTML, never use tables, never use cards/pills. Telegram only supports plain text + simple markdown.

TONE & LENGTH (CRITICAL):
- KEEP IT SHORT. 3-5 lines max unless the user explicitly asks for details. You are texting, not writing.
- Lead with the emoji + one-line summary. THEN details if needed.
- Be conversational: casual contractions (it's, don't, can't, I'll), friendly, direct.
- Example of correct format:
  ✅ Task "Buy groceries" created in Personal workspace. Due tomorrow at 3pm.
  • *Priority:* Medium
  • *Subtasks:* 3 items

CAPABILITIES:
- You still use ALL tools (create tasks, notes, search the web, etc.) — the actions are the same.
- The difference is ONLY in how you present the answer: brief Telegram text vs. rich web app content.
- When you execute a tool that generates a visual card/artifact in the web app, do NOT describe the card's appearance in Telegram — just confirm the action and key details inline.

IMAGE GENERATION:
- When the user asks for an image, generate it and send the image. A short caption is fine.
- Do NOT describe what the image looks like in text — the image speaks for itself.`
  }

  // Removed legacy attention block handling as it's now inside dynamicContext
  let activePromptForGen = prompt

  let finalUsageType: 'chat' | 'tool' | 'search' | 'vision' | 'image' = 'chat'
  if (category === 'WEB_SEARCH' || category === 'RESEARCH') finalUsageType = 'search'
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
  if (thinkingEnabled && category !== 'IMAGE_GEN' && !routerV2) {
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
  if (category === 'RESEARCH') {
    onStatus({ chain: 'RESEARCH', goal: 'Running iterative web research', status: 'running', label: getStatusLabel('RESEARCH') })
    const researchResult = await runDeepResearchChain(prompt, uniqueChain, context)
    if (!researchResult.researchText.includes('Search failed') && (researchResult as any).findings) {
      system_prompt = `${system_prompt}\n\n[SEARCH DATA]\n${(researchResult as any).findings}\n\n`
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



  // ── Status label for text-processing categories ──
  const STATUS_CATEGORIES = ['REGULAR', 'COMPLEX', 'CODING', 'ADVISOR', 'AUDIO', 'WEB_SEARCH', 'PRIMARY']
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
            useTools: ['REGULAR', 'COMPLEX', 'CODING', 'ADVISOR', 'WEB_SEARCH', 'RESEARCH', 'PRIMARY'].includes(category),
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
            // toolTier drives resolveMaxToolHops() in each provider.
            // PRIMARY paths carry the real tier; all others default to 'light'
            // which resolves to MAX_TOOL_HOPS_LIGHT (4) — same as today's hardcoded value.
            // (resolveMaxToolHops only returns SMART for an explicit 'smart' tier.)
            toolTier: (routerV2 && category === 'PRIMARY') ? (primaryTier ?? 'light') : 'light',
            setSynthesisModel: (m: string) => { usedSynthesisModel = m }
          }

          // Only stream tokens for COMPLEX and REGULAR chains. All other chains
          // (vision, search, image gen, tools, advisor, coding) buffer their full
          // response so post-processing (e.g. stripping [VISION_CONTEXT]) runs before
          // anything reaches the user.
          const TEXT_STREAM_CATEGORIES = ['COMPLEX', 'REGULAR', 'PRIMARY']
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

          // When a session summary exists, the summary already covers everything up to
          // the watermark — only show the model messages AFTER that point, not a fixed
          // "last 5" that could hide messages the summary never actually covered.
          if (currentSummary && sessionState?.last_compacted_message_id) {
            historyForChain = messagesAfterWatermark(historyForChain, sessionState.last_compacted_message_id)
          }

          // ── Token Limit Application ──
          // Skip token limits for search chains — raw results must pass through unmodified.
          const SEARCH_CHAINS = ['WEB_SEARCH', 'RESEARCH']
          const enabledCats: string[] = pipelineSettings.tokenLimitEnabledCategories ?? []
          const isTokenLimitEnabled = enabledCats.length > 0
            ? enabledCats.includes(category)
            : !SEARCH_CHAINS.includes(category)
          const finalUserPrompt = dynamicContext
            ? `${dynamicContext}\n\n[CURRENT REQUEST]\n${activePromptForGen}`
            : activePromptForGen;

          if (isTokenLimitEnabled) {
            // Apply Output Limit (max_tokens)
            if (pipelineSettings.outputTokenLimit > 0) {
              routeContext.max_tokens = pipelineSettings.outputTokenLimit
            }

            // Apply Input Limit (Hard trimming)
            if (pipelineSettings.inputTokenLimit > 0) {
              const currentPromptTokens = estimateTokens(system_prompt + finalUserPrompt)
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
            input_user: finalUserPrompt,
            input_history_count: historyForChain.length,
          }
          const t0 = Date.now()

          try {
            const result = await executeProvider(
              modelConfig,
              category,
              category === 'IMAGE_GEN' ? activePromptForGen : finalUserPrompt,
              system_prompt,
              historyForChain,
              activeKey,
              providerKeys,
              context,
              routeContext,
              temperature,
              prompt,
              augmentSearchQuery,
              category === 'PRIMARY' ? visualBuffersForPrimary : undefined
            )

            totalCostUsd += result.searchCostUsd

            if (result.searchFailed) {
              const displayKey = routeContext.usedKeyIndex ? `${key} ${routeContext.usedKeyIndex}` : `${key} 1`
              routingTrace.push({ model: modelConfig.id, category, key: displayKey, success: false, status: 'empty' })
              tracer.recordFailed({ ...traceMeta, error: 'search failed to retrieve results' }, Date.now() - t0)
              break
            }
            if (result.searchResult) {
              system_prompt = `${system_prompt}\n\n[SEARCH DATA: ${modelConfig.id}]\n${result.searchResult}\n\n`
            }

            if (result.response === null) {
              continue modelLoop
            }
            response = result.response
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
            const actualCost = computeModelCost({
              prompt_tokens: providerUsage?.prompt_tokens ?? 0,
              completion_tokens: providerUsage?.completion_tokens ?? 0,
              cache_read_tokens: providerUsage?.cache_read_input_tokens,
              cache_creation_tokens: providerUsage?.cache_creation_input_tokens,
              prompt_cost: modelConfig.prompt_cost,
              completion_cost: modelConfig.completion_cost,
              cache_read_cost: modelConfig.cache_read_cost,
              cache_write_cost: modelConfig.cache_write_cost,
            })
            totalCostUsd += actualCost
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
            await trackModelUsage(modelConfig.id, modelConfig.provider).catch(() => { })
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

              // Same "messages after the watermark" window as historyForChain (line ~777) —
              // must stay in lockstep with the prompt window, or this estimate silently
              // diverges from what was actually sent (undercounting once the post-watermark
              // window grows past 5, or double-counting already-summarized messages right
              // after compaction).
              const watermark = sessionState?.last_compacted_message_id ?? null
              const limitHistory = currentSummary
                ? messagesAfterWatermark(historyWithResponse, watermark)
                : historyWithResponse;
              const historyPartTexts = limitHistory.map(h => h.parts?.[0]?.text || h.content || '')
              activeHistoryText += historyPartTexts.join('')

              const summaryTokens = currentSummary ? estimateTokens(currentSummary) : 0;
              const imageTokenCredit = computeVisionTokenCredit(visualBuffersForPrimary.length, historyPartTexts);
              const totalUsage = summaryTokens + estimateTokens(activeHistoryText) + imageTokenCredit;

              const limit = sessionState?.context_limit ?? 32000
              const threshold = sessionState?.compaction_threshold ?? 0.8
              // Compaction itself is triggered pre-request by manageSessionCompaction —
              // this is bookkeeping only, so the next turn's trigger check has an
              // accurate totalUsage to compare against.
              await updateSessionState(sid, { token_usage_total: totalUsage, context_limit: limit, compaction_threshold: threshold })
                .catch((e: any) => logger.error(`Failed to update session state for ${sid}:`, e))
            }

            if (typeof finalContent === 'string') {
              finalContent = sanitizeOutput(finalContent)
              finalContent = stripToolAnnotations(finalContent)
              if (routeContext.useTools && hasUngroundedActionClaim(finalContent, capturedToolCalls)) {
                const failedMutations = (capturedToolCalls ?? [])
                  .filter((c: any) => c?.success === false && c?.error)
                  .map((c: any) => `${c.tool}: ${c.error}`)
                const why = failedMutations.length > 0
                  ? `tool(s) failed — ${failedMutations.join('; ')}`
                  : 'no mutating tool ran'
                logger.warn(`[GroundingGuard] Reply claims completed action but ${why} — replacing. Claim: "${finalContent.slice(0, 120)}"`)
                finalContent = "⚠️ I wasn't able to complete that action — nothing was changed. Please try again."
              }
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
              routerPrompt: undefined,
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
              tokensUsed: providerUsage 
                ? ((providerUsage.prompt_tokens ?? 0) - (providerUsage.cache_read_input_tokens ?? 0) + (providerUsage.completion_tokens ?? 0))
                : (typeof finalContent === 'string' ? estimateTokens(prompt + (finalContent as string) + (system_prompt || '')) : undefined),
              providerUsage,
              providerReasoning,
              chainDuration: Date.now() - t0,
              usageType: finalUsageType,
              modelChain: detailedModelChain,
              capturedToolCalls,
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
              tokens_used: (() => {
                const userPromptTokens = finalUserPrompt ? estimateTokens(finalUserPrompt) : 0;
                const historyText = historyForChain && historyForChain.length > 0 
                  ? historyForChain.map(h => h.parts?.[0]?.text || h.content || '').join('\n')
                  : '';
                const historyTokens = estimateTokens(historyText);
                
                if (providerUsage) {
                  const completion = providerUsage.completion_tokens ?? 0;
                  const estimatedPrompt = userPromptTokens + historyTokens;
                  const totalPrompt = providerUsage.prompt_tokens ?? 0;
                  const calc = Math.min(estimatedPrompt, totalPrompt) + completion;
                  logger.info(`[TokenCalc] totalPrompt=${totalPrompt}, estimatedPrompt=${estimatedPrompt} (user=${userPromptTokens}, hist=${historyTokens}), completion=${completion}, calculated=${calc}`);
                  return calc;
                }
                
                const completionEst = typeof finalContent === 'string' ? estimateTokens(finalContent) : 0;
                const calc = userPromptTokens + historyTokens + completionEst;
                logger.info(`[TokenCalc] fallback estimate calculated=${calc}`);
                return calc;
              })(),
              image_description: imageDescription || (context as any)?._visionImageDescription,
              image_prompt: category === 'IMAGE_GEN' ? activePromptForGen : undefined,
              pipeline_steps: thinkPipelineStepsPrepass.length > 0 ? thinkPipelineStepsPrepass : undefined,
              step_traces: tracer.all.length > 0 ? tracer.all : undefined,
              captured_tool_calls: capturedToolCalls,
              transcript_md,
              total_cost_usd: totalCostUsd,
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
    content: "*System Overload*",
    usage_type: 'chat',
    model_chain: detailedModelChain,
    status: 'error',
    classification_trace: classificationTrace,
    routing_trace: routingTrace,
    step_traces: tracer.all.length > 0 ? tracer.all : undefined,
    total_cost_usd: totalCostUsd,
  }
}

