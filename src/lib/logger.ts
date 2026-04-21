/**
 * Custom logger for Flowr AI
 * Ensures consistent log formatting for Vercel Log visibility
 */
export const logger = {
  info: (msg: string, data?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, data ? JSON.stringify(data, null, 2) : '')
  },
  error: (msg: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, error || '')
  },
  warn: (msg: string, data?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, data ? JSON.stringify(data, null, 2) : '')
  },
}
