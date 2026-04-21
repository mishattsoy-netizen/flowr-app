import { GoogleGenerativeAI } from '@google/generative-ai'
import { getProviderKeys } from '../../vault'
import { logger } from '../../logger'
import { FLOWR_TOOLS } from '../tools/definitions'
import { toolHandlers } from '../tools/handlers'

export async function runGoogle(
  modelId: string, 
  prompt: string, 
  systemPrompt?: string,
  imageBuffer?: Buffer,
  context?: { chatId: number },
  history: any[] = [] // History support added
): Promise<string | null> {
  const keys = await getProviderKeys('GEMINI')
  
  if (keys.length === 0) {
    logger.error('No Gemini keys found in vault')
    return null
  }

  for (const key of keys) {
    try {
      const genAI = new GoogleGenerativeAI(key)
      
      const model = genAI.getGenerativeModel({ 
        model: modelId,
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: FLOWR_TOOLS as any }]
      })
      
      const parts: any[] = [{ text: prompt || "Analyze this." }]
      
      if (imageBuffer) {
        parts.push({
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: 'image/jpeg'
          }
        })
      }
      
      // Start chat WITH HISTORY
      let chat = model.startChat({
        history: history
      })
      
      let result = await chat.sendMessage(parts)
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
      if (finalAnswer) return finalAnswer
    } catch (error: any) {
      if (error.message?.includes('429') || error.message?.includes('quota')) {
        logger.warn(`Gemini key rate limited. Trying next key...`)
        continue
      }
      logger.error(`Google model ${modelId} execution failed:`, error.message)
      throw error
    }
  }

  return null
}
