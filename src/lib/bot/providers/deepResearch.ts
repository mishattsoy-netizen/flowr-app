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
    const results = await client.search(query, { searchDepth: 'advanced', maxResults: 5, days: 60 })
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

async function detectGaps(allFindings: string, originalQuestion: string, gapSystemPrompt: string, gapModel: any, context?: any): Promise<string[]> {
  const gapPrompt = `${gapSystemPrompt}\n\nORIGINAL QUESTION: ${originalQuestion}\n\nFINDINGS SO FAR:\n${allFindings}`

  try {
    let raw: string | null = null
    const provider = gapModel.provider.toLowerCase()

    if (provider === 'google') {
      const { runGoogle } = await import('./google')
      const res = await runGoogle(gapModel.id, gapPrompt, undefined, undefined, undefined)
      raw = typeof res === 'object' && res !== null ? (res as any).content ?? null : res ?? null
    } else if (provider === 'openrouter') {
      const { runOpenRouter } = await import('./openrouter')
      const res = await runOpenRouter(gapModel.id, gapPrompt, undefined, [], undefined, { ...(context || {}), openrouterProvider: gapModel.openrouter_provider })
      raw = typeof res === 'object' && res !== null ? (res as any).content ?? null : res ?? null
    } else if (provider === 'groq') {
      const { runGroq } = await import('./groq')
      const res = await runGroq(gapModel.id, gapPrompt, undefined, undefined, undefined, [])
      raw = typeof res === 'string' ? res : null
    }

    if (!raw) return []
    const match = raw.match(/\[[\s\S]*?\]/)
    if (!match) return []
    const parsed = JSON.parse(match[0])
    return Array.isArray(parsed) ? parsed.filter((q: any) => typeof q === 'string').slice(0, 2) : []
  } catch {
    return []
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
  logger.info(`Starting iterative deep research for: ${prompt}`)

  const { getRouterChain } = await import('../../router-config')

  const gapChainCategory = 'REGULAR'
  const gapSystemPrompt = getChainPrompt('deep_research_gap_detector')

  const { chain: gapChain } = await getRouterChain(gapChainCategory, 'default')
  const gapModel = gapChain.find(m => m.is_enabled)

  // Build a research query from vision notes when available.
  // The raw user prompt is often conversational ("imagine you are from prague..."),
  // but vision already extracted the real research topic in [VISION INSTRUCTIONS].
  const researchQuery = context?.vision_notes
    ? extractSearchQuery(context.vision_notes, prompt)
    : prompt
  logger.info(`Deep research using query: ${researchQuery}`)

  // Round 1 — initial broad search (using the real topic, not the conversational prompt)
  const round1 = await bestSearch(researchQuery, chainModels, context)
  if (!round1) return { researchText: 'Search failed to retrieve results.', gapTrace: [] }

  let allFindings = `[ROUND 1 — Query: ${researchQuery}]\n${round1.text}`

  // Fetch full content from discovered URLs
  if (round1.urls.length > 0) {
    const pages = await extractContent(round1.urls, context)
    if (pages.length > 0) {
      allFindings += `\n\n[EXTRACTED CONTENT]\n${formatExtractedPages(pages)}`
    }
  }

  // Round 2 — gap detection + targeted follow-up
  if (gapModel) {
    const gaps = await detectGaps(allFindings, researchQuery, gapSystemPrompt, gapModel, context)
    logger.info(`Deep research gaps detected: ${JSON.stringify(gaps)}`)

    if (gaps.length > 0) {
      const round2Results = await Promise.all(gaps.map(q => bestSearch(q, chainModels, context)))
      gaps.forEach((query, i) => {
        if (round2Results[i]) {
          allFindings += `\n\n[ROUND 2 — Query: ${query}]\n${round2Results[i].text}`
          if (round2Results[i].urls.length > 0) {
            // Reuse already-extracted pages if same URLs, otherwise content is from R1
          }
        }
      })
    }
  }

  const gapTrace: { model: string; key: string; success: boolean; category?: string }[] = []
  if (gapModel) {
    gapTrace.push({
      model: gapModel.id,
      key: gapChainCategory,
      success: true,
      category: gapChainCategory,
    })
  }

  const systemPrompt = getChainPrompt('research_pipeline')
  return {
    researchText: `${systemPrompt}\n\nRESEARCH FINDINGS:\n${allFindings}\n\nUSER QUESTION:\n${prompt}`,
    findings: allFindings,
    gapTrace,
  }
}
