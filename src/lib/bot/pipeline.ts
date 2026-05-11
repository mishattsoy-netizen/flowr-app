import { logger } from '../logger'
import { getInternalPrompt } from './compilePrompt'
import { getRouterChain, IntentCategory, getPipelineSettings } from '../router-config'
import { OrchestratorPlan } from './orchestrator'

// Dynamic imports inside runSingleChain to avoid circular deps

const MAX_STEP_OUTPUT_CHARS = 4000

export interface PipelineStep {
  chain: string
  goal: string
  status: 'pending' | 'running' | 'done' | 'failed'
  label?: string
  output?: string
}

export interface PipelineResult {
  accumulatedContext: string
  steps: PipelineStep[]
  imageBuffer?: Buffer
}

export type StatusCallback = (step: PipelineStep) => void

function formatAccumulatedContext(steps: PipelineStep[]): string {
  return steps
    .filter(s => s.status === 'done' && s.output)
    .map(s => `[${s.chain} STEP OUTPUT]\nGoal: ${s.goal}\nResult: ${s.output}`)
    .join('\n\n')
}

function truncateOutput(output: string): string {
  if (output.length <= MAX_STEP_OUTPUT_CHARS) return output
  return output.slice(0, MAX_STEP_OUTPUT_CHARS) + '\n[...truncated for context window]'
}

async function runSingleChain(
  chainType: IntentCategory,
  prompt: string,
  systemPrompt: string,
  context: any
): Promise<string | Buffer | null> {
  const { chain, temperature } = await getRouterChain(chainType)
  const routeContext = { ...context, temperature }

  for (const modelConfig of chain) {
    if (!modelConfig.is_enabled) continue
    try {
      let response: string | Buffer | { content: string; citations?: string[] } | null = null
      const provider = modelConfig.provider.toLowerCase()

      if (provider === 'google') {
        const { runGoogle } = await import('./providers/google')
        response = await runGoogle(modelConfig.id, prompt, systemPrompt, undefined, routeContext, [])
      } else if (provider === 'groq') {
        const { runGroq } = await import('./providers/groq')
        response = await runGroq(modelConfig.id, prompt, systemPrompt, undefined, routeContext, [])
      } else if (provider === 'vault') {
        // web search providers identified by model id
        if (modelConfig.id.includes('tavily')) {
          const { runWebSearchChain } = await import('./providers/tavily')
          response = await runWebSearchChain(prompt, routeContext)
        } else if (modelConfig.id.includes('duckduckgo')) {
          const { runDuckDuckGoSearchChain } = await import('./providers/duckduckgo')
          response = await runDuckDuckGoSearchChain(prompt, routeContext)
        }
      } else if (provider === 'huggingface') {
        if (chainType === 'IMAGE_GEN') {
          const { runHuggingFace } = await import('./providers/huggingface')
          response = await runHuggingFace(modelConfig.id, prompt, '')
        }
        // HuggingFace has no text generation export — skip for non-image chains
      } else if (provider === 'pollinations') {
        if (chainType === 'IMAGE_GEN') {
          const { runPollinations } = await import('./providers/pollinations')
          response = await runPollinations(prompt, modelConfig.id)
        } else {
          const { runPollinationsText } = await import('./providers/pollinations')
          response = await runPollinationsText(modelConfig.id, prompt, systemPrompt, [], '')
        }
      } else if (provider === 'cloudflare') {
        const { runCloudflare } = await import('./providers/cloudflare')
        response = await runCloudflare(modelConfig.id, prompt, routeContext?.aiApiKey, systemPrompt, [], chainType)
      } else if (provider === 'openrouter') {
        const { runOpenRouter } = await import('./providers/openrouter')
        response = await runOpenRouter(modelConfig.id, prompt, systemPrompt, [], routeContext?.aiApiKey, modelConfig.openrouter_provider || undefined)
      } else if (
        provider === 'ollama' ||
        provider === 'local' ||
        provider === 'ollama(my pc)'
      ) {
        const { runOllama } = await import('./providers/ollama')
        response = await runOllama(modelConfig.id, prompt, systemPrompt, [], temperature ?? 0.7)
      }

      if (response !== null) {
        if (typeof response === 'object' && !Buffer.isBuffer(response) && 'content' in response) {
          if (response.citations && context) {
            context.citations = [...(context.citations || []), ...response.citations]
          }
          return response.content
        }
        return response
      }
    } catch (e: any) {
      logger.warn(`Pipeline chain ${chainType} model ${modelConfig.id} failed: ${e.message}`)
    }
  }
  return null
}

export async function executePipeline(
  plan: OrchestratorPlan,
  originalPrompt: string,
  context: any,
  onStatus: StatusCallback
): Promise<PipelineResult> {
  const { imageGenAutoLast } = await getPipelineSettings()
  const completedSteps: PipelineStep[] = []
  let imageBuffer: Buffer | undefined

  let steps = [...plan.steps]
  if (imageGenAutoLast && steps.includes('IMAGE_GEN' as IntentCategory)) {
    steps = steps.filter(s => s !== ('IMAGE_GEN' as IntentCategory))
    steps.push('IMAGE_GEN' as IntentCategory)
  }

  for (let i = 0; i < steps.length; i++) {
    const chainType = steps[i]
    const goal = plan.stepGoals[i] || `Process ${chainType} for this request`
    const { statusMessages } = await getPipelineSettings()
    const customStatus = statusMessages[chainType]
    const label = customStatus ? `${customStatus.emoji} ${customStatus.label}`.trim() : 'Working'

    const step: PipelineStep = { chain: chainType, goal, status: 'running', label }
    onStatus(step)

    const accumulatedSoFar = formatAccumulatedContext(completedSteps)
    const internalPrompt = await getInternalPrompt(chainType, context?.mode ?? 'default')

    const stepPrompt = accumulatedSoFar
      ? `${originalPrompt}\n\n${accumulatedSoFar}\n\n[YOUR GOAL FOR THIS STEP]\n${goal}`
      : `${originalPrompt}\n\n[YOUR GOAL FOR THIS STEP]\n${goal}`

    try {
      const result = await runSingleChain(
        chainType,
        stepPrompt,
        internalPrompt,
        context
      )

      if (result === null) {
        step.status = 'failed'
        step.output = `[${chainType} chain returned no output]`
        logger.warn(`Pipeline step ${chainType} returned null`)
      } else if (Buffer.isBuffer(result)) {
        imageBuffer = result
        step.status = 'done'
        step.output = JSON.stringify({
          type: 'image_generated',
          prompt_used: originalPrompt,
          concept: goal,
        })
      } else {
        step.status = 'done'
        step.output = truncateOutput(result)
      }
    } catch (e: any) {
      step.status = 'failed'
      step.output = `[${chainType} chain error: ${e.message}]`
      logger.error(`Pipeline step ${chainType} threw: ${e.message}`)
    }

    completedSteps.push(step)
    onStatus({ ...step })
  }

  return {
    accumulatedContext: formatAccumulatedContext(completedSteps),
    steps: completedSteps,
    imageBuffer,
  }
}
