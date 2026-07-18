import { NextRequest, NextResponse, after } from 'next/server'
import { telegram } from '@/lib/bot/telegram'
import { supabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { checkUserAndLimits, incrementUsage } from '@/lib/bot/usageGuard'
import { logInteraction, logWebInteraction, logModelWebMessage } from '@/lib/bot/analytics'
import { parseCommand } from '@/lib/bot/telegram-commands'
import { createTelegramLinkToken } from '@/lib/bot/telegramLinkToken'
import { getClientTime } from '@/data/store.helpers'

const AUTH_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://www.flowr.website'
  : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

/** Escapes legacy Telegram Markdown special characters in untrusted text interpolated outside a code span. */
function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1')
}

/** Escapes a backtick/backslash inside an inline `code` span so untrusted text can't break out of it. */
function escapeInlineCode(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/`/g, '\\`')
}

/**
 * Sync Telegram messages to the web app's conversations/messages tables.
 */
async function syncTelegramMessages(
  authUserId: string,
  chatId: string,
  userMessage: string,
  aiResponse: string,
  modelChain?: string,
  toolResults?: any[],
  attachments?: any[],
): Promise<void> {
  try {
    const { data: existing } = await supabaseAdmin!
      .from('conversations')
      .select('id, user_id')
      .eq('id', chatId)
      .maybeSingle()

    if (!existing) {
      const { data: profile } = await supabaseAdmin!
        .from('profiles')
        .select('active_space_id')
        .eq('id', authUserId)
        .maybeSingle()

      const title = userMessage.length > 60
        ? userMessage.slice(0, 57) + '…'
        : userMessage || 'Telegram Chat'
      await supabaseAdmin!.from('conversations').insert({
        id: chatId,
        user_id: authUserId,
        title,
        updated_at: new Date().toISOString(),
        space_id: profile?.active_space_id || null,
      })
    } else if (existing.user_id === authUserId) {
      await supabaseAdmin!.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', chatId)
    } else {
      logger.warn(`[Telegram sync] Refusing to sync conversation ${chatId}: owned by ${existing.user_id}, not ${authUserId}`)
      return
    }
    let userContent = userMessage
    if (attachments && attachments.length > 0) {
      userContent = `${userContent}\n\n<!-- ATTACHMENTS_JSON:${JSON.stringify(attachments)} -->`
    }
    await supabaseAdmin!.from('messages').insert({ conversation_id: chatId, role: 'user', content: userContent })
    let assistantContent = typeof aiResponse === 'string' ? aiResponse : '[Image generated]'
    if (toolResults && toolResults.length > 0) {
      assistantContent = `${assistantContent}\n\n<!-- TOOL_RESULTS_JSON:${JSON.stringify(toolResults)} -->`
    }
    await supabaseAdmin!.from('messages').insert({
      conversation_id: chatId, role: 'assistant',
      content: assistantContent,
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
async function clearSessionMessages(chatId: number, sessionChatId: string, authUserId: string): Promise<number> {
  try {
    const { data: logs } = await supabaseAdmin!
      .from('message_logs')
      .select('context_messages')
      .eq('topic_tag', `chat:${sessionChatId}`)
      .eq('auth_user_id', authUserId)
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
      const { data: profile } = await supabaseAdmin!
        .from('profiles')
        .select('active_space_id')
        .eq('id', authUserId)
        .maybeSingle()

      await supabaseAdmin!.from('conversations').insert({
        id: activeChatId,
        user_id: authUserId,
        title: systemMessage.replace(/\*+/g, '').trim(),
        updated_at: new Date().toISOString(),
        space_id: profile?.active_space_id || null,
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

  if (data === 'clear_all_guide') {
    await telegram.sendMessage(chatId,
      `🗑️ *Clear entire chat*

Bot API can only delete bot messages, not yours. To clear everything:

• *Mobile:* Tap bot name at top → *Clear chat*
• *Desktop:* Right-click chat → *Clear history*
• *Web:* Click ⋮ → *Clear history*

Your session context is already reset — the bot won't see old messages. This just cleans the Telegram UI.`)
    return
  }

  const type = data === 'clear_new' ? 'saved' : 'temp'
  await clearSessionMessages(chatId, activeChatId, linkedAuthUserId)
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

    let linkedAuthUserId: string | null = null
    let activeChatId: string | null = null
    let botMode: string = 'default'
    let requestId: string | null = null
    let result: any = null

    try {
      const user = await checkUserAndLimits(chatId)

      // Fetch linked auth info + bot mode
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
        if (linkedAuthUserId) {
          await telegram.sendMessage(chatId,
            `👋 *Welcome back!* Ready to pick up where you left off.

Just send me a message — I can browse the web, create notes, manage tasks, and more.

📌 Send /help to see all commands.`)
        } else {
          await telegram.sendMessage(chatId,
            `🌟 *Flowr AI — Your Productivity Bot*

Hey there! I'm the Telegram bot for *Flowr* — a productivity platform that combines notes, tasks, whiteboards, and AI into one workspace.

Here's what I can do for you:

🧠 *Chat with AI* — Ask questions, brainstorm, get advice
🌐 *Browse the web* — Real-time search and research
📝 *Create notes & tasks* — Right inside your Flowr account
🎨 *Generate images* — Describe what you want
🔄 *Full sync* — Chats appear in the Flowr web app too

*To get started:*
🔐 Send /login to link your Google account
📖 Send /help to see all commands
💬 Or just say hello — I'll figure out the rest :)`)
        }
        return NextResponse.json({ ok: true })
      }

      if (cmd.type === 'login') {
        if (linkedAuthUserId) {
          await telegram.sendMessage(chatId, '✅ *Already linked!* Send /account for details.')
        } else {
          const token = createTelegramLinkToken(chatId)
          const link = `${AUTH_BASE_URL}/auth/telegram-link?tg=${chatId}&token=${encodeURIComponent(token)}`
          await telegram.sendMessage(chatId,
            `🔗 *Link Your Account*\n\nTap the link below to sign in with Google:\n\n${link}\n\nThis link expires in 10 minutes. After linking, send /account to confirm.`)
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
            `📋 *Account Info*\n\n*Linked:* ✅\n*Email:* \`${escapeInlineCode(email)}\`\n*Plan:* ${escapeMarkdown(user.preset_name)}`)
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
        const deleted = await clearSessionMessages(chatId, activeChatId, linkedAuthUserId)
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
              { text: '🗑️ Clear All', callback_data: 'clear_all_guide' },
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

      if (cmd.type === 'spaces') {
        if (!linkedAuthUserId) {
          await telegram.sendMessage(chatId, '🔒 Please /login first.')
          return NextResponse.json({ ok: true })
        }

        const value = cmd.value.trim()

        // 1. Fetch user's spaces
        const { data: spaces, error: spacesError } = await supabaseAdmin!
          .from('spaces')
          .select('id, name, is_default')
          .eq('owner_id', linkedAuthUserId)
          .order('name', { ascending: true })

        if (spacesError) {
          logger.error('Failed to fetch spaces:', spacesError)
          await telegram.sendMessage(chatId, '❌ Failed to fetch spaces.')
          return NextResponse.json({ ok: true })
        }

        // 2. Fetch current profile active space ID
        const { data: profile } = await supabaseAdmin!
          .from('profiles')
          .select('active_space_id')
          .eq('id', linkedAuthUserId)
          .single()

        const currentActiveId = profile?.active_space_id || spaces?.find((s: any) => s.is_default)?.id || spaces?.[0]?.id

        if (!value) {
          // List spaces
          if (!spaces || spaces.length === 0) {
            await telegram.sendMessage(chatId, '📂 *No spaces found.*')
            return NextResponse.json({ ok: true })
          }

          const spaceListText = spaces.map((s: any) => {
            const isActive = s.id === currentActiveId
            const isDefault = s.is_default
            let suffix = ''
            if (isActive && isDefault) suffix = ' (active, default)'
            else if (isActive) suffix = ' (active)'
            else if (isDefault) suffix = ' (default)'
            return `• *${escapeMarkdown(s.name)}*${suffix}`
          }).join('\n')

          await telegram.sendMessage(chatId,
            `📂 *Your Spaces*\n\n${spaceListText}\n\nTo switch spaces, send:\n/spaces <name>\n/spaces default — to switch to default space`)
          return NextResponse.json({ ok: true })
        }

        if (value.toLowerCase() === 'default') {
          // Switch to default space
          const defaultSpace = spaces?.find((s: any) => s.is_default)
          if (!defaultSpace) {
            await telegram.sendMessage(chatId, '❌ No default space configured.')
            return NextResponse.json({ ok: true })
          }
          await supabaseAdmin!
            .from('profiles')
            .update({ active_space_id: defaultSpace.id })
            .eq('id', linkedAuthUserId)

          await telegram.sendMessage(chatId, `✅ Switched active space to *${escapeMarkdown(defaultSpace.name)}* (default).`)
          return NextResponse.json({ ok: true })
        }

        // Search space by name (case-insensitive) or by ID
        const targetSpace = spaces?.find((s: any) => 
          s.name.toLowerCase() === value.toLowerCase() || s.id === value
        ) || spaces?.find((s: any) =>
          s.name.toLowerCase().includes(value.toLowerCase())
        )

        if (!targetSpace) {
          await telegram.sendMessage(chatId, `❌ Space "${escapeMarkdown(value)}" not found.`)
          return NextResponse.json({ ok: true })
        }

        await supabaseAdmin!
          .from('profiles')
          .update({ active_space_id: targetSpace.id })
          .eq('id', linkedAuthUserId)

        await telegram.sendMessage(chatId, `✅ Switched active space to *${escapeMarkdown(targetSpace.name)}*.`)
        return NextResponse.json({ ok: true })
      }

      if (cmd.type === 'context') {
        if (!linkedAuthUserId || !activeChatId) {
          await telegram.sendMessage(chatId, '🔒 Please /login first to use the bot.')
          return NextResponse.json({ ok: true })
        }
        const { getSessionState } = await import('@/lib/bot/context')
        const sessionState = await getSessionState(activeChatId)
        const pct = sessionState
          ? Math.round((sessionState.token_usage_total / sessionState.context_limit) * 100)
          : 0
        await telegram.sendMessage(chatId, `🧠 *Memory Usage:* ${pct}%`)
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
/clear — Start fresh context in current session
/context — Session memory usage

*Info*
/status — Session stats & health
/id — Your Telegram & session IDs

*Settings*
/mode default|pro — Switch AI mode
/spaces [name] — List or switch spaces
/help — Show this message`)
        return NextResponse.json({ ok: true })
      }

      // ── Auth gate ──
      if (!linkedAuthUserId) {
        await telegram.sendMessage(chatId, '🔒 Please /login first to use the bot.')
        return NextResponse.json({ ok: true })
      }

      // ── Reserve credit against tier budget before any model cost is incurred ──
      requestId = crypto.randomUUID()
      const { data: reserveResult, error: reserveError } = await supabaseAdmin!
        .rpc('reserve_credit_for_user', { p_user_id: linkedAuthUserId, p_request_id: requestId, p_mode: botMode })
        .single()

      if (reserveError) {
        logger.error('[reserve_credit_for_user] error:', reserveError)
        // Fail open on infra errors — same policy as the web route
      } else if (reserveResult && !(reserveResult as any).allowed) {
        const { blocked_window, resets_at } = reserveResult as any
        await telegram.sendMessage(chatId, `You've hit your ${blocked_window} limit. Resets ${resets_at ? new Date(resets_at).toLocaleString() : 'soon'}.`)
        return NextResponse.json({ ok: true })
      }

      // ── Generate active_chat_id if needed ──
      if (!activeChatId) {
        const result = await startNewSession(chatId, linkedAuthUserId, 'saved', botMode)
        activeChatId = result.activeChatId
        await telegram.sendMessage(chatId, result.systemMessage)
      }

      // The user's saved timezone + AI prefs (web Settings → user_settings).
      // Without timezone, date/time math falls back to the server's clock (UTC
      // on Vercel). Style/language are soft defaults for the system prompt.
      let telegramClientTime: string | undefined
      let telegramResponseStyle: string | undefined
      let telegramReplyLanguage: string | undefined
      if (linkedAuthUserId && supabaseAdmin) {
        const { data: settings } = await supabaseAdmin
          .from('user_settings')
          .select('timezone, response_style, reply_language')
          .eq('user_id', linkedAuthUserId)
          .maybeSingle()
        if (settings?.timezone) telegramClientTime = getClientTime(settings.timezone)
        if (settings?.response_style) telegramResponseStyle = settings.response_style
        if (settings?.reply_language) telegramReplyLanguage = settings.reply_language
      }

      // ── Execute and Reply Helper ──
      const executeAndReply = async (prompt: string, buffers?: Buffer[]) => {
        const authId = linkedAuthUserId!
        let attachments: any[] | undefined = undefined
        if (buffers && buffers.length > 0) {
          attachments = []
          for (const buf of buffers) {
            const filename = `${authId}/telegram-${Date.now()}-${crypto.randomUUID()}.jpg`
            const { error } = await supabaseAdmin!.storage.from('user_uploads').upload(filename, buf, {
              contentType: 'image/jpeg',
              cacheControl: '31536000',
              upsert: false,
            })
            if (error) {
              logger.error('Telegram storage upload failed:', error)
            } else {
              const publicUrl = supabaseAdmin!.storage.from('user_uploads').getPublicUrl(filename).data.publicUrl
              attachments.push({ type: 'image', url: publicUrl, name: filename })
            }
          }
        }

        const usageType = buffers && buffers.length > 0 ? 'vision' : 'chat'
        logWebInteraction(authId, prompt, 'user', usageType, 'success', undefined, requestId || undefined, undefined, undefined, activeChatId as string | undefined)
          .catch(e => logger.error('User web log failed', e))

        const { runChain } = await import('@/lib/bot/chainRouter')
        const chainResult = await runChain(prompt, buffers && buffers.length === 1 ? buffers[0] : buffers, {
          chatId,
          userId: authId,
          activeChatId,
          isTempChat,
          mode: botMode as 'default' | 'pro',
          _triggerType: 'telegram',
          clientTime: telegramClientTime,
          responseStyle: telegramResponseStyle,
          replyLanguage: telegramReplyLanguage,
        })

        if (chainResult.type === 'photo') {
          const caption = chainResult.text_content || `Generated by Flowr AI ✨`
          const msgId = await telegram.sendPhoto(chatId, chainResult.content as Buffer, caption)
          logModelWebMessage(authId, '[IMAGE GENERATED]', chainResult.usage_type || 'chat', chainResult.status || 'success', chainResult.model_chain, requestId || undefined,
            msgId ? { telegram_message_id: msgId } : undefined, undefined, activeChatId as string | undefined).catch(e => logger.error('Model web log failed', e))
          incrementUsage(user.telegram_id, 'image').catch(e => logger.error('Increment image usage failed', e))
          if (!isTempChat && activeChatId) await syncTelegramMessages(authId, activeChatId!, prompt, '📸 [Image generated]', chainResult.model_chain, undefined, attachments)
        } else {
          const msgId = await telegram.sendMessage(chatId, chainResult.content as string)
          const tgToolSummary = (chainResult.captured_tool_calls?.length)
            ? '\n\n[Tools: ' + chainResult.captured_tool_calls.map((tc: any) => {
                const name = tc.tool || 'unknown'
                const argHints: string[] = []
                if (tc.searchQuery) argHints.push(`query="${String(tc.searchQuery).slice(0, 40)}"`)
                if (tc.title) argHints.push(`title="${String(tc.title).slice(0, 30)}"`)
                if (tc.id) argHints.push(`id="${String(tc.id).slice(0, 12)}..."`)
                const args = argHints.length > 0 ? `(${argHints.join(', ')})` : ''
                let res = 'ok'
                if (tc.success === false || tc.error) res = `error`
                else if (Array.isArray(tc.items)) res = `${tc.items.length} items`
                else if (Array.isArray(tc.results)) res = `${tc.results.length} results`
                return `${name}${args} → ${res}`
              }).join(' | ') + ']'
            : ''
          if (chainResult.status !== 'error') {
            logModelWebMessage(authId, (chainResult.content as string) + tgToolSummary, chainResult.usage_type || 'chat', chainResult.status || 'success', chainResult.model_chain, requestId || undefined,
              msgId ? { telegram_message_id: msgId } : undefined, undefined, activeChatId as string | undefined).catch(e => logger.error('Model web log failed', e))
          }
          if (!isTempChat && activeChatId) await syncTelegramMessages(authId, activeChatId!, prompt, chainResult.content as string, chainResult.model_chain, chainResult.captured_tool_calls, attachments)
        }
        return chainResult
      }

      // ── Handle photo / send action ──
      const isTempChat = cmd.type === 'temp'
      let activePrompt = userText

      if (isTempChat) activePrompt = userText.replace(/^\/temp\s*/i, '').trim()

      // Bare /temp (no message, no photo) must not fall through to the model:
      // an empty prompt makes it improvise off stale context (observed live:
      // it invented and created a random task).
      if (isTempChat && (!photo || photo.length === 0) && !activePrompt) {
        await telegram.sendMessage(chatId, '🕶️ *Temporary chat*\n\nUsage: /temp <message> — replies are ephemeral and not saved to history.')
        return NextResponse.json({ ok: true })
      }

      if (message.media_group_id && photo && photo.length > 0) {
        const mediaGroupId = message.media_group_id
        const fileId = photo[photo.length - 1].file_id

        // PostgrestBuilder is PromiseLike (then-only, no .catch), and the
        // query doesn't execute until then() is invoked — so fire-and-forget
        // cleanup must go through then().
        supabaseAdmin!.from('telegram_media_groups')
          .delete()
          .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
          .then(undefined, () => {})

        // Atomic append (migration 20260714000005): concurrent invocations for
        // the same album can't lose each other's file_ids the way the old
        // read-modify-write could. Returns the array as of this append.
        const { data: fileIdsAfterAppend, error: appendError } = await supabaseAdmin!
          .rpc('append_telegram_media_file', {
            p_media_group_id: mediaGroupId,
            p_chat_id: String(chatId),
            p_file_id: fileId,
            p_caption: message.caption || null,
          })
        if (appendError) throw appendError
        const countAfterAppend = Array.isArray(fileIdsAfterAppend) ? fileIdsAfterAppend.length : 1

        // Telegram holds back the album's next update until this request
        // responds, so the settle window and claim MUST run after the 200 goes
        // out — sleeping before responding meant the first photo's invocation
        // claimed the group before photos 2..N were ever delivered (observed
        // live: the model only saw the album cover). Only the invocation whose
        // append is still the newest after the settle window attempts the
        // atomic claim; the processed=false gate breaks any remaining tie.
        const reconcileRequestId = requestId
        requestId = null // the after() task owns credit reconciliation for this invocation
        after(async () => {
          let chainResult: any = null
          try {
            await new Promise(resolve => setTimeout(resolve, 2500))

            const { data: group } = await supabaseAdmin!
              .from('telegram_media_groups')
              .select('file_ids, processed')
              .eq('media_group_id', mediaGroupId)
              .maybeSingle()
            const isNewestAppend = !!group && !group.processed
              && (group.file_ids as string[]).length === countAfterAppend
            if (!isNewestAppend) return

            const { data: claimed } = await supabaseAdmin!
              .from('telegram_media_groups')
              .update({ processed: true })
              .eq('media_group_id', mediaGroupId)
              .eq('processed', false)
              .select()
              .maybeSingle()
            if (!claimed) return

            await telegram.sendAction(chatId, 'typing')
            const buffers: Buffer[] = []
            for (const fid of claimed.file_ids) {
              const fileInfo = await telegram.getFile(fid)
              if (fileInfo?.file_path) {
                const buf = await telegram.downloadFile(fileInfo.file_path)
                if (buf) buffers.push(buf)
              }
            }

            let albumPrompt = claimed.caption || ''
            if (isTempChat) albumPrompt = albumPrompt.replace(/^\/temp\s*/i, '').trim()

            chainResult = await executeAndReply(albumPrompt, buffers)
          } catch (err: any) {
            if (err.message === 'USER_BLOCKED') {
              await telegram.sendMessage(chatId, '🚫 Suspended.').catch(() => {})
            } else {
              logger.error('Album flow error:', err)
              logInteraction(chatId, err.message || 'Engine error', 'model', 'text', 'chat', 'error').catch(() => {})
              await telegram.sendMessage(chatId, '❌ *Engine Error*').catch(() => {})
            }
          } finally {
            if (linkedAuthUserId && reconcileRequestId) {
              const finalCost = (chainResult && typeof chainResult.total_cost_usd === 'number') ? chainResult.total_cost_usd : 0
              try {
                await supabaseAdmin!.rpc('reconcile_credit_for_user', { p_user_id: linkedAuthUserId, p_request_id: reconcileRequestId, p_real_amount_usd: finalCost })
              } catch (e: any) {
                logger.error('[reconcile_credit_for_user] error:', e)
              }
            }
          }
        })

        return NextResponse.json({ ok: true })
      } else {
        let buffers: Buffer[] | undefined = undefined
        if (photo && photo.length > 0) {
          await telegram.sendAction(chatId, 'typing')
          const fileInfo = await telegram.getFile(photo[photo.length - 1].file_id)
          if (fileInfo?.file_path) {
            const buf = await telegram.downloadFile(fileInfo.file_path)
            if (buf) buffers = [buf]
          }
        } else {
          const isImg = (activePrompt || '').toLowerCase().includes('draw') || (activePrompt || '').toLowerCase().includes('generate')
          await telegram.sendAction(chatId, isImg ? 'upload_photo' : 'typing')
        }
        
        result = await executeAndReply(activePrompt, buffers)
      }

    } catch (err: any) {
      if (err.message === 'USER_BLOCKED') {
        await telegram.sendMessage(chatId, '🚫 Suspended.')
      } else {
        logger.error('Flow error:', err)
        logInteraction(chatId, err.message || 'Engine error', 'model', 'text', 'chat', 'error').catch(() => {})
        await telegram.sendMessage(chatId, '❌ *Engine Error*')
      }
    } finally {
      if (linkedAuthUserId && requestId) {
        const finalCost = (result && typeof result.total_cost_usd === 'number') ? result.total_cost_usd : 0
        try {
          await supabaseAdmin!.rpc('reconcile_credit_for_user', { p_user_id: linkedAuthUserId, p_request_id: requestId, p_real_amount_usd: finalCost })
        } catch (e: any) {
          logger.error('[reconcile_credit_for_user] error:', e)
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('Webhook processing error:', error)
    return NextResponse.json({ ok: true })
  }
}
