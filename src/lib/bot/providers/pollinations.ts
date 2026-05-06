import { logger } from '../../logger'

const POLLINATIONS_TIMEOUT_MS = 30000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ])
}

export async function runPollinations(prompt: string, model?: string): Promise<Buffer | null> {
  try {
    const seed = Math.floor(Math.random() * 1000000)
    let url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&width=1024&height=1024&nologo=true`
    if (model) url += `&model=${encodeURIComponent(model)}`

    logger.info(`Generating image via Pollinations [${model || 'default'}]: ${url}`)
    const response = await withTimeout(fetch(url), POLLINATIONS_TIMEOUT_MS, `Pollinations image [${model}]`)
    if (!response.ok) throw new Error(`Pollinations image ${response.status}: ${response.statusText}`)

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error: any) {
    logger.error(`Pollinations image [${model}] failed: ${error.message}`)
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

    const recentHistory = (history || []).slice(-10)
    for (const msg of recentHistory) {
      if (msg.role && msg.content) messages.push({ role: msg.role, content: msg.content })
    }
    messages.push({ role: 'user', content: prompt })

    logger.info(`Routing text to Pollinations model: ${modelId}`)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const response = await withTimeout(
      fetch('https://gen.pollinations.ai/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: modelId, messages, seed: Math.floor(Math.random() * 1000000) })
      }),
      POLLINATIONS_TIMEOUT_MS,
      `Pollinations text [${modelId}]`
    )

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      throw new Error(`Pollinations text [${modelId}] ${response.status}: ${response.statusText} — ${errBody}`)
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) throw new Error(`Pollinations [${modelId}] returned empty content`)

    return content
  } catch (error: any) {
    logger.error(`Pollinations text [${modelId}] failed: ${error.message}`)
    return null
  }
}
