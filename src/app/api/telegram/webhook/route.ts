import { NextRequest, NextResponse } from 'next/server'
import { telegram } from '@/lib/bot/telegram'
import { supabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { checkUserAndLimits, incrementUsage } from '@/lib/bot/usageGuard'
import { logInteraction, logWebInteraction, logModelWebMessage } from '@/lib/bot/analytics'
import { parseCommand } from '@/lib/bot/telegram-commands'

const AUTH_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://www.flowr.website'
  : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

/**
 * Sync Telegram messages to the web app's conversations/messages tables.
 */
async function syncTelegramMessages(
  authUserId: string,
  chatId: string,
  userMessage: string,
  aiResponse: string,
  modelChain?: string,
): Promise<void> {
  try {
    const { data: existing } = await supabaseAdmin!
      .from('conversations')
      .select('id')
      .eq('id', chatId)
      .maybeSingle()

    if (!existing) {
      const title = userMessage.length > 60
        ? userMessage.slice(0, 57) + '…'
        : userMessage || 'Telegram Chat'
      await supabaseAdmin!.from('conversations').insert({
        id: chatId, user_id: authUserId, title, updated_at: new Date().toISOString(),
      })
    } else {
      await supabaseAdmin!.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', chatId)
    }
    await supabaseAdmin!.from('messages').insert({ conversation_id: chatId, role: 'user', content: userMessage })
    await supabaseAdmin!.from('messages').insert({
      conversation_id: chatId, role: 'assistant',
      content: typeof aiResponse === 'string' ? aiResponse : '[Image generated]',
      model: modelChain || undefined,
    })
    logger.info(`[Telegram sync] Synced conversation ${chatId} for user ${authUserId}`)
  } catch (err) {
    logger.warn(`[Telegram sync] Failed to sync conversation: ${err}`)
  }
}

/**
 * Delete all tracked bot messages for a given session from Telegram.
 */
async function clearSessionMessages(chatId: number, sessionChatId: string): Promise<number> {
  try {
    const { data: logs } = await supabaseAdmin!
      .from('message_logs')
      .select('context_messages')
      .eq('topic_tag', `chat:${sessionChatId}`)
      .not('context_messages', 'is', null)

    let deleted = 0
    for (const row of logs || []) {
      const cm = row.context_messages as Record<string, any> | null
      const msgId = cm?.telegram_message_id
      if (typeof msgId === 'number') {
        if (await telegram.deleteMessage(chatId, msgId)) deleted++
      }
    }
    return deleted
  } catch (err) {
    logger.warn(`[Telegram clear] Error clearing messages: ${err}`)
    return 0
  }
}

/**
 * Create a new session for the user.
 */
async function startNewSession(
  telegramId: number,
  authUserId: string,
  type: 'saved' | 'temp',
  mode: string,
): Promise<{ activeChatId: string; systemMessage: string }> {
  const activeChatId = crypto.randomUUID()
  const modeLabel = mode === 'pro' ? 'Pro' : 'Default'
  const systemMessage = type === 'saved'
    ? `🆕 *New saved session started.*\n*Mode:* ${modeLabel}`
    : `🆕 *New temporary session started.*`

  await supabaseAdmin!.from('telegram_users').update({ active_chat_id: activeChatId }).eq('telegram_id', telegramId)

  if (type === 'saved') {
    try {
      await supabaseAdmin!.from('conversations').insert({
        id: activeChatId, user_id: authUserId,
        title: systemMessage.replace(/\*+/g, '').trim(),
        updated_at: new Date().toISOString(),
      })
    } catch { /* non-critical */ }
  }
  return { activeChatId, systemMessage }
}

/**
 * Handle an inline keyboard callback (from /clear buttons).
 */
async function handleClearCallback(
  callbackQueryId: string,
  data: string,
  chatId: number,
  linkedAuthUserId: string | null,
  activeChatId: string | null,
  botMode: string,
): Promise<void> {
  // Acknowledge the button press immediately
  await telegram.answerCallbackQuery(callbackQueryId, '')

  if (!linkedAuthUserId || !activeChatId) {
    await telegram.sendMessage(chatId, '🔒 Please /login first.')
    return
  }

  if (data === 'clear_current') {
    await telegram.sendMessage(chatId, '🧹 *Cleared.* Continue chatting in the same session.')
    return
  }

  const type = data === 'clear_new' ? 'saved' : 'temp'
  await clearSessionMessages(chatId, activeChatId)
  const { activeChatId: newId, systemMessage } = await startNewSession(chatId, linkedAuthUserId, type, botMode)
  // Update the outer scope's reference isn't needed since this sends a new message
  await telegram.sendMessage(chatId, systemMessage)
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('X-Telegram-Bot-Api-Secret-Token')
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    logger.warn('Unauthorized webhook request blocked.')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()

    // ── Handle callback queries (inline button taps) ──
    if (body.callback_query) {
      const cq = body.callback_query
      const chatId = cq.message.chat.id
      const data: string = cq.data || ''
      const callbackQueryId: string = cq.id

      try {
        let linkedAuthUserId: string | null = null
        let activeChatId: string | null = null
        let botMode = 'default'
        const { data: tgUser } = await supabaseAdmin!
          .from('telegram_users')
          .select('auth_user_id, active_chat_id, bot_mode')
          .eq('telegram_id', chatId)
          .single()
        if (tgUser?.auth_user_id) linkedAuthUserId = tgUser.auth_user_id
        if (tgUser?.active_chat_id) activeChatId = tgUser.active_chat_id
        if (tgUser?.bot_mode) botMode = tgUser.bot_mode

        if (data.startsWith('clear_')) {
          await handleClearCallback(callbackQueryId, data, chatId, linkedAuthUserId, activeChatId, botMode)
        }
      } catch (err) {
        logger.error('Callback query error:', err)
        await telegram.answerCallbackQuery(callbackQueryId, 'Error')
      }
      return NextResponse.json({ ok: true })
    }

    // ── Handle regular messages ──
    const message = body.message
    if (!message) return NextResponse.json({ ok: true })

    const chatId = message.chat.id
    const userText = message.text || message.caption || ""
    const photo = message.photo
    const cmd = parseCommand(userText)

    try {
      const user = await checkUserAndLimits(chatId)

      // Fetch linked auth info + bot mode
      let linkedAuthUserId: string | null = null
      let activeChatId: string | null = null
      let botMode: string = 'default'
      try {
        const { data: tgUser } = await supabaseAdmin!
          .from('telegram_users')
          .select('auth_user_id, active_chat_id, bot_mode')
          .eq('telegram_id', chatId)
          .single()
        if (tgUser?.auth_user_id) linkedAuthUserId = tgUser.auth_user_id
        if (tgUser?.active_chat_id) activeChatId = tgUser.active_chat_id
        if (tgUser?.bot_mode) botMode = tgUser.bot_mode
      } catch (e) {
        logger.info(`No telegram_users row yet for ${chatId}`)
      }

      // ── Handle commands ──

      if (cmd.type === 'start') {
        const welcome = linkedAuthUserId
          ? '👋 Welcome back! Your account is linked — send a message to start chatting.'
          : '👋 Welcome! Use /login to link your Flowr account and start using the bot.'
        await telegram.sendMessage(chatId, welcome)
        return NextResponse.json({ ok: true })
      }

      if (cmd.type === 'login') {
        if (linkedAuthUserId) {
          await telegram.sendMessage(chatId, '✅ *Already linked!* Send /account for details.')
        } else {
          const link = `${AUTH_BASE_URL}/auth/telegram-link?tg=${chatId}`
          await telegram.sendMessage(chatId,
            `🔗 *Link Your Account*\n\nTap the link below to sign in with Google:\n\n${link}\n\nAfter linking, send /account to confirm.`)
        }
        return NextResponse.json({ ok: true })
      }

      if (cmd.type === 'logout') {
        if (!linkedAuthUserId) {
          await telegram.sendMessage(chatId, '❌ Not linked to any account.')
        } else {
          await supabaseAdmin!.from('telegram_users').update({ auth_user_id: null, active_chat_id: null }).eq('telegram_id', chatId)
          await telegram.sendMessage(chatId, '✅ Account unlinked successfully.')
        }
        return NextResponse.json({ ok: true })
      }

      if (cmd.type === 'account') {
        if (linkedAuthUserId) {
          const { data: userData } = await supabaseAdmin!.auth.admin.getUserById(linkedAuthUserId)
          const email = userData?.user?.email || linkedAuthUserId.slice(0, 12)
          await telegram.sendMessage(chatId,
            `📋 *Account Info*\n\n*Linked:* ✅\n*Email:* \`${email}\`\n*Plan:* ${user.preset_name}`)
        } else {
          await telegram.sendMessage(chatId, `📋 *Account Info*\n\n*Linked:* ❌\nUse /login to link your account.`)
        }
        return NextResponse.json({ ok: true })
      }

      if (cmd.type === 'status') {
        const isTemp = !!activeChatId?.startsWith('temp-')
        let health = '✅ All good'
        try {
          if (linkedAuthUserId && activeChatId) {
            const { count: convCount } = await supabaseAdmin!.from('conversations').select('id', { count: 'exact', head: true }).eq('id', activeChatId)
            const { count: logCount } = await supabaseAdmin!.from('message_logs').select('id', { count: 'exact', head: true }).eq('topic_tag', `chat:${activeChatId}`)
            if (convCount === 0 && logCount > 0) health = '⚠️ Web sync lagging'
          }
        } catch { health = '⚠️ Sync check failed' }

        const modeLabel = botMode === 'pro' ? 'Pro' : 'Default'
        await telegram.sendMessage(chatId,
          `📊 *Session Status*\n\n*Mode:* ${modeLabel}\n*Type:* ${isTemp ? 'Temporary' : 'Saved'}\n*Session ID:* \`${(activeChatId || '—').slice(0, 8)}…\`\n*Health:* ${health}`)
        return NextResponse.json({ ok: true })
      }

      if (cmd.type === 'new') {
        const { activeChatId: newId, systemMessage } = await startNewSession(chatId, linkedAuthUserId || '', 'saved', botMode)
        activeChatId = newId
        await telegram.sendMessage(chatId, systemMessage)
        return NextResponse.json({ ok: true })
      }

      if (cmd.type === 'id') {
        await telegram.sendMessage(chatId,
          `🆔 *IDs*\n\n*Chat:* \`${chatId}\`\n*Session:* \`${activeChatId || '—'}\``)
        return NextResponse.json({ ok: true })
      }

      if (cmd.type === 'clear') {
        if (!linkedAuthUserId || !activeChatId) {
          await telegram.sendMessage(chatId, '🔒 Please /login first.')
          return NextResponse.json({ ok: true })
        }
        const deleted = await clearSessionMessages(chatId, activeChatId)
        const header = deleted > 0
          ? `🧹 *Cleaned up ${deleted} message(s).* What now?`
          : `🧹 *Session cleared.* What now?`

        await telegram.sendMessage(chatId, header, {
          inline_keyboard: [
            [
              { text: '💬 New Chat', callback_data: 'clear_new' },
              { text: '⏳ Temporary', callback_data: 'clear_temp' },
            ],
            [
              { text: '🧹 Stay Here', callback_data: 'clear_current' },
            ],
          ],
        })
        return NextResponse.json({ ok: true })
      }

      if (cmd.type === 'mode') {
        if (!linkedAuthUserId) {
          await telegram.sendMessage(chatId, '🔒 Please /login first.')
          return NextResponse.json({ ok: true })
        }
        const value = cmd.value.toLowerCase()
        if (value !== 'default' && value !== 'pro') {
          await telegram.sendMessage(chatId,
            `⚙️ *Mode*\n\nCurrent: *${botMode === 'pro' ? 'Pro' : 'Default'}*\n\n/mode default — Standard AI\n/mode pro — Advanced AI with thinking`)
          return NextResponse.json({ ok: true })
        }
        await supabaseAdmin!.from('telegram_users').update({ bot_mode: value }).eq('telegram_id', chatId)
        botMode = value
        await telegram.sendMessage(chatId, `✅ Switched to *${value === 'pro' ? 'Pro' : 'Default'}* mode.`)
        return NextResponse.json({ ok: true })
      }

      if (cmd.type === 'help') {
        await telegram.sendMessage(chatId,
          `🤖 *Flowr Bot Commands*

*Account*
/login — Link your Google account
/logout — Unlink your account
/account — View linked info & plan

*Chat*
/new — New saved session (history visible in app)
/temp <msg> — New temporary session (ephemeral, no history saved)
/clear — Clear messages, then pick next action

*Info*
/status — Session stats & health
/id — Your Telegram & session IDs

*Settings*
/mode default|pro — Switch AI mode
/help — Show this message`)
        return NextResponse.json({ ok: true })
      }

      // ── Auth gate ──
      if (!linkedAuthUserId) {
        await telegram.sendMessage(chatId, '🔒 Please /login first to use the bot.')
        return NextResponse.json({ ok: true })
      }

      // ── Generate active_chat_id if needed ──
      if (!activeChatId) {
        const result = await startNewSession(chatId, linkedAuthUserId, 'saved', botMode)
        activeChatId = result.activeChatId
        await telegram.sendMessage(chatId, result.systemMessage)
      }

      // ── Handle photo / send action ──
      let photoBuffer: Buffer | undefined = undefined
      const isTempChat = cmd.type === 'temp'
      let activePrompt = userText

      if (isTempChat) activePrompt = userText.replace(/^\/temp\s*/i, '').trim()

      if (photo && photo.length > 0) {
        await telegram.sendAction(chatId, 'typing')
        const fileInfo = await telegram.getFile(photo[photo.length - 1].file_id)
        if (fileInfo?.file_path) photoBuffer = (await telegram.downloadFile(fileInfo.file_path)) || undefined
      } else {
        const isImg = (activePrompt || '').toLowerCase().includes('draw') || (activePrompt || '').toLowerCase().includes('generate')
        await telegram.sendAction(chatId, isImg ? 'upload_photo' : 'typing')
      }

      // ── Log incoming user message ──
      const requestId = crypto.randomUUID()
      const usageType = photo ? 'vision' : 'chat'
      logWebInteraction(linkedAuthUserId, activePrompt, 'user', usageType, 'success', undefined, requestId, undefined, undefined, activeChatId)
        .catch(e => logger.error('User web log failed', e))

      const { runChain } = await import('@/lib/bot/chainRouter')
      const result = await runChain(activePrompt, photoBuffer, {
        chatId,
        userId: linkedAuthUserId,
        activeChatId,
        isTempChat,
        mode: botMode as 'default' | 'pro',
        _triggerType: 'telegram',
      })

      // ── Send Response & track message_id ──
      if (result.type === 'photo') {
        const caption = result.text_content || `Generated by Flowr AI ✨`
        const msgId = await telegram.sendPhoto(chatId, result.content as Buffer, caption)
        logModelWebMessage(linkedAuthUserId, '[IMAGE GENERATED]', result.usage_type || 'chat', result.status || 'success', result.model_chain, requestId,
          msgId ? { telegram_message_id: msgId } : undefined, undefined, activeChatId).catch(e => logger.error('Model web log failed', e))
        incrementUsage(user.telegram_id, 'image').catch(e => logger.error('Increment image usage failed', e))
        if (!isTempChat) syncTelegramMessages(linkedAuthUserId, activeChatId, activePrompt, '📸 [Image generated]', result.model_chain)
      } else {
        const msgId = await telegram.sendMessage(chatId, result.content as string)
        logModelWebMessage(linkedAuthUserId, result.content as string, result.usage_type || 'chat', result.status || 'success', result.model_chain, requestId,
          msgId ? { telegram_message_id: msgId } : undefined, undefined, activeChatId).catch(e => logger.error('Model web log failed', e))
        incrementUsage(user.telegram_id, 'message').catch(e => logger.error('Increment message usage failed', e))
        if (!isTempChat && activeChatId) syncTelegramMessages(linkedAuthUserId, activeChatId, activePrompt, result.content as string, result.model_chain)
      }

    } catch (err: any) {
      if (err.message === 'USER_BLOCKED') {
        await telegram.sendMessage(chatId, '🚫 Suspended.')
      } else {
        logger.error('Flow error:', err)
        logInteraction(chatId, err.message || 'Engine error', 'model', 'text', 'chat', 'error').catch(() => {})
        await telegram.sendMessage(chatId, '❌ *Engine Error*')
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('Webhook processing error:', error)
    return NextResponse.json({ ok: true })
  }
}
