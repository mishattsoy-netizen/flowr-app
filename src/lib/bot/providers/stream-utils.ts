import { logger } from '../../logger'

const STREAM_STALL_TIMEOUT_MS = 30_000
const CONNECTION_TIMEOUT_MS = 20_000

export function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (text: string) => void,
  stallTimeoutMs: number = STREAM_STALL_TIMEOUT_MS
): Promise<{ content: string; citations?: any[]; reasoning?: string; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } }> {
  const decoder = new TextDecoder()
  let sseBuffer = ''
  let fullContent = ''
  let fullReasoning = ''
  let citations: any[] | undefined
  let usage: any | undefined

  return new Promise((resolve, reject) => {
    let stallTimer: NodeJS.Timeout | null = null

    const resetStallTimer = () => {
      if (stallTimer) clearTimeout(stallTimer)
      stallTimer = setTimeout(() => {
        reader.cancel().catch(() => {})
        reject(new Error(`Stream stalled: no data for ${stallTimeoutMs}ms`))
      }, stallTimeoutMs)
    }

    const clearStallTimer = () => {
      if (stallTimer) {
        clearTimeout(stallTimer)
        stallTimer = null
      }
    }

    function pump(): void {
      reader.read().then(({ done, value }) => {
        if (done) {
          clearStallTimer()
          resolve({ content: fullContent, citations, reasoning: fullReasoning || undefined, usage })
          return
        }

        resetStallTimer()
        sseBuffer += decoder.decode(value, { stream: true })
        const parts = sseBuffer.split('\n')
        sseBuffer = parts.pop() || ''

        let isDone = false
        for (const line of parts) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            isDone = true
            break
          }
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta
            if (delta) {
              if (delta.content) {
                fullContent += delta.content
                onChunk(delta.content)
              }
              if (delta.reasoning) {
                fullReasoning += delta.reasoning
              }
            }
            if (parsed.citations) {
              citations = parsed.citations
            }
            if (parsed.usage) {
              usage = {
                prompt_tokens: parsed.usage.prompt_tokens,
                completion_tokens: parsed.usage.completion_tokens,
                total_tokens: parsed.usage.total_tokens,
                cache_read_input_tokens: parsed.usage.prompt_tokens_details?.cached_tokens ?? parsed.usage.cache_read_input_tokens,
                cache_creation_input_tokens: parsed.usage.cache_creation_input_tokens,
              }
            }
          } catch {
            // Skip malformed SSE lines
          }
        }

        if (isDone) {
          clearStallTimer()
          reader.cancel().catch(() => {})
          resolve({ content: fullContent, citations, reasoning: fullReasoning || undefined, usage })
          return
        }

        pump()
      }).catch((err) => {
        clearStallTimer()
        reject(err)
      })
    }

    resetStallTimer()
    pump()
  })
}

export async function streamOpenAICompatible(
  url: string,
  body: Record<string, any>,
  onChunk?: (text: string) => void,
  signal?: AbortSignal,
  extraHeaders?: Record<string, string>
): Promise<{ content: string; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }; reasoning?: string } | null> {
  const shouldStream = !!onChunk

  const requestBody = {
    ...body,
    stream: shouldStream || undefined,
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  }

  const connectController = new AbortController()
  const connectTimer = setTimeout(() => connectController.abort(), CONNECTION_TIMEOUT_MS)
  const onCallerAbort = () => connectController.abort()
  if (signal) signal.addEventListener('abort', onCallerAbort)

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: connectController.signal,
    })
  } catch (err: any) {
    if (signal) signal.removeEventListener('abort', onCallerAbort)
    clearTimeout(connectTimer)
    if (connectController.signal.aborted && !signal?.aborted) {
      throw new Error(`API connection timeout after ${CONNECTION_TIMEOUT_MS}ms: ${url}`)
    }
    throw err
  }
  clearTimeout(connectTimer)
  if (signal) signal.removeEventListener('abort', onCallerAbort)

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`API ${response.status}: ${errText.slice(0, 200)}`)
  }

  // Streaming
  if (shouldStream && response.body) {
    const reader = response.body.getReader()
    const { content, reasoning, usage } = await parseSSEStream(reader, onChunk)

    if (!content) {
      throw new Error('Stream returned empty content')
    }

    return { content, reasoning, usage }
  }

  // Non-streaming
  const data = await response.json()
  const choice = data?.choices?.[0]
  const msg = choice?.message

  if (!msg?.content) {
    throw new Error('API returned empty content')
  }

  const usage = data?.usage ? {
    prompt_tokens: data.usage.prompt_tokens,
    completion_tokens: data.usage.completion_tokens,
    total_tokens: data.usage.total_tokens,
  } : undefined

  return {
    content: msg.content,
    usage,
    reasoning: msg.reasoning || choice?.reasoning || undefined,
  }
}
