import { logger } from '../logger'

const TOKEN = process.env.NODE_ENV === 'production' 
  ? process.env.TELEGRAM_BOT_TOKEN_PROD 
  : process.env.TELEGRAM_BOT_TOKEN_DEV || process.env.TELEGRAM_BOT_TOKEN_PROD

const BASE_URL = `https://api.telegram.org/bot${TOKEN}`
const FILE_BASE_URL = `https://api.telegram.org/file/bot${TOKEN}`

/**
 * Lightweight Telegram Bot API client for serverless environments.
 */
export const telegram = {
  /**
   * Sends a text message to a user.
   */
  async sendMessage(chatId: number, text: string) {
    if (!TOKEN) return
    try {
      const response = await fetch(`${BASE_URL}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown'
        })
      })
      return await response.json()
    } catch (error) {
      logger.error('Error in telegram.sendMessage:', error)
    }
  },

  /**
   * Sends a photo to a user.
   */
  async sendPhoto(chatId: number, photo: string | Blob | Buffer, caption?: string) {
    if (!TOKEN) return
    try {
      const formData = new FormData()
      formData.append('chat_id', chatId.toString())
      if (typeof photo === 'string') {
        formData.append('photo', photo)
      } else {
        const blob = photo instanceof Blob ? photo : new Blob([photo as any])
        formData.append('photo', blob, 'image.jpg')
      }
      if (caption) {
        formData.append('caption', caption)
        formData.append('parse_mode', 'Markdown')
      }
      const response = await fetch(`${BASE_URL}/sendPhoto`, {
        method: 'POST',
        body: formData
      })
      return await response.json()
    } catch (error) {
      logger.error('Error in telegram.sendPhoto:', error)
    }
  },

  /**
   * Gets file information from Telegram to construct a download URL.
   */
  async getFile(fileId: string) {
    if (!TOKEN) return null
    try {
      const response = await fetch(`${BASE_URL}/getFile?file_id=${fileId}`)
      const data = await response.json()
      return data.ok ? data.result : null
    } catch (error) {
      logger.error('Error in telegram.getFile:', error)
      return null
    }
  },

  /**
   * Downloads a file's binary content from Telegram.
   */
  async downloadFile(filePath: string): Promise<Buffer | null> {
    if (!TOKEN) return null
    try {
      const response = await fetch(`${FILE_BASE_URL}/${filePath}`)
      if (!response.ok) return null
      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    } catch (error) {
      logger.error('Error downloading Telegram file:', error)
      return null
    }
  },

  /**
   * Shows "typing..." or other actions.
   */
  async sendAction(chatId: number, action: 'typing' | 'upload_photo' = 'typing') {
    if (!TOKEN) return
    try {
      await fetch(`${BASE_URL}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: action })
      })
    } catch (error) {
      logger.error('Error in telegram.sendAction:', error)
    }
  }
}
