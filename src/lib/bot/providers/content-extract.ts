import { logger } from '../../logger'
import { getProviderKeys, getVaultKey } from '../../vault'

export interface ExtractedPage {
  url: string
  title: string
  content: string
}

async function extractViaExa(urls: string[]): Promise<ExtractedPage[] | null> {
  const keys = await getProviderKeys('EXA')
  const apiKey = keys[0] || await getVaultKey('EXA_API_KEY') || process.env.EXA_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.exa.ai/contents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls, text: { maxCharacters: 20000 } }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data?.results || []).map((r: any) => ({
      url: r.url,
      title: r.title || '',
      content: r.text || '',
    }))
  } catch {
    return null
  }
}

async function extractViaTavily(urls: string[]): Promise<ExtractedPage[] | null> {
  const keys = await getProviderKeys('TAVILY')
  const apiKey = keys[0] || await getVaultKey('TAVILY_API_KEY') || process.env.TAVILY_API_KEY
  if (!apiKey) return null

  try {
    const { tavily } = await import('@tavily/core')
    const client = tavily({ apiKey })
    const results = await client.extract(urls)
    if (!results?.results) return null
    return results.results.map((r: any) => ({
      url: r.url,
      title: r.title || '',
      content: (r.content || r.rawContent || '').slice(0, 20000),
    }))
  } catch {
    return null
  }
}

async function extractViaFetch(urls: string[]): Promise<ExtractedPage[]> {
  const results: ExtractedPage[] = []

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

export async function extractContent(urls: string[], context?: any): Promise<ExtractedPage[]> {
  if (urls.length === 0) return []

  // Priority 1: Exa (best quality)
  const exaResult = await extractViaExa(urls)
  if (exaResult && exaResult.some(p => p.content)) {
    logger.info(`Content extracted via Exa for ${exaResult.filter(p => p.content).length}/${urls.length} URLs`)
    return exaResult
  }

  // Priority 2: Tavily
  const tavilyResult = await extractViaTavily(urls)
  if (tavilyResult && tavilyResult.some(p => p.content)) {
    logger.info(`Content extracted via Tavily for ${tavilyResult.filter(p => p.content).length}/${urls.length} URLs`)
    return tavilyResult
  }

  // Priority 3: Generic fetch (always works, no key needed)
  logger.info(`Extracting content via generic fetch for ${urls.length} URLs`)
  return extractViaFetch(urls)
}

export function formatExtractedPages(pages: ExtractedPage[]): string {
  if (pages.length === 0) return ''
  return pages
    .filter(p => p.content)
    .map(p =>
      `[EXTRACTED: ${p.title || p.url}]\nURL: ${p.url}\nCONTENT:\n${p.content}`
    )
    .join('\n\n---\n\n')
}
