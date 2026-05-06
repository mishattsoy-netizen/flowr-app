import { getSettings } from '@/app/admin/bot/settings/actions'
import { getClassifierConfig } from '@/app/admin/bot/classifier/actions'
import ModeSettingsClient from '@/app/admin/bot/_shared/ModeSettingsClient'

export default async function ProModePage() {
  const [settings, classifierConfig] = await Promise.all([
    getSettings('pro'),
    getClassifierConfig('pro'),
  ])
  const activeStates = Object.fromEntries(settings.map(s => [s.category, s.is_active]))
  return (
    <ModeSettingsClient
      mode="pro"
      modeLabel="Pro"
      modeIcon="🔥"
      initialSettings={settings}
      initialActiveStates={activeStates}
      initialClassifierPrompt={classifierConfig.prompt}
    />
  )
}
