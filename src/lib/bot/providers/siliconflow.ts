import { logger } from '../../logger'
import { getProviderKeys } from '../../vault'

/**
 * SiliconFlow Image Generation
 */
export async function runSiliconFlow(
  modelId: string,
  prompt: string,
  aiApiKey?: string
): Promise<Buffer | string | null> {
  let keys = aiApiKey ? [aiApiKey] : []
  if (keys.length === 0) {
    keys = await getProviderKeys('SILICONFLOW')
  }

  const token = keys[0]
  if (!token) {
    logger.error('No SiliconFlow keys found for image generation')
    return null
  }

  try {
    logger.info(`SiliconFlow Image Generation [${modelId}]: ${prompt.slice(0, 50)}...`)
    
    const response = await fetch('https://api.siliconflow.cn/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        prompt: prompt,
        batch_size: 1,
        // SiliconFlow standard sizes
        image_size: "1024x1024"
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`SiliconFlow Image API ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    const imageUrl = data?.images?.[0]?.url || data?.data?.[0]?.url
    
    if (!imageUrl) {
      throw new Error('SiliconFlow returned no image URL')
    }

    // If it's a base64 string already, return it (after cleaning)
    if (imageUrl.startsWith('data:image')) return imageUrl
    
    // Otherwise return the URL directly, chainRouter will handle it or we fetch it here
    return imageUrl
  } catch (error: any) {
    logger.error(`SiliconFlow Image [${modelId}] failed:`, error.message)
    return null
  }
}

/**
 * SiliconFlow Text Generation (OpenAI-compatible)
 */
export async function runSiliconFlowText(
  modelId: string,
  prompt: string,
  systemPrompt?: string,
  history: any[] = [],
  aiApiKey?: string
): Promise<string | null> {
  let keys = aiApiKey ? [aiApiKey] : []
  if (keys.length === 0) {
    keys = await getProviderKeys('SILICONFLOW')
  }

  if (keys.length === 0) {
    logger.error('No SiliconFlow keys found for text generation')
    return null
  }

  // Convert history to OpenAI format
  const historyMessages = (history || []).map((h: any) => ({
    role: h.role === 'model' ? 'assistant' : 'user',
    content: h.content || (h.parts?.[0]?.text) || ''
  })).filter(m => m.content)

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    try {
      const messages: { role: string; content: string }[] = []
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt })
      }
      messages.push(...historyMessages)
      messages.push({ role: 'user', content: prompt })

      const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          max_tokens: 4096,
          stream: false
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        const isKeyExhausted = response.status === 401 || response.status === 402 || response.status === 429
        if (isKeyExhausted && i < keys.length - 1) {
          logger.warn(`SiliconFlow key ${i+1} exhausted, trying next...`)
          continue
        }
        throw new Error(`SiliconFlow Text API ${response.status}: ${errText}`)
      }

      const data = await response.json()
      const content = data?.choices?.[0]?.message?.content
      if (!content) throw new Error('SiliconFlow returned empty content')

      return content
    } catch (error: any) {
      logger.error(`SiliconFlow Text [${modelId}] key ${i+1} failed:`, error.message)
      if (i === keys.length - 1) return null
    }
  }

  return null
}
