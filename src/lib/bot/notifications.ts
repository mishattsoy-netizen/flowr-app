import { telegram } from './telegram'
import { logger } from '../logger'

/**
 * Sends a system alert to the configured administrator.
 */
export async function sendAdminAlert(message: string) {
  const adminId = process.env.ADMIN_CHAT_ID
  if (!adminId) {
    logger.warn('ADMIN_CHAT_ID not configured. Alert suppressed: ' + message)
    return
  }

  try {
    await telegram.sendMessage(parseInt(adminId), `🚨 *SYSTEM ALERT*\n\n${message}`)
  } catch (error) {
    logger.error('Failed to send admin alert:', error)
  }
}
