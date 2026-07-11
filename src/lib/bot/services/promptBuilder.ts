import { getGlobalPrompt, getToolInstructions, getChainPrompt } from '../prompts'
import { supabaseAdmin } from '../../supabase'
import type { IntentCategory } from '../../router-config'

export interface PromptBuilderContext {
  userId?: string
  pageContext?: string | null
  vision_notes?: string
  replyContext?: any
  clientTime?: string
  isGlobalPromptEnabled: boolean
  skipSummary: boolean
  currentSummary: string | null
}

function getChainInstructions(category: IntentCategory): string {
  const map: Partial<Record<IntentCategory, string>> = {
    REGULAR: 'regular',
    COMPLEX: 'complex',
    ADVISOR: 'complex',
    WEB_SEARCH: 'web_search',
    RESEARCH: 'research',
    CODING: 'coding',
    THINKING: 'thinking',
    COMPACTION: 'compaction',
    CLASSIFIER: 'classifier',
  }
  const file = map[category]
  return file ? getChainPrompt(file) : ''
}

export async function buildSystemPrompt(
  category: IntentCategory,
  context: PromptBuilderContext
): Promise<{ staticPrompt: string, dynamicContext: string }> {
  let now = new Date()
  let localTimeString = now.toLocaleTimeString()
  let localDateString = now.toDateString()
  let tzOffset = now.getTimezoneOffset()

  if (context.clientTime) {
    const clientDate = new Date(context.clientTime)
    if (!isNaN(clientDate.getTime())) {
      now = clientDate
      localTimeString = context.clientTime.match(/\d{2}:\d{2}:\d{2}/)?.[0] || now.toLocaleTimeString()
      localDateString = now.toDateString()
      
      const tzMatch = context.clientTime.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
      if (tzMatch) {
        const sign = tzMatch[1] === '+' ? -1 : 1;
        const hours = parseInt(tzMatch[2], 10);
        const minutes = tzMatch[3] ? parseInt(tzMatch[3], 10) : 0;
        tzOffset = sign * ((hours * 60) + minutes);
      }
    }
  }
  // Compute a human-readable UTC offset label for the AI (e.g. "UTC+3", "UTC-5")
  // tzOffset follows JavaScript convention: negative = east of UTC, positive = west of UTC
  const utcOffsetHours = -tzOffset / 60;
  const utcLabel = utcOffsetHours >= 0 ? `UTC+${utcOffsetHours}` : `UTC${utcOffsetHours}`;

  let dateContext = `[CURRENT CONTEXT]
Date: ${localDateString}
Local Time: ${localTimeString}
User Timezone: ${utcLabel}
ISO Time (UTC): ${now.toISOString()}
Timezone Offset (mins): ${tzOffset}

CRITICAL — DATE/TIME CONVERSION RULES FOR TOOL CALLS:
All dueDate and endDate values in tool calls MUST be UTC ISO strings (ending in Z).
The user speaks in LOCAL time (${utcLabel}). You must convert:
  Formula: UTC hour = Local hour - (${utcOffsetHours})
  Example: User says "6 PM" → 18:00 local → 18 - (${utcOffsetHours}) = ${18 - utcOffsetHours}:00 UTC → use "${new Date().toISOString().split('T')[0]}T${String(18 - utcOffsetHours).padStart(2, '0')}:00:00.000Z"

CRITICAL — START DATE vs END DATE:
When the user provides TWO dates (e.g. "start now, end tomorrow at 6pm"):
  - dueDate = the START date/time (converted to UTC ISO)
  - endDate = the END date/time (converted to UTC ISO)
  - includeTime = true (when any time is mentioned)
You MUST set BOTH dueDate AND endDate. Never omit endDate when the user explicitly mentions an end date or a date range.
`

  const chainInstructions = getChainInstructions(category)

  let finalSysPrompt = ""

  // Global prompt (personality, answer style, thinking, restrictions)
  const globalPrompt = getGlobalPrompt()
  if (globalPrompt && context.isGlobalPromptEnabled) {
    finalSysPrompt += globalPrompt
  }

  if (context.isGlobalPromptEnabled) {
    finalSysPrompt += `\n\n[ABOUT THE APP & CREATOR]
Flowr is a productivity platform by Mikhail Tsoy (19, independent developer) combining knowledge management, task planning, visual whiteboarding, and a context-aware AI agent — all in one workspace. Not a cryptocurrency or financial service.

What Flowr does:
- Notes & knowledge management (block-based, local files with optional cloud sync)
- Visual whiteboards & diagrams (canvas with shapes, connectors — Excalidraw to Figma range)
- Task tracking integrated with workspaces
- Personal AI agent that reads and writes your content

Desktop mode: files local, offline-capable. Web mode: cloud sync across devices. Both include AI + tasks.\n`
  }

  if (chainInstructions) {
    finalSysPrompt += "\n\n" + chainInstructions
  }

  if (['REGULAR', 'COMPLEX', 'CODING', 'WEB_SEARCH', 'RESEARCH'].includes(category)) {
    finalSysPrompt += "\n\n" + getToolInstructions()
  }

  // Inject dynamic date context after the static rules to preserve prefix caching!
  if (finalSysPrompt) {
    finalSysPrompt += "\n\n" + dateContext
  } else {
    finalSysPrompt = dateContext
  }

  // Fetch and inject memory fact sheet BEFORE page context
  if (context.isGlobalPromptEnabled && context.userId && supabaseAdmin) {
    try {
      const { data: memories } = await supabaseAdmin
        .from('bot_memories')
        .select('id, title, content')
        .eq('user_id', context.userId)
        .order('created_at', { ascending: true })

      if (memories && memories.length > 0) {
        finalSysPrompt += `\n\n[USER MEMORY FACT SHEET]\nThe following are confirmed facts you have memorized about the user:\n`
        for (const mem of memories) {
          finalSysPrompt += `- [ID: ${mem.id}] [${mem.title}] ${mem.content}\n`
        }
        finalSysPrompt += `\n`
      }
    } catch (e) {
      console.error('Failed to fetch bot memories:', e)
    }
  }

  if (context.pageContext && context.pageContext !== 'null') {
    const limit = 15000
    let contextStr = context.pageContext
    if (contextStr.length > limit) {
      contextStr = contextStr.slice(0, limit) + '\n... [TRUNCATED DUE TO LENGTH LIMIT]'
    }
    finalSysPrompt += `\n\n[PAGE CONTEXT]\n${contextStr}\n`
  }

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

  // Strip system prompt and memory for IMAGE_GEN chain
  if (category === 'IMAGE_GEN') {
    system_prompt = ''
    dynamicContext = ''
  }

  return { staticPrompt: system_prompt, dynamicContext }
}

