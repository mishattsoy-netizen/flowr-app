import { getVaultKey, getProviderKeys } from '../../vault'
import { logger } from '../../logger'
import { getHighestResolution } from '../image-utils'

const CF_TIMEOUT_MS = 30000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ])
}

export async function runCloudflare(
  modelId: string, 
  prompt: string, 
  aiApiKey?: string,
  system_prompt?: string,
  history: { role: 'user' | 'assistant' | 'system', content: string }[] = [],
  category?: string
): Promise<Buffer | string | null> {
  const keys = await getProviderKeys('cloudflare')
  const token = (aiApiKey || keys[0])?.trim()
  const accountId = keys[1]?.trim()?.replace(/[^a-zA-Z0-9]/g, '')

  if (!token || !accountId) {
    logger.error(`Cloudflare credentials missing — token: ${!!token}, accountId: ${!!accountId}`)
    return null
  }

  // Diagnostic log (masked for security)
  const maskedToken = `${token.slice(0, 4)}...${token.slice(-4)}`
  const tokenLen = token.length
  logger.info(`Cloudflare Diagnostic: Account [${accountId.slice(0, 6)}...], Token [${maskedToken}] Len=${tokenLen}`)

  const cfModel = modelId
  logger.info(`Cloudflare request: account=${accountId.slice(0, 8)}... model=${cfModel} category=${category}`)

  // Detect if this is an image generation task
  // Cloudflare image models are usually in stabilityai, bytedance, lykon namespaces or have 'diffusion' in name
  const isImageGen = category === 'IMAGE_GEN' || 
    cfModel.includes('diffusion') || 
    cfModel.includes('dreamshaper') || 
    cfModel.includes('flux')

  const timeoutMs = isImageGen ? 60000 : 30000

  try {
    let body: any = {}
    // ... existing body logic ...
    if (isImageGen) {
      const res = getHighestResolution(cfModel, 'cloudflare')
      body = { 
        prompt,
        width: res.width,
        height: res.height
      }
    } else {
      const messages = []
      if (system_prompt) messages.push({ role: 'system', content: system_prompt })
      for (const msg of history) messages.push({ role: msg.role, content: msg.content })
      messages.push({ role: 'user', content: prompt })
      body = { messages, max_tokens: 2048 }
    }

    const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId.trim()}/ai/run/${cfModel.trim()}`
    
    logger.info(`Cloudflare [${cfModel}] fetching from: ${cfUrl}`)

    const response = await withTimeout(
      fetch(
        cfUrl,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      ),
      timeoutMs,
      `Cloudflare [${cfModel}]`
    )

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`Cloudflare [${cfModel}] API Error ${response.status}: ${errorText}`)
      
      if (response.status === 401 || response.status === 403 || response.status === 429) {
        throw new Error(`KEY_EXHAUSTED: Cloudflare ${response.status} - ${errorText}`)
      }
      throw new Error(`Cloudflare AI ${response.status}: ${errorText}`)
    }

    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const json = await response.json() as any
      if (json?.success) {
        if (json?.result?.image) return Buffer.from(json.result.image, 'base64')
        if (json?.result?.response) return json.result.response
        if (json?.result?.text) return json.result.text
        if (json?.result && typeof json.result === 'string') return json.result
      } else {
        const cfErrors = (json?.errors || []).map((e: any) => `${e.code}: ${e.message}`).join(', ')
        throw new Error(`Cloudflare AI error — ${cfErrors || 'Unknown error'}`)
      }
      
      logger.error(`Cloudflare [${cfModel}] unexpected JSON shape: ${JSON.stringify(json).slice(0, 500)}`)
      throw new Error(`Cloudflare returned unexpected JSON shape — see logs`)
    }

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength < 100) {
      // If it's not JSON and not a decent sized buffer, something is weird
      if (contentType.includes('text')) {
        const text = new TextDecoder().decode(arrayBuffer)
        return text
      }
      throw new Error(`Cloudflare [${cfModel}] returned empty/tiny response (${arrayBuffer.byteLength} bytes)`)
    }
    return Buffer.from(arrayBuffer)
  } catch (error: any) {
    // If it's a key exhaustion or already formatted error, rethrow it
    if (error.message.includes('KEY_EXHAUSTED') || error.message.includes('Cloudflare AI')) {
      throw error
    }
    logger.error(`Cloudflare [${modelId}] unexpected error: ${error.message}`)
    throw error // Re-throw to trigger key rotation
  }
}
