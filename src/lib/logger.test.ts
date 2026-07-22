import { describe, it, expect, beforeEach } from 'vitest'
import { logger, getCapturedLogsSince, clearCapturedLogs } from './logger'

describe('getCapturedLogsSince', () => {
  beforeEach(() => clearCapturedLogs())

  it('returns only entries at or after the marker', async () => {
    logger.info('old entry')
    await new Promise(r => setTimeout(r, 5))
    const marker = new Date().toISOString()
    logger.info('new entry')
    const logs = getCapturedLogsSince(marker)
    expect(logs.some(l => l.message.includes('new entry'))).toBe(true)
    expect(logs.some(l => l.message.includes('old entry'))).toBe(false)
  })
})
