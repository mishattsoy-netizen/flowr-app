import { logger } from '../../logger'
import { getProviderKeys } from '../../vault'

export async function runOpenRouter(
  modelId: string,
  prompt: string,
  systemPrompt?: string,
  history: any[] = [],
  aiApiKey?: string,
  openrouterProvider?: string
): Promise<string | null> {
  let keys = aiApiKey ? [aiApiKey] : []

  if (keys.length === 0) {
    keys = await getProviderKeys('OPENROUTER')
  }

  if (keys.length === 0) {
    logger.error('No OpenRouter keys found (vault or provided)')
    throw new Error('KEY_EXHAUSTED: No OpenRouter keys found')
  }

  // Convert Gemini-format history to OpenAI format
  const historyMessages = (history || []).map((h: any) => ({
    role: h.role === 'model' ? 'assistant' : 'user',
    content: h.content || (h.parts?.[0]?.text) || ''
  })).filter(m => m.content)

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    try {
      if (openrouterProvider) {
        logger.info(`OpenRouter: Forcing provider routing to: ${openrouterProvider}`)
      }

      const messages: { role: string; content: string }[] = []
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt })
      }
      messages.push(...historyMessages)
      messages.push({ role: 'user', content: prompt })

      // Build request body with optional provider routing
      const requestBody: any = {
        model: modelId,
        messages,
        max_tokens: 5000,
      }
      if (openrouterProvider) {
        requestBody.provider = { order: [openrouterProvider], allow_fallbacks: true }
        console.log(`[DEBUG openrouter.ts] SENDING provider routing:`, JSON.stringify(requestBody.provider), `| model:`, modelId);
      } else {
        console.log(`[DEBUG openrouter.ts] NO provider routing set | model:`, modelId);
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://flowr.ai',
          'X-Title': 'Flowr AI'
        },
        body: JSON.stringify(requestBody),
      })

      const status = response.status
      if (status !== 200) {
        let errBody = ''
        try {
          const errData = await response.json()
          errBody = JSON.stringify(errData.error || errData)
        } catch {
          errBody = await response.text()
        }

        const isKeyExhausted = status === 401 || status === 402 || status === 403
        const prefix = isKeyExhausted ? 'KEY_EXHAUSTED:' : ''
        const errorMsg = `${prefix}OpenRouter API ${status}: ${response.statusText} — ${errBody.slice(0, 200)}`
        
        if (isKeyExhausted) {
          logger.warn(`OpenRouter key index ${i + 1} exhausted (${status}). Trying next if available...`)
          if (i === keys.length - 1) throw new Error(errorMsg)
          continue // Try next key
        }
        
        throw new Error(errorMsg)
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
      const isExhausted = error.message.includes('KEY_EXHAUSTED:')
      logger.error(`OpenRouter failure [${modelId}] key ${i + 1}:`, error.message)
      
      if (isExhausted && i < keys.length - 1) {
        continue
      }
      throw error
    }
  }

  return null
}
