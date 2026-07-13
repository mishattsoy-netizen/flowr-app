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
  pendingAction?: { tool: string; args: Record<string, any>; dry_run_result: any } | null
}

function getChainInstructions(category: IntentCategory): string {
  const map: Partial<Record<IntentCategory, string>> = {
    REGULAR: 'regular',
    COMPLEX: 'complex',
    ADVISOR: 'complex',
    PRIMARY: 'primary',
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

  // Round displayed times to the minute — a per-second timestamp needlessly
  // differentiates otherwise-identical prompts.
  const localTimeMinute = localTimeString.replace(/^(\d{1,2}:\d{2}):\d{2}/, '$1')
  const isoMinute = now.toISOString().slice(0, 16) + 'Z'

  // dateContext is DYNAMIC (changes every request) — it must NOT enter the
  // static system prompt, or it busts provider prefix caching on every turn.
  // It travels in dynamicContext (prepended to the user message) instead.
  const dateContext = `[CURRENT CONTEXT]
Date: ${localDateString}
Local Time: ${localTimeMinute} (${utcLabel})
ISO Time (UTC): ${isoMinute}

DATE/TIME RULES FOR TOOL CALLS (CRITICAL):
All dueDate/endDate values MUST be UTC ISO strings (ending in Z). The user speaks in LOCAL time (${utcLabel}): UTC hour = local hour - (${utcOffsetHours}). Example: "6 PM" local → ${String(18 - utcOffsetHours).padStart(2, '0')}:00 UTC.
When the user gives TWO dates ("start now, end tomorrow 6pm"): dueDate = START, endDate = END, includeTime = true when any time is mentioned. Never omit endDate when the user states an end date or range.
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

  if (['REGULAR', 'COMPLEX', 'CODING', 'WEB_SEARCH', 'RESEARCH', 'PRIMARY'].includes(category)) {
    finalSysPrompt += "\n\n" + getToolInstructions()
  }

  // Memory fact sheet stays in the STATIC system prompt: it changes rarely
  // (only when manage_memory fires), so the whole prefix — global + app +
  // chain + tools + memory — is byte-stable across turns and cacheable.
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

  let system_prompt = finalSysPrompt

  // Everything below changes per request/page — it rides in dynamicContext
  // (prepended to the user message) so the system prompt stays cache-stable.
  let dynamicContext = dateContext + '\n'

  if (context.pageContext && context.pageContext !== 'null') {
    const limit = 15000
    let contextStr = context.pageContext
    if (contextStr.length > limit) {
      contextStr = contextStr.slice(0, limit) + '\n... [TRUNCATED DUE TO LENGTH LIMIT]'
    }
    dynamicContext += `[PAGE CONTEXT]\n${contextStr}\n\n`
  }

  if (context.vision_notes) {
    dynamicContext += `[VISION DATA]\n${context.vision_notes}\n\n`
  }

  if (context.currentSummary && !context.skipSummary) {
    dynamicContext += `[SESSION MEMORY SUMMARY]\n${context.currentSummary}\n\n`
  }

  if (context.replyContext?.attentionBlock) {
    dynamicContext += context.replyContext.attentionBlock + "\n\n"
  }

  // §6b: server-recorded pending confirmation state, so the model reasons
  // over what was actually dry-run instead of re-deriving it from raw text.
  if (context.pendingAction) {
    const pa = context.pendingAction
    dynamicContext += `[PENDING CONFIRMATION]\nTool: ${pa.tool}\nDetails: ${JSON.stringify(pa.dry_run_result)}\nThe user has NOT yet confirmed this. If their message answers it (yes/no/adjustment), act accordingly — call the tool again with confirmed:true using the SAME args if they said yes, or drop it and address whatever they actually said if the topic changed.\n\n`
  }

  // Strip system prompt and memory for IMAGE_GEN chain
  if (category === 'IMAGE_GEN') {
    system_prompt = ''
    dynamicContext = ''
  }

  return { staticPrompt: system_prompt, dynamicContext }
}

