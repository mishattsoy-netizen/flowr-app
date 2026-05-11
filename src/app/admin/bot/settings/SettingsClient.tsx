'use client'

import { useState, useTransition, useEffect } from 'react'
import { Settings, RefreshCw, Eye, EyeOff, Check, Cpu, Copy } from 'lucide-react'
import { saveSettingBlock, syncCompiledPrompt, toggleSettingBlock, setGlobalPromptEnabled, setOllamaEnabled, setBackendModel } from './actions'
import type { BotSetting, SettingsCategory } from './actions'
import { cn } from '@/lib/utils'
import ModelDropdown from '@/components/admin/ModelDropdown'
import { RegistryModel } from '@/components/admin/model-utils'
import { Toggle } from '@/components/ui/Toggle'
import PipelinePromptsPanel from '@/components/admin/PipelinePromptsPanel'
import PipelineStatusPanel from '@/components/admin/PipelineStatusPanel'
import OrchestratorPanel from '@/components/admin/OrchestratorPanel'

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
  globalEnabled: boolean
  initialActiveStates: Record<string, boolean>
  initialOllamaEnabled: boolean
  initialBackendModel: string
  initialModels?: RegistryModel[]
  initialStatusMessages: Record<string, { label: string; emoji: string }>
  initialPipelinePrompts: { value: Record<string, string>; updated_at: string | null }
  initialPipelineSettings: any
}

