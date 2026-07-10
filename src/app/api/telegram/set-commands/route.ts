import { NextRequest, NextResponse } from 'next/server'
import { telegram } from '@/lib/bot/telegram'

const COMMANDS = [
  { command: 'start', description: 'Start the bot and link your account' },
  { command: 'login', description: 'Link your Flowr account' },
  { command: 'logout', description: 'Unlink your account' },
  { command: 'account', description: 'Show your linked account info' },
  { command: 'new', description: 'Quick task or note' },
  { command: 'temp', description: 'Start a temporary chat (no history)' },
  { command: 'mode', description: 'Switch mode: default or pro' },
  { command: 'status', description: 'Check bot status' },
  { command: 'help', description: 'Show help message' },
  { command: 'clear', description: 'Clear conversation history' },
  { command: 'id', description: 'Show your chat ID' },
  { command: 'context', description: 'Session memory usage' },
]

async function resetCommands(chatId?: number) {
  const bot = await telegram.getMe()
  const steps: any[] = []

  // Step 1: delete default scope
  const delDefault = await telegram.deleteMyCommands()
  steps.push({ step: 'delete_default', ok: delDefault })

  // Step 2: delete user-specific scope if chatId provided
  if (chatId) {
    const delUser = await telegram.deleteMyCommands({ type: 'chat', chat_id: chatId })
    steps.push({ step: 'delete_user', ok: delUser })
  }

  // Step 3: set default commands (no scope)
  const setDefault = await telegram.setMyCommands(COMMANDS)
  steps.push({ step: 'set_default', ok: setDefault })

  // Step 4: set user-specific commands to bust their cache
  if (chatId) {
    const setUser = await telegram.setMyCommands(COMMANDS, chatId)
    steps.push({ step: 'set_user_scoped', ok: setUser })
  }

  // Step 5: set all_private_chats scope as well
  const setPrivate = await telegram.setMyCommands(COMMANDS, undefined)
  steps.push({ step: 'set_all_private', ok: setPrivate })

  return {
    ok: steps.every(s => s.ok !== false),
    steps,
    bot,
    commands: COMMANDS,
    chatId,
  }
}

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get('chat_id')
  const action = req.nextUrl.searchParams.get('action')

  // Quick diagnostic: just get bot info
  if (action === 'verify') {
    const bot = await telegram.getMe()
    return NextResponse.json({ bot })
  }

  const result = await resetCommands(chatId ? Number(chatId) : undefined)
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const chatId = body.chat_id
  const result = await resetCommands(chatId ? Number(chatId) : undefined)
  return NextResponse.json(result)
}
