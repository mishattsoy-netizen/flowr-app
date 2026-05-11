/**
 * Parses mode-default.txt, mode-think.txt, mode-pro.txt and upserts each
 * section (core_rules, personality, answer_style, thinking_pattern, restrictions,
 * classifier_prompt) into bot_settings per mode, then triggers recompile.
 *
 * Run: node scripts/sync-mode-prompts.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const promptDir = join(root, 'bot prompts(premission to edit needed!)')

// Load env
const envRaw = readFileSync(join(root, '.env'), 'utf8')
const env = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] })
)

const supabase = createClient(
  env['NEXT_PUBLIC_SUPABASE_URL'],
  env['SUPABASE_SERVICE_ROLE_KEY']
)

// Maps txt section headers → bot_settings category values
const SECTION_MAP = {
  '[CORE RULES]': 'core_rules',
  '[PERSONALITY]': 'personality',
  '[ANSWER STYLE]': 'answer_style',
  '[THINKING PATTERN]': 'thinking_pattern',
  '[RESTRICTIONS]': 'restrictions',
  '[CLASSIFIER PROMPT]': 'classifier_prompt',
}

const MODE_FILES = [
  { mode: 'default', file: 'mode-default.txt' },
  { mode: 'pro',     file: 'mode-pro.txt'     },
]

function parseSections(text) {
  const sections = {}
  let currentKey = null
  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    const matchedHeader = Object.keys(SECTION_MAP).find(h => trimmed === h)
    if (matchedHeader) {
      currentKey = SECTION_MAP[matchedHeader]
      sections[currentKey] = []
    } else if (currentKey) {
      sections[currentKey].push(line)
    }
  }

  // Trim leading/trailing blank lines from each section
  for (const key of Object.keys(sections)) {
    const arr = sections[key]
    while (arr.length && arr[0].trim() === '') arr.shift()
    while (arr.length && arr[arr.length - 1].trim() === '') arr.pop()
    sections[key] = arr.join('\n')
  }

  return sections
}

async function syncMode(mode, file) {
  const text = readFileSync(join(promptDir, file), 'utf8')
  const sections = parseSections(text)

  const categories = Object.keys(sections)
  console.log(`\n[${mode}] Found sections: ${categories.join(', ')}`)

  for (const [category, content] of Object.entries(sections)) {
    const { error } = await supabase
      .from('bot_settings')
      .upsert(
        { category, content, mode, is_active: true, updated_at: new Date().toISOString() },
        { onConflict: 'category,mode' }
      )

    if (error) {
      console.error(`  ✗ ${category}: ${error.message}`)
    } else {
      console.log(`  ✓ ${category} (${content.length} chars)`)
    }
  }
}

async function recompileAll() {
  for (const mode of ['default', 'pro']) {
    // Load all active settings for this mode
    const { data: settings, error: sErr } = await supabase
      .from('bot_settings')
      .select('category, content, is_active')
      .eq('mode', mode)
      .in('category', ['core_rules', 'personality', 'answer_style', 'thinking_pattern', 'restrictions'])
      .eq('is_active', true)

    if (sErr) { console.error(`Recompile fetch error [${mode}]:`, sErr.message); continue }

    // Load brain entries (shared)
    const { data: brain } = await supabase
      .from('bot_brain')
      .select('content')
      .eq('is_active', true)
      .order('created_at')

    const ORDER = ['core_rules', 'personality', 'answer_style', 'thinking_pattern', 'restrictions']
    const ordered = ORDER
      .map(cat => settings?.find(s => s.category === cat)?.content)
      .filter(Boolean)

    const brainParts = (brain ?? []).map(b => b.content).filter(Boolean)
    const compiled = [...ordered, ...brainParts].join('\n\n')

    const { error: cErr } = await supabase
      .from('bot_compiled_prompt')
      .upsert(
        { mode, content: compiled, compiled_at: new Date().toISOString(), entry_count: (settings?.length ?? 0) + (brain?.length ?? 0) },
        { onConflict: 'mode' }
      )

    if (cErr) {
      console.error(`  ✗ Recompile [${mode}]: ${cErr.message}`)
    } else {
      console.log(`  ✓ Compiled prompt [${mode}] (${compiled.length} chars, ${(settings?.length ?? 0) + (brain?.length ?? 0)} entries)`)
    }
  }
}

// Main
console.log('Syncing mode prompts to Supabase...')
for (const { mode, file } of MODE_FILES) {
  await syncMode(mode, file)
}

console.log('\nRecompiling all mode prompts...')
await recompileAll()

console.log('\nDone.')
