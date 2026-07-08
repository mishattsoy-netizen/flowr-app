import { logger } from '../../logger'

export async function extractDuckDuckGoUrls(urls: string[]): Promise<Array<{ url: string; title: string; content: string }>> {
  if (urls.length === 0) return []
  const results: Array<{ url: string; title: string; content: string }> = []

  for (const url of urls.slice(0, 5)) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlowrBot/1.0)' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue
      const html = await res.text()
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const title = titleMatch ? titleMatch[1].trim() : ''
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
      let bodyText = bodyMatch ? bodyMatch[1] : html
      bodyText = bodyText
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 10000)
      results.push({ url, title, content: bodyText })
    } catch {
      results.push({ url, title: '', content: '' })
    }
  }

  return results
}

import { cleanSearchQuery } from './tavily'

export async function runDuckDuckGoSearchChain(prompt: string, _context?: any, systemPrompt?: string): Promise<string> {
  const cleanQuery = cleanSearchQuery(prompt)
  logger.info(`Starting DuckDuckGo search for: ${cleanQuery} (original: ${prompt.slice(0, 60)})`)
  if (systemPrompt) {
    logger.info(`DuckDuckGo search received system prompt instructions (length: ${systemPrompt.length})`)
  }

  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`
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

    if (!results.length) {
      logger.warn(`DuckDuckGo Instant Answer returned no results for: ${prompt}`)
      return 'DuckDuckGo Instant Answer was unable to find a direct summary for this query. Falling back to next provider.'
    }

    return `[DUCKDUCKGO INSTANT ANSWER FOR: ${prompt}]\n\n${results.join('\n\n---\n\n')}`
  } catch (error: any) {
    logger.error('DuckDuckGo search failed:', error.message)
    return 'Search failed to retrieve results.'
  }
}
