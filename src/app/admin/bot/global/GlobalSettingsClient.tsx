'use client'

import { useState, useTransition } from 'react'
import { Globe, RefreshCw, Eye, EyeOff, Check, Cpu, Copy } from 'lucide-react'
import { Toggle } from '@/components/ui/Toggle'
import ModelDropdown from '@/components/admin/ModelDropdown'
import ProviderSelector from '@/components/admin/ProviderSelector'
import { RegistryModel } from '@/components/admin/model-utils'
import { cn } from '@/lib/utils'
import {
  setGlobalPromptEnabled, setOllamaEnabled, setBackendModel,
  syncCompiledPrompt, updateCompactionConfig, setKeywordsEnabled, getCompiledPromptMeta
} from './actions'
import OrchestratorPanel from '@/components/admin/OrchestratorPanel'
import PipelinePromptsPanel from '@/components/admin/PipelinePromptsPanel'
import PipelineStatusPanel from '@/components/admin/PipelineStatusPanel'
import type { CompactionConfig } from '@/lib/bot/compaction'
import type { BotMode } from '@/data/store.types'

interface Props {
  globalEnabled: boolean
  ollamaEnabled: boolean
  backendModel: string
  compactionConfig: CompactionConfig
  compiledMeta: Record<BotMode, { content: string; compiled_at: string; entry_count: number }>
  models: RegistryModel[]
  keywordsEnabled: boolean
  initialPipelinePrompts: { value: Record<string, string>; updated_at: string | null }
  initialStatusMessages: Record<string, { label: string; emoji: string }>
  initialPipelineSettings: any
}

const MODE_TABS: { key: BotMode; label: string }[] = [
  { key: 'default', label: 'Default' },
  { key: 'pro',     label: 'Pro' },
]

