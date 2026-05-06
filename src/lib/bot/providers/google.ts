import { GoogleGenerativeAI } from '@google/generative-ai'
import { getProviderKeys } from '../../vault'
import { logger } from '../../logger'
import { FLOWR_TOOLS } from '../tools/definitions'
import { toolHandlers } from '../tools/handlers'

const GOOGLE_TIMEOUT_MS = 30000

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
  imageBuffer?: Buffer,
  context?: { chatId?: number; userId?: string; aiApiKey?: string; platform?: string; useTools?: boolean; temperature?: number },
  history: any[] = []
): Promise<string | null> {
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
    try {
      const genAI = new GoogleGenerativeAI(key)

      const isGemma = modelId.toLowerCase().includes('gemma')
      let finalPrompt = prompt

      // Legacy Gemma models (1, 2, 3) don't support native systemInstruction role or tools on Gemini API.
      // We prepend system instructions to the prompt text instead to bypass the 400 Bad Request.
      if (isGemma && systemPrompt) {
        finalPrompt = `System Instructions:\n${systemPrompt}\n\nUser Request: ${finalPrompt}`
      }

      const model = genAI.getGenerativeModel({
        model: modelId,
        systemInstruction: !isGemma ? systemPrompt : undefined,
        ...(context?.useTools && !isGemma ? { tools: [{ functionDeclarations: FLOWR_TOOLS as any }] } : {}),
        generationConfig: {
          temperature: typeof context?.temperature === 'number' ? context.temperature : 0.7
        }
      }, { apiVersion: 'v1beta' })

      const parts: any[] = [{ text: finalPrompt }]

      if (imageBuffer) {
        parts.push({
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: 'image/jpeg'
          }
        })
      }

      // Gemini requires history to start with 'user' and alternate user/model
      // Drop any leading model messages and enforce alternation
      const safeHistory: any[] = []
      for (const msg of history) {
        const expectedRole = safeHistory.length % 2 === 0 ? 'user' : 'model'
        if (msg.role === expectedRole) safeHistory.push(msg)
        // skip out-of-order messages silently
      }
      // Must end on model turn (history is pairs: user then model)
      if (safeHistory.length % 2 !== 0) safeHistory.pop()

      let chat = model.startChat({ history: safeHistory })

      let result = await withTimeout(chat.sendMessage(parts), GOOGLE_TIMEOUT_MS)
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
            toolResults.push({
              functionResponse: { name: call.name, response: output }
            })
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
      if (errorMsg.includes('429') || errorMsg.includes('quota')) {
        logger.warn(`Gemini key rate limited. Trying next key...`)
        continue
      }

      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        logger.error(`Model ID "${modelId}" not found. Check your Router config.`)
      } else if (errorMsg.includes('401') || errorMsg.includes('API key')) {
        logger.error(`Authentication failed for Gemini key.`)
      } else {
        logger.error(`Google model ${modelId} execution failed:`, errorMsg)
      }
      throw error
    }
  }

  return null
}
