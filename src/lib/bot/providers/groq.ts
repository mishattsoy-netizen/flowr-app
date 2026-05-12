import { getProviderKeys } from '../../vault'
import { logger } from '../../logger'
import { FLOWR_TOOLS } from '../tools/definitions'
import { toolHandlers } from '../tools/handlers'

export async function runGroq(
  modelId: string,
  prompt: string,
  systemPrompt?: string,
  aiApiKey?: string,
  context?: any,
  history: any[] = [],
  imageBuffers?: Buffer | Buffer[]
): Promise<string | null> {
  let keys = aiApiKey ? [aiApiKey] : []
  
  if (keys.length === 0) {
    keys = await getProviderKeys('GROQ')
  }
  
  if (keys.length === 0) {
    logger.error('No Groq keys found (vault or provided)')
    return null
  }

  // Format tools for OpenAI/Groq
  const tools = FLOWR_TOOLS.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }))

  // Convert Gemini-format history [{role, parts: [{text}]}] to OpenAI format [{role, content}]
  const historyMessages = history.map((h: any) => ({
    role: h.role === 'model' ? 'assistant' : 'user',
    content: h.parts?.[0]?.text || ''
  }))

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    try {
      let messages: any[] = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...historyMessages,
      ]

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
        })
      } else {
        messages.push({ role: 'user', content: prompt })
      }

      const MAX_TOOL_HOPS = 4
      let hops = 0

      while (hops < MAX_TOOL_HOPS) {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: modelId,
            messages,
            tools: (context?.useTools && !modelId.includes('vision')) ? tools : undefined,
            tool_choice: context?.useTools ? 'auto' : undefined,
            temperature: typeof context?.temperature === 'number' ? context.temperature : 0.7
          })
        })

        if (response.status === 429) {
          logger.warn(`Groq [${modelId}] key index ${i + 1} rate limited (429) — trying next key if available`)
          break
        }

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error?.message || `Groq API Error: ${response.status}`)
        }

        const message = data.choices[0]?.message
        messages.push(message)

        if (message.tool_calls && message.tool_calls.length > 0) {
          hops++
          for (const call of message.tool_calls) {
            const handler = toolHandlers[call.function.name]
            let output = { error: 'Tool not found' }
            
            if (handler) {
              try {
                const args = JSON.parse(call.function.arguments)
                output = await handler(args, context)
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
          // Continue loop to get final answer or more tool calls
        } else {
          // No more tool calls, return final content
          if (context) context.usedKeyIndex = context.usedKeyIndex || i + 1
          return message.content || null
        }
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error'
      if (errorMsg.includes('404') || errorMsg.includes('model_not_found')) {
        logger.error(`Model ID "${modelId}" not found on Groq. Check your Router config.`)
        throw error // Throw to abort this model entirely
      } else if (errorMsg.includes('401') || errorMsg.includes('API key')) {
        logger.error(`Authentication failed for Groq key index ${i + 1}.`)
        // Continue to try next key
      } else {
        logger.error(`Groq model ${modelId} execution failed:`, errorMsg)
      }
      continue 
    }
  }

  return null
}
