/**
 * Custom logger for Flowr AI
 * Ensures consistent log formatting for Vercel Log visibility
 */

export interface LogEntry {
  level: 'INFO' | 'WARN' | 'ERROR'
  message: string
  timestamp: string
}

const MAX_LOG_ENTRIES = 500
const capturedLogs: LogEntry[] = []

function pushLog(level: LogEntry['level'], msg: string, data?: any) {
  let message = msg
  if (data !== undefined) {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data)
    message += ' ' + dataStr
  }
  capturedLogs.push({ level, message, timestamp: new Date().toISOString() })
  if (capturedLogs.length > MAX_LOG_ENTRIES) {
    capturedLogs.splice(0, capturedLogs.length - MAX_LOG_ENTRIES)
  }
}

export function getCapturedLogs(): LogEntry[] {
  return capturedLogs
}

export function getCapturedLogsSince(sinceIso: string): LogEntry[] {
  return capturedLogs.filter(l => l.timestamp >= sinceIso)
}

export function clearCapturedLogs(): void {
  capturedLogs.length = 0
}

export const logger = {
  info: (msg: string, data?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, data ? JSON.stringify(data, null, 2) : '')
    pushLog('INFO', msg, data)
  },
  error: (msg: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, error || '')
    pushLog('ERROR', msg, error)
  },
  warn: (msg: string, data?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, data ? JSON.stringify(data, null, 2) : '')
    pushLog('WARN', msg, data)
  },
}
