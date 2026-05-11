import { getCompactionConfig } from '@/lib/bot/compaction'
import { getGlobalEnabled, getOllamaEnabled, getBackendModel, getCompiledPromptMeta, getKeywordsEnabled } from '@/app/admin/bot/settings/actions'
import { getInternalPromptsFull, getStatusMessages, getPipelineSettings } from '@/app/admin/router/actions'
import { getModels } from '@/app/admin/models/actions'
import { UnsavedChangesProvider } from '@/components/admin/shared/UnsavedChangesGuard'
import GlobalSettingsClient from './GlobalSettingsClient'

export default async function GlobalSettingsPage() {
  const [globalEnabled, ollamaEnabled, backendModel, compactionConfig,
         defaultMeta, proMeta, models, keywordsEnabled,
         internalPrompts, statusMessages, pipelineSettings] = await Promise.all([
    getGlobalEnabled(),
    getOllamaEnabled(),
    getBackendModel(),
    getCompactionConfig(),
    getCompiledPromptMeta('default'),
    getCompiledPromptMeta('pro'),
    getModels(),
    getKeywordsEnabled(),
    getInternalPromptsFull(),
    getStatusMessages(),
    getPipelineSettings(),
  ])

  return (
    <UnsavedChangesProvider>
      <GlobalSettingsClient
        globalEnabled={globalEnabled}
        ollamaEnabled={ollamaEnabled}
        backendModel={backendModel}
        compactionConfig={compactionConfig}
        compiledMeta={{ default: defaultMeta, pro: proMeta }}
        models={models}
        keywordsEnabled={keywordsEnabled}
        initialPipelinePrompts={internalPrompts}
        initialStatusMessages={statusMessages}
        initialPipelineSettings={pipelineSettings}
      />
    </UnsavedChangesProvider>
  )
}
