'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { Toggle } from '@/components/ui/Toggle'
import { cn } from '@/lib/utils'
import { saveSettingBlock, toggleSettingBlock } from '@/app/admin/bot/settings/actions'
import { saveClassifierConfig } from '@/app/admin/bot/classifier/actions'
import type { BotSetting, SettingsCategory } from '@/app/admin/bot/settings/actions'
import type { BotMode } from '@/data/store.types'

const SETTINGS_TABS: { key: SettingsCategory; label: string; description: string }[] = [
  { key: 'core_rules',       label: 'Core Rules',   description: 'Hard constraints — what the bot must always or never do' },
  { key: 'personality',      label: 'Personality',  description: 'Tone, warmth, humor — what the bot feels like to talk to' },
  { key: 'answer_style',     label: 'Answer Style', description: 'Length, formatting, when to use lists vs prose' },
  { key: 'thinking_pattern', label: 'Thinking',     description: 'How the bot approaches complex vs simple questions' },
  { key: 'restrictions',     label: 'Restrictions', description: 'Topics and behaviors that are off-limits' },
]

interface Props {
  mode: BotMode
  modeLabel: string
  modeIcon: string
  initialSettings: BotSetting[]
  initialActiveStates: Record<string, boolean>
  initialClassifierPrompt: string
}

export default function ModeSettingsClient({
  mode, modeLabel, modeIcon,
  initialSettings, initialActiveStates,
  initialClassifierPrompt,
}: Props) {
  const [activeTab, setActiveTab] = useState<SettingsCategory | 'classifier'>('core_rules')
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initialSettings.map(s => [s.category, s.content]))
  )
  const [activeStates, setActiveStates] = useState(initialActiveStates)
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [classifierPrompt, setClassifierPrompt] = useState(initialClassifierPrompt)
  const [classifierSaved, setClassifierSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSave = (category: SettingsCategory) => {
    startTransition(async () => {
      await saveSettingBlock(category, drafts[category] ?? '', mode)
      setSaved(prev => ({ ...prev, [category]: true }))
      setTimeout(() => setSaved(prev => ({ ...prev, [category]: false })), 1500)
    })
  }

  const handleToggle = (category: SettingsCategory, val: boolean) => {
    setActiveStates(prev => ({ ...prev, [category]: val }))
    startTransition(() => toggleSettingBlock(category, val, mode))
  }

  const handleClassifierSave = () => {
    startTransition(async () => {
      await saveClassifierConfig(classifierPrompt, {}, mode)
      setClassifierSaved(true)
      setTimeout(() => setClassifierSaved(false), 1500)
    })
  }

  const allTabs = [...SETTINGS_TABS, { key: 'classifier' as const, label: 'Classifier', description: 'Intent classification prompt for this mode' }]

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <span className="text-lg">{modeIcon}</span>
        <h1 className="text-xl font-display font-normal">{modeLabel} Mode</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap mb-2">
        {allTabs.map(t => (
          <div key={t.key}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-colors',
              activeTab === t.key ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10'
            )}
            onClick={() => setActiveTab(t.key as SettingsCategory | 'classifier')}
          >
            <span className={cn('text-xs font-medium', activeTab === t.key ? 'text-bone-100' : 'text-bone-60')}>{t.label}</span>
            {t.key !== 'classifier' && (
              <div onClick={(e) => e.stopPropagation()}>
                <Toggle checked={activeStates[t.key] ?? true} onChange={v => handleToggle(t.key as SettingsCategory, v)} />
              </div>
            )}
          </div>
        ))}
      </div>

      {activeTab !== 'classifier' ? (() => {
        const tab = SETTINGS_TABS.find(t => t.key === activeTab)!
        return (
          <div className="flex flex-col gap-4 p-5 rounded-[16px] bg-white/5">
            <div>
              <p className="text-sm font-medium text-bone-100">{tab.label}</p>
              <p className="text-xs text-bone-60 mt-0.5">{tab.description}</p>
            </div>
            <textarea
              value={drafts[tab.key] ?? ''}
              onChange={e => setDrafts(prev => ({ ...prev, [tab.key]: e.target.value }))}
              rows={16}
              className="w-full bg-[#111111] rounded-[8px] p-4 text-sm text-bone-100 font-mono resize-y focus:outline-none placeholder:text-bone-60"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-bone-60">{drafts[tab.key]?.length ?? 0} chars</span>
              <button onClick={() => handleSave(tab.key)} disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-[8px] bg-white text-black hover:bg-bone-80 transition-colors">
                {saved[tab.key] ? <Check className="w-3.5 h-3.5 text-green-600" /> : null}
                {saved[tab.key] ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>
        )
      })() : (
        <div className="flex flex-col gap-4 p-5 rounded-[16px] bg-white/5">
          <div>
            <p className="text-sm font-medium text-bone-100">Classifier Prompt</p>
            <p className="text-xs text-bone-60 mt-0.5">System prompt used when classifying messages in {modeLabel} mode</p>
          </div>
          <textarea value={classifierPrompt} onChange={e => setClassifierPrompt(e.target.value)} rows={12}
            className="w-full bg-[#111111] rounded-[8px] p-4 text-sm text-bone-100 font-mono resize-y focus:outline-none placeholder:text-bone-60" />
          <div className="flex justify-end mt-2">
            <button onClick={handleClassifierSave} disabled={isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-[8px] bg-white text-black hover:bg-bone-80 transition-colors">
              {classifierSaved ? <Check className="w-3.5 h-3.5 text-green-600" /> : null}
              {classifierSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
