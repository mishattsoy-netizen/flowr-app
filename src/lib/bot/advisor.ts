import { logger } from '../logger'
import { getRouterChain } from '../router-config'
import { getProviderKeys } from '../vault'
import type { BotMode } from '@/data/store.types'

export interface AdvisorState {
  phase: 'planning' | 'ready' | 'pass'
  round: number
  conversation: Array<{ role: 'advisor' | 'user', content: string }>
  gatheredConstraints: string[]
  ready: boolean
  finalBrief?: string
  approvedPlan?: string
  originalPrompt: string
}

export interface AdvisorResult {
  phase: 'planning' | 'ready' | 'pass'
  questions: string | null
  state: AdvisorState | null
  finalizedBrief?: string
  gatheredConstraintsList?: string[]
  approvedPlan?: string
}

function formatConversation(conversation: AdvisorState['conversation']): string {
  if (!conversation || conversation.length === 0) return 'No prior conversation.'
  const parts: string[] = []
  let roundNum = 1
  for (const entry of conversation) {
    if (entry.role === 'advisor') {
      parts.push(`--- ROUND ${roundNum} — Advisor asked/responded ---\n${entry.content}`)
    } else {
      parts.push(`--- ROUND ${roundNum} — User answered ---\n${entry.content}`)
      roundNum++
    }
  }
  // If last entry is advisor, no user response yet, so don't increment round
  return parts.join('\n\n')
}

function formatConstraintsList(constraints: string[]): string {
  if (!constraints || constraints.length === 0) return 'None gathered yet.'
  return constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')
}

function buildAdvisorPrompt(
  message: string,
  mode: BotMode,
  thinkingEnabled: boolean,
  availableTools: string[],
  pendingState?: AdvisorState | null,
): string {
  const now = new Date()
  const dateContext = `[CURRENT CONTEXT]\nDate: ${now.toDateString()}\nTime: ${now.toLocaleTimeString()}\n`

  const sessionState = [
    `Mode: ${mode}`,
    `Think mode: ${thinkingEnabled ? 'on' : 'off'}`,
    `Advisor: on`,
    `Available tools: ${availableTools.length > 0 ? availableTools.join(', ') : 'none'}`,
  ].join('\n')

  let conversationBlock = ''
  let round = 1
  let constraints: string[] = []

  if (pendingState) {
    round = pendingState.round + 1
    constraints = pendingState.gatheredConstraints || []

    const updatedConversation = [
      ...(pendingState.conversation || []),
      { role: 'user' as const, content: message },
    ]

    conversationBlock = formatConversation(updatedConversation)
  } else {
    conversationBlock = `No prior conversation.\n\nUser's initial request:\n${message}`
  }

  const constraintsBlock = formatConstraintsList(constraints)

  return `${dateContext}\n[CURRENT SESSION STATE]\n${sessionState}\n\n[ADVISOR CONVERSATION HISTORY]\n${conversationBlock}\n\n[CURRENTLY GATHERED CONSTRAINTS]\n${constraintsBlock}\n\n[CURRENT ROUND]\nRound ${round}`
}

export const MAX_ROUNDS = 6

