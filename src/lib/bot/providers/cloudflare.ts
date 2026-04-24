import { getVaultKey } from '../../vault'
import { logger } from '../../logger'

const MODEL_MAP: Record<string, string> = {
  'cloudflare-workers-ai': '@cf/stabilityai/stable-diffusion-xl-base-1.0',
}

export async function runCloudflare(modelId: string, prompt: string, aiApiKey?: string): Promise<Buffer | null> {
  const token = aiApiKey || await getVaultKey('CLOUDFLARE_TOKEN')
  const accountId = await getVaultKey('CLOUDFLARE_ACCOUNT_ID')

  if (!token || !accountId) {
    logger.error('CLOUDFLARE_TOKEN or CLOUDFLARE_ACCOUNT_ID missing from vault')
    return null
  }

  const cfModel = MODEL_MAP[modelId] ?? modelId

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${cfModel}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Cloudflare AI Error: ${response.status} - ${error}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error: any) {
    logger.error(`Cloudflare model ${modelId} execution failed:`, error.message)
    return null
  }
}
