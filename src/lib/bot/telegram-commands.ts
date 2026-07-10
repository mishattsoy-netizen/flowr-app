export type BotCommand =
  | { type: 'login' }
  | { type: 'logout' }
  | { type: 'account' }
  | { type: 'status' }
  | { type: 'new' }
  | { type: 'temp' }
  | { type: 'help' }
  | { type: 'clear' }
  | { type: 'id' }
  | { type: 'start' }
  | { type: 'mode'; value: string }
  | { type: 'spaces'; value: string }
  | { type: 'context' }
  | { type: 'message'; text: string }

const COMMANDS = [
  '/login', '/logout', '/account', '/status',
  '/new', '/temp', '/clear', '/id',
  '/mode', '/help', '/start', '/spaces', '/space', '/context'
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
    case '/new':
      return { type: 'new' }
    case '/temp':
      return { type: 'temp' }
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
    case '/spaces':
    case '/space':
      return { type: 'spaces', value: text.slice(parts[0].length).trim() }
    case '/context':
      return { type: 'context' }
    default:
      return { type: 'message', text }
  }
}
