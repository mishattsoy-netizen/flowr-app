import { getCompactionConfig } from '@/lib/bot/compaction'
import { getGlobalEnabled, getOllamaEnabled, getBackendModel, getCompiledPromptMeta, getKeywordsEnabled } from '@/app/admin/bot/settings/actions'
import { getModels } from '@/app/admin/models/actions'
import { supabaseAdmin } from '@/lib/supabase'
import GlobalSettingsClient from './GlobalSettingsClient'

export default async function GlobalSettingsPage() {
  const [globalEnabled, ollamaEnabled, backendModel, compactionConfig,
         defaultMeta, thinkMeta, proMeta, models, keywordsEnabled] = await Promise.all([
    getGlobalEnabled(),
    getOllamaEnabled(),
    getBackendModel(),
    getCompactionConfig(),
    getCompiledPromptMeta('default'),
    getCompiledPromptMeta('think'),
    getCompiledPromptMeta('pro'),
    getModels(),
    getKeywordsEnabled(),
  ])

  return (
    <GlobalSettingsClient
      globalEnabled={globalEnabled}
      ollamaEnabled={ollamaEnabled}
      backendModel={backendModel}
      compactionConfig={compactionConfig}
      compiledMeta={{ default: defaultMeta, think: thinkMeta, pro: proMeta }}
      models={models}
      keywordsEnabled={keywordsEnabled}
    />
  )
}
