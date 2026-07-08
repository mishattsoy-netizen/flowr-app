import { getCompactionConfig } from '@/lib/bot/compaction'
import { getOllamaEnabled, getBackendModel, getKeywordsEnabled } from '@/app/admin/bot/settings/actions'
import { getInternalPromptsFull, getPipelineSettings, getRouterChains } from '@/app/admin/router/actions'
import { getModels } from '@/app/admin/models/actions'
import { UnsavedChangesProvider } from '@/components/admin/shared/UnsavedChangesGuard'
import GlobalSettingsClient from './GlobalSettingsClient'

export default async function GlobalSettingsPage() {
  const [ollamaEnabled, backendModel, compactionConfig,
         models, keywordsEnabled,
         internalPrompts, pipelineSettings,
         appChains] = await Promise.all([
    getOllamaEnabled(),
    getBackendModel(),
    getCompactionConfig(),
    getModels(),
    getKeywordsEnabled(),
    getInternalPromptsFull(),
    getPipelineSettings(),
    getRouterChains(),
  ])

  const compactionChain = appChains.find((c: any) => c.category === 'COMPACTION')

  return (
    <UnsavedChangesProvider>
      <GlobalSettingsClient
        ollamaEnabled={ollamaEnabled}
        backendModel={backendModel}
        compactionConfig={compactionConfig}
        models={models}
        keywordsEnabled={keywordsEnabled}
        initialPipelinePrompts={internalPrompts}
        initialPipelineSettings={pipelineSettings}
        compactionChain={compactionChain ?? null}
      />
    </UnsavedChangesProvider>
  )
}
