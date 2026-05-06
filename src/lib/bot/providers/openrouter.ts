import { logger } from '../../logger'

export async function runOpenRouter(
  modelId: string,
  prompt: string,
  systemPrompt?: string,
  history: any[] = [],
  apiKey?: string
): Promise<string | null> {
  try {
    if (!apiKey) {
      throw new Error('OpenRouter API key is missing')
    }

    const messages: { role: string; content: string }[] = []
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }

    // Add conversation history (last 10 messages)
    const recentHistory = (history || []).slice(-10)
    for (const msg of recentHistory) {
      if (msg.role && msg.content) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    messages.push({ role: 'user', content: prompt })

    logger.info(`Routing text to OpenRouter model: ${modelId}`)

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://flowr.ai', // Optional but recommended by OpenRouter
        'X-Title': 'Flowr AI'
      },
      body: JSON.stringify({
        model: modelId,
        messages,
      })
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      throw new Error(`OpenRouter API ${response.status}: ${response.statusText} — ${errBody.slice(0, 200)}`)
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    const citations = data?.citations

    if (!content) {
      throw new Error('OpenRouter returned empty content')
    }

    if (citations && Array.isArray(citations) && citations.length > 0) {
      const citationText = citations.map((c: any, i: number) => `[${i + 1}] ${typeof c === 'string' ? c : c.url ?? JSON.stringify(c)}`).join('\n')
      return `${content}\n\n${citationText}`
    }

    return content
  } catch (error: any) {
    logger.error(`OpenRouter failure [${modelId}]:`, error.message)
    return null
  }
}
