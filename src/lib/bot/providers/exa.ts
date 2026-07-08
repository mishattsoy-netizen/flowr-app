import { getVaultKey, getProviderKeys } from '../../vault'
import { logger } from '../../logger'
import { cleanSearchQuery } from './tavily'

export async function searchExa(query: string, context?: any): Promise<string | null> {
  let keys = context?.aiApiKey ? [context.aiApiKey] : []
  if (keys.length === 0) keys = await getProviderKeys('EXA')
  const apiKey = keys[0] || await getVaultKey('EXA_API_KEY') || process.env.EXA_API_KEY

  if (!apiKey) {
    logger.warn(`Exa search skipped: No API key found in vault or env.`)
    return null
  }

  const cleanQuery = cleanSearchQuery(query)
  logger.info(`Exa search: "${cleanQuery}" (original: "${query.slice(0, 60)}")`)

  try {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: cleanQuery,
        numResults: 5,
        type: 'auto',
        startPublishedDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        contents: { text: { maxCharacters: 2000 } },
      }),
      signal: context?.signal,
    })

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown error')
      logger.error(`Exa API error: ${res.status} — ${err.slice(0, 200)}`)
      return null
    }

    const data = await res.json()
    const results = data?.results
    if (!results || results.length === 0) {
      logger.info(`Exa returned 0 results for: "${query}"`)
      return null
    }

    return results.map((r: any) =>
      `SOURCE: ${r.title}\nURL: ${r.url}\nCONTENT: ${r.text || r.snippet || ''}\n\n[ ${r.title}](${r.url})`
    ).join('\n\n---\n\n')
  } catch (e: any) {
    logger.error(`Exa API error for "${query}": ${e.message}`)
    return null
  }
}

export async function extractExaUrls(urls: string[], context?: any): Promise<Array<{ url: string; title: string; content: string }>> {
  let keys = context?.aiApiKey ? [context.aiApiKey] : []
  if (keys.length === 0) keys = await getProviderKeys('EXA')
  const apiKey = keys[0] || await getVaultKey('EXA_API_KEY') || process.env.EXA_API_KEY

  if (!apiKey || urls.length === 0) return []

  logger.info(`Exa extracting ${urls.length} URLs`)

  try {
    const res = await fetch('https://api.exa.ai/contents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls }),
      signal: context?.signal,
    })

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown error')
      logger.error(`Exa extract error: ${res.status} — ${err.slice(0, 200)}`)
      return []
    }

    const data = await res.json()
    const results = data?.results
    if (!results) return []

    return results.map((r: any) => ({
      url: r.url,
      title: r.title || '',
      content: r.text || '',
    }))
  } catch (e: any) {
    logger.error(`Exa extract error: ${e.message}`)
    return []
  }
}

export async function runExaSearchChain(prompt: string, context?: any, systemPrompt?: string): Promise<string> {
  logger.info(`Starting Exa search for: ${prompt}`)

  const result = await searchExa(prompt, context)
  if (result) return `[SEARCH RESULTS FOR: ${prompt}]\n\n${result}`

  return 'Search failed to retrieve results.'
}
