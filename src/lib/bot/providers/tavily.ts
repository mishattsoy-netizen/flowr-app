import { tavily } from '@tavily/core'
import { getVaultKey } from '../../vault'
import { logger } from '../../logger'
import { runGoogle } from './google'

/**
 * Stage 1: Raw Web Search
 */
export async function searchWeb(query: string): Promise<string> {
  const apiKey = await getVaultKey('TAVILY_API_KEY')
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
export async function runWebSearchChain(prompt: string): Promise<string> {
  logger.info(`Starting web search for: ${prompt}`)
  
  // 1. Get real-time data
  const context = await searchWeb(prompt)
  
  if (context.includes('unavailable') || context.includes('failed')) {
    return context
  }

  // 2. Synthesize answer using Gemini Flash
  const synthesisPrompt = `
You are Flowr AI with real-time web access. 
Use the following search results to answer the user's question. 
Be concise, accurate, and cite URLs if possible.

SEARCH RESULTS:
${context}

USER QUESTION:
${prompt}
`
  // We use gemini-1.5-flash for synthesis as it's fast and has a large context window
  const answer = await runGoogle('gemini-1.5-flash', synthesisPrompt)
  
  return answer || "I found information but couldn't process a response. Please try again."
}
