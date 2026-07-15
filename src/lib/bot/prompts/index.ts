import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

function getPromptsDir(): string {
  const cwdPath = join(process.cwd(), 'src', 'lib', 'bot', 'prompts')
  if (existsSync(cwdPath)) return cwdPath
  return join(__dirname, '..', '..', '..', '..', 'src', 'lib', 'bot', 'prompts')
}

const PROMPTS_DIR = getPromptsDir()

const cache = new Map<string, string>()

/**
 * Reads a .txt prompt file from the prompts directory.
 * Results are cached in memory for the lifetime of the process.
 */
function loadPrompt(relativePath: string): string {
  if (process.env.NODE_ENV !== 'development' && cache.has(relativePath)) {
    return cache.get(relativePath)!
  }
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

const CHAIN_DEFAULTS: Record<string, string> = {
  regular: "You produce the final user-facing answer. Synthesize all pipeline inputs into a clear, well-structured response.",
  complex: "You produce the final user-facing answer for complex, multi-step problems. Decompose, reason, and deliver a thorough, well-structured response.",
  coding: "You are a code generation agent. Write complete, runnable code with clear explanations. Never output pseudocode — always real, production-quality code.",
  web_search: "Your job: search the web, find current information, and write a clear, sourced answer. You are an active search agent.",
  research: "You are a research agent. Your job: conduct exhaustive multi-round research across multiple sources and produce a comprehensive, well-structured report.",
  classifier: "Classify user intent into exactly ONE category. Respond ONLY with the category name.",
  thinking: "You are the reasoning layer in a multi-step AI pipeline. Your job is to review all chain outputs, catch errors or gaps, consider multiple approaches, and commit to the clearest direction for the final answer.",
  compaction: "You are a conversation compactor. Given a raw chat history, produce a concise summary that preserves all important context.",
  vision: "You are a vision analysis agent. When the user uploads an image, analyze it carefully and provide a detailed, accurate description or answer based on what you see.",
  advisor: "You are an Advisor agent. Your role is to conduct a structured planning conversation with the user before the request is processed by the main chain."
}

/** Chain-specific prompt (e.g. 'regular', 'complex') */
export function getChainPrompt(chain: string): string {
  const normalizedKey = chain.toLowerCase()
  try {
    return loadPrompt(join('chains', `${normalizedKey}.txt`))
  } catch {
    return CHAIN_DEFAULTS[normalizedKey] || ''
  }
}

/**
 * Builds the full "global" prompt by concatenating all personality sections.
 * This is the static, cacheable portion of the system prompt.
 */
export function getGlobalPrompt(): string {
  return loadPrompt('system_prompt.txt')
}

/**
 * Invalidate the prompt cache (useful for hot-reloading during dev).
 */
export function clearPromptCache(): void {
  cache.clear()
}
