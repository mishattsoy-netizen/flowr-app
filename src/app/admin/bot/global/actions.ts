'use server'

import fs from 'fs'
import path from 'path'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { getCompactionConfig, saveCompactionConfig, type CompactionConfig } from '@/lib/bot/compaction'
import { getGlobalEnabled, setGlobalPromptEnabled, getOllamaEnabled, setOllamaEnabled, getBackendModel, setBackendModel, syncCompiledPrompt, getCompiledPromptMeta, getKeywordsEnabled, setKeywordsEnabled } from '@/app/admin/bot/settings/actions'
import { recompilePrompt } from '@/lib/bot/compilePrompt'
import { revalidatePath } from 'next/cache'

export { getCompactionConfig, saveCompactionConfig, getGlobalEnabled, setGlobalPromptEnabled, getOllamaEnabled, setOllamaEnabled, getBackendModel, setBackendModel, syncCompiledPrompt, getCompiledPromptMeta, getKeywordsEnabled, setKeywordsEnabled }

export async function updateCompactionConfig(config: Partial<CompactionConfig>): Promise<void> {
  await saveCompactionConfig(config)
  revalidatePath('/admin/bot/global')
}

const FINAL_PROMPTS_DIR = path.join(process.cwd(), 'Final prompts(active)')

function readFile(...segments: string[]): string {
  const fullPath = path.join(FINAL_PROMPTS_DIR, ...segments)
  if (!fs.existsSync(fullPath)) return ''
  const content = fs.readFileSync(fullPath, 'utf8')
  // Extract content after the --- PROMPT --- marker, or return entire file
  const promptMatch = content.match(/--- PROMPT ---\n([\s\S]*)/)
  return promptMatch ? promptMatch[1].trim() : content.trim()
}

// Strip leading [SECTION NAME]\n prefix if present — prevents double headers on recompile
function stripHeaderPrefix(content: string): string {
  return content.replace(/^\[[A-Z_ ]+\]\s*\n?/, '')
}

export async function syncFinalPrompts(): Promise<{ synced: string[]; errors: string[] }> {
  const synced: string[] = []
  const errors: string[] = []

  // Chain system prompts are now served from static files in src/lib/bot/prompts/chains/
  // No DB sync needed for chain prompts.



  // 2. Mode prompt parts → bot_settings (for compilation)
  // Note: content is stored WITHOUT [HEADER] prefix — recompilePrompt adds it automatically.
  const MODE_PARTS = ['core_rules', 'personality', 'answer_style', 'thinking_pattern', 'restrictions']
  for (const mode of ['default', 'pro']) {
    for (const part of MODE_PARTS) {
      try {
        const content = stripHeaderPrefix(readFile('modes', mode, `${part}.txt`))
        if (!content) continue
        await supabase.from('bot_settings').upsert({
          category: part,
          mode,
          content,
          is_active: true,
        }, { onConflict: 'category,mode' })
        synced.push(`${mode}/${part}`)
      } catch (e: any) {
        errors.push(`${mode}/${part}: ${e.message}`)
      }
    }
  }

  // 3. Classifier prompts → bot_settings
  for (const mode of ['default', 'pro']) {
    try {
      const content = readFile('classifier', `mode-${mode}.txt`)
      if (!content) continue
      await supabase.from('bot_settings').upsert({
        category: 'classifier_prompt',
        mode,
        content,
        is_active: true,
      }, { onConflict: 'category,mode' })
      synced.push(`classifier/${mode}`)
    } catch (e: any) {
      errors.push(`classifier/${mode}: ${e.message}`)
    }
  }

  // 4. Subchain configs → settings
  try {
    const subchains = [
      { id: 'prompt_expander', file: 'prompt_expander.txt' },
      { id: 'image_narration', file: 'image_narration.txt' },
      { id: 'deep_research_gap_detector', file: 'deep_research_gap_detector.txt' },
    ]
    const currentConfigs: any[] = []
    for (const sc of subchains) {
      const content = readFile('subchains', sc.file)
      if (!content) continue
      currentConfigs.push({
        id: sc.id,
        system_prompt: content,
      })
      synced.push(`subchain/${sc.id}`)
    }
    if (currentConfigs.length > 0) {
      await supabase.from('settings').upsert({
        key: 'subchain_configs',
        value: currentConfigs,
      }, { onConflict: 'key' })
    }
  } catch (e: any) {
    errors.push(`subchains: ${e.message}`)
  }

  // 6. Pipeline internal prompts → settings
  try {
    const FILE_MAP: Record<string, string> = {
      THINKING:   'chains/THINKING/system_prompt.txt',
      VISION:     'chains/VISION/system_prompt.txt',
      WEB_SEARCH: 'chains/WEB_SEARCH/pipeline.txt',
      RESEARCH:   'chains/RESEARCH/pipeline.txt',
      CODING:     'chains/CODING/pipeline.txt',
      TOOLS:      'chains/TOOLS/pipeline.txt',
      IMAGE_GEN:  'chains/IMAGE_GEN/pipeline.txt',
    }
    const internalPrompts: Record<string, string> = {}
    for (const [chainType, filePath] of Object.entries(FILE_MAP)) {
      const content = readFile(filePath)
      if (!content) continue
      internalPrompts[chainType] = content
      synced.push(`pipeline/${chainType}`)
    }
    if (Object.keys(internalPrompts).length > 0) {
      const { data: existing } = await supabase.from('settings').select('value').eq('key', 'pipeline_internal_prompts').maybeSingle()
      const merged = { ...(existing?.value as Record<string, string> ?? {}), ...internalPrompts }
      await supabase.from('settings').upsert({ key: 'pipeline_internal_prompts', value: merged }, { onConflict: 'key' })
    }
  } catch (e: any) {
    errors.push(`pipeline prompts: ${e.message}`)
  }

  // 7. Recompile both modes so compiled prompt reflects new parts
  try {
    await recompilePrompt('default')
    await recompilePrompt('pro')
    synced.push('compiled prompt (default + pro)')
  } catch (e: any) {
    errors.push(`recompile: ${e.message}`)
  }

  revalidatePath('/admin/bot/global')
  revalidatePath('/admin/bot/default')
  revalidatePath('/admin/bot/pro')
  return { synced, errors }
}
