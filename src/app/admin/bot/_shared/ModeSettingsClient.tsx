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

const INTENT_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  FAST_SIMPLE: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  MEDIUM_THINKING: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  COMPLEX_THINKING: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  IMAGE_GEN: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  WEB_SEARCH: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  TOOL_CALLING: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  AUDIO_VOICE: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' },
  VISION: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  CODING: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  DEEP_RESEARCH: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' }
}

const CATEGORIES = [
  'FAST_SIMPLE', 'MEDIUM_THINKING', 'COMPLEX_THINKING', 'IMAGE_GEN',
  'WEB_SEARCH', 'TOOL_CALLING', 'AUDIO_VOICE', 'VISION', 'CODING', 'DEEP_RESEARCH'
]

interface Props {
  mode: BotMode
  modeLabel: string
  modeIcon: string
  initialSettings: BotSetting[]
  initialActiveStates: Record<string, boolean>
  initialClassifierPrompt: string
  initialClassifierKeywords: Record<string, string[]>
}

export default function ModeSettingsClient({
  mode, modeLabel, modeIcon,
  initialSettings, initialActiveStates,
  initialClassifierPrompt, initialClassifierKeywords,
}: Props) {
  const [activeTab, setActiveTab] = useState<SettingsCategory | 'classifier'>('core_rules')
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initialSettings.map(s => [s.category, s.content]))
  )
  const [activeStates, setActiveStates] = useState(initialActiveStates)
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [classifierPrompt, setClassifierPrompt] = useState(initialClassifierPrompt)
  const [keywordInputs] = useState<Record<string, string>>(() => {
    const inputs: Record<string, string> = {}
    for (const [k, v] of Object.entries(initialClassifierKeywords || {})) {
      inputs[k] = Array.isArray(v) ? v.join(', ') : ''
    }
    return inputs
  })
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
      const keywords: Record<string, string[]> = {}
      for (const [k, v] of Object.entries(keywordInputs)) {
        const words = v.split(',').map(w => w.trim()).filter(Boolean)
        if (words.length > 0) keywords[k] = words
      }
      await saveClassifierConfig(classifierPrompt, keywords, mode)
      setClassifierSaved(true)
      setTimeout(() => setClassifierSaved(false), 1500)
    })
  }

  const allTabs = [...SETTINGS_TABS, { key: 'classifier' as const, label: 'Classifier', description: 'Intent classification prompt and keywords for this mode' }]

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
        <div className="flex flex-col gap-6">
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

          <div className="flex flex-col gap-3">
            <div className="mb-2 pl-2 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-bone-100">Intent Keyword Fast-Pass</p>
                <p className="text-xs text-bone-60 mt-0.5">Keywords are shared across all modes. Edit them in the <a href="/admin/bot/classifier" className="underline text-bone-80 hover:text-bone-100 transition-colors">Classifier page</a>.</p>
              </div>
            </div>

            {CATEGORIES.map(cat => {
              const colors = INTENT_COLORS[cat] || { bg: 'bg-white/10', text: 'text-bone-100', border: 'border-white/10' }
              return (
                <div key={cat} className="p-4 rounded-[16px] bg-white/5 opacity-60">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={cn('text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-[6px] border', colors.bg, colors.text, colors.border)}>
                      {cat.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-bone-60 font-mono">{cat}</span>
                  </div>
                  <input
                    value={keywordInputs[cat] || ''}
                    readOnly
                    placeholder="No keywords set"
                    className="w-full bg-[#111111] rounded-[8px] p-4 text-sm text-bone-100 font-medium focus:outline-none placeholder:text-bone-60/50 cursor-not-allowed"
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
