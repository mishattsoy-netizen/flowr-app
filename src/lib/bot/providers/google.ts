import { GoogleGenerativeAI } from '@google/generative-ai'
import { getProviderKeys } from '../../vault'
import { logger } from '../../logger'
import { FLOWR_TOOLS } from '../tools/definitions'
import { toolHandlers } from '../tools/handlers'
import { detectMimeType } from '../image-utils'
import { toGeminiThinkingBudget } from '../reasoning'


// Per-key concurrency semaphore: serializes API calls per key to avoid rate-limit storms
const keyQueues = new Map<string, Array<() => void>>()

function runNext(key: string): void {
  const queue = keyQueues.get(key)
  if (!queue) return
  queue.shift()
  if (queue.length > 0) {
    queue[0]()
  } else {
    keyQueues.delete(key)
  }
}

async function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const execute = () => {
      fn().then(resolve, reject).finally(() => runNext(key))
    }
    const queue = keyQueues.get(key)
    if (!queue || queue.length === 0) {
      keyQueues.set(key, [execute])
      execute()
    } else {
      queue.push(execute)
    }
  })
}

const GOOGLE_TIMEOUT_MS = 60000
const GOOGLE_TIMEOUT_MS_GEMMA4 = 120000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Google API timeout after ${ms}ms`)), ms))
  ])
}

function withSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'))
      else signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })
  ])
}

export async function runGoogle(
  modelId: string,
  prompt: string,
  systemPrompt?: string,
  imageBuffers?: Buffer | Buffer[],
  context?: { chatId?: number; userId?: string; aiApiKey?: string; platform?: string; useTools?: boolean; useGrounding?: boolean; temperature?: number; max_tokens?: number; usedKeyIndex?: number; thinkingBudget?: string | number },
  history: any[] = []
): Promise<string | { content: string; citations?: string[]; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }; reasoning?: string; capturedToolCalls?: any[] } | null> {
  let keys = context?.aiApiKey ? [context.aiApiKey] : []

  if (keys.length === 0) {
    keys = await getProviderKeys('GEMINI')
  }

  if (keys.length === 0) {
    logger.error('No Gemini keys found (vault or provided)')
    return null
  }

  if (!prompt) {
    logger.error(`Google provider [${modelId}]: received empty prompt — no fallback configured`)
    return null
  }

  const imageBufferArray = Array.isArray(imageBuffers) ? imageBuffers : (imageBuffers ? [imageBuffers] : [])
  const activeTimeout = (modelId.toLowerCase().includes('gemma-4') && imageBufferArray.length > 0) ? GOOGLE_TIMEOUT_MS_GEMMA4 : GOOGLE_TIMEOUT_MS
  const temperature = context?.temperature ?? 0.7

  let lastError: Error | null = null
  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const key = keys[keyIndex]
    if (!key) continue

    let forceLegacy = sanitizedIdIsLegacy(modelId)
    let retryCount = 0

    while (retryCount < 2) {
      retryCount++
      try {
        if (context) context.usedKeyIndex = keyIndex + 1
        
        const genAI = new GoogleGenerativeAI(key)
        const sanitizedId = modelId.split('/').pop() || modelId
        
        const isGemma4 = sanitizedId.toLowerCase().includes('gemma-4')
        const isLegacyGemma = sanitizedId.toLowerCase().includes('gemma') && !isGemma4
        
        let useSystemInstruction = !isLegacyGemma && !forceLegacy
        let finalPrompt = prompt
        
        // Legacy fallback: Prepend system instructions
        if ((isLegacyGemma || forceLegacy) && systemPrompt) {
          finalPrompt = `System Instructions:\n${systemPrompt}\n\nUser Request: ${finalPrompt}`
        }

        // Grounding (Google Search) and function calling are mutually exclusive — grounding wins for WEB_SEARCH.
        const useGrounding = context?.useGrounding && useSystemInstruction && !isLegacyGemma
        const useFunctionTools = !useGrounding && context?.useTools && useSystemInstruction
        // Tool shape differs by model generation: 1.5 models use `googleSearchRetrieval`,
        // 2.0+ (2.x / 3.x) models require `googleSearch`. Sending the wrong shape makes the
        // API silently ignore grounding — the model then answers from training and fabricates
        // citations to satisfy the "cite every block" prompt rule.
        const isLegacyGroundingModel = /gemini-1\.5/.test(sanitizedId)
        const groundingTool = isLegacyGroundingModel
          ? { googleSearchRetrieval: {} }
          : { googleSearch: {} }
        const toolsConfig = useGrounding
          ? { tools: [groundingTool as any] }
          : useFunctionTools
            ? { tools: [{ functionDeclarations: FLOWR_TOOLS as any }] }
            : {}

        const lockResult = await withKeyLock(key!, async () => {
          const generationConfig: any = {
            temperature: temperature,
            maxOutputTokens: context?.max_tokens || 4096,
          }
          const geminiBudget = toGeminiThinkingBudget(context?.thinkingBudget)
          if (typeof geminiBudget === 'number' && geminiBudget > 0) {
            generationConfig.thinkingConfig = {
              thinkingBudget: geminiBudget,
            }
          }

          const m = genAI.getGenerativeModel({
            model: sanitizedId,
            systemInstruction: useSystemInstruction ? systemPrompt : undefined,
            generationConfig,
            ...toolsConfig,
          }, {
            apiVersion: forceLegacy ? 'v1' : 'v1beta',
          })

          logger.info(`[runGoogle] Payload for ${sanitizedId} (Key ${keyIndex + 1}): temp=${temperature}, maxTokens=${context?.max_tokens || 4096}, sysInst=${useSystemInstruction && !!systemPrompt}, ground=${useGrounding}, tools=${useFunctionTools}, apiVer=${forceLegacy ? 'v1' : 'v1beta'}, images=${imageBufferArray.length}, history=${history?.length || 0}`)

          const pts: any[] = []
          for (const buf of imageBufferArray) {
            pts.push({
              inlineData: {
                data: buf.toString('base64'),
                mimeType: detectMimeType(buf),
              },
            })
          }
          if (finalPrompt.trim() === '') {
             logger.error(`[DEBUG] finalPrompt is entirely empty or whitespace: "${finalPrompt}"`);
          } else {
             logger.info(`[DEBUG] finalPrompt is not empty. Length: ${finalPrompt.length}, Content: "${finalPrompt}"`);
          }
          pts.push({ text: finalPrompt })

          let rslt: any
          let responseContent = ''
          let capturedToolCalls: any[] = []
          let usage: any = undefined
          let reasoning: string | undefined = undefined

          const hasStreaming = !!(context as any)?.onChunk
          const onChunk = (context as any)?.onChunk

          // Streaming path (no function-tool calling). Grounding is allowed here.
          if (hasStreaming && !useFunctionTools) {
            let streamResult: any
            if (history && history.length > 0) {
              const safeHistory: any[] = []
              for (const msg of history) {
                const expectedRole = safeHistory.length % 2 === 0 ? 'user' : 'model'
                if (msg.role === expectedRole) safeHistory.push(msg)
              }
              if (safeHistory.length % 2 !== 0) safeHistory.pop()

              const chat = m.startChat({ history: safeHistory })
              logger.info(`[runGoogle] Stream Chat to ${sanitizedId} (Key ${keyIndex + 1}, Hist ${safeHistory.length}${useGrounding ? ', grounded' : ''})`)
              streamResult = await withSignal(chat.sendMessageStream(pts), (context as any)?.signal)
            } else {
              logger.info(`[runGoogle] Stream Content for ${sanitizedId} (Key ${keyIndex + 1}${useGrounding ? ', grounded' : ''})`)
              streamResult = await withSignal(m.generateContentStream({ contents: [{ role: 'user', parts: pts }] }), (context as any)?.signal)
            }
            for await (const chunk of streamResult.stream) {
              const chunkText = chunk.text()
              if (chunkText) {
                responseContent += chunkText
                onChunk(chunkText)
              }
              usage = extractUsage(chunk) || usage
              reasoning = extractReasoning(chunk) || reasoning
            }

            // Pull grounding citations from the aggregated final response.
            let citations: string[] | undefined
            try {
              const finalResp = await streamResult.response
              citations = extractCitations(finalResp)
            } catch { /* citations optional */ }

            logger.info(`[runGoogle] Stream complete for ${sanitizedId} (Key ${keyIndex + 1}): contentLen=${responseContent.length}${citations ? `, citations=${citations.length}` : ''}`)
            if (!responseContent) {
              const err = new Error(`Stream produced empty content for ${sanitizedId} (Key ${keyIndex + 1}) — likely silent quota/safety failure`)
              logger.error(`[runGoogle] ${err.message}`)
              throw err
            }
            return { content: responseContent, usage, reasoning, capturedToolCalls, citations }
          }

          const safeHistory: any[] = []
          if (history && history.length > 0) {
            for (const msg of history) {
              const expectedRole = safeHistory.length % 2 === 0 ? 'user' : 'model'
              if (msg.role === expectedRole) safeHistory.push(msg)
            }
            if (safeHistory.length % 2 !== 0) safeHistory.pop()
          }

          const chat = m.startChat({ history: safeHistory })
          logger.info(`[runGoogle] Chat to ${sanitizedId} (Key ${keyIndex + 1}, Hist ${safeHistory.length}${useGrounding ? ', grounded' : ''})`)
          rslt = await withSignal(withTimeout(chat.sendMessage(pts), activeTimeout), (context as any)?.signal)

          // Tool Handling
          let currentResponse = rslt.response
          const MAX_TOOL_HOPS = 4
          let hops = 0

          while (currentResponse.functionCalls() && currentResponse.functionCalls().length > 0 && hops < MAX_TOOL_HOPS) {
            hops++
            const toolCalls = currentResponse.functionCalls()
            const toolResults = []
            for (const call of toolCalls) {
              const handler = toolHandlers[call.name]
              if (handler) {
                const output = await (handler as any)(call.args, context)
                toolResults.push({ functionResponse: { name: call.name, response: output } })
                if (([] as string[]).includes(call.name)) {
                  capturedToolCalls.push({ ...call.args, ...output, tool: call.name })
                } else {
                  capturedToolCalls.push({ ...call.args, ...output, tool: call.name, success: !output?.error })
                }
              }
            }
            rslt = await withSignal(chat.sendMessage(toolResults), (context as any)?.signal)
            currentResponse = rslt.response
          }
          
          try {
            responseContent = currentResponse.text()
          } catch (e) {
            logger.warn(`[runGoogle] Could not extract text from final tool response (might be empty).`)
            responseContent = ''
          }
          if (!responseContent && capturedToolCalls.length > 0) {
            responseContent = `Successfully executed ${capturedToolCalls.length} tool action(s).`
          }
          usage = extractUsage(currentResponse)
          reasoning = extractReasoning(currentResponse)
          var finalRespForCitations: any = currentResponse

          const citations = extractCitations(finalRespForCitations)
          return { content: responseContent, usage, reasoning, capturedToolCalls, citations }
        })

        return lockResult
      } catch (error: any) {
        const errorMsg = error.message || 'Unknown error'
        const isQuotaOrService = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('503') || errorMsg.includes('500')

        logger.error(`[runGoogle] ${modelId} execution failed (Key ${keyIndex + 1}): ${errorMsg}`)
        lastError = error instanceof Error ? error : new Error(errorMsg)

        if (isQuotaOrService && keyIndex < keys.length - 1) {
          logger.warn(`[runGoogle] ${modelId} (Key ${keyIndex + 1}) — quota/service error, switching to next key`)
          break // Exit the retryCount loop to try next key
        }

        // 429/503 on last key: retry with backoff before giving up
        if (isQuotaOrService && retryCount < 2) {
          const delayMs = 1000 * retryCount
          logger.warn(`[runGoogle] ${modelId} (Key ${keyIndex + 1}) — ${errorMsg.includes('429') ? 'rate limited' : 'service error'}, last key, retrying in ${delayMs}ms (attempt ${retryCount}/2)`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
          continue
        }

        if (retryCount === 1 && !forceLegacy && (errorMsg.includes('400') || errorMsg.includes('500'))) {
          logger.warn(`[runGoogle] Potential instruction error. Retrying with legacy format...`)
          forceLegacy = true
          continue // Try again with same key but legacy format
        }

        break // Fatal error for this key
      }
    }
  }

  if (lastError) {
    logger.error(`[runGoogle] All keys exhausted for ${modelId}, rethrowing last error: ${lastError.message}`)
    throw lastError
  }
  logger.error(`[runGoogle] Unexpected exit for ${modelId}: no response, no error captured (keys=${keys.length})`)
  return null
}

function sanitizedIdIsLegacy(id: string): boolean {
  const lower = id.toLowerCase()
  return lower.includes('pro-vision') || lower.includes('gemini-pro-1.0') || lower.includes('gemini-1.0-pro')
}

function extractUsage(response: any) {
  const meta = response.usageMetadata
  if (!meta) return undefined
  return {
    prompt_tokens: meta.promptTokenCount,
    completion_tokens: meta.candidatesTokenCount,
    total_tokens: meta.totalTokenCount,
  }
}

function extractReasoning(response: any) {
  try {
    const parts = response.candidates?.[0]?.content?.parts
    if (parts) {
      const thoughtTexts = parts.filter((p: any) => p.thought).map((p: any) => p.text)
      if (thoughtTexts.length > 0) return thoughtTexts.join('\n')
    }
  } catch {}
  return undefined
}

function extractCitations(response: any): string[] | undefined {
  try {
    const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks
    if (!Array.isArray(chunks) || chunks.length === 0) return undefined
    const uris = chunks.map((c: any) => c?.web?.uri).filter((u: any): u is string => typeof u === 'string' && u.length > 0)
    return uris.length > 0 ? Array.from(new Set(uris)) : undefined
  } catch {
    return undefined
  }
}




