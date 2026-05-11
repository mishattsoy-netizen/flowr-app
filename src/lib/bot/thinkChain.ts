import { logger } from '../logger'
import { getRouterChain, IntentCategory } from '../router-config'
import { executePipeline, PipelineStep, StatusCallback } from './pipeline'
import { OrchestratorPlan } from './orchestrator'

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

const DEFAULT_THINK_SYSTEM_PROMPT = `You are the reasoning layer in a multi-step AI pipeline. Your job is to review all chain outputs, catch errors or gaps, consider multiple approaches, and commit to the clearest direction for the final answer.

Output your thinking in this exact format:
[THINKING SUMMARY]
Reviewed: [list chain types reviewed, or "none" if no chains ran]
Gap found: [describe gap or "none"]
Correction needed: [chain type needed to fix gap, or "none"]
Approach selected: [chosen approach for final answer]
Direction for final output: [specific instruction for the answer chain]
Confidence: [high / medium / low] — [one sentence reason]`

function parseThinkOutput(raw: string): ThinkResult {
  const direction = raw.match(/Direction for final output:\s*(.+)/i)?.[1]?.trim() || raw
  const correctionMatch = raw.match(/Correction needed:\s*([A-Z_]+)/i)?.[1]?.trim()
  const confidenceMatch = raw.match(/Confidence:\s*(high|medium|low)/i)?.[1] as 'high' | 'medium' | 'low' | undefined

  const validChains: IntentCategory[] = [
    'WEB_SEARCH', 'DEEP_RESEARCH', 'VISION', 'CODING', 'COMPLEX_THINKING', 'MEDIUM_THINKING'
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
  context: any
): Promise<string | null> {
  const { chain } = await getRouterChain('THINKING' as any)

  if (chain.length === 0) {
    logger.warn('THINKING chain is empty — add models via Admin > Router > THINKING. Skipping think step.')
    return null
  }

  for (const modelConfig of chain) {
    if (!modelConfig.is_enabled) continue
    try {
      const provider = modelConfig.provider.toLowerCase()
      if (provider === 'google') {
        const { runGoogle } = await import('./providers/google')
        const res = await runGoogle(modelConfig.id, prompt, systemPrompt, undefined, context, history)
        if (res) {
          return typeof res === 'object' ? res.content : res
        }
      } else if (provider === 'groq') {
        const { runGroq } = await import('./providers/groq')
        const res = await runGroq(modelConfig.id, prompt, systemPrompt, undefined, context, history)
        if (res) {
          return typeof res === 'object' ? (res as any).content : res
        }
      } else if (provider === 'openrouter') {
        const { runOpenRouter } = await import('./providers/openrouter')
        const res = await runOpenRouter(modelConfig.id, prompt, systemPrompt, history, '', modelConfig.openrouter_provider || undefined)
        if (res) {
          return typeof res === 'object' ? (res as any).content : res
        }
      }
    } catch (e: any) {
      logger.warn(`Think chain model ${modelConfig.id} failed: ${e.message}`)
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
): Promise<ThinkChainOutput> {
  const { statusMessages } = await import('../router-config').then(m => m.getPipelineSettings())
  const customStatus = statusMessages['THINKING']
  const label = customStatus ? `${customStatus.emoji} ${customStatus.label}`.trim() : 'Working'

  const { system_prompt } = await getRouterChain('THINKING' as any)
  const systemPrompt = system_prompt || DEFAULT_THINK_SYSTEM_PROMPT

  const buildThinkPrompt = (ctx: string): string => {
    const now = new Date()
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

  const thinkStep: PipelineStep = { chain: 'THINKING', goal: 'Review all outputs and plan final answer', status: 'running', label }
  onStatus(thinkStep)

  const thinkPrompt = buildThinkPrompt(accumulatedContext)
  const raw = await runThinkModel(thinkPrompt, systemPrompt, history.slice(-20), context)

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

  if (result.correctionChain) {
    logger.info(`Think chain requesting correction: ${result.correctionChain}`)
    thinkStep.status = 'done'
    thinkStep.output = raw
    allSteps.push({ ...thinkStep })
    onStatus({ ...thinkStep })

    const correctionPlan: OrchestratorPlan = {
      steps: [result.correctionChain],
      stepGoals: [`Provide additional data to fill gap identified by think chain: ${result.direction}`],
    }

    const correctionResult = await executePipeline(correctionPlan, originalPrompt, context, onStatus)
    const correctedContext = accumulatedContext
      ? accumulatedContext + '\n\n' + correctionResult.accumulatedContext
      : correctionResult.accumulatedContext
    allSteps.push(...correctionResult.steps)

    // Second think pass — no more corrections
    const thinkStep2: PipelineStep = { chain: 'THINKING', goal: 'Final review after correction', status: 'running', label }
    onStatus(thinkStep2)

    const thinkPrompt2 = buildThinkPrompt(correctedContext)
    const raw2 = await runThinkModel(thinkPrompt2, systemPrompt, history.slice(-20), context)

    if (raw2) {
      const result2 = parseThinkOutput(raw2)
      thinkStep2.status = 'done'
      thinkStep2.output = raw2
      allSteps.push({ ...thinkStep2 })
      onStatus({ ...thinkStep2 })
      return {
        thinkSummary: raw2,
        direction: result2.direction,
        correctedContext,
        steps: allSteps,
      }
    }

    thinkStep2.status = 'failed'
    allSteps.push({ ...thinkStep2 })
    onStatus({ ...thinkStep2 })
    return {
      thinkSummary: raw,
      direction: result.direction,
      correctedContext,
      steps: allSteps,
    }
  }

  thinkStep.status = 'done'
  thinkStep.output = raw
  allSteps.push({ ...thinkStep })
  onStatus({ ...thinkStep })

  return {
    thinkSummary: raw,
    direction: result.direction,
    steps: allSteps,
  }
}
