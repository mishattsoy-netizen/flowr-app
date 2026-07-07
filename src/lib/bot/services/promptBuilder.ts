import { getAiUserDescription } from '@/app/settings/ai/actions'
import { getGlobalPrompt, getToolInstructions, getChainPrompt } from '../prompts'
import type { IntentCategory } from '../../router-config'

export interface PromptBuilderContext {
  userId?: string
  pageContext?: string | null
  vision_notes?: string
  replyContext?: any
  isGlobalPromptEnabled: boolean
  skipSummary: boolean
  currentSummary: string | null
}

function getChainInstructions(category: IntentCategory): string {
  if (category === 'REGULAR') return getChainPrompt('regular')
  if (category === 'COMPLEX' || category === 'ADVISOR') return getChainPrompt('complex')
  return ''
}

export async function buildSystemPrompt(
  category: IntentCategory,
  routerOverridePrompt: string | undefined,
  context: PromptBuilderContext
): Promise<{ staticPrompt: string, dynamicContext: string }> {
  const now = new Date()
  let dateContext = `[CURRENT CONTEXT]\nDate: ${now.toDateString()}\nTime: ${now.toLocaleTimeString()}\n`

  const userDescription = context.userId ? await getAiUserDescription(context.userId) : null
  const chainInstructions = getChainInstructions(category)

  let finalSysPrompt = dateContext

  // Global prompt (personality, answer style, thinking, restrictions)
  const globalPrompt = getGlobalPrompt()
  if (globalPrompt && context.isGlobalPromptEnabled) {
    finalSysPrompt += "\n\n" + globalPrompt
  }

  if (userDescription) {
    finalSysPrompt += `\n\n[ABOUT THE USER]\nThe following is what the user has shared about themselves. Use this information to personalize your responses and understand who they are:\n${userDescription}\n`
  }

  finalSysPrompt += `\n\n[ABOUT THE APP & CREATOR]
Flowr is a productivity platform by Mikhail Tsoy (19, independent developer) combining knowledge management, task planning, visual whiteboarding, and a context-aware AI agent — all in one workspace. Not a cryptocurrency or financial service.

What Flowr does:
- Notes & knowledge management (block-based, local files with optional cloud sync)
- Visual whiteboards & diagrams (canvas with shapes, connectors — Excalidraw to Figma range)
- Task tracking integrated with workspaces
- Personal AI agent that reads and writes your content

Desktop mode: files local, offline-capable. Web mode: cloud sync across devices. Both include AI + tasks.\n`


  const PIPELINE_PROMPT_CHAINS = ['WEB_SEARCH', 'RESEARCH']
  if (chainInstructions && !PIPELINE_PROMPT_CHAINS.includes(category)) {
    finalSysPrompt += "\n\n" + chainInstructions
  }

  if (['REGULAR', 'COMPLEX', 'CODING', 'WEB_SEARCH', 'RESEARCH'].includes(category)) {
    finalSysPrompt += "\n\n" + getToolInstructions()
  }

  // REGULAR and COMPLEX get their chain instructions from .txt files above.
  // Skip any DB-stored override for those to avoid a stale duplicate block.
  const FILE_CHAIN_CATEGORIES = ['REGULAR', 'COMPLEX']
  if (routerOverridePrompt && !FILE_CHAIN_CATEGORIES.includes(category)) {
    finalSysPrompt += "\n\n" + routerOverridePrompt
  }

  if (context.pageContext) finalSysPrompt += `\n\n[PAGE CONTEXT]\n${context.pageContext}\n`

  let system_prompt = finalSysPrompt
  let dynamicContext = ''

  if (context.vision_notes) {
    dynamicContext += `[VISION DATA]\n${context.vision_notes}\n\n`
  }

  if (context.currentSummary && !context.skipSummary) {
    dynamicContext += `[SESSION MEMORY SUMMARY]\n${context.currentSummary}\n\n`
  }

  if (context.replyContext?.attentionBlock) {
    dynamicContext += context.replyContext.attentionBlock + "\n\n"
  }

  return { staticPrompt: system_prompt, dynamicContext }
}
