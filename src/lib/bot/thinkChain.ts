import { logger } from '../logger'
import { getRouterChain, IntentCategory } from '../router-config'
import { getChainPrompt } from './prompts'
import type { PipelineStep, StatusCallback } from './pipeline'
import { TraceCollector } from './tracing'

export interface ThinkResult {
  summary: string
  direction: string
  correctionChain?: IntentCategory
  confidence: 'high' | 'medium' | 'low'
}

export interface ThinkChainOutput {
  thinkSummary: string
  direction: string
  correctedContext?: string
  steps: PipelineStep[]
}



function parseThinkOutput(raw: string): ThinkResult {
  const direction = raw.match(/Direction for final output:\s*(.+)/i)?.[1]?.trim() || ''
  const correctionMatch = raw.match(/Correction needed:\s*([A-Z_]+)/i)?.[1]?.trim()
  const confidenceMatch = raw.match(/Confidence:\s*(high|medium|low)/i)?.[1] as 'high' | 'medium' | 'low' | undefined

  const validChains: IntentCategory[] = [
    'WEB_SEARCH', 'RESEARCH', 'VISION', 'CODING', 'COMPLEX', 'REGULAR'
  ]
  const correctionChain = (
    correctionMatch &&
    correctionMatch !== 'NONE' &&
    correctionMatch !== 'none' &&
    validChains.includes(correctionMatch as IntentCategory)
  ) ? correctionMatch as IntentCategory : undefined

  return {
    summary: raw,
    direction,
    correctionChain,
    confidence: confidenceMatch ?? 'medium',
  }
}

async function runThinkModel(
  prompt: string,
  systemPrompt: string,
  history: any[],
  context: any,
  tracer?: TraceCollector
): Promise<string | null> {
  const { chain } = await getRouterChain('THINKING')

  if (chain.length === 0) {
    logger.warn('THINKING chain is empty — add models via Admin > Router > THINKING. Skipping think step.')
    return null
  }

  for (const modelConfig of chain) {
    if (!modelConfig.is_enabled) continue
    const t0 = Date.now()
    const traceMeta = { chain: 'THINKING', model: modelConfig.id, provider: modelConfig.provider, input_system: systemPrompt, input_user: prompt, input_history_count: history.length }
    try {
      const provider = modelConfig.provider.toLowerCase()
      let res: any = null
      if (provider === 'google') {
        const { runGoogle } = await import('./providers/google')
        res = await runGoogle(modelConfig.id, prompt, systemPrompt, undefined, context, history)
      } else if (provider === 'groq') {
        const { runGroq } = await import('./providers/groq')
        res = await runGroq(modelConfig.id, prompt, systemPrompt, undefined, context, history)
      } else if (provider === 'openrouter') {
        const { runOpenRouter } = await import('./providers/openrouter')
        res = await runOpenRouter(modelConfig.id, prompt, systemPrompt, history, '', { ...(context || {}), openrouterProvider: modelConfig.openrouter_provider })
      }
      if (res) {
        const content = typeof res === 'object' ? (res as any).content : res
        tracer?.recordSuccess({ ...traceMeta, output: content }, Date.now() - t0)
        return content
      }
      tracer?.recordFailed({ ...traceMeta, error: 'empty response' }, Date.now() - t0)
    } catch (e: any) {
      logger.warn(`Think chain model ${modelConfig.id} failed: ${e.message}`)
      tracer?.recordFailed({ ...traceMeta, error: e.message }, Date.now() - t0)
    }
  }
  return null
}

export async function runThinkChain(
  originalPrompt: string,
  accumulatedContext: string,
  history: any[],
  sessionSummary: string | null,
  replyContext: any,
  context: any,
  onStatus: StatusCallback,
  tracer?: TraceCollector,
): Promise<ThinkChainOutput> {
  const { statusMessages } = await import('../router-config').then(m => m.getPipelineSettings())
  const customStatus = statusMessages['THINKING']
  const label = customStatus ? `${customStatus.emoji} ${customStatus.label}`.trim() : 'Working...'

  const systemPrompt = getChainPrompt('thinking')

  const buildThinkPrompt = (ctx: string): string => {
    const now = context?.clientTime ? new Date(context.clientTime) : new Date()
    const dateContext = `[CURRENT CONTEXT]\nDate: ${now.toDateString()}\nTime: ${now.toLocaleTimeString()}\n`
    
    const parts: string[] = []
    parts.push(dateContext)
    if (replyContext?.attentionBlock) parts.push(replyContext.attentionBlock)
    if (sessionSummary) parts.push(`[SESSION MEMORY SUMMARY]\n${sessionSummary}`)
    parts.push(`[ORIGINAL REQUEST]\n${originalPrompt}`)
    if (ctx) parts.push(ctx)
    parts.push(`Review the above, identify any gaps or errors, select the best approach, and provide clear direction for the final answer.`)
    return parts.join('\n\n')
  }

  const thinkStep: PipelineStep = { 
    chain: 'THINKING', 
    goal: 'Review all outputs and plan final answer', 
    status: 'running', 
    label 
  }
  onStatus(thinkStep)

  const thinkPrompt = buildThinkPrompt(accumulatedContext)
  const raw = await runThinkModel(thinkPrompt, systemPrompt, history.slice(-20), context, tracer)

  if (!raw) {
    thinkStep.status = 'failed'
    onStatus({ ...thinkStep })
    return {
      thinkSummary: '',
      direction: 'Answer the user request based on the available context.',
      steps: [{ ...thinkStep }],
    }
  }

  const result = parseThinkOutput(raw)
  const allSteps: PipelineStep[] = []

  thinkStep.status = 'done'
  allSteps.push({ ...thinkStep })
  onStatus({ ...thinkStep })

  return {
    thinkSummary: raw,
    direction: result.direction,
    steps: allSteps,
  }
}
