export type V2Category = 'PRIMARY' | 'WEB_SEARCH' | 'RESEARCH' | 'IMAGE_GEN'

export interface V2Classification {
  category: V2Category
  complexity: 'normal' | 'hard'
  action: boolean
  focus_shift: string | null
}

const V2_CATEGORIES: V2Category[] = ['PRIMARY', 'WEB_SEARCH', 'RESEARCH', 'IMAGE_GEN']

/**
 * Parses the v2 classifier's JSON output. Tolerant of fences/preamble; salvages
 * a bare category word. `action` now means "needs multiple coordinated tool
 * calls" (not "touches app content" — a single create/list/delete is false and
 * can run on Light). The classifier prompt defaults `action` to false; here we
 * trust a well-formed `action: false` from the model as-is. Only on a fully
 * malformed/unparseable response (the salvage path below) do we fall back to
 * action: true — a genuinely unknown case should not be under-provisioned.
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
          focus_shift: typeof obj.focus_shift === 'string' && obj.focus_shift.trim() ? obj.focus_shift.trim() : null,
        }
      }
    } catch { /* fall through to salvage */ }
  }
  const upper = raw.toUpperCase()
  for (const cat of V2_CATEGORIES) {
    if (new RegExp(`\\b${cat}\\b`).test(upper)) {
      return { category: cat, complexity: 'normal', action: true, focus_shift: null }
    }
  }
  return null
}

/**
 * `action` = needs multiple coordinated tool calls (spec §4, refined after
 * v1 testing: single simple actions like "create task X" or "list my tasks"
 * are false and route to Light; "create a task AND a note", "read this image
 * and create a note from it" are true and route to Smart).
 * Rule: `action || hard || extended → Smart; else → Light`.
 */
export function selectTier(input: { action: boolean; complexity: 'normal' | 'hard'; extendedThinking: boolean }): 'smart' | 'light' {
  return (input.action || input.complexity === 'hard' || input.extendedThinking) ? 'smart' : 'light'
}

/** Spec §3: toggle or hard → model max ('high'); otherwise 'medium'. */
export function resolveThinkingLevel(input: { complexity: 'normal' | 'hard'; thinkingToggle: boolean }): 'medium' | 'high' {
  return (input.thinkingToggle || input.complexity === 'hard') ? 'high' : 'medium'
}
