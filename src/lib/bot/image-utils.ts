import { logger } from '../logger'

/**
 * Extracts dimensions from PNG or JPEG buffers without external dependencies.
 */
export function getImageDimensions(buffer: Buffer): { width: number, height: number } | null {
  try {
    if (buffer.length < 24) return null

    // PNG: \x89PNG\r\n\x1a\n
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      const width = buffer.readInt32BE(16)
      const height = buffer.readInt32BE(20)
      return { width, height }
    }

    // JPEG: \xff\xd8
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let i = 2
      while (i < buffer.length - 8) {
        // Skip padding 0xFF
        while (buffer[i] !== 0xff && i < buffer.length - 8) i++
        while (buffer[i] === 0xff && i < buffer.length - 8) i++
        
        const marker = buffer[i]
        const length = buffer.readUInt16BE(i + 1)
        
        // SOFn markers (Start Of Frame)
        if (marker >= 0xc0 && marker <= 0xc3) {
          const height = buffer.readUInt16BE(i + 4)
          const width = buffer.readUInt16BE(i + 6)
          return { width, height }
        }
        
        i += 1 + length
      }
    }
  } catch (err) {
    logger.error('Error parsing image dimensions:', err)
  }

  return null
}

/**
 * Returns the highest supported resolution for a given model and provider.
 * Following the user rule: "image gen model is using highest possible resolution it can for all providers"
 */
export function getHighestResolution(modelId: string, provider: string): { width: number, height: number } {
  const modelLower = modelId.toLowerCase()
  const providerLower = provider.toLowerCase()

  // SiliconFlow Flux models support up to 4MP (approx 2048x2048)
  if (providerLower === 'siliconflow' && (modelLower.includes('flux') || modelLower.includes('pro'))) {
    return { width: 2048, height: 2048 }
  }

  // Cloudflare and Pollinations generally cap at 1MP for stability
  if (providerLower === 'cloudflare' || providerLower === 'pollinations') {
    return { width: 1024, height: 1024 }
  }

  // Default for high-end models on other providers (like HuggingFace)
  if (modelLower.includes('flux') || modelLower.includes('sdxl') || modelLower.includes('diffusion')) {
    return { width: 1024, height: 1024 }
  }

  // Fallback for older/standard models
  return { width: 512, height: 512 }
}
