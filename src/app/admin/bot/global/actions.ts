'use server'

import { getCompactionConfig, saveCompactionConfig, type CompactionConfig } from '@/lib/bot/compaction'
import { getGlobalEnabled, setGlobalPromptEnabled, getOllamaEnabled, setOllamaEnabled, getBackendModel, setBackendModel, syncCompiledPrompt, getCompiledPromptMeta, getKeywordsEnabled, setKeywordsEnabled } from '@/app/admin/bot/settings/actions'
import { revalidatePath } from 'next/cache'

export { getCompactionConfig, saveCompactionConfig, getGlobalEnabled, setGlobalPromptEnabled, getOllamaEnabled, setOllamaEnabled, getBackendModel, setBackendModel, syncCompiledPrompt, getCompiledPromptMeta, getKeywordsEnabled, setKeywordsEnabled }

export async function updateCompactionConfig(config: Partial<CompactionConfig>): Promise<void> {
  await saveCompactionConfig(config)
  revalidatePath('/admin/bot/global')
}
