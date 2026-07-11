import { logger } from '../../logger'
import { getProviderKeys } from '../../vault'
import { detectMimeType } from '../image-utils'
import { parseSSEStream } from './stream-utils'
import { FLOWR_TOOLS } from '../tools/definitions'
import { toolHandlers } from '../tools/handlers'
import { toOpenRouterReasoning } from '../reasoning'
import { summarizeToolCalls } from '../services/toolSummary'

export async function runOpenRouter(
  modelId: string,
  prompt: string,
  systemPrompt?: string,
  history: any[] = [],
  aiApiKey?: string,
  context?: any,
  imageBuffers?: Buffer | Buffer[]
): Promise<{ content: string; provider?: string; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }; reasoning?: string; capturedToolCalls?: any[] } | null> {
  const normContext = typeof context === 'string' ? { openrouterProvider: context } : (context || {})
  logger.info(`[OpenRouter Audit] Entering runOpenRouter: model=${modelId}, provider=${normContext.openrouterProvider}, hasImages=${!!imageBuffers}`)
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

  const tools = FLOWR_TOOLS.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }))

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    try {
      if (normContext.openrouterProvider) {
        logger.info(`OpenRouter: Forcing provider routing to: ${normContext.openrouterProvider} (Key preview: ${key.substring(0, 10)}...)`)
      }

      const isAnthropic = modelId.startsWith('anthropic/')
      const messages: { role: string; content: any; cache_control?: any; tool_call_id?: string; tool_calls?: any }[] = []
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt,
          ...(isAnthropic ? { cache_control: { type: 'ephemeral' } } : {})
        })
      }
      messages.push(...historyMessages)
      let hasPdf = false
      if (imageBuffers) {
        const buffers = Array.isArray(imageBuffers) ? imageBuffers : [imageBuffers]
        const contentParts: any[] = [{ type: 'text', text: prompt }]

        for (const buf of buffers) {
          const mime = detectMimeType(buf)
          if (mime === 'application/pdf') {
            hasPdf = true
            contentParts.push({
              type: 'image_url',
              image_url: { url: `data:application/pdf;base64,${buf.toString('base64')}` }
            })
          } else {
            contentParts.push({
              type: 'image_url',
              image_url: { url: `data:${mime};base64,${buf.toString('base64')}` }
            })
          }
        }

        messages.push({
          role: 'user',
          content: contentParts
        } as any)
      } else {
        messages.push({ role: 'user', content: prompt })
      }

      const resolvedSessionId = normContext.sessionId 
        || normContext.activeChatId 
        || normContext.chatId 
        || normContext.activeEntityId 
        || undefined

      const fetchHeaders: Record<string, string> = {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://flowr.ai',
        'X-Title': 'Flowr AI'
      }
      if (isAnthropic) {
        fetchHeaders['anthropic-beta'] = 'prompt-caching-2025-01-17'
      }

      // Tool-calling path: non-streaming due to tool loop
      if (normContext.useTools) {
        const MAX_TOOL_HOPS = 4
        let hops = 0
        const capturedToolCalls: any[] = []

        while (hops < MAX_TOOL_HOPS) {
          const toolRequestBody: any = {
            model: modelId,
            messages,
            tools,
            tool_choice: 'auto',
            max_tokens: normContext.max_tokens || 5000,
          }

          if (typeof normContext.temperature === 'number') {
            toolRequestBody.temperature = normContext.temperature
          }
          const orReasoning = toOpenRouterReasoning(normContext.thinkingBudget)
          if (orReasoning) {
            Object.assign(toolRequestBody, orReasoning)
          }

          if (resolvedSessionId) {
            toolRequestBody.session_id = String(resolvedSessionId)
          }
          if (normContext.openrouterProvider) {
            toolRequestBody.provider = {
              order: [(normContext.openrouterProvider || '').trim()],
              allow_fallbacks: true
            }
          }

          // Redact base64 image data from log to keep terminal readable
          if (process.env.NODE_ENV !== 'production') {
            const logBody = JSON.parse(JSON.stringify(toolRequestBody))
            if (Array.isArray(logBody.messages)) {
              for (const msg of logBody.messages) {
                if (typeof msg.content === 'string') {
                  msg.content = msg.content.replace(/data:(image|application)\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[base64 data redacted]')
                } else if (Array.isArray(msg.content)) {
                  for (const part of msg.content) {
                    if (part?.image_url?.url?.startsWith('data:')) {
                      part.image_url.url = '[base64 data redacted]'
                    }
                  }
                }
              }
            }
            console.log(`[DEBUG openrouter.ts] TOOL PAYLOAD:`, JSON.stringify(logBody, null, 2));
          }

          const response = await fetch(`https://openrouter.ai/api/v1/chat/completions?cb=${Date.now()}`, {
            method: 'POST',
            headers: fetchHeaders,
            body: JSON.stringify(toolRequestBody),
            signal: normContext.signal,
          })

          const actualProvider = response.headers.get('x-openrouter-provider') || undefined

          if (response.status === 429) {
            logger.warn(`OpenRouter [${modelId}] key index ${i + 1} rate limited (429) — trying next key`)
            break
          }

          if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            const errBody = JSON.stringify(err.error || err)
            if (normContext.openrouterProvider && (response.status === 400 || response.status === 404 || response.status === 422 || response.status === 403) && (errBody.toLowerCase().includes('provider') || errBody.toLowerCase().includes('allow'))) {
              logger.warn(`OpenRouter: Forced provider "${normContext.openrouterProvider}" failed in tool-calling path — retrying without provider constraint`)
              const retryContext = { ...normContext }
              delete retryContext.openrouterProvider
              return runOpenRouter(modelId, prompt, systemPrompt, history, key, retryContext, imageBuffers)
            }
            throw new Error(err.error?.message || `OpenRouter API Error: ${response.status}`)
          }

          const data = await response.json()
          const message = data.choices?.[0]?.message
          if (!message) throw new Error('OpenRouter returned empty response')

          messages.push(message)

          if (message.tool_calls && message.tool_calls.length > 0) {
            hops++
            for (const call of message.tool_calls) {
              const handler = toolHandlers[call.function.name]
              let output = { error: 'Tool not found' }

              if (handler) {
                try {
                  const args = JSON.parse(call.function.arguments)
                  output = await handler(args, normContext)
                  if (([] as string[]).includes(call.function.name)) {
                    capturedToolCalls.push({ ...args, ...output, tool: call.function.name })
                  } else {
                    capturedToolCalls.push({ ...args, ...output, tool: call.function.name, success: !output?.error })
                  }
                } catch (e: any) {
                  output = { error: e.message }
                }
              }

              messages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(output)
              })
            }
            if (normContext?.onEvent) {
              normContext.onEvent({ toolResults: capturedToolCalls })
            }
          } else {
            // No more tool calls — return final response
            const usage = data?.usage ? {
              prompt_tokens: data.usage.prompt_tokens,
              completion_tokens: data.usage.completion_tokens,
              total_tokens: data.usage.total_tokens,
            } : undefined

            let finalContent = message.content || ''
            if (!finalContent && capturedToolCalls.length > 0) {
              finalContent = summarizeToolCalls(capturedToolCalls)
            }

            return {
              content: finalContent,
              provider: actualProvider,
              usage,
              reasoning: message.reasoning || undefined,
              capturedToolCalls: capturedToolCalls.length > 0 ? capturedToolCalls : undefined,
            } as any
          }
        }
        // If we exhausted tool hops, fall through to next key
        continue
      }

      const shouldStream = !!(normContext.onChunk) && !normContext._skipStreaming
      const requestBody: any = {
        model: modelId,
        messages,
        max_tokens: normContext.max_tokens || 5000,
        stream: shouldStream || undefined,
      }

      if (typeof normContext.temperature === 'number') {
        requestBody.temperature = normContext.temperature
      }
      const orReasoning = toOpenRouterReasoning(normContext.thinkingBudget)
      if (orReasoning) {
        Object.assign(requestBody, orReasoning)
      }

      if (resolvedSessionId) {
        requestBody.session_id = String(resolvedSessionId)
      }

      if (hasPdf) {
        requestBody.plugins = [
          { id: 'file-parser', pdf: { engine: 'cloudflare-ai' } }
        ]
      }

      if (normContext.openrouterProvider) {
        const forcedSlug = (normContext.openrouterProvider || '').trim()
        logger.info(`OpenRouter: Dynamic routing requested for provider: "${forcedSlug}" (Key preview: ${key.substring(0, 10)}...)`)

        requestBody.provider = {
          order: [forcedSlug],
          allow_fallbacks: true
        }
      }

      // Redact base64 image data from log to keep terminal readable
      if (process.env.NODE_ENV !== 'production') {
        const logBody = JSON.parse(JSON.stringify(requestBody))
        if (Array.isArray(logBody.messages)) {
          for (const msg of logBody.messages) {
            if (typeof msg.content === 'string') {
              msg.content = msg.content.replace(/data:(image|application)\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[base64 data redacted]')
            } else if (Array.isArray(msg.content)) {
              for (const part of msg.content) {
                if (part?.image_url?.url?.startsWith('data:')) {
                  part.image_url.url = '[base64 data redacted]'
                }
              }
            }
          }
        }
        console.log(`[DEBUG openrouter.ts] PAYLOAD:`, JSON.stringify(logBody, null, 2));
      }

      logger.info(`OpenRouter: Preparing request for model ${modelId} with provider type: ${typeof normContext.openrouterProvider}, value: "${normContext.openrouterProvider}"`)

      const response = await fetch(`https://openrouter.ai/api/v1/chat/completions?cb=${Date.now()}`, {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify(requestBody),
        signal: normContext.signal,
      })

      const actualProvider = response.headers.get('x-openrouter-provider') || undefined
      if (actualProvider) {
        logger.info(`OpenRouter: Response received from provider: ${actualProvider}`)
      }

      // Non-OK: handle errors, including streaming-not-supported fallback
      if (!response.ok) {
        let errBody = ''
        try {
          const errData = await response.json()
          errBody = JSON.stringify(errData.error || errData)
        } catch {
          errBody = await response.text()
        }

        // Forced provider not allowed/available — retry without provider constraint
        if (normContext.openrouterProvider && (response.status === 400 || response.status === 404 || response.status === 422 || response.status === 403) && (errBody.toLowerCase().includes('provider') || errBody.toLowerCase().includes('allow'))) {
          logger.warn(`OpenRouter: Forced provider "${normContext.openrouterProvider}" failed — retrying without provider constraint`)
          const retryContext = { ...normContext }
          delete retryContext.openrouterProvider
          return runOpenRouter(modelId, prompt, systemPrompt, history, key, retryContext, imageBuffers)
        }

        // Streaming not supported by model — retry without streaming on same key
        if (shouldStream && (response.status === 400 || response.status === 422) && errBody.toLowerCase().includes('stream')) {
          logger.info(`Model ${modelId} does not support streaming — retrying without stream`)
          const retryContext = { ...normContext, _skipStreaming: true }
          return runOpenRouter(modelId, prompt, systemPrompt, history, key, retryContext, imageBuffers)
        }

        const isKeyExhausted = response.status === 401 || response.status === 402 || response.status === 403
        const prefix = isKeyExhausted ? 'KEY_EXHAUSTED:' : ''
        const errorMsg = `${prefix}OpenRouter API ${response.status}: ${response.statusText} — ${errBody.slice(0, 200)}`

        if (isKeyExhausted) {
          logger.warn(`OpenRouter key index ${i + 1} exhausted (${response.status}). Trying next if available...`)
          if (i === keys.length - 1) throw new Error(errorMsg)
          continue
        }

        throw new Error(errorMsg)
      }

      // Streaming response
      if (shouldStream && response.body) {
        const reader = response.body.getReader()
        const { content: streamedContent, citations, reasoning: streamedReasoning, usage: streamedUsage } = await parseSSEStream(reader, normContext.onChunk)

        if (!streamedContent) {
          throw new Error('OpenRouter returned empty streamed content')
        }

        let finalContent = streamedContent
        if (citations && Array.isArray(citations) && citations.length > 0) {
          const citationText = citations.map((c: any, i: number) => `[${i + 1}] ${typeof c === 'string' ? c : c.url ?? JSON.stringify(c)}`).join('\n')
          finalContent = `${streamedContent}\n\n${citationText}`
        }

        return { content: finalContent, provider: actualProvider, reasoning: streamedReasoning, usage: streamedUsage }
      }

      // Non-streaming response
      const data = await response.json()
      const msg = data?.choices?.[0]?.message
      const content = msg?.content
      const citations = data?.citations
      const usage = data?.usage
      const reasoning = msg?.reasoning

      if (!content) {
        throw new Error('OpenRouter returned empty content')
      }

      let finalContent = content
      if (citations && Array.isArray(citations) && citations.length > 0) {
        const citationText = citations.map((c: any, i: number) => `[${i + 1}] ${typeof c === 'string' ? c : c.url ?? JSON.stringify(c)}`).join('\n')
        finalContent = `${content}\n\n${citationText}`
      }

      return {
        content: finalContent,
        provider: actualProvider,
        usage: usage ? {
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens,
          cache_read_input_tokens: usage.cache_read_input_tokens,
          cache_creation_input_tokens: usage.cache_creation_input_tokens,
        } : undefined,
        reasoning: reasoning || undefined,
      }
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