function parseAdvisorResponse(raw: string, currentRound: number, currentConstraints: string[]): AdvisorResult {
  const trimmed = raw.trim()
  const preview = trimmed.slice(0, 300).replace(/\n/g, '\\n')

  // Check for PASS signal
  const firstLine = trimmed.split('\n')[0]?.trim().toUpperCase()
  logger.info(`[Advisor parse] firstLine="${firstLine}" firstLine==="PASS"=${firstLine === 'PASS'} preview="${preview}"`)
  if (firstLine === 'PASS') {
    logger.info('[Advisor parse] detected PASS — returning phase=pass, questions=null')
    return {
      phase: 'pass',
      questions: null,
      state: {
        phase: 'pass',
        round: currentRound,
        conversation: [],
        gatheredConstraints: currentConstraints,
        ready: true,
        originalPrompt: '',
      },
    }
  }

  // Extract ADVISOR_STATE JSON block
  const stateRegex = /---ADVISOR_STATE---([\s\S]*?)---END_ADVISOR_STATE---/
  const stateMatch = trimmed.match(stateRegex)
  logger.info(`[Advisor parse] stateMatch=${!!stateMatch}`)
  
  let parsedState: AdvisorState | null = null
  let extractedJsonStr = ''

  if (stateMatch) {
    extractedJsonStr = stateMatch[1].trim()
  } else {
    // Fallback: search for a JSON block containing "phase"
    const braceIndex = trimmed.indexOf('{')
    if (braceIndex !== -1) {
      const lastBraceIndex = trimmed.lastIndexOf('}')
      if (lastBraceIndex > braceIndex) {
        const potentialJson = trimmed.slice(braceIndex, lastBraceIndex + 1)
        if (potentialJson.includes('"phase"') || potentialJson.includes("'phase'")) {
          extractedJsonStr = potentialJson.trim()
        }
      }
    }
  }

  if (extractedJsonStr) {
    // Strip markdown wrappers if any, e.g. ```json ... ``` or ``` ... ```
    let cleanJsonStr = extractedJsonStr
    if (cleanJsonStr.startsWith('```')) {
      cleanJsonStr = cleanJsonStr.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '')
    }
    cleanJsonStr = cleanJsonStr.trim()
    try {
      const stateJson = JSON.parse(cleanJsonStr)
      logger.info(`[Advisor parse] extracted state: phase=${stateJson.phase} ready=${stateJson.ready} round=${stateJson.round}`)
      parsedState = {
        phase: stateJson.phase === 'ready' ? 'ready' : 'planning',
        round: stateJson.round ?? currentRound,
        conversation: [],
        gatheredConstraints: stateJson.gathered_constraints ?? stateJson.gatheredConstraints ?? currentConstraints,
        ready: stateJson.ready ?? false,
        finalBrief: stateJson.final_brief ?? stateJson.finalBrief,
        approvedPlan: stateJson.approved_plan ?? stateJson.approvedPlan,
        originalPrompt: '',
      }
    } catch (e) {
      logger.warn(`[Advisor parse] state JSON parse failed: ${e}`)
    }
  }

  // If parsing failed or yielded no state, create fallback state keeping prior constraints
  if (!parsedState) {
    logger.warn('[Advisor parse] Failed to parse any state, creating fallback state with previous constraints')
    parsedState = {
      phase: 'planning',
      round: currentRound,
      conversation: [],
      gatheredConstraints: currentConstraints,
      ready: false,
      originalPrompt: '',
    }
  }

  // Enforce Hard Round Cap
  if (parsedState.round >= MAX_ROUNDS) {
    logger.info(`[Advisor parse] Round cap reached (${parsedState.round} >= ${MAX_ROUNDS}). Forcing phase=ready.`)
    parsedState.ready = true
    parsedState.phase = 'ready'
    
    // Synthesize finalBrief and approvedPlan from gathered constraints if not present
    if (!parsedState.finalBrief) {
      parsedState.finalBrief = `Automatically finalized due to reaching maximum discussion rounds (${MAX_ROUNDS}). Constraints gathered:\n` + 
        parsedState.gatheredConstraints.map((c, i) => `- ${c}`).join('\n')
    }
    if (!parsedState.approvedPlan) {
      parsedState.approvedPlan = `Round limit of ${MAX_ROUNDS} reached. Proceeding with planning. Gathered constraints:\n` + 
        parsedState.gatheredConstraints.map((c, i) => `- ${c}`).join('\n')
    }
  }

  // Remove state block / JSON block to get clean display output
  let cleanOutput = trimmed
  if (stateMatch) {
    cleanOutput = cleanOutput.replace(stateRegex, '').replace(/---ADVISOR_STATE---[\s\S]*?---END_ADVISOR_STATE---/g, '').trim()
  } else if (extractedJsonStr) {
    const braceIndex = cleanOutput.indexOf('{')
    const lastBraceIndex = cleanOutput.lastIndexOf('}')
    if (braceIndex !== -1 && lastBraceIndex !== -1 && lastBraceIndex > braceIndex) {
      cleanOutput = (cleanOutput.slice(0, braceIndex) + cleanOutput.slice(lastBraceIndex + 1)).trim()
    }
  }

  // Determine phase
  let phase: 'planning' | 'ready' | 'pass' = 'planning'
  if (parsedState.ready || parsedState.phase === 'ready') {
    phase = 'ready'
  }
  logger.info(`[Advisor parse] final phase=${phase} cleanPreview="${cleanOutput.slice(0, 200).replace(/\n/g, '\\n')}"`)

  return {
    phase,
    questions: cleanOutput || null,
    state: parsedState,
    finalizedBrief: parsedState.finalBrief,
    approvedPlan: parsedState.approvedPlan,
    gatheredConstraintsList: parsedState.gatheredConstraints.length ? parsedState.gatheredConstraints : undefined,
  }
}

