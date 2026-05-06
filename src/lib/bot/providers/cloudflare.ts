import { getVaultKey } from '../../vault'
import { logger } from '../../logger'

const CF_TIMEOUT_MS = 30000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ])
}

export async function runCloudflare(modelId: string, prompt: string, aiApiKey?: string): Promise<Buffer | string | null> {
  const token = aiApiKey || await getVaultKey('CLOUDFLARE_TOKEN')
  const accountId = await getVaultKey('CLOUDFLARE_ACCOUNT_ID')

  if (!token || !accountId) {
    logger.error(`Cloudflare credentials missing from vault — token: ${!!token}, accountId: ${!!accountId}`)
    return null
  }

  const cfModel = modelId
  logger.info(`Cloudflare request: account=${accountId.slice(0, 8)}... model=${cfModel}`)

  try {
    const response = await withTimeout(
      fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${cfModel}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt }),
        }
      ),
      CF_TIMEOUT_MS,
      `Cloudflare [${cfModel}]`
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Cloudflare AI ${response.status}: ${error}`)
    }

    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const json = await response.json() as any
      if (json?.success) {
        if (json?.result?.image) return Buffer.from(json.result.image, 'base64')
        if (json?.result?.response) return json.result.response
        if (json?.result?.text) return json.result.text
      }
      logger.error(`Cloudflare [${cfModel}] unexpected JSON shape: ${JSON.stringify(json).slice(0, 500)}`)
      throw new Error(`Cloudflare returned unexpected JSON shape — see logs`)
    }

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength < 100) {
      throw new Error(`Cloudflare [${cfModel}] returned empty/tiny response (${arrayBuffer.byteLength} bytes)`)
    }
    return Buffer.from(arrayBuffer)
  } catch (error: any) {
    logger.error(`Cloudflare [${modelId}] failed: ${error.message}`)
    return null
  }
}
