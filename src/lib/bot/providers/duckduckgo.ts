import { logger } from '../../logger'
import { getRouterChain } from '../../router-config'
import { runGoogle } from './google'

export async function searchDuckDuckGo(query: string): Promise<string> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) throw new Error(`DuckDuckGo API responded with ${res.status}`)
    const data = await res.json()

    const results: string[] = []

    if (data.AbstractText) {
      results.push(`SOURCE: DuckDuckGo Abstract\nURL: ${data.AbstractURL || 'No URL'}\nCONTENT: ${data.AbstractText}`)
    }

    for (const topic of (data.RelatedTopics || []).slice(0, 5)) {
      if (topic.Text && topic.FirstURL) {
        results.push(`SOURCE: DuckDuckGo Topic\nURL: ${topic.FirstURL}\nCONTENT: ${topic.Text}`)
      }
    }

    if (data.Answer) {
      results.push(`SOURCE: DuckDuckGo Answer\nCONTENT: ${data.Answer}`)
    }

    return results.join('\n\n---\n\n')
  } catch (error: any) {
    logger.error('DuckDuckGo search failed:', error.message)
    return 'Search failed to retrieve results from DuckDuckGo.'
  }
}

export async function runDuckDuckGoSearchChain(prompt: string, context?: any): Promise<string> {
  logger.info(`Starting DuckDuckGo search for: ${prompt}`)
  const contextData = await searchDuckDuckGo(prompt)

  if (!contextData || contextData.includes('failed')) {
    return contextData || 'Search failed.'
  }

  const synthesisPrompt = `
You are Flowr AI with real-time web access via DuckDuckGo. 
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
  const duckIndex = chain.findIndex(m => m.id === 'duckduckgo-search')
  let primaryModelId = 'gemini-2.5-flash'
  if (duckIndex !== -1 && chain[duckIndex - 1]) {
    primaryModelId = chain[duckIndex - 1].id
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

  return answer || "I found information but couldn't process a response from DuckDuckGo. Please try again."
}
