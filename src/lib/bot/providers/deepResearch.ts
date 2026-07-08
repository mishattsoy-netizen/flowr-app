import { tavily } from '@tavily/core'
import { getVaultKey, getProviderKeys } from '../../vault'
import { logger } from '../../logger'
import { extractContent, formatExtractedPages } from './content-extract'
import { getChainPrompt } from '../prompts'

async function searchTavily(query: string, context?: any): Promise<string | null> {
  let keys = context?.aiApiKey ? [context.aiApiKey] : []
  if (keys.length === 0) keys = await getProviderKeys('TAVILY')
  const apiKey = keys[0] || await getVaultKey('TAVILY_API_KEY') || process.env.TAVILY_API_KEY
  if (!apiKey) return null

  try {
    const client = tavily({ apiKey })
    const results = await client.search(query, { searchDepth: 'basic', maxResults: 5, days: 60 })
    if (!results.results?.length) return null
    return results.results.map(r =>
      `SOURCE: ${r.title}\nURL: ${r.url}\nCONTENT: ${r.content}\n\n[ ${r.title}](${r.url})`
    ).join('\n\n---\n\n')
  } catch (e: any) {
    logger.warn(`Tavily search failed for "${query}": ${e.message}`)
    return null
  }
}

async function searchExa(query: string, context?: any): Promise<string | null> {
  const { searchExa: exaSearch } = await import('./exa')
  return exaSearch(query, context)
}

async function bestSearch(query: string, chainModels: import('../../router-config').RouterModel[], context?: any): Promise<{ text: string; urls: string[] } | null> {
  const searchNodes = chainModels.filter(m => 
    m.id.includes('search') || m.provider === 'exa' || m.provider === 'tavily' || m.provider === 'core'
  );
  
  if (searchNodes.length === 0) {
    logger.warn(`No search provider configured in RESEARCH matrix, falling back to Tavily/Exa.`)
    const tavilyResult = await searchTavily(query, context)
    if (tavilyResult) return { text: tavilyResult, urls: extractUrls(tavilyResult) }
    const exaResult = await searchExa(query, context)
    if (exaResult) return { text: exaResult, urls: extractUrls(exaResult) }
    return null
  }

  for (const node of searchNodes) {
    let result: string | null = null;
    if (node.provider === 'exa' || node.id === 'exa-search') {
      result = await searchExa(query, context);
    } else if (node.provider === 'tavily' || node.id === 'tavily-search') {
      result = await searchTavily(query, context);
    } else if (node.provider === 'core' || node.id === 'duckduckgo-search') {
      const { runDuckDuckGoSearchChain } = await import('./duckduckgo')
      try {
        result = await runDuckDuckGoSearchChain(query, context);
      } catch (e: any) {
        logger.warn(`DuckDuckGo search failed: ${e.message}`);
        result = null;
      }
    }
    
    if (result) {
      return { text: result, urls: extractUrls(result) };
    }
  }
  return null
}

function extractUrls(searchText: string): string[] {
  const urls: string[] = []
  const urlRegex = /URL:\s*(https?:\/\/[^\s\n]+)/g
  let match
  while ((match = urlRegex.exec(searchText)) !== null) {
    urls.push(match[1])
  }
  return urls
}

export interface ResearchPlan {
  queries: string[]
  mustInclude: string[]
  constraints: string[]
}

export function buildPlannerPrompt(originalQuestion: string, plannerSystemPrompt: string): string {
  return `${plannerSystemPrompt}\n\nUSER REQUEST: ${originalQuestion}`
}

export function parsePlannerOutput(raw: string | null, fallbackQuery: string): ResearchPlan {
  const fallback: ResearchPlan = { queries: [fallbackQuery], mustInclude: [], constraints: [] }
  if (!raw) return fallback

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return fallback
    const parsed = JSON.parse(match[0])

    const queries = Array.isArray(parsed.queries)
      ? parsed.queries.filter((q: any) => typeof q === 'string' && q.trim()).slice(0, 3)
      : []
    if (queries.length === 0) return fallback

    const mustInclude = Array.isArray(parsed.mustInclude)
      ? parsed.mustInclude.filter((m: any) => typeof m === 'string' && m.trim())
      : []
    const constraints = Array.isArray(parsed.constraints)
      ? parsed.constraints.filter((c: any) => typeof c === 'string' && c.trim())
      : []

    return { queries, mustInclude, constraints }
  } catch {
    return fallback
  }
}

export function buildChecklist(plan: ResearchPlan): string {
  if (plan.mustInclude.length === 0 && plan.constraints.length === 0) return ''

  const lines: string[] = []
  if (plan.mustInclude.length > 0) {
    lines.push(`Must include: ${plan.mustInclude.join(', ')}`)
  }
  if (plan.constraints.length > 0) {
    lines.push(`Must satisfy: ${plan.constraints.join('; ')}`)
  }
  return `[ANSWER REQUIREMENTS — verify all before responding]\n${lines.join('\n')}`
}