export default function SettingsClient({
  initialSettings,
  compiledAt,
  entryCount,
  compiledContent,
  globalEnabled,
  initialActiveStates,
  initialOllamaEnabled,
  initialBackendModel,
  initialModels = [],
  initialStatusMessages,
  initialPipelinePrompts,
  initialPipelineSettings,
}: Props) {
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
  const [globalOn, setGlobalOn] = useState(globalEnabled)
  const [ollamaOn, setOllamaOn] = useState(initialOllamaEnabled)
  const [backendModel, setBackendModel_] = useState(initialBackendModel)
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>(initialActiveStates)
  const [copied, setCopied] = useState(false)

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

  async function handleGlobalToggle(val: boolean) {
    setGlobalOn(val)
    await setGlobalPromptEnabled(val)
  }

  async function handleOllamaToggle(val: boolean) {
    setOllamaOn(val)
    await setOllamaEnabled(val)
  }

  async function handleBackendModelChange(val: string) {
    setBackendModel_(val)
    await setBackendModel(val)
  }

  async function handleBlockToggle(category: SettingsCategory, val: boolean) {
    setActiveStates(s => ({ ...s, [category]: val }))
    await toggleSettingBlock(category, val)
  }

  const handleCopy = () => {
    if (!compiledContent) return
    navigator.clipboard.writeText(compiledContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 font-sans select-none">
      <div>
        <h1 className="text-4xl font-display font-normal tracking-tight text-foreground mb-1 select-none">Global Settings</h1>
        <p className="text-muted-foreground text-sm font-medium select-none">
          Author the bot's global identity — personality, rules, and behavior for all users.
        </p>
      </div>

      {/* Global Prompt Injection */}
       <div className="flex items-center justify-between p-4 bg-panel rounded-big transition-all">
        <div>
          <p className="text-sm font-semibold tracking-wide text-foreground">Global Prompt Injection</p>
          <p className="text-xs text-bone-60 mt-0.5">Brain + Settings are active on every chat request</p>
        </div>
        <Toggle 
          checked={globalOn}
          onChange={handleGlobalToggle}
        />
      </div>

      {/* Local Ollama */}
       <div className="flex items-center justify-between p-4 bg-panel rounded-big transition-all">
        <div>
          <p className="text-sm font-semibold tracking-wide text-foreground">Local Ollama</p>
          <p className="text-xs text-bone-60 mt-0.5">Your local Ollama instance is active for all users</p>
        </div>
        <Toggle 
          checked={ollamaOn}
          onChange={handleOllamaToggle}
        />
      </div>

      {/* Backend Model */}
       <div className="flex items-center justify-between p-4 bg-panel rounded-big transition-all">
        <div className="flex items-start gap-3">
          <div className="text-accent mt-0.5 shrink-0 opacity-60">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-foreground">Backend Model</p>
            <p className="text-xs text-bone-60 mt-0.5">Used for routine analysis, brain sync, and all backend AI actions</p>
          </div>
        </div>
        <div className="relative w-[280px]">
          <ModelDropdown
            value={backendModel}
            models={initialModels}
            onChange={(val) => handleBackendModelChange(val)}
          />
        </div>
      </div>

      {/* Tabs with toggle switches */}
      <div className="flex flex-wrap gap-2 pt-2">
        {TABS.map(tab => (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer select-none transition-all",
               activeTab === tab.key
                 ? "bg-[var(--bone-10)] text-foreground"
                 : "bg-panel text-muted-foreground hover:bg-white/[0.06]"
            )}
          >
            <span className="font-semibold tracking-wide select-none">{tab.label}</span>
            <Toggle 
              size="sm"
              checked={activeStates[tab.key]}
              onChange={(val) => handleBlockToggle(tab.key, val)}
            />
          </div>
        ))}
      </div>

      {/* Editor card */}
      <div className="bg-panel rounded-big p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-foreground select-none">{activeTab_.label}</h3>
          <p className="text-xs text-bone-60 mt-0.5 select-none">{activeTab_.description}</p>
        </div>
        <textarea
          value={currentDraft}
          onChange={e => setDrafts(d => ({ ...d, [activeTab]: e.target.value }))}
          rows={11}
          className="w-full bg-background border border-white/[0.04] rounded-medium px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 resize-y font-mono leading-relaxed focus:outline-none focus:border-accent transition-all"
          placeholder={`Write the ${activeTab_.label.toLowerCase()} prompt here...`}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground/40 font-mono select-none">{currentDraft.length} chars</span>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-1.5 px-4 h-8 bg-white text-background rounded-medium text-xs font-semibold hover:brightness-95 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all select-none"
          >
            {saved[activeTab] ? <><Check className="w-3 h-3" /> Saved</> : isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Compiled prompt panel */}
      <div className="bg-panel rounded-big p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-accent opacity-60">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-foreground select-none">Compiled Prompt</p>
            {currentCompiledAt && mounted && (
              <p className="text-xs text-muted-foreground/50 mt-0.5 select-none">
                Last compiled: {new Date(currentCompiledAt).toLocaleString()} · {entryCount} brain entries
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(v => !v)}
            className="flex items-center gap-1 px-3 h-8 bg-white/[0.05] border border-white/[0.02] text-muted-foreground hover:text-foreground rounded-medium text-xs font-medium transition-all select-none"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? 'Hide' : 'Preview'}
          </button>
          <button
            onClick={handleCopy}
            disabled={!compiledContent}
            className="flex items-center gap-1 px-3 h-8 bg-white/[0.05] border border-white/[0.02] text-muted-foreground hover:text-foreground rounded-medium text-xs font-medium transition-all select-none"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleSync}
            disabled={syncStatus === 'syncing'}
            className="flex items-center gap-1 px-3 h-8 bg-white/[0.05] border border-white/[0.02] text-muted-foreground hover:text-foreground rounded-medium text-xs font-medium transition-all disabled:opacity-50 select-none"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", syncStatus === 'syncing' && "animate-spin")} />
            {syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'done' ? '✓ Synced' : 'Sync Brain'}
          </button>
        </div>
      </div>

      {showPreview && (
        <pre className="bg-background border border-white/[0.03] rounded-big p-4 text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto mt-2">
          {compiledContent || '(not yet compiled — click Sync Brain)'}
        </pre>
      )}

      <div className="h-4" />
      <div className="border-t border-white/5 pt-6">
        <h2 className="text-lg font-bold text-bone-100 uppercase tracking-widest mb-4 opacity-60">Pipeline & Chain Configuration</h2>
        <div className="flex flex-col gap-6">
          <OrchestratorPanel settings={initialPipelineSettings} />
          <PipelinePromptsPanel initialPrompts={initialPipelinePrompts} />
          <PipelineStatusPanel initialMessages={initialStatusMessages} />
        </div>
      </div>
    </div>
  )
}
