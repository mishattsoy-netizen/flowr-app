import { GoogleGenerativeAI } from '@google/generative-ai'
import { getProviderKeys } from '../../vault'
import { logger } from '../../logger'
import { FLOWR_TOOLS } from '../tools/definitions'
import { toolHandlers } from '../tools/handlers'

const GOOGLE_TIMEOUT_MS = 60000
const GOOGLE_TIMEOUT_MS_GEMMA4 = 120000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Google API timeout after ${ms}ms`)), ms))
  ])
}

export async function runGoogle(
  modelId: string,
  prompt: string,
  systemPrompt?: string,
  imageBuffers?: Buffer | Buffer[],
  context?: { chatId?: number; userId?: string; aiApiKey?: string; platform?: string; useTools?: boolean; temperature?: number },
  history: any[] = []
): Promise<string | { content: string; citations?: string[] } | null> {
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

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    let forceLegacy = false
    let attempts = 0
    
    while (attempts < 2) {
      attempts++
      try {
        const genAI = new GoogleGenerativeAI(key)

        const isGemma4 = modelId.toLowerCase().includes('gemma-4')
        const isLegacyGemma = modelId.toLowerCase().includes('gemma') && !isGemma4
        
        let finalPrompt = prompt
        let useSystemInstruction = !isLegacyGemma && !forceLegacy

        // Fallback or Legacy: Prepend system instructions to the prompt text
        if ((isLegacyGemma || forceLegacy) && systemPrompt) {
          finalPrompt = `System Instructions:\n${systemPrompt}\n\nUser Request: ${finalPrompt}`
        }

        const model = genAI.getGenerativeModel({
          model: modelId,
          systemInstruction: useSystemInstruction ? systemPrompt : undefined,
          ...(context?.useTools && useSystemInstruction ? { tools: [{ functionDeclarations: FLOWR_TOOLS as any }] } : {}),
          generationConfig: {
            temperature: typeof context?.temperature === 'number' ? context.temperature : 0.7
          }
        }, { 
          apiVersion: forceLegacy ? 'v1' : 'v1beta' 
        })

        const parts: any[] = [{ text: finalPrompt }]

        if (imageBuffers) {
          const buffers = Array.isArray(imageBuffers) ? imageBuffers : [imageBuffers]
          for (const buf of buffers) {
            parts.push({
              inlineData: {
                data: buf.toString('base64'),
                mimeType: 'image/jpeg'
              }
            })
          }
        }

        const safeHistory: any[] = []
        for (const msg of history) {
          const expectedRole = safeHistory.length % 2 === 0 ? 'user' : 'model'
          if (msg.role === expectedRole) safeHistory.push(msg)
        }
        if (safeHistory.length % 2 !== 0) safeHistory.pop()

        let chat = model.startChat({ history: safeHistory })
        const activeTimeout = (isGemma4 && imageBuffers) ? GOOGLE_TIMEOUT_MS_GEMMA4 : GOOGLE_TIMEOUT_MS
        let result = await withTimeout(chat.sendMessage(parts), activeTimeout)
        let response = result.response

        const MAX_TOOL_HOPS = 4
        let hops = 0

        while (response.functionCalls() && hops < MAX_TOOL_HOPS) {
          hops++
          const toolCalls = response.functionCalls() || []
          const toolResults = []
          for (const call of toolCalls) {
            const handler = toolHandlers[call.name]
            if (handler) {
              const output = await (handler as any)(call.args, context)
              toolResults.push({ functionResponse: { name: call.name, response: output } })
            }
          }
          result = await chat.sendMessage(toolResults)
          response = result.response
        }

        const finalAnswer = response.text()
        if (finalAnswer) {
          if (context) (context as any).usedKeyIndex = (context as any).usedKeyIndex || i + 1
          return finalAnswer
        }
      } catch (error: any) {
        const errorMsg = error.message || 'Unknown error'
        
        // Gemma 4 specific fallback: Retry with legacy prepending if 500/400 error occurs
        if (modelId.toLowerCase().includes('gemma-4') && !forceLegacy && (errorMsg.includes('500') || errorMsg.includes('400'))) {
          logger.warn(`Gemma 4 failed with native instructions. Retrying with legacy prepend...`)
          forceLegacy = true
          continue
        }

        if (errorMsg.includes('429') || errorMsg.includes('quota')) {
          throw error 
        }

        logger.error(`Google model ${modelId} execution failed:`, errorMsg)
        if (error.response) {
          logger.error(`Full error response:`, JSON.stringify(error.response, null, 2))
        }
        break // Fail this model and try next key or next model in chain
      }
    }
  }

  return null
}
