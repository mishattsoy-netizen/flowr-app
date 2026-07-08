import { supabaseAdmin as supabase } from '@/lib/supabase'
import { logger } from '../logger'
import { getCachedInternalPrompts, setCachedInternalPrompts } from './promptCache'

export async function getInternalPrompt(chainType: string): Promise<string> {
  // 0. In-memory cache — avoids Supabase query on every request
  const cached = getCachedInternalPrompts()
  if (cached) return cached[chainType] ?? ''

  // 1. Supabase primary
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'pipeline_internal_prompts')
        .limit(1)
        .maybeSingle()

      if (!error && data) {
        const customPrompts = (data.value as Record<string, string>) ?? {}
        setCachedInternalPrompts(customPrompts)
        return customPrompts[chainType] ?? ''
      }
    } catch (err) {
      logger.warn(`getInternalPrompt: DB error: ${err}`)
    }
  }

  return ''
}
