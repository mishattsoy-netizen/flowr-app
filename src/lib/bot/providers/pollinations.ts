import { logger } from '../../logger'

export async function runPollinations(prompt: string, model?: string): Promise<Buffer | null> {
  try {
    const seed = Math.floor(Math.random() * 1000000)
    let url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&width=1024&height=1024&nologo=true`
    
    if (model) {
      url += `&model=${encodeURIComponent(model)}`
    }
    
    logger.info(`Generating image via Pollinations [${model || 'default'}]: ${url}`)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Pollinations failed: ${response.statusText}`)
    
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error: any) {
    logger.error('Pollinations image generation failed:', error.message)
    return null
  }
}

export async function runPollinationsText(
  modelId: string,
  prompt: string,
  systemPrompt?: string,
  history: any[] = [],
  apiKey?: string
): Promise<string | null> {
  try {
    const messages: { role: string; content: string }[] = []
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
    
    // Add conversation history (last 10 messages)
    const recentHistory = (history || []).slice(-10)
    for (const msg of recentHistory) {
      if (msg.role && msg.content) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }
    
    messages.push({ role: 'user', content: prompt })

    logger.info(`Routing text to Pollinations model: ${modelId}`)
    
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    // Using the unified endpoint which is more robust
    const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId,
        messages,
        seed: Math.floor(Math.random() * 1000000)
      })
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      // Log for local debugging
      console.error('POLLINATIONS ERROR:', response.status, errBody)
      throw new Error(`Pollinations Text API ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    
    if (!content) {
      throw new Error('Pollinations returned empty content')
    }

    return content
  } catch (error: any) {
    logger.error(`Pollinations Text failure [${modelId}]:`, error.message)
    return null
  }
}