export default function GlobalSettingsClient({
  globalEnabled, ollamaEnabled, backendModel,
  compactionConfig, compiledMeta, models, keywordsEnabled,
  initialPipelinePrompts, initialStatusMessages, initialPipelineSettings
}: Props) {
  const [globalOn, setGlobalOn] = useState(globalEnabled)
  const [ollamaOn, setOllamaOn] = useState(ollamaEnabled)
  const [keywordsOn, setKeywordsOn] = useState(keywordsEnabled)
  const [backend, setBackend] = useState(backendModel)
  const [config, setConfig] = useState(compactionConfig)
  const [activeTab, setActiveTab] = useState<BotMode>('default')
  const [showPreview, setShowPreview] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done'>('idle')
  const [meta, setMeta] = useState(compiledMeta)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [, startTransition] = useTransition()

  // Track provider for each model selector (local state, not persisted)
  const getProviderForModel = (modelId: string) => models.find(m => m.id === modelId)?.provider || 'google'
  const [backendProvider, setBackendProvider] = useState(() => getProviderForModel(backendModel))
  const [draftPrimaryProvider, setDraftPrimaryProvider] = useState(() => getProviderForModel(compactionConfig.draft_primary_model))
  const [draftFallbackProvider, setDraftFallbackProvider] = useState(() => getProviderForModel(compactionConfig.draft_fallback_model))
  const [refinePrimaryProvider, setRefinePrimaryProvider] = useState(() => getProviderForModel(compactionConfig.refine_primary_model))
  const [refineFallbackProvider, setRefineFallbackProvider] = useState(() => getProviderForModel(compactionConfig.refine_fallback_model))

  const allProviders = Array.from(new Set(models.map(m => m.provider.toLowerCase())))

  const handleSync = () => {
    setSyncStatus('syncing')
    startTransition(async () => {
      await syncCompiledPrompt()
      // Re-fetch all metas to update UI
      const newMetas = {
        default: await getCompiledPromptMeta('default'),
        pro: await getCompiledPromptMeta('pro'),
      }
      setMeta(newMetas as any)
      setSyncStatus('done')
      setTimeout(() => setSyncStatus('idle'), 2000)
    })
  }

  const handleCopy = () => {
    const content = meta[activeTab]?.content
    if (!content) return
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleConfigChange = (key: keyof CompactionConfig, value: number | string) => {
    const next = { ...config, [key]: value }
    setConfig(next)
    startTransition(async () => {
      await updateCompactionConfig({ [key]: value })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    })
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-display font-normal">Global Settings</h1>
        <p className="text-sm text-bone-60">Author the bot's global identity — personality, rules, and behavior for all users.</p>
      </div>

      {/* Global toggles */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between p-4 rounded-[16px] bg-white/5">
          <div>
            <p className="text-sm font-medium text-bone-100">Global Prompt Injection</p>
            <p className="text-xs text-bone-60 mt-0.5">Brain + Settings are active on every chat request</p>
          </div>
          <Toggle checked={globalOn} onChange={v => { setGlobalOn(v); startTransition(() => setGlobalPromptEnabled(v)) }} />
        </div>
        
        <div className="flex items-center justify-between p-4 rounded-[16px] bg-white/5">
          <div>
            <p className="text-sm font-medium text-bone-100">Local Ollama</p>
            <p className="text-xs text-bone-60 mt-0.5">Your local Ollama instance is active for all users</p>
          </div>
          <Toggle checked={ollamaOn} onChange={v => { setOllamaOn(v); startTransition(() => setOllamaEnabled(v)) }} />
        </div>

        <div className="flex items-center justify-between p-4 rounded-[16px] bg-white/5 border border-white/5">
          <div>
            <p className="text-sm font-medium text-bone-100">Classifier Keywords</p>
            <p className="text-xs text-bone-60 mt-0.5">Enable keyword fast-path for intent classification</p>
          </div>
          <Toggle checked={keywordsOn} onChange={v => { setKeywordsOn(v); startTransition(() => setKeywordsEnabled(v)) }} />
        </div>

        <div className="flex items-center justify-between p-4 rounded-[16px] bg-white/5">
          <div className="flex items-center gap-3">
            <Cpu className="w-4 h-4 text-bone-60" />
            <div>
              <p className="text-sm font-medium text-bone-100">Backend Model</p>
              <p className="text-xs text-bone-60 mt-0.5">Used for routine analysis, brain sync, and all backend AI actions</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-background/50 rounded-[12px] p-1.5 border border-white/5 relative min-w-[280px]">
            <ProviderSelector 
              value={backendProvider} 
              providers={allProviders} 
              onChange={setBackendProvider}
              className="border-r border-white/5 pr-1.5"
            />
            <ModelDropdown 
              value={backend} 
              models={models} 
              providerFilter={backendProvider}
              onChange={v => { setBackend(v); startTransition(() => setBackendModel(v)) }} 
              className="flex-1"
            />
          </div>
        </div>
      </section>



      {/* Context & Compaction */}
      <section className="flex flex-col gap-4 p-4 rounded-[8px] bg-white/5">
        <h2 className="text-sm font-medium text-bone-80">Context & Compaction</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">Context Limit</p>
            <p className="text-xs text-bone-60">Max tokens per session before compaction</p>
          </div>
          <div className="flex gap-2">
            {[32000, 64000, 128000].map(v => (
              <button key={v} onClick={() => handleConfigChange('context_limit', v)}
                className={cn('px-2 py-1 text-xs rounded-[8px]', config.context_limit === v ? 'bg-accent/10 text-accent' : 'bg-white/5 text-bone-60 hover:text-bone-100 hover:bg-white/10')}>
                {v / 1000}k
              </button>
            ))}
            <input type="number" value={config.context_limit}
              onChange={e => handleConfigChange('context_limit', parseInt(e.target.value) || 32000)}
              className="w-20 px-2 py-1 text-xs bg-white/5 rounded-[8px] text-bone-100 focus:outline-none focus:bg-white/10 transition-colors" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">Compaction Threshold</p>
            <p className="text-xs text-bone-60">Trigger compaction at this % of context limit</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="range" min={50} max={95} step={5} value={Math.round(config.compaction_threshold * 100)}
              onChange={e => handleConfigChange('compaction_threshold', parseInt(e.target.value) / 100)}
              className="w-24" />
            <span className="text-xs text-bone-60 w-8">{Math.round(config.compaction_threshold * 100)}%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Draft models */}
          <div className="flex flex-col gap-3 p-4 rounded-[16px] bg-white/[0.02] border border-white/5">
            <p className="text-[10px] font-bold text-bone-60 uppercase tracking-widest px-1">Draft Step</p>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-bone-60 px-1">Primary</p>
                <div className="flex items-center gap-2 bg-background/50 rounded-[10px] p-1.5 border border-white/5 relative min-w-[200px]">
                  <ProviderSelector value={draftPrimaryProvider} providers={allProviders} onChange={setDraftPrimaryProvider} />
                  <ModelDropdown value={config.draft_primary_model} models={models} providerFilter={draftPrimaryProvider} onChange={v => handleConfigChange('draft_primary_model', v)} className="flex-1" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-bone-60 px-1">Fallback</p>
                <div className="flex items-center gap-2 bg-background/50 rounded-[10px] p-1.5 border border-white/5 relative min-w-[200px]">
                  <ProviderSelector value={draftFallbackProvider} providers={allProviders} onChange={setDraftFallbackProvider} />
                  <ModelDropdown value={config.draft_fallback_model} models={models} providerFilter={draftFallbackProvider} onChange={v => handleConfigChange('draft_fallback_model', v)} className="flex-1" />
                </div>
              </div>
            </div>
          </div>

          {/* Refine models */}
          <div className="flex flex-col gap-3 p-4 rounded-[16px] bg-white/[0.02] border border-white/5">
            <p className="text-[10px] font-bold text-bone-60 uppercase tracking-widest px-1">Refine Step</p>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-bone-60 px-1">Primary</p>
                <div className="flex items-center gap-2 bg-background/50 rounded-[10px] p-1.5 border border-white/5 relative min-w-[200px]">
                  <ProviderSelector value={refinePrimaryProvider} providers={allProviders} onChange={setRefinePrimaryProvider} />
                  <ModelDropdown value={config.refine_primary_model} models={models} providerFilter={refinePrimaryProvider} onChange={v => handleConfigChange('refine_primary_model', v)} className="flex-1" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-bone-60 px-1">Fallback</p>
                <div className="flex items-center gap-2 bg-background/50 rounded-[10px] p-1.5 border border-white/5 relative min-w-[200px]">
                  <ProviderSelector value={refineFallbackProvider} providers={allProviders} onChange={setRefineFallbackProvider} />
                  <ModelDropdown value={config.refine_fallback_model} models={models} providerFilter={refineFallbackProvider} onChange={v => handleConfigChange('refine_fallback_model', v)} className="flex-1" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {saved && <p className="text-xs text-green-400">Saved</p>}
      </section>

      {/* Compiled prompts */}
      <section className="flex items-center justify-between p-4 rounded-[16px] bg-white/5 mt-4">
        <div className="flex items-center gap-3">
          <Globe className="w-4 h-4 text-bone-60" />
          <div>
            <p className="text-sm font-medium text-bone-100">Compiled Prompt</p>
            <p className="text-xs text-bone-60 mt-0.5" suppressHydrationWarning>
              Last compiled: {meta[activeTab]?.compiled_at ? new Date(meta[activeTab].compiled_at).toLocaleString() : 'Never'} · {meta[activeTab]?.entry_count ?? 0} entries · {meta[activeTab]?.content?.length ? `${(meta[activeTab].content.length / 4).toFixed(0)} tokens` : '0 tokens'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="relative flex items-center p-0.5 bg-background rounded-[8px] min-w-[200px] mr-2">
            {/* Sliding Background Pill */}
            <div 
              className="absolute top-[2px] bottom-[2px] rounded-[6px] bg-[var(--bone-10)] shadow-sm transition-all duration-300 ease-out"
              style={{ 
                left: `calc(${(MODE_TABS.findIndex(t => t.key === activeTab) / MODE_TABS.length) * 100}% + 2px)`,
                width: `calc(${100 / MODE_TABS.length}% - 4px)`
              }}
            />
            {MODE_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "relative z-10 flex-1 flex items-center justify-center py-1 px-3 rounded-[6px] transition-colors duration-200",
                  activeTab === tab.key ? "text-[var(--bone-100)]" : "text-bone-60 hover:text-foreground"
                )}
              >
                <span className="text-[11px] font-semibold">{tab.label}</span>
              </button>
            ))}
          </div>

          <button onClick={handleCopy} disabled={!meta[activeTab]?.content}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white/5 text-xs text-bone-100 hover:bg-white/10 transition-colors disabled:opacity-50">
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button onClick={() => setShowPreview(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white/5 text-xs text-bone-100 hover:bg-white/10 transition-colors">
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            Preview
          </button>
          <button onClick={handleSync} disabled={syncStatus === 'syncing'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white/5 text-xs text-bone-100 hover:bg-white/10 transition-colors">
            {syncStatus === 'done' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <RefreshCw className={cn('w-3.5 h-3.5', syncStatus === 'syncing' && 'animate-spin')} />}
            {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'done' ? 'Done' : 'Sync Brain'}
          </button>
        </div>
      </section>

      {showPreview && (
        <pre className="text-xs text-bone-60 bg-white/5 rounded-[12px] p-4 overflow-auto max-h-64 whitespace-pre-wrap font-mono -mt-2">
          {meta[activeTab]?.content || 'No compiled content yet. Click Sync Brain.'}
        </pre>
      )}

      {/* Pipeline & Chain Configuration */}
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
