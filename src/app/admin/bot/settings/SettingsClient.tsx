'use client'

import { useState, useTransition, useEffect } from 'react'
import { Settings, RefreshCw, Eye, EyeOff, Check } from 'lucide-react'
import { saveSettingBlock, syncCompiledPrompt } from './actions'
import type { BotSetting, SettingsCategory } from './actions'
import { cn } from '@/lib/utils'

const TABS: { key: SettingsCategory; label: string; description: string }[] = [
  { key: 'core_rules',       label: 'Core Rules',      description: 'Hard constraints — what the bot must always or never do' },
  { key: 'personality',      label: 'Personality',     description: 'Tone, warmth, humor — what the bot feels like to talk to' },
  { key: 'answer_style',     label: 'Answer Style',    description: 'Length, formatting, when to use lists vs prose' },
  { key: 'thinking_pattern', label: 'Thinking',        description: 'How the bot approaches complex vs simple questions' },
  { key: 'restrictions',     label: 'Restrictions',    description: 'Topics and behaviors that are off-limits' },
]

interface Props {
  initialSettings: BotSetting[]
  compiledAt: string
  entryCount: number
  compiledContent: string
}

export default function SettingsClient({ initialSettings, compiledAt, entryCount, compiledContent }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsCategory>('core_rules')
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initialSettings.map(s => [s.category, s.content]))
  )
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [showPreview, setShowPreview] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done'>('idle')
  const [currentCompiledAt, setCurrentCompiledAt] = useState(compiledAt)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const activeTab_ = TABS.find(t => t.key === activeTab)!
  const currentDraft = drafts[activeTab] ?? ''

  function handleSave() {
    startTransition(async () => {
      await saveSettingBlock(activeTab, currentDraft)
      setSaved(s => ({ ...s, [activeTab]: true }))
      setTimeout(() => setSaved(s => ({ ...s, [activeTab]: false })), 2000)
    })
  }

  async function handleSync() {
    setSyncStatus('syncing')
    await syncCompiledPrompt()
    setCurrentCompiledAt(new Date().toISOString())
    setSyncStatus('done')
    setTimeout(() => setSyncStatus('idle'), 3000)
  }

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display text-foreground mb-1">Global Settings</h1>
        <p className="text-muted-foreground text-sm font-medium">
          Author the bot's global identity — personality, rules, and behavior for all users.
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
              activeTab === tab.key
                ? "bg-[var(--bone-15)] text-[var(--bone-100)]"
                : "bg-[var(--bone-6)] text-[var(--bone-60)] hover:text-[var(--bone-100)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Editor card */}
      <div className="bg-[var(--bone-6)] border border-[var(--bone-10)] rounded-xl p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{activeTab_.label}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{activeTab_.description}</p>
          </div>
        </div>
        <textarea
          value={currentDraft}
          onChange={e => setDrafts(d => ({ ...d, [activeTab]: e.target.value }))}
          rows={10}
          className="w-full bg-background border border-[var(--bone-10)] rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-y font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-[var(--bone-30)]"
          placeholder={`Write the ${activeTab_.label.toLowerCase()} prompt here...`}
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground">{currentDraft.length} chars</span>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {saved[activeTab] ? <><Check className="w-3.5 h-3.5" /> Saved</> : isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Compiled prompt panel */}
      <div className="bg-[var(--bone-6)] border border-[var(--bone-10)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Compiled Prompt
            </h3>
            {currentCompiledAt && mounted && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Last compiled: {new Date(currentCompiledAt).toLocaleString()} · {entryCount} brain entries
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1 bg-[var(--bone-10)] rounded-lg text-xs font-medium text-[var(--bone-60)] hover:text-foreground transition-colors"
            >
              {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showPreview ? 'Hide' : 'Preview'}
            </button>
            <button
              onClick={handleSync}
              disabled={syncStatus === 'syncing'}
              className="flex items-center gap-1.5 px-3 py-1 bg-[var(--bone-10)] rounded-lg text-xs font-medium text-[var(--bone-60)] hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3 h-3", syncStatus === 'syncing' && "animate-spin")} />
              {syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'done' ? '✓ Synced' : 'Sync Brain'}
            </button>
          </div>
        </div>
        {showPreview && (
          <pre className="bg-background border border-[var(--bone-10)] rounded-lg p-4 text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
            {compiledContent || '(not yet compiled — click Sync Brain)'}
          </pre>
        )}
      </div>
    </div>
  )
}
