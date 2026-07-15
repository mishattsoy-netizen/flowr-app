import sharp from 'sharp'
import { logger } from '../logger'

export const MAX_IMAGE_DIMENSION = 1536

/**
 * Resizes an image buffer so its longest edge is at most MAX_IMAGE_DIMENSION.
 * Maintains aspect ratio. If the image is already smaller than the max dimension,
 * it is returned untouched (unless format conversion is needed, but we keep the original if possible).
 * This slashes token costs by ensuring 4K screenshots aren't sliced into a dozen expensive tiles.
 */
export async function resizeImageForApi(buffer: Buffer, maxDimension = MAX_IMAGE_DIMENSION): Promise<Buffer> {
  try {
    const metadata = await sharp(buffer).metadata()
    const { width, height } = metadata

    if (!width || !height) {
      return buffer
    }

    if (width > maxDimension || height > maxDimension) {
      logger.info(`[ImageResizer] Downscaling image from ${width}x${height} to max ${maxDimension}px`)
      return await sharp(buffer)
        .resize(maxDimension, maxDimension, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .toBuffer()
    }

    return buffer
  } catch (error: any) {
    logger.warn(`[ImageResizer] Failed to resize image, returning original buffer: ${error.message}`)
    return buffer
  }
}
