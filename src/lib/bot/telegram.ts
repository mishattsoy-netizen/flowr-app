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
   * Sends a text message to a user, optionally with inline keyboard buttons.
   * Returns the sent message_id on success.
   */
  async sendMessage(chatId: number, text: string, replyMarkup?: { inline_keyboard: { text: string; callback_data: string }[][] }): Promise<number | null> {
    if (!TOKEN) return null
    try {
      const body: Record<string, any> = {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
      }
      if (replyMarkup) body.reply_markup = replyMarkup
      const response = await fetch(`${BASE_URL}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      return data?.ok ? (data.result.message_id as number) : null
    } catch (error) {
      logger.error('Error in telegram.sendMessage:', error)
      return null
    }
  },

  /**
   * Sends a photo to a user. Returns the sent message_id on success.
   */
  async sendPhoto(chatId: number, photo: string | Blob | Buffer, caption?: string): Promise<number | null> {
    if (!TOKEN) return null
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
      const data = await response.json()
      return data?.ok ? (data.result.message_id as number) : null
    } catch (error) {
      logger.error('Error in telegram.sendPhoto:', error)
      return null
    }
  },

  /**
   * Deletes a message by chat_id and message_id.
   */
  async deleteMessage(chatId: number, messageId: number): Promise<boolean> {
    if (!TOKEN) return false
    try {
      const response = await fetch(`${BASE_URL}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId })
      })
      const data = await response.json()
      return data?.ok === true
    } catch (error) {
      logger.error('Error in telegram.deleteMessage:', error)
      return false
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
  },

  /**
   * Answers a callback query (dismisses the loading spinner on an inline button).
   */
  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<boolean> {
    if (!TOKEN) return false
    try {
      const response = await fetch(`${BASE_URL}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text || '',
        }),
      })
      const data = await response.json()
      return data?.ok === true
    } catch (error) {
      logger.error('Error in telegram.answerCallbackQuery:', error)
      return false
    }
  },
}
