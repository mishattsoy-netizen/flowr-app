import { supabaseAdmin } from './supabase'
import { IntentCategory } from './router-config'

export interface SubchainConfig {
  id: string
  label: string
  parent_category: string
  chain_category: IntentCategory
  system_prompt: string
}

const SETTINGS_KEY = 'subchain_configs'

const DEFAULTS: SubchainConfig[] = [

  {
    id: 'image_narration',
    label: 'Image Narration',
    parent_category: 'IMAGE_GEN',
    chain_category: 'VISION',
    system_prompt: `You are an expert image analyst and storyteller.
Your task is to provide a detailed, vivid description of the provided image.

Rules:
1. Length: Minimum 250 characters, Maximum 700 characters.
2. Content: Describe the subject, environment, lighting, colors, and mood.
3. Tone: Professional, descriptive, and engaging.
4. Output ONLY the description. No intro like "The image shows..." or "Here is the description:".
5. Focus on what is actually present in the image.`,
  },
]

let _cache: SubchainConfig[] | null = null

export async function getAllSubchainConfigs(): Promise<SubchainConfig[]> {
  if (_cache) return _cache
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()
    if (error || !data?.value) {
      _cache = DEFAULTS
      return DEFAULTS
    }
    const saved = data.value as SubchainConfig[]
    const merged = DEFAULTS.map(d => {
      const override = saved.find(s => s.id === d.id)
      return override ? { ...d, ...override } : d
    })
    _cache = merged
    return merged
  } catch {
    return DEFAULTS
  }
}

export async function getSubchainConfig(id: string): Promise<SubchainConfig | undefined> {
  const all = await getAllSubchainConfigs()
  return all.find(c => c.id === id)
}

export function invalidateSubchainCache() {
  _cache = null
}
