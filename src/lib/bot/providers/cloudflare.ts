import { getVaultKey } from '../../vault'
import { logger } from '../../logger'

const MODEL_MAP: Record<string, string> = {
  'cloudflare-workers-ai': '@cf/black-forest-labs/flux-1-schnell',
}

export async function runCloudflare(modelId: string, prompt: string, aiApiKey?: string): Promise<Buffer | string | null> {
  const token = aiApiKey || await getVaultKey('CLOUDFLARE_TOKEN')
  const accountId = await getVaultKey('CLOUDFLARE_ACCOUNT_ID')

  if (!token || !accountId) {
    logger.error(`Cloudflare credentials missing from vault — token: ${!!token}, accountId: ${!!accountId}`)
    return null
  }

  const cfModel = MODEL_MAP[modelId] ?? modelId
  logger.info(`Cloudflare request: account=${accountId.slice(0, 8)}... model=${cfModel}`)

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

    const contentType = response.headers.get('content-type') || ''

    // Some Cloudflare models return JSON with base64 image, text response, or error info
    if (contentType.includes('application/json')) {
      const json = await response.json() as any
      if (json?.success) {
        if (json?.result?.image) {
          return Buffer.from(json.result.image, 'base64')
        }
        if (json?.result?.response) {
          return json.result.response
        }
        if (json?.result?.text) {
          return json.result.text
        }
      }
      throw new Error(`Cloudflare AI JSON response: ${JSON.stringify(json).slice(0, 200)}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength < 100) {
      throw new Error(`Cloudflare AI returned empty/tiny response (${arrayBuffer.byteLength} bytes)`)
    }
    return Buffer.from(arrayBuffer)
  } catch (error: any) {
    logger.error(`Cloudflare model ${modelId} execution failed:`, error.message)
    return null
  }
}
