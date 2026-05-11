import { getVaultKey, getProviderKeys } from '../../vault'
import { logger } from '../../logger'

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
          width: 1024,
          height: 1024,
          guidance_scale: 7.5,
          num_inference_steps: 40
        },
        options: {
          use_cache: false,
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
  aiApiKey?: string
): Promise<string | null> {
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
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`HF API Error: ${response.status} - ${error}`)
    }

    const json = await response.json()
    return json.choices?.[0]?.message?.content ?? null
  } catch (error: any) {
    logger.error(`HuggingFace text model ${modelId} execution failed:`, error.message)
    return null
  }
}
