import { logger } from '../../logger' // Heartbeat update to force recompile
import { getProviderKeys } from '../../vault'

export async function runOpenRouter(
  modelId: string,
  prompt: string,
  systemPrompt?: string,
  history: any[] = [],
  aiApiKey?: string,
  openrouterProvider?: string,
  imageBuffers?: Buffer | Buffer[]
): Promise<{ content: string; provider?: string } | null> {
  logger.info(`[OpenRouter Audit] Entering runOpenRouter: model=${modelId}, provider=${openrouterProvider}, hasImages=${!!imageBuffers}`)
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
        logger.info(`OpenRouter: Forcing provider routing to: ${openrouterProvider} (Key preview: ${key.substring(0, 10)}...)`)
      }

      const messages: { role: string; content: any }[] = []
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt })
      }
      messages.push(...historyMessages)
      if (imageBuffers) {
        const buffers = Array.isArray(imageBuffers) ? imageBuffers : [imageBuffers]
        const contentParts: any[] = [{ type: 'text', text: prompt }]

        for (const buf of buffers) {
          contentParts.push({
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${buf.toString('base64')}` }
          })
        }

        messages.push({
          role: 'user',
          content: contentParts
        } as any)
      } else {
        messages.push({ role: 'user', content: prompt })
      }

      // Build request body with optional provider routing
      const requestBody: any = {
        model: modelId,
        messages,
        max_tokens: 5000,
      }

      if (openrouterProvider) {
        const forcedSlug = (openrouterProvider || '').trim()
        logger.info(`OpenRouter: Dynamic routing requested for provider: "${forcedSlug}" (Key preview: ${key.substring(0, 10)}...)`)

        // Force specific provider as selected in the UI
        requestBody.provider = {
          order: [forcedSlug],
          allow_fallbacks: true
        }
      }

      console.log(`[DEBUG openrouter.ts] FULL PAYLOAD:`, JSON.stringify(requestBody, null, 2));

      logger.info(`OpenRouter: Preparing request for model ${modelId} with provider type: ${typeof openrouterProvider}, value: "${openrouterProvider}"`)

      const response = await fetch(`https://openrouter.ai/api/v1/chat/completions?cb=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://flowr.ai',
          'X-Title': 'Flowr AI'
        },
        body: JSON.stringify(requestBody),
      })

      // Capture actual provider from headers if available
      const actualProvider = response.headers.get('x-openrouter-provider') || undefined
      if (actualProvider) {
        logger.info(`OpenRouter: Response received from provider: ${actualProvider}`)
      }

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

      let finalContent = content
      if (citations && Array.isArray(citations) && citations.length > 0) {
        const citationText = citations.map((c: any, i: number) => `[${i + 1}] ${typeof c === 'string' ? c : c.url ?? JSON.stringify(c)}`).join('\n')
        finalContent = `${content}\n\n${citationText}`
      }

      return { content: finalContent, provider: actualProvider }
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
