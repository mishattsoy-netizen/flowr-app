export type BotCommand =
  | { type: 'login' }
  | { type: 'logout' }
  | { type: 'status' }
  | { type: 'newchat' }
  | { type: 'newtempchat' }
  | { type: 'start' }
  | { type: 'message'; text: string }

const COMMANDS = ['/login', '/logout', '/status', '/newchat', '/newtempchat', '/start'] as const

/**
 * Parses a Telegram message text into a typed BotCommand.
 * Text that doesn't start with a known command is treated as a regular message.
 */
export function parseCommand(text: string): BotCommand {
  if (!text || !text.startsWith('/')) return { type: 'message', text }

  const lower = text.toLowerCase().split(' ')[0].split('@')[0] // strip bot username suffix

  switch (lower) {
    case '/login':
      return { type: 'login' }
    case '/logout':
      return { type: 'logout' }
    case '/status':
      return { type: 'status' }
    case '/newchat':
      return { type: 'newchat' }
    case '/newtempchat':
      return { type: 'newtempchat' }
    case '/start':
      return { type: 'start' }
    default:
      return { type: 'message', text }
  }
}
