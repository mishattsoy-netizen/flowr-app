'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { getCompactionConfig, saveCompactionConfig, type CompactionConfig } from '@/lib/bot/compaction'
import { getOllamaEnabled, setOllamaEnabled, getBackendModel, setBackendModel, getKeywordsEnabled, setKeywordsEnabled } from '@/app/admin/bot/settings/actions'
import { revalidatePath } from 'next/cache'

export { getCompactionConfig, saveCompactionConfig, getOllamaEnabled, setOllamaEnabled, getBackendModel, setBackendModel, getKeywordsEnabled, setKeywordsEnabled }

export async function updateCompactionConfig(config: Partial<CompactionConfig>): Promise<void> {
  await saveCompactionConfig(config)
  revalidatePath('/admin/bot/global')
}
