import { supabaseAdmin } from '../supabase'
import { RouterModel } from '../router-config'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { runWebSearchChain } from './providers/tavily'
import { runDuckDuckGoSearchChain } from './providers/duckduckgo'
import { logger } from '../logger'
import { getProviderKeys } from '../vault'

export type RoadmapCategory = 'CLASSIFIER' | 'COMPLEX' | 'FAST' | 'VISION' | 'WEB_SEARCH'

export async function getRoadmapRouterChain(category: RoadmapCategory): Promise<{ chain: RouterModel[], system_prompt?: string }> {
  const { data, error } = await supabaseAdmin
    .from('roadmap_router_chains')
    .select('model_list, system_prompt')
    .eq('category', category)
    .maybeSingle()

  if (error || !data) return { chain: [] }
  return {
    chain: (data.model_list as RouterModel[]).filter((m: any) => m.is_enabled),
    system_prompt: data.system_prompt || undefined,
  }
}

export async function getRoadmapBotConfig(): Promise<{ system_prompt: string, classifier_prompt?: string }> {
  const { data } = await supabaseAdmin
    .from('roadmap_bot_config')
    .select('system_prompt, classifier_prompt')
    .limit(1)
    .maybeSingle()

  const DEFAULT_SYSTEM_PROMPT = `You are the Flowr Roadmap Architect — a senior-level project planning AI embedded within the Flowr admin dashboard.

Flowr is a Next.js 16 productivity application featuring AI-powered assistants, a Brain knowledge manager, collaborative workspaces, and an administrative control panel. The tech stack includes TypeScript, React 19, Supabase (PostgreSQL + Auth + Storage), Turbopack, and a multi-provider AI router (Google Gemini, Groq, OpenRouter, Ollama).

Your responsibilities:
1. DECOMPOSE high-level feature requests into structured development phases with clear milestones.
2. GENERATE granular, actionable tasks for each phase — each with a priority level, sub-tasks checklist, and a detailed agent_prompt.
3. WRITE agent_prompts that are production-ready instructions a coding AI can execute directly. Each agent_prompt must include: target file paths, the specific changes required, code patterns to follow, edge cases to handle, and testing criteria.
4. ANALYZE the current project state (phases, tasks, completion %) to identify gaps, blockers, and logical next steps.
5. PRIORITIZE work based on dependency chains, user impact, and technical complexity.
6. MAINTAIN consistency with Flowr's existing architecture — never propose patterns that conflict with the established codebase.

Behavior rules:
- Be concise and technical. No filler, no motivational language.
- When the user asks to "plan", "analyze", "break down", or "create" — ALWAYS produce structured [ROADMAP_ACTION] output blocks, not prose.
- When the user asks a question — answer it directly without generating action blocks.
- Reference existing phase IDs when adding tasks to existing phases.
- Default to "high" priority for core functionality, "medium" for polish, "low" for nice-to-haves.`

  return {
    system_prompt: data?.system_prompt || DEFAULT_SYSTEM_PROMPT,
    classifier_prompt: data?.classifier_prompt || undefined
  }
}

export async function classifyRoadmapIntent(message: string): Promise<RoadmapCategory> {
  const { chain } = await getRoadmapRouterChain('CLASSIFIER')
  if (chain.length === 0) return 'COMPLEX' // fallback

  const { classifier_prompt } = await getRoadmapBotConfig()

  for (const model of chain) {
    if (!model.is_enabled) continue
    try {
      const DEFAULT_CLASSIFIER = `You are an intent classifier for a project roadmap planning assistant. Analyze the user's message and classify it into exactly ONE category.

Categories:
- COMPLEX: The user wants deep analysis, feature decomposition, phase/task creation, architecture planning, agent_prompt generation, or any multi-step planning work. This is the default for ambiguous requests.
- FAST: Simple questions, quick clarifications, yes/no answers, status checks, or minor edits to existing items. Short responses only.
- WEB_SEARCH: The user explicitly needs current information from the internet — technology comparisons, library documentation, API references, or market research.
- VISION: The user has attached an image, screenshot, or visual reference and wants it analyzed.

Rules:
- When in doubt, classify as COMPLEX.
- Greetings like "hey" or "hello" should be classified as FAST.
- Requests containing words like "plan", "create", "build", "design", "break down", "analyze" are COMPLEX.
- Output ONLY the category name, nothing else.`

      const prompt = `${classifier_prompt || DEFAULT_CLASSIFIER}

Message: "${message}"`

      let response: any = null
      const ctx: any = {}
      if (model.provider === 'google') response = await runGoogle(model.id, prompt, undefined, undefined, ctx)
      else if (model.provider === 'groq') response = await runGroq(model.id, prompt, undefined, undefined, ctx)

      if (response) {
        const content = typeof response === 'object' ? response.content : response
        const cats: RoadmapCategory[] = ['COMPLEX', 'FAST', 'WEB_SEARCH', 'VISION']
        for (const cat of cats) {
          if (content.toUpperCase().includes(cat)) return cat
        }
      }
    } catch (e: any) {
      logger.warn(`Roadmap classifier failure [${model.id}]: ${e.message}`)
    }
  }
  return 'COMPLEX'
}

