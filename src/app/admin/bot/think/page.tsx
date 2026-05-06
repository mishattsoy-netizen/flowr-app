import { getSettings } from '@/app/admin/bot/settings/actions'
import { getClassifierConfig } from '@/app/admin/bot/classifier/actions'
import ModeSettingsClient from '@/app/admin/bot/_shared/ModeSettingsClient'

export default async function ThinkModePage() {
  const [settings, classifierConfig] = await Promise.all([
    getSettings('think'),
    getClassifierConfig('think'),
  ])
  const activeStates = Object.fromEntries(settings.map(s => [s.category, s.is_active]))
  return (
    <ModeSettingsClient
      mode="think"
      modeLabel="Think"
      modeIcon="🧠"
      initialSettings={settings}
      initialActiveStates={activeStates}
      initialClassifierPrompt={classifierConfig.prompt}
    />
  )
}
