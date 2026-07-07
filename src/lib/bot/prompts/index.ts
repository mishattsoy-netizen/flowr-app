import { readFileSync } from 'fs'
import { join } from 'path'

const PROMPTS_DIR = join(process.cwd(), 'src', 'lib', 'bot', 'prompts')

const cache = new Map<string, string>()

/**
 * Reads a .txt prompt file from the prompts directory.
 * Results are cached in memory for the lifetime of the process.
 */
function loadPrompt(relativePath: string): string {
  if (cache.has(relativePath)) return cache.get(relativePath)!
  const fullPath = join(PROMPTS_DIR, relativePath)
  const content = readFileSync(fullPath, 'utf-8').trim()
  cache.set(relativePath, content)
  return content
}

/** Core identity rules */
export function getCoreRules(): string {
  return loadPrompt('core_rules.txt')
}

/** AI personality traits */
export function getPersonality(): string {
  return loadPrompt('personality.txt')
}

/** Answer formatting style */
export function getAnswerStyle(): string {
  return loadPrompt('answer_style.txt')
}

/** Thinking/reasoning pattern */
export function getThinkingPattern(): string {
  return loadPrompt('thinking_pattern.txt')
}

/** Security restrictions */
export function getRestrictions(): string {
  return loadPrompt('restrictions.txt')
}

/** XML tool instructions */
export function getToolInstructions(): string {
  return loadPrompt('tools.txt')
}

/** Chain-specific prompt (e.g. 'regular', 'complex') */
export function getChainPrompt(chain: string): string {
  try {
    return loadPrompt(join('chains', `${chain.toLowerCase()}.txt`))
  } catch {
    return ''
  }
}

/**
 * Builds the full "global" prompt by concatenating all personality sections.
 * This is the static, cacheable portion of the system prompt.
 */
export function getGlobalPrompt(): string {
  return [
    '[CORE RULES]',
    getCoreRules(),
    '',
    '[PERSONALITY]',
    getPersonality(),
    '',
    '[ANSWER STYLE]',
    getAnswerStyle(),
    '',
    '[THINKING PATTERN]',
    getThinkingPattern(),
    '',
    '[RESTRICTIONS]',
    getRestrictions(),
  ].join('\n')
}

/**
 * Invalidate the prompt cache (useful for hot-reloading during dev).
 */
export function clearPromptCache(): void {
  cache.clear()
}