async function runResearchPlanner(originalQuestion: string, plannerSystemPrompt: string, plannerModel: any, context?: any): Promise<ResearchPlan> {
  const fullPrompt = buildPlannerPrompt(originalQuestion, plannerSystemPrompt)

  try {
    let raw: string | null = null
    const provider = plannerModel.provider.toLowerCase()

    if (provider === 'google') {
      const { runGoogle } = await import('./google')
      const res = await runGoogle(plannerModel.id, fullPrompt, undefined, undefined, undefined)
      raw = typeof res === 'object' && res !== null ? (res as any).content ?? null : res ?? null
    } else if (provider === 'openrouter') {
      const { runOpenRouter } = await import('./openrouter')
      const res = await runOpenRouter(plannerModel.id, fullPrompt, undefined, [], undefined, { ...(context || {}), openrouterProvider: plannerModel.openrouter_provider })
      raw = typeof res === 'object' && res !== null ? (res as any).content ?? null : res ?? null
    } else if (provider === 'groq') {
      const { runGroq } = await import('./groq')
      const res = await runGroq(plannerModel.id, fullPrompt, undefined, undefined, undefined, [])
      raw = typeof res === 'string' ? res : null
    }

    return parsePlannerOutput(raw, originalQuestion)
  } catch {
    return parsePlannerOutput(null, originalQuestion)
  }
}

function extractSearchQuery(visionNotes: string, fallbackPrompt: string): string {
  const instrMatch = visionNotes.match(/\[VISION INSTRUCTIONS\][\s\S]*$/)
  if (instrMatch) {
    const query = instrMatch[0]
      .replace(/\[VISION INSTRUCTIONS\]\s*/, '')
      .replace(/\[CURRENT CONTEXT\][\s\S]*$/, '')
      .trim()
      .slice(0, 500)
    if (query) return query
  }
  return fallbackPrompt
}

export async function runDeepResearchChain(prompt: string, chainModels: import('../../router-config').RouterModel[], context?: any): Promise<{
  researchText: string
  findings?: string
  gapTrace: { model: string; key: string; success: boolean; category?: string }[]
}> {
  logger.info(`Starting adaptive deep research for: ${prompt}`)

  const { getRouterChain } = await import('../../router-config')

  const plannerChainCategory = 'REGULAR'
  const plannerSystemPrompt = getChainPrompt('research_planner')

  const { chain: plannerChain } = await getRouterChain(plannerChainCategory, 'default')
  const plannerModel = plannerChain.find(m => m.is_enabled)

  // Build a research query from vision notes when available.
  // The raw user prompt is often conversational ("imagine you are from prague..."),
  // but vision already extracted the real research topic in [VISION INSTRUCTIONS].
  const researchQuery = context?.vision_notes
    ? extractSearchQuery(context.vision_notes, prompt)
    : prompt
  logger.info(`Deep research using query: ${researchQuery}`)

  // Run the planner to decompose the query into 1-3 targeted sub-queries
  const plan: ResearchPlan = plannerModel
    ? await runResearchPlanner(researchQuery, plannerSystemPrompt, plannerModel, context)
    : { queries: [researchQuery], mustInclude: [], constraints: [] }
  logger.info(`Deep research plan: ${JSON.stringify(plan)}`)

  // Run all sub-queries in parallel
  const searchResults = await Promise.all(plan.queries.map(q => bestSearch(q, chainModels, context)))

  // Merge results with extracted content
  const findingsParts: string[] = []
  for (let i = 0; i < plan.queries.length; i++) {
    const result = searchResults[i]
    if (!result) continue
    findingsParts.push(`[QUERY: ${plan.queries[i]}]\n${result.text}`)
    if (result.urls.length > 0) {
      const pages = await extractContent(result.urls, context)
      if (pages.length > 0) {
        findingsParts.push(`[EXTRACTED CONTENT for "${plan.queries[i]}"]\n${formatExtractedPages(pages)}`)
      }
    }
  }

  if (findingsParts.length === 0) {
    return { researchText: 'Search failed to retrieve results.', gapTrace: [] }
  }

  // Attach the constraint checklist so the synthesis LLM can verify coverage
  const checklist = buildChecklist(plan)
  const allFindings = findingsParts.join('\n\n---\n\n') + (checklist ? `\n\n${checklist}` : '')

  const gapTrace: { model: string; key: string; success: boolean; category?: string }[] = []
  if (plannerModel) {
    gapTrace.push({ model: plannerModel.id, key: plannerChainCategory, success: true, category: plannerChainCategory })
  }

  return {
    researchText: `RESEARCH FINDINGS:\n${allFindings}\n\nUSER QUESTION:\n${prompt}`,
    findings: allFindings,
    gapTrace,
  }
}
