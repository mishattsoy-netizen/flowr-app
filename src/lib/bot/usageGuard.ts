import { supabaseAdmin } from '../supabase'
import { logger } from '../logger'
import { sendAdminAlert } from './notifications'

export interface UserStatus {
  telegram_id: number
  is_blocked: boolean
  messages_used_today: number
  images_used_today: number
  daily_msg_limit: number
  daily_image_limit: number
  has_vision: boolean
  has_web_search: boolean
  has_image_gen: boolean
  preset_name: string
}

/**
 * Verifies user registration and checks usage limits.
 */
export async function checkUserAndLimits(telegramId: number): Promise<UserStatus> {
  const { data: user, error } = await supabaseAdmin
    .from('telegram_users')
    .select(`
      telegram_id,
      is_blocked,
      messages_used_today,
      images_used_today,
      limit_presets (
        name,
        daily_msg_limit,
        daily_image_limit,
        has_vision,
        has_web_search,
        has_image_gen
      )
    `)
    .eq('telegram_id', telegramId)
    .single()

  if (error && error.code === 'PGRST116') {
     // Default preset is Standard
    const { data: preset } = await supabaseAdmin!.from('limit_presets').select().eq('name', 'Standard').single()
    const { data: newUser, error: insertError } = await supabaseAdmin!
      .from('telegram_users')
      .insert({ telegram_id: telegramId, preset_id: preset?.id })
      .select('*, limit_presets(*)')
      .single()

    if (insertError) throw insertError
    return formatUser(newUser)
  }

  if (error) throw error
  if (user.is_blocked) throw new Error('USER_BLOCKED')
  return formatUser(user)
}

/**
 * Increments the user's daily usage count and triggers alerts if thresholds are met.
 */
export async function incrementUsage(telegramId: number, type: 'message' | 'image' = 'message') {
  const column = type === 'message' ? 'messages_used_today' : 'images_used_today'
  
  // Fetch current usage and limits to check thresholds
  const { data: user, error } = await supabaseAdmin!
    .from('telegram_users')
    .select(`
      username,
      telegram_id,
      messages_used_today,
      images_used_today,
      limit_presets (
        daily_image_limit
      )
    `)
    .eq('telegram_id', telegramId)
    .single()

  if (error) {
    logger.error('Failed to fetch user for usage increment:', error)
    return
  }

  const u = user as any
  const newValue = (u?.[column] || 0) + 1
  const limit = Array.isArray(u.limit_presets) ? u.limit_presets[0]?.daily_image_limit : u.limit_presets?.daily_image_limit || 0

  await supabaseAdmin!
    .from('telegram_users')
    .update({ [column]: newValue })
    .eq('telegram_id', telegramId)

  // Early Warning System: 90% Image Generation Limit Notification
  if (type === 'image' && limit > 0) {
    const threshold = Math.floor(limit * 0.9)
    if (newValue === threshold) {
      await sendAdminAlert(
        `≡ƒôê *Usage Warning*\n\nUser @${user.username || user.telegram_id} has reached *90%* of their daily image generation limit (${newValue}/${limit}).`
      )
    }
  }
}

function formatUser(raw: any): UserStatus {
  const lp = raw.limit_presets || {}
  return {
    telegram_id: raw.telegram_id,
    is_blocked: raw.is_blocked,
    messages_used_today: raw.messages_used_today || 0,
    images_used_today: raw.images_used_today || 0,
    daily_msg_limit: lp.daily_msg_limit || 0,
    daily_image_limit: lp.daily_image_limit || 0,
    has_vision: lp.has_vision || false,
    has_web_search: lp.has_web_search || false,
    has_image_gen: lp.has_image_gen || false,
    preset_name: lp.name || 'Unknown'
  }
}
