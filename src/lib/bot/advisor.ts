import { logger } from '../logger'
import { getRouterChain } from '../router-config'
import { getProviderKeys } from '../vault'
import type { BotMode } from '@/data/store.types'

export interface AdvisorResult {
  shouldAsk: boolean
  questions: string | null
}

const PASS_SIGNAL = 'PASS'

function buildAdvisorPrompt(
  message: string,
  mode: BotMode,
  thinkingEnabled: boolean,
  availableTools: string[]
): string {
  const now = new Date()
  const dateContext = `[CURRENT CONTEXT]\nDate: ${now.toDateString()}\nTime: ${now.toLocaleTimeString()}\n`

  const sessionState = [
    `Mode: ${mode}`,
    `Think mode: ${thinkingEnabled ? 'on' : 'off'}`,
    `Advisor: on`,
    `Available tools: ${availableTools.length > 0 ? availableTools.join(', ') : 'none'}`,
  ].join('\n')

  return `${dateContext}\n[CURRENT SESSION STATE]\n${sessionState}\n\n[USER MESSAGE]\n${message}`
}

export async function runAdvisor(
  message: string,
  mode: BotMode,
  thinkingEnabled: boolean,
  availableTools: string[],
  context: any
): Promise<AdvisorResult> {
  const { chain, system_prompt } = await getRouterChain('ADVISOR')

  if (chain.length === 0) {
    logger.warn('ADVISOR chain is empty — skipping advisor step. Add models via Admin > Router > ADVISOR.')
    return { shouldAsk: false, questions: null }
  }

  const systemPrompt = system_prompt || ''
  if (!systemPrompt) {
    logger.warn('ADVISOR chain has no system_prompt configured — skipping advisor step.')
    return { shouldAsk: false, questions: null }
  }

  const advisorPrompt = buildAdvisorPrompt(message, mode, thinkingEnabled, availableTools)

  for (const modelConfig of chain) {
    if (!modelConfig.is_enabled) continue
    try {
      const provider = modelConfig.provider.toLowerCase()
      let response: any = null

      if (provider === 'google') {
        const { runGoogle } = await import('./providers/google')
        response = await runGoogle(modelConfig.id, advisorPrompt, systemPrompt, undefined, context, [])
      } else if (provider === 'groq') {
        const { runGroq } = await import('./providers/groq')
        response = await runGroq(modelConfig.id, advisorPrompt, systemPrompt, undefined, context, [])
      } else if (provider === 'openrouter') {
        const { runOpenRouter } = await import('./providers/openrouter')
        const keys = await getProviderKeys('OPENROUTER')
        response = await runOpenRouter(modelConfig.id, advisorPrompt, systemPrompt, [], keys[0] || '', modelConfig.openrouter_provider || undefined)
      }

      if (response) {
        const content = typeof response === 'object' ? response.content : response
        const trimmed = content.trim()
        if (trimmed.toUpperCase() === PASS_SIGNAL) {
          return { shouldAsk: false, questions: null }
        }
        // Non-PASS response = questions to ask
        return { shouldAsk: true, questions: trimmed }
      }
    } catch (e: any) {
      logger.warn(`Advisor model ${modelConfig.id} failed: ${e.message}`)
    }
  }

  // All models failed — fail open (skip advisor, don't block user)
  logger.warn('Advisor: all models failed — passing through silently')
  return { shouldAsk: false, questions: null }
}
