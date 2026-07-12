export type V2Category = 'PRIMARY' | 'WEB_SEARCH' | 'RESEARCH' | 'IMAGE_GEN'

export interface V2Classification {
  category: V2Category
  complexity: 'normal' | 'hard'
  action: boolean
}

const V2_CATEGORIES: V2Category[] = ['PRIMARY', 'WEB_SEARCH', 'RESEARCH', 'IMAGE_GEN']

/**
 * Parses the v2 classifier's JSON output. Tolerant of fences/preamble; salvages
 * a bare category word. Flag defaults are SAFE-side: complexity 'normal'
 * (cheap), action true (a chat turn on Smart costs a little more, but an
 * action turn on Light fails — spec §2).
 */
export function parseClassifierV2Output(raw: string): V2Classification | null {
  if (!raw) return null
  const jsonMatch = raw.match(/\{[\s\S]*?\}/)
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0])
      const cat = String(obj.category ?? '').toUpperCase()
      if (V2_CATEGORIES.includes(cat as V2Category)) {
        return {
          category: cat as V2Category,
          complexity: obj.complexity === 'hard' ? 'hard' : 'normal',
          action: obj.action === false ? false : true,
        }
      }
    } catch { /* fall through to salvage */ }
  }
  const upper = raw.toUpperCase()
  for (const cat of V2_CATEGORIES) {
    if (new RegExp(`\\b${cat}\\b`).test(upper)) {
      return { category: cat, complexity: 'normal', action: true }
    }
  }
  return null
}

/** Spec §4: `action || hard || extended → Smart; else → Light`. */
export function selectTier(input: { action: boolean; complexity: 'normal' | 'hard'; extendedThinking: boolean }): 'smart' | 'light' {
  return (input.action || input.complexity === 'hard' || input.extendedThinking) ? 'smart' : 'light'
}

/** Spec §3: toggle or hard → model max ('high'); otherwise 'medium'. */
export function resolveThinkingLevel(input: { complexity: 'normal' | 'hard'; thinkingToggle: boolean }): 'medium' | 'high' {
  return (input.thinkingToggle || input.complexity === 'hard') ? 'high' : 'medium'
}
