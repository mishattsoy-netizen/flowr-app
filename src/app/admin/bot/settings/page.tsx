import { getSettings, getCompiledPromptMeta, getGlobalEnabled, getOllamaEnabled, getBackendModel } from './actions'
import { getModels } from '@/app/admin/models/actions'
import { getInternalPromptsFull, getStatusMessages, getPipelineSettings } from '@/app/admin/router/actions'
import SettingsClient from './SettingsClient'
import { UnsavedChangesProvider } from '@/components/admin/shared/UnsavedChangesGuard'

export default async function BotSettingsPage() {
  const [
    settings,
    meta,
    globalEnabled,
    ollamaEnabled,
    backendModel,
    models,
    internalPrompts,
    statusMessages,
    pipelineSettings
  ] = await Promise.all([
    getSettings(),
    getCompiledPromptMeta(),
    getGlobalEnabled(),
    getOllamaEnabled(),
    getBackendModel(),
    getModels(),
    getInternalPromptsFull(),
    getStatusMessages(),
    getPipelineSettings(),
  ])

  return (
    <UnsavedChangesProvider>
      <SettingsClient
        initialSettings={settings}
        compiledAt={meta.compiled_at}
        entryCount={meta.entry_count}
        compiledContent={meta.content}
        globalEnabled={globalEnabled}
        initialActiveStates={Object.fromEntries(settings.map(s => [s.category, s.is_active]))}
        initialOllamaEnabled={ollamaEnabled}
        initialBackendModel={backendModel}
        initialModels={models}
        initialPipelinePrompts={internalPrompts}
        initialStatusMessages={statusMessages}
        initialPipelineSettings={pipelineSettings}
      />
    </UnsavedChangesProvider>
  )
}

