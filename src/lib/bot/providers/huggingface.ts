import { getVaultKey, getProviderKeys } from '../../vault'
import { logger } from '../../logger'
import { getHighestResolution } from '../image-utils'

export async function runHuggingFace(modelId: string, prompt: string, aiApiKey?: string): Promise<Buffer | null> {
  let keys = aiApiKey ? [aiApiKey] : []
  if (keys.length === 0) {
    keys = [...await getProviderKeys('HUGGINGFACE'), ...await getProviderKeys('HUGGING_FACE')]
  }
  const token = keys[0] || await getVaultKey('HUGGING_FACE_TOKEN')

  if (!token) {
    logger.error('HUGGING_FACE_TOKEN missing (vault or provided)')
    return null
  }

  try {
    const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          width: getHighestResolution(modelId, 'huggingface').width,
          height: getHighestResolution(modelId, 'huggingface').height,
          guidance_scale: 7.5,
          num_inference_steps: 40
        },
        options: {
          use_cache: true,
          wait_for_model: true
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`HF API Error: ${response.status} - ${error}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error: any) {
    logger.error(`HuggingFace model ${modelId} execution failed:`, error.message)
    return null
  }
}

export async function runHuggingFaceText(
  modelId: string,
  prompt: string,
  systemPrompt?: string,
  history?: any[],
  aiApiKey?: string,
  context?: any
): Promise<string | { content: string; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }; reasoning?: string } | null> {
  let keys = aiApiKey ? [aiApiKey] : []
  if (keys.length === 0) {
    keys = [...await getProviderKeys('HUGGINGFACE'), ...await getProviderKeys('HUGGING_FACE')]
  }
  const token = keys[0] || await getVaultKey('HUGGING_FACE_TOKEN')

  if (!token) {
    logger.error('HUGGING_FACE_TOKEN missing for text inference')
    return null
  }

  try {
    const messages: { role: string; content: string }[] = []
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    if (history && history.length > 0) {
      for (const h of history) {
        messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })
      }
    }
    messages.push({ role: 'user', content: prompt })

    const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages,
        max_tokens: context?.max_tokens || 2000,
        options: { use_cache: true }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`HF API Error: ${response.status} - ${error}`)
    }

    const json = await response.json()
    const msg = json.choices?.[0]?.message
    const usage = json.usage ? {
      prompt_tokens: json.usage.prompt_tokens,
      completion_tokens: json.usage.completion_tokens,
      total_tokens: json.usage.total_tokens,
    } : undefined
    if (!msg?.content) return null
    return { content: msg.content, usage, reasoning: msg.reasoning || undefined }
  } catch (error: any) {
    logger.error(`HuggingFace text model ${modelId} execution failed:`, error.message)
    return null
  }
}