export async function runAdvisor(
  message: string,
  mode: BotMode,
  thinkingEnabled: boolean,
  availableTools: string[],
  context: any,
  history: any[] = [],
  pendingState?: AdvisorState | null,
): Promise<AdvisorResult> {
  const { chain, system_prompt } = await getRouterChain('ADVISOR')

  if (chain.length === 0) {
    logger.warn('ADVISOR chain is empty — skipping advisor step. Add models via Admin > Router > ADVISOR.')
    return {
      phase: 'pass',
      questions: null,
      state: null,
    }
  }

  const systemPrompt = system_prompt || ''
  if (!systemPrompt) {
    logger.warn('ADVISOR chain has no system_prompt configured — skipping advisor step.')
    return {
      phase: 'pass',
      questions: null,
      state: null,
    }
  }

  const advisorPrompt = buildAdvisorPrompt(message, mode, thinkingEnabled, availableTools, pendingState)
  const currentRound = pendingState?.round ?? 0
  const currentConstraints = pendingState?.gatheredConstraints ?? []

  for (const modelConfig of chain) {
    if (!modelConfig.is_enabled) continue
    try {
      const provider = modelConfig.provider.toLowerCase()
      let response: any = null

      if (provider === 'google' || provider === 'gemini') {
        const { runGoogle } = await import('./providers/google')
        response = await runGoogle(modelConfig.id, advisorPrompt, systemPrompt, undefined, context, history)
      } else if (provider === 'groq') {
        const { runGroq } = await import('./providers/groq')
        response = await runGroq(modelConfig.id, advisorPrompt, systemPrompt, undefined, context, history)
      } else if (provider === 'openrouter') {
        const { runOpenRouter } = await import('./providers/openrouter')
        const keys = await getProviderKeys('OPENROUTER')
        response = await runOpenRouter(modelConfig.id, advisorPrompt, systemPrompt, history, keys[0] || '', { ...(context || {}), openrouterProvider: modelConfig.openrouter_provider })
      }

      if (response) {
        const content = typeof response === 'object' ? response.content : response
        const result = parseAdvisorResponse(content, currentRound + 1, currentConstraints)
        logger.info(`[runAdvisor] questions length=${(result.questions || '').length} containsADVISOR_STATE=${(result.questions || '').includes('ADVISOR_STATE')} phase=${result.phase}`)

        // Attach the updated conversation to the state
        if (result.state) {
          const newConversationEntry = { role: 'advisor' as const, content: content.trim() }
          result.state.conversation = [
            ...(pendingState?.conversation || []),
            { role: 'user' as const, content: message },
            newConversationEntry,
          ]
          result.state.originalPrompt = pendingState?.originalPrompt || message
        }

        return result
      }
    } catch (e: any) {
      logger.warn(`Advisor model ${modelConfig.id} failed: ${e.message}`)
    }
  }

  // All models failed — fail open (skip advisor, don't block user)
  logger.warn('Advisor: all models failed — passing through silently')
  return {
    phase: 'pass',
    questions: null,
    state: null,
  }
}
