import { getProviderKeys } from '../../vault'
import { logger } from '../../logger'
import { FLOWR_TOOLS } from '../tools/definitions'
import { toolHandlers } from '../tools/handlers'
import { detectMimeType } from '../image-utils'
import { streamOpenAICompatible } from './stream-utils'

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions'

export async function runGroq(
  modelId: string,
  prompt: string,
  systemPrompt?: string,
  aiApiKey?: string,
  context?: any,
  history: any[] = [],
  imageBuffers?: Buffer | Buffer[]
): Promise<string | { content: string; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }; reasoning?: string; capturedToolCalls?: any[] } | null> {
  let keys = aiApiKey ? [aiApiKey] : []

  if (keys.length === 0) {
    keys = await getProviderKeys('GROQ')
  }

  if (keys.length === 0) {
    logger.error('No Groq keys found (vault or provided)')
    return null
  }

  const tools = FLOWR_TOOLS.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }))

  const historyMessages = history.map((h: any) => ({
    role: h.role === 'model' ? 'assistant' : 'user',
    content: h.content || (h.parts?.[0]?.text) || ''
  })).filter(m => m.content)

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
            image_url: { url: `data:${detectMimeType(buf)};base64,${buf.toString('base64')}` }
          })
        }
        messages.push({ role: 'user', content: contentParts })
      } else {
        messages.push({ role: 'user', content: prompt })
      }

      // No tools or vision model: use streaming path
      if (!context?.useTools || modelId.includes('vision')) {
        const result = await streamOpenAICompatible(
          GROQ_API,
          {
            model: modelId,
            messages,
            max_tokens: context?.max_tokens || undefined,
          },
          context?.onChunk,
          context?.signal,
          { 'Authorization': `Bearer ${key}` }
        )

        if (!result) throw new Error('Groq returned empty response')

        if (context) context.usedKeyIndex = context.usedKeyIndex || i + 1
        return result
      }

      // Tool-calling path: non-streaming due to tool loop
      const MAX_TOOL_HOPS = 4
      let hops = 0
      const capturedToolCalls: any[] = []

      while (hops < MAX_TOOL_HOPS) {
        const response = await fetch(GROQ_API, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: modelId,
            messages,
            tools,
            tool_choice: 'auto',
            temperature: typeof context?.temperature === 'number' ? context.temperature : 0.7,
            max_tokens: context?.max_tokens || undefined
          }),
          signal: context?.signal,
        })

        if (response.status === 429) {
          logger.warn(`Groq [${modelId}] key index ${i + 1} rate limited (429) — trying next key`)
          break
        }

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.error?.message || `Groq API Error: ${response.status}`)
        }

        const data = await response.json()
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
                if (([] as string[]).includes(call.function.name)) {
                  capturedToolCalls.push({ ...args, ...output, tool: call.function.name })
                } else {
                  capturedToolCalls.push({ ...args, ...output, tool: call.function.name, success: !output?.error })
                }
              } catch (e: any) {
                output = { error: e.message }
              }
            }
            if ((context as any)?.onEvent) {
              (context as any).onEvent({ toolResults: capturedToolCalls })
            }

            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(output)
            })
          }
        } else {
          if (context) context.usedKeyIndex = context.usedKeyIndex || i + 1
          const usage = data?.usage ? {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens,
          } : undefined
          let finalContent = message.content || ''
          if (!finalContent && capturedToolCalls.length > 0) {
            finalContent = `Successfully executed ${capturedToolCalls.length} tool action(s).`
          }

          return {
            content: finalContent,
            provider: 'groq',
            usage,
            reasoning: message.reasoning || undefined,
            capturedToolCalls: capturedToolCalls.length > 0 ? capturedToolCalls : undefined,
          } as any
        }
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error'
      if (errorMsg.includes('404') || errorMsg.includes('model_not_found')) {
        logger.error(`Model ID "${modelId}" not found on Groq. Check your Router config.`)
        throw error
      } else if (errorMsg.includes('401') || errorMsg.includes('API key')) {
        logger.error(`Authentication failed for Groq key index ${i + 1}.`)
      } else {
        logger.error(`Groq model ${modelId} execution failed:`, errorMsg)
      }
      continue
    }
  }

  return null
}




