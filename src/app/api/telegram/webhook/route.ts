import { NextRequest, NextResponse } from 'next/server'
import { telegram } from '@/lib/bot/telegram'
import { supabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { checkUserAndLimits } from '@/lib/bot/usageGuard'
import { logInteraction, logWebInteraction, logModelWebMessage } from '@/lib/bot/analytics'
import { parseCommand } from '@/lib/bot/telegram-commands'

const AUTH_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://www.flowr.website'
  : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export async function POST(req: NextRequest) {
  const secret = req.headers.get('X-Telegram-Bot-Api-Secret-Token')

  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    logger.warn('Unauthorized webhook request blocked.')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const message = body.message

    if (!message) return NextResponse.json({ ok: true })

    const chatId = message.chat.id
    const userText = message.text || message.caption || ""
    const photo = message.photo
    const cmd = parseCommand(userText)

    try {
      const user = await checkUserAndLimits(chatId)

      // Fetch linked auth info
      let linkedAuthUserId: string | null = null
      let activeChatId: string | null = null
      try {
        const { data: tgUser } = await supabaseAdmin!
          .from('telegram_users')
          .select('auth_user_id, active_chat_id')
          .eq('telegram_id', chatId)
          .single()
        if (tgUser?.auth_user_id) linkedAuthUserId = tgUser.auth_user_id
        if (tgUser?.active_chat_id) activeChatId = tgUser.active_chat_id
      } catch (e) {
        // telegram_users row might not exist yet (just created by checkUserAndLimits)
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
          await telegram.sendMessage(chatId, '✅ You\'re already linked! Send /status to see your account.')
        } else {
          const link = `${AUTH_BASE_URL}/auth/telegram-link?tg=${chatId}`
          await telegram.sendMessage(chatId,
            `🔗 *Link Your Account*\n\nTap the link below to sign in with Google:\n\n${link}\n\nAfter linking, send /status to confirm.`)
        }
        return NextResponse.json({ ok: true })
      }

      if (cmd.type === 'logout') {
        if (!linkedAuthUserId) {
          await telegram.sendMessage(chatId, 'Not linked to any account.')
        } else {
          await supabaseAdmin!
            .from('telegram_users')
            .update({ auth_user_id: null, active_chat_id: null })
            .eq('telegram_id', chatId)
          await telegram.sendMessage(chatId, '✅ Account unlinked successfully.')
        }
        return NextResponse.json({ ok: true })
      }

      if (cmd.type === 'status') {
        if (linkedAuthUserId) {
          const { data: userData } = await supabaseAdmin!.auth.admin.getUserById(linkedAuthUserId)
          const email = userData?.user?.email || linkedAuthUserId.slice(0, 12)
          await telegram.sendMessage(chatId,
            `📋 *Account Status*\n\n` +
            `*Linked:* ✅\n` +
            `*Email:* \`${email}\`\n` +
            `*Messages:* ${user.messages_used_today}/${user.daily_msg_limit}\n` +
            `*Images:* ${user.images_used_today}/${user.daily_image_limit}\n` +
            `*Plan:* ${user.preset_name}`)
        } else {
          await telegram.sendMessage(chatId,
            `📋 *Account Status*\n\n` +
            `*Linked:* ❌\n` +
            `Use /login to link your account.\n\n` +
            `*Messages:* ${user.messages_used_today}/${user.daily_msg_limit}\n` +
            `*Images:* ${user.images_used_today}/${user.daily_image_limit}`)
        }
        return NextResponse.json({ ok: true })
      }

      if (cmd.type === 'newchat') {
        const newChatId = crypto.randomUUID()
        await supabaseAdmin!
          .from('telegram_users')
          .update({ active_chat_id: newChatId })
          .eq('telegram_id', chatId)
        await telegram.sendMessage(chatId, '🆕 *New chat created.* Previous messages won\'t be used for context.')
        return NextResponse.json({ ok: true })
      }

      // ── Auth gate ──
      if (!linkedAuthUserId) {
        await telegram.sendMessage(chatId, '🔒 Please /login first to use the bot.')
        return NextResponse.json({ ok: true })
      }

      // ── Daily limit check ──
      if (user.messages_used_today >= user.daily_msg_limit) {
        await telegram.sendMessage(chatId, '⚡ *Daily Limit Reached*')
        return NextResponse.json({ ok: true })
      }

      // ── Generate active_chat_id if needed ──
      if (!activeChatId) {
        activeChatId = crypto.randomUUID()
        await supabaseAdmin!
          .from('telegram_users')
          .update({ active_chat_id: activeChatId })
          .eq('telegram_id', chatId)
      }

      // ── Handle photo / send action ──
      let photoBuffer: Buffer | undefined = undefined
      const isTempChat = cmd.type === 'newtempchat'
      let activePrompt = userText

      if (isTempChat) {
        // Strip the /newtempchat prefix to get the actual message
        activePrompt = userText.replace(/^\/newtempchat\s*/i, '').trim()
      }

      if (photo && photo.length > 0) {
        await telegram.sendAction(chatId, 'typing')
        const fileInfo = await telegram.getFile(photo[photo.length - 1].file_id)
        if (fileInfo?.file_path) {
          photoBuffer = (await telegram.downloadFile(fileInfo.file_path)) || undefined
        }
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
        _triggerType: 'telegram',
      })

      // ── Send Response ──
      if (result.type === 'photo') {
        const caption = result.text_content || `Generated by Flowr AI ✨`
        await telegram.sendPhoto(chatId, result.content as Buffer, caption)
        logModelWebMessage(linkedAuthUserId, '[IMAGE GENERATED]', result.usage_type || 'chat', result.status || 'success', result.model_chain, requestId, undefined, undefined, activeChatId)
          .catch(e => logger.error('Model web log failed', e))

        const { incrementUsage } = await import('@/lib/bot/usageGuard')
        incrementUsage(user.telegram_id, 'image').catch(e => logger.error('Increment image usage failed', e))
      } else {
        await telegram.sendMessage(chatId, result.content as string)
        logModelWebMessage(linkedAuthUserId, result.content as string, result.usage_type || 'chat', result.status || 'success', result.model_chain, requestId, undefined, undefined, activeChatId)
          .catch(e => logger.error('Model web log failed', e))

        const { incrementUsage } = await import('@/lib/bot/usageGuard')
        incrementUsage(user.telegram_id, 'message').catch(e => logger.error('Increment message usage failed', e))
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
