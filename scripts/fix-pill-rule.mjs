/**
 * Pill placement fix — single source of truth in the global ANSWER STYLE.
 *
 * (A) Adds a placement rule to bot_settings.answer_style for default + pro modes
 *     by extending the existing "**Links** as [label](url)..." line. Then recompiles.
 * (B) Trims the detailed placement sentence in the 4 pill-emitting chain prompts
 *     (REGULAR, WEB_SEARCH, COMPLEX, RESEARCH) on the LIVE platform ('telegram')
 *     down to a short "per ANSWER STYLE" pointer, so the rule isn't duplicated.
 *
 * Dry-run by default. Pass --apply to write.
 *
 * Run: node scripts/fix-pill-rule.mjs           (dry run)
 *      node scripts/fix-pill-rule.mjs --apply    (write to DB + recompile)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envRaw = readFileSync(join(root, '.env'), 'utf8')
const env = Object.fromEntries(
  envRaw.split('\n').filter(l => l.includes('=')).map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] })
)
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'])
const APPLY = process.argv.includes('--apply')
const LIVE_PLATFORM = 'telegram' // the platform value getRouterChain() actually reads

// ---- (A) GLOBAL answer_style ----
const LINKS_OLD_DEFAULT = '- **Links** as [label](url) — render as styled pill chips with favicons. Prefer descriptive labels over raw URLs.'
const LINKS_OLD_PRO     = '- **Links** as [label](url) — render as styled pill chips with favicons.'
const LINKS_NEW =
  '- **Source pills** `[label](url)` — render as styled pill chips with favicons. Prefer descriptive labels over raw URLs. ' +
  'Place all of a paragraph’s source pills as a SINGLE bare cluster at the very END of the paragraph, list item, or table row — AFTER the closing punctuation, with one space before the cluster. ' +
  'Never put a pill before a comma or period, never mid-sentence, and never wrap a pill in or attach it to parentheses, brackets, quotes, dashes, or colons. ' +
  'Multiple adjacent pills sit directly side by side with no separator between them. ' +
  'Example: a paragraph ending “...preserved” renders as `...preserved. [Polygon](polygon.com)[IGN](ign.com)` — never `...preserved [Polygon](polygon.com), [IGN](ign.com).` and never `([IGN](ign.com))`.'

// ---- (B) CHAIN prompts: replace detailed placement sentence with a pointer ----
const CHAIN_REPLACEMENTS = [
  // REGULAR
  { from: 'a [title](url) pill at the end of its paragraph, list item, or info block — never inside sentence text. No spaces, commas, dots, bullets, or any other separators between pills — they must sit directly adjacent. No emojis in pill labels — plain text only. No "Source:" prefix, no separate source section.',
    to:   'a source pill following the ANSWER STYLE pill-placement rules (one bare cluster at the end of the block, after punctuation, never wrapped, never mid-sentence). No "Source:" prefix, no separate source section.' },
  // RESEARCH
  { from: 'with [title](url) pill placed at the end of each paragraph, list item, or info block — never inside sentence text. No spaces, commas, dots, bullets, or any other separators between pills — they must sit directly adjacent. No emojis in pill labels — plain text only. No "Source:" prefix, no separate source section.',
    to:   'with a source pill following the ANSWER STYLE pill-placement rules (one bare cluster at the end of the block, after punctuation, never wrapped, never mid-sentence). No "Source:" prefix, no separate source section.' },
  // COMPLEX
  { from: 'with [title](url) pills placed at the end of each paragraph, list item, or info block — never inside sentence text. No spaces, commas, dots, bullets, or any other separators between pills — they must sit directly adjacent. No emojis in pill labels — plain text only. No "Source:" prefix, no separate source section.',
    to:   'with source pills following the ANSWER STYLE pill-placement rules (one bare cluster at the end of the block, after punctuation, never wrapped, never mid-sentence). No "Source:" prefix, no separate source section.' },
  // WEB_SEARCH
  { from: 'Place [title](url) pill at the end of each paragraph, list item, table row, or info block each source supports — never inside sentence text. Every factual block gets its own pill(s). No spaces, commas, dots, bullets, dividers, or any other separators between pills — they must sit directly adjacent. No "Source:" prefix, no separate source section. No emojis in pill labels — plain text only. Example: `[CNN](cnn.com)[Reuters](reuters.com)` — never `[CNN](cnn.com), [Reuters](reuters.com)` or `[CNN](cnn.com) • [Reuters](reuters.com)`.',
    to:   'Attach source pills following the ANSWER STYLE pill-placement rules (one bare cluster at the end of each factual block, after punctuation, never wrapped, never mid-sentence; adjacent pills with no separator). No "Source:" prefix, no separate source section.' },
]

function showLine(label, text, needle) {
  const line = text.split('\n').find(l => l.includes(needle))
  console.log(`   ${label}: ${line ? line.trim() : '(line not found)'}`)
}

// ===== (A) =====
console.log('========== (A) GLOBAL answer_style ==========')
const { data: settings, error: sErr } = await supabase
  .from('bot_settings').select('mode, content').eq('category', 'answer_style').eq('is_active', true)
if (sErr) { console.error(sErr); process.exit(1) }

let aChanged = 0
for (const s of settings) {
  const oldLink = s.mode === 'pro' ? LINKS_OLD_PRO : LINKS_OLD_DEFAULT
  if (!s.content.includes(oldLink)) {
    console.log(`\n⏭  answer_style/${s.mode}: Links line not found verbatim — SKIPPED`)
    continue
  }
  const updated = s.content.replace(oldLink, LINKS_NEW)
  console.log(`\n✏️  answer_style/${s.mode}`)
  showLine('BEFORE', s.content, '**Links**')
  showLine('AFTER ', updated, '**Source pills**')
  if (APPLY) {
    const { error } = await supabase.from('bot_settings').update({ content: updated }).eq('category', 'answer_style').eq('mode', s.mode)
    if (error) { console.error(`   ❌ ${error.message}`); continue }
    console.log('   ✅ written')
  }
  aChanged++
}

// ===== (B) =====
console.log('\n========== (B) CHAIN prompts (platform=' + LIVE_PLATFORM + ') ==========')
const { data: chains, error: cErr } = await supabase
  .from('router_chains').select('id, category, platform, system_prompt')
  .eq('platform', LIVE_PLATFORM)
  .in('category', ['REGULAR', 'WEB_SEARCH', 'COMPLEX', 'RESEARCH'])
if (cErr) { console.error(cErr); process.exit(1) }

let bChanged = 0
for (const row of chains) {
  let sp = row.system_prompt
  let hit = false
  for (const { from, to } of CHAIN_REPLACEMENTS) {
    if (sp.includes(from)) { sp = sp.replace(from, to); hit = true }
  }
  if (!hit) { console.log(`\n⏭  ${row.category}/${row.platform}: no matching fragment — SKIPPED (id=${row.id})`); continue }
  console.log(`\n✏️  ${row.category}/${row.platform} (id=${row.id})`)
  showLine('BEFORE', row.system_prompt, 'pill')
  showLine('AFTER ', sp, 'ANSWER STYLE pill')
  if (APPLY) {
    const { error } = await supabase.from('router_chains').update({ system_prompt: sp, updated_at: new Date().toISOString() }).eq('id', row.id)
    if (error) { console.error(`   ❌ ${error.message}`); continue }
    console.log('   ✅ written')
  }
  bChanged++
}

// ===== recompile global prompt so answer_style change takes effect =====
if (APPLY && aChanged > 0) {
  console.log('\n========== Recompiling global prompt ==========')
  const SECTION_ORDER = ['core_rules', 'personality', 'answer_style', 'thinking_pattern', 'restrictions']
  const LABELS = { core_rules: 'CORE RULES', personality: 'PERSONALITY', answer_style: 'ANSWER STYLE', thinking_pattern: 'THINKING PATTERN', restrictions: 'RESTRICTIONS' }
  for (const mode of ['default', 'pro']) {
    const { data: rows } = await supabase.from('bot_settings').select('category, content').eq('is_active', true).eq('mode', mode)
    const { data: brain } = await supabase.from('bot_brain_entries').select('category, title, content').eq('is_active', true).order('created_at', { ascending: true })
    const parts = []
    for (const cat of SECTION_ORDER) {
      const block = (rows ?? []).find(r => r.category === cat)
      if (block?.content?.trim()) parts.push(`[${LABELS[cat]}]\n${block.content.trim()}`)
    }
    const brainOrder = ['rules', 'red_flags', 'tone', 'personality', 'facts']
    const brainLabels = { rules: 'BRAIN: RULES', red_flags: 'BRAIN: RED FLAGS', tone: 'BRAIN: TONE REFINEMENTS', personality: 'BRAIN: PERSONALITY REFINEMENTS', facts: 'BRAIN: FACTS & KNOWLEDGE' }
    for (const cat of brainOrder) {
      const entries = (brain ?? []).filter(e => e.category === cat)
      if (!entries.length) continue
      parts.push(`[${brainLabels[cat]}]\n` + entries.map(e => `- ${e.title}: ${e.content}`).join('\n'))
    }
    const compiled = parts.join('\n\n')
    const { error } = await supabase.from('bot_compiled_prompt').update({ content: compiled, compiled_at: new Date().toISOString(), entry_count: (brain ?? []).length }).eq('mode', mode)
    console.log(error ? `   ❌ ${mode}: ${error.message}` : `   ✅ recompiled ${mode} (${compiled.length} chars, has "Source pills": ${compiled.includes('Source pills')})`)
  }
}

console.log(`\n${'='.repeat(60)}`)
console.log(APPLY
  ? `Done. (A) ${aChanged} answer_style rows, (B) ${bChanged} chain rows updated.`
  : `DRY RUN. (A) ${aChanged} answer_style rows, (B) ${bChanged} chain rows would change. Re-run with --apply.`)
