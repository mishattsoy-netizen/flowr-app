import { tavily } from '@tavily/core'
import { getVaultKey, getProviderKeys } from '../../vault'
import { getRouterChain } from '../../router-config'
import { logger } from '../../logger'
import { runGoogle } from './google'

/**
 * Stage 1: Raw Web Search
 */
export async function searchWeb(query: string, aiApiKey?: string): Promise<string> {
  let keys = aiApiKey ? [aiApiKey] : []
  if (keys.length === 0) {
    keys = await getProviderKeys('TAVILY')
  }
  const apiKey = keys[0] || await getVaultKey('TAVILY_API_KEY') || process.env.TAVILY_API_KEY
  if (!apiKey) {
    logger.error('TAVILY_API_KEY missing in vault')
    return 'Search feature is currently unavailable.'
  }

  try {
    const client = tavily({ apiKey })
    const results = await client.search(query, {
      searchDepth: 'advanced',
      maxResults: 5
    })

    const context = results.results.map(r => 
      `SOURCE: ${r.title}\nURL: ${r.url}\nCONTENT: ${r.content}`
    ).join('\n\n---\n\n')

    return context
  } catch (error: any) {
    logger.error('Tavily search failed:', error.message)
    return 'Search failed to retrieve results.'
  }
}

/**
 * Stage 2: Synthesis (Tavily Context -> AI Answer)
 */
export async function runWebSearchChain(prompt: string, context?: any): Promise<string> {
  logger.info(`Starting web search for: ${prompt}`)
  
  // 1. Get real-time data
  const contextData = await searchWeb(prompt, context?.aiApiKey)
  
  if (contextData.includes('unavailable') || contextData.includes('failed')) {
    return contextData
  }

  // 2. Synthesize answer using the next model in the router list
  const synthesisPrompt = `
You are Flowr AI with real-time web access. 
Use the following search results to answer the user's question. 
Be concise, accurate, and helpful.

CRITICAL Formatting Rule:
1. Do NOT embed or include any URLs, links, or parentheses containing URLs inside the main body text of your response. Keep all paragraphs and bullet points completely free of web links.
2. At the very end of your response, create a dedicated section starting with the phrase "**Sources:**" followed by a space.
3. List the unique source URLs used as clickable markdown links separated by spaces (e.g., [Source Name](url) [Source Name 2](url2)).

SEARCH RESULTS:
${contextData}

USER QUESTION:
${prompt}
`

  const { chain } = await getRouterChain('WEB_SEARCH')
  const tavilyIndex = chain.findIndex(m => m.id === 'tavily-search')
  let primaryModelId = 'gemini-2.5-flash'
  if (tavilyIndex !== -1 && chain[tavilyIndex + 1]) {
    primaryModelId = chain[tavilyIndex + 1].id
  }

  let answer: string | null = null
  const modelsToTry = [primaryModelId, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro']
  const uniqueModels = [...new Set(modelsToTry)]

  for (const m of uniqueModels) {
    try {
      const res = await runGoogle(m, synthesisPrompt, undefined, undefined, context)
      if (res) {
        answer = typeof res === 'object' ? res.content : res
        if (context?.setSynthesisModel) context.setSynthesisModel(m)
        break
      }
    } catch (e: any) {
      logger.warn(`Synthesis fallback failed for ${m}: ${e.message}`)
    }
  }
  
  return answer || "I found information but couldn't process a response. Please try again."
}
