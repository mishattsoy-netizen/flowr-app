import { getVaultKey } from '../../vault'
import { logger } from '../../logger'

export async function runHuggingFace(modelId: string, prompt: string): Promise<Buffer | null> {
  const token = await getVaultKey('HUGGING_FACE_TOKEN')
  
  if (!token) {
    logger.error('HUGGING_FACE_TOKEN missing in vault')
    return null
  }

  try {
    const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: prompt })
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