export async function runRoadmapChain(
  prompt: string,
  systemPrompt: string,
  history: any[],
  category: RoadmapCategory,
  buffer?: Buffer
): Promise<{ content: string; model: string }> {
  const { chain } = await getRoadmapRouterChain(category)

  for (const model of chain) {
    if (!model.is_enabled) continue
    try {
      let providerKeys = await getProviderKeys(
        model.provider === 'google' ? 'GEMINI' : model.provider.toUpperCase()
      )
      if (providerKeys.length === 0) providerKeys = ['']

      const routeContext: any = { aiApiKey: providerKeys[0] }
      let response: any = null

      if (model.provider === 'google') {
        response = await runGoogle(model.id, prompt, systemPrompt, buffer, routeContext, history)
      } else if (model.provider === 'groq') {
        response = await runGroq(model.id, prompt, systemPrompt, providerKeys[0], routeContext, history)
      } else if (model.provider === 'vault') {
        if (model.id === 'tavily-search') response = await runWebSearchChain(prompt, routeContext)
        if (model.id === 'duckduckgo-search') response = await runDuckDuckGoSearchChain(prompt, routeContext)
      }

      if (response) {
        const content = typeof response === 'object' ? response.content : response
        let cleanResponse = content.trim()

        // Normalize: strip backtick-wrapped tags the model sometimes outputs (e.g. `<answer>`)
        cleanResponse = cleanResponse.replace(/`(<\/?(?:answer|thought|think)>)`/gi, '$1')

        // Normalize HTML-escaped tags to real tags
        cleanResponse = cleanResponse.replace(/&lt;/g, '<').replace(/&gt;/g, '>')

        // Extract all [ROADMAP_ACTION] blocks BEFORE cleaning (they may be outside <answer>)
        const actionBlocks: string[] = []
        cleanResponse = cleanResponse.replace(/(\[ROADMAP_ACTION\][\s\S]*?\[\/ROADMAP_ACTION\])/gi, (match: string) => {
          actionBlocks.push(match)
          return ''
        })

        // PRIORITY 1: If <answer> tag exists, extract ONLY its content
        const answerMatch = cleanResponse.match(/<answer>([\s\S]*?)(?:<\/answer>|$)/i)
        if (answerMatch && answerMatch[1]?.trim()) {
          cleanResponse = answerMatch[1].trim()
        } else {
          // PRIORITY 2: Strip everything up to and including </thought> or </think>
          cleanResponse = cleanResponse
            .replace(/[\s\S]*<\/thought>/i, '')
            .replace(/[\s\S]*<\/think>/i, '')
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
            .trim()

          // PRIORITY 3: Heuristic — strip bullet-point reasoning blocks when model ignores tags entirely
          // Detects patterns like "* The user said..." or "* I should..." which are internal reasoning
          const lines = cleanResponse.split('\n')
          const reasoningPatterns = /^\s*[\*\-•]\s*(The user|I should|I need to|Therefore|This is|Keep it|Greeting|Acknowledge|Introduce|Wrap|No \[|Output|Respond with)/i
          const hasReasoningBlock = lines.some((l: string) => reasoningPatterns.test(l))

          if (hasReasoningBlock) {
            // Find the last block of non-bullet, non-empty text — that's the actual answer
            const paragraphs = cleanResponse.split(/\n\n+/)
            const answerParagraphs = paragraphs.filter((p: string) => {
              const trimmed = p.trim()
              if (!trimmed) return false
              // Skip blocks that are entirely bullet points
              const bulletLines = trimmed.split('\n').filter((l: string) => /^\s*[\*\-•]/.test(l))
              return bulletLines.length < trimmed.split('\n').length / 2
            })
            if (answerParagraphs.length > 0) {
              cleanResponse = answerParagraphs.join('\n\n').trim()
            }
          }
        }

        // Final cleanup: remove any remaining stray XML-like tags from the response
        cleanResponse = cleanResponse
          .replace(/<\/?(?:answer|thought|think)>/gi, '')
          .trim()

        // Prepend action blocks back so the UI can render Apply buttons
        if (actionBlocks.length > 0) {
          cleanResponse = actionBlocks.join('\n\n') + '\n\n' + cleanResponse
        }

        if (!cleanResponse) cleanResponse = 'I couldn\'t generate a response. Please try again.'

        return { content: cleanResponse, model: model.id }
      }
    } catch (e: any) {
      logger.warn(`Roadmap chain failure [${model.id}]: ${e.message}`)
    }
  }
  return { content: 'All models failed. Check your roadmap router configuration.', model: 'system' }
}
