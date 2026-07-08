export type BotCommand =
  | { type: 'login' }
  | { type: 'logout' }
  | { type: 'account' }
  | { type: 'status' }
  | { type: 'newchat' }
  | { type: 'newtempchat' }
  | { type: 'help' }
  | { type: 'clear' }
  | { type: 'id' }
  | { type: 'start' }
  | { type: 'mode'; value: string }
  | { type: 'message'; text: string }

export type ClearAction = 'new' | 'temp' | 'current'

const COMMANDS = [
  '/login', '/logout', '/account', '/status',
  '/newchat', '/newtempchat', '/clear', '/id',
  '/mode', '/help', '/start'
] as const

/**
 * Parses a Telegram message text into a typed BotCommand.
 * Text that doesn't start with a known command is treated as a regular message.
 * Commands with arguments (e.g. /mode pro) preserve the value.
 */
export function parseCommand(text: string): BotCommand {
  if (!text || !text.startsWith('/')) return { type: 'message', text }

  const fullLower = text.toLowerCase()
  const parts = fullLower.split(' ')
  const first = parts[0].split('@')[0] // strip bot username suffix

  switch (first) {
    case '/login':
      return { type: 'login' }
    case '/logout':
      return { type: 'logout' }
    case '/account':
      return { type: 'account' }
    case '/status':
      return { type: 'status' }
    case '/newchat':
      return { type: 'newchat' }
    case '/newtempchat':
      return { type: 'newtempchat' }
    case '/start':
      return { type: 'start' }
    case '/help':
      return { type: 'help' }
    case '/clear':
      return { type: 'clear' }
    case '/id':
      return { type: 'id' }
    case '/mode':
      return { type: 'mode', value: parts[1] || '' }
    default:
      return { type: 'message', text }
  }
}
