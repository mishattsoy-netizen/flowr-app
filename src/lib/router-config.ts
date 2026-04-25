import { supabaseAdmin as supabase } from './supabase'

export interface RouterModel {
  id: string
  provider: 'google' | 'huggingface' | 'cloudflare' | 'groq' | 'local' | 'vault'
  is_enabled: boolean
}

export type IntentCategory =
  | 'FAST_SIMPLE'
  | 'COMPLEX_THINKING'
  | 'MEDIUM_THINKING'
  | 'AUDIO_VOICE'
  | 'TOOL_CALLING'
  | 'IMAGE_GEN'
  | 'WEB_SEARCH'
  | 'CLASSIFIER'
  | 'VISION'

export type Platform = 'app' | 'telegram'

export async function getRouterChain(
  category: IntentCategory,
  platform: Platform = 'telegram'
): Promise<{ chain: RouterModel[], system_prompt?: string }> {
  const { data, error } = await supabase
    .from('router_chains')
    .select('model_list, system_prompt')
    .eq('category', category)
    .eq('platform', platform)
    .maybeSingle()

  if (error || !data) {
    console.warn(`No router chain found for category: ${category}, platform: ${platform}.`)
    return { chain: [] }
  }

  return {
    chain: (data.model_list as RouterModel[]).filter(m => m.is_enabled),
    system_prompt: (data as any).system_prompt || undefined
  }
}
