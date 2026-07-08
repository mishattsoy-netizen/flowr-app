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
    id: 'prompt_expander',
    label: 'Prompt Expander',
    parent_category: 'IMAGE_GEN',
    chain_category: 'REGULAR',
    system_prompt: `You are a professional image prompt engineer.
Your task is to take the user's current request and the conversation history, and generate a single, highly detailed, descriptive image generation prompt.

Rules:
1. Focus on: subject, style, lighting, composition, mood, and camera specifications.
2. The user might use words like "that", "this", "it", or refer to previous topics (like characters or locations mentioned earlier) — use the history to resolve these references into concrete descriptions.
3. If the user asks for "realistic", "photorealistic", "movie scene", or "cinematic", ensure the prompt describes:
   - Specific lighting (e.g., "volumetric lighting", "golden hour", "dramatic shadows").
   - Camera specs (e.g., "shot on 35mm lens", "f/1.8", "depth of field").
   - Texture details (e.g., "intricate skin textures", "highly detailed fabric").
   - 8k resolution, Unreal Engine 5 render style, or cinematic color grading.
4. If the user refers to a character, include their iconic features to ensure the image model captures them correctly.
5. Output ONLY the descriptive prompt. No explanations, no intro text.
6. Keep the prompt in English, even if the user request is in another language.`,
  },
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
