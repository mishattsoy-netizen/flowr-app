'use client'

import { useState, useTransition, useCallback } from 'react'
import { Globe, RefreshCw, Eye, EyeOff, Check, Cpu, Copy, Plus, Trash2, Power, Save, ChevronDown, Settings2 } from 'lucide-react'
import { Toggle } from '@/components/ui/Toggle'
import ModelDropdown from '@/components/admin/ModelDropdown'
import ProviderSelector from '@/components/admin/ProviderSelector'
import OpenRouterRoutingProviderSelector from '@/components/admin/OpenRouterRoutingProviderSelector'
import { RegistryModel } from '@/components/admin/model-utils'
import { cn } from '@/lib/utils'
import {
  setGlobalPromptEnabled, setOllamaEnabled, setBackendModel,
  syncCompiledPrompt, updateCompactionConfig, setKeywordsEnabled, getCompiledPromptMeta,
  syncFinalPrompts
} from './actions'
import { updateRouterChain, updateRouterSystemPrompt, setRouterTemperature, savePipelineSetting } from '@/app/admin/router/actions'
import PipelineStatusPanel from '@/components/admin/PipelineStatusPanel'
import type { CompactionConfig } from '@/lib/bot/compaction'
import type { BotMode } from '@/data/store.types'

interface ModelEntry {
  id: string
  provider: string
  is_enabled: boolean
  openrouter_provider?: string
  _key?: string
}

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
  compactionChain: { id: string; category: string; model_list: ModelEntry[]; system_prompt: string | null } | null
  compactionTemperature: number
}

const MODE_TABS: { key: BotMode; label: string }[] = [
  { key: 'default', label: 'Default' },
  { key: 'pro',     label: 'Pro' },
]

let modelKeyCounter = 0
const nextKey = () => `model_${++modelKeyCounter}_${Date.now()}`

export default function GlobalSettingsClient({
  globalEnabled, ollamaEnabled, backendModel,
  compactionConfig, compiledMeta, models, keywordsEnabled,
  initialPipelinePrompts, initialStatusMessages, initialPipelineSettings,
  compactionChain, compactionTemperature
}: Props) {
  const [globalOn, setGlobalOn] = useState(globalEnabled)
  const [ollamaOn, setOllamaOn] = useState(ollamaEnabled)
  const [keywordsOn, setKeywordsOn] = useState(keywordsEnabled)
  const [backend, setBackend] = useState(backendModel)
  const [config, setConfig] = useState(compactionConfig)
  const [activeTab, setActiveTab] = useState<BotMode>('default')
  const [showPreview, setShowPreview] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done'>('idle')
  const [finalSyncStatus, setFinalSyncStatus] = useState<'idle' | 'syncing' | 'done'>('idle')
  const [meta, setMeta] = useState(compiledMeta)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const ALL_CATS = ['REGULAR', 'COMPLEX', 'CODING', 'WEB_SEARCH', 'RESEARCH', 'IMAGE_GEN', 'VISION', 'AUDIO', 'CLASSIFIER', 'ADVISOR', 'THINKING', 'COMPACTION']

  const [historyLimit, setHistoryLimit] = useState(initialPipelineSettings.history_limit ?? 20)
  const [historyCats, setHistoryCats] = useState<string[]>(initialPipelineSettings.history_enabled_categories || ALL_CATS)
  const [globalCats, setGlobalCats] = useState<string[]>(initialPipelineSettings.global_prompt_enabled_categories || ALL_CATS)
  const [tokenLimitCats, setTokenLimitCats] = useState<string[]>(initialPipelineSettings.token_limit_enabled_categories || [])
  const [inputTokenLimit, setInputTokenLimit] = useState(initialPipelineSettings.input_token_limit ?? 0)
  const [outputTokenLimit, setOutputTokenLimit] = useState(initialPipelineSettings.output_token_limit ?? 0)
  const [autoLast, setAutoLast] = useState(initialPipelineSettings.image_gen_auto_last !== false)

  const handleSetting = (key: string, value: any, setter: (v: any) => void) => {
    setter(value)
    startTransition(async () => { await savePipelineSetting(key, value) })
  }

  const toggleCat = (list: string[], cat: string): string[] =>
    list.includes(cat) ? list.filter(c => c !== cat) : [...list, cat]

  const [, startTransition] = useTransition()

  const getProviderForModel = (modelId: string) => models.find(m => m.id === modelId)?.provider || 'google'
  const [backendProvider, setBackendProvider] = useState(() => getProviderForModel(backendModel))

  // Compaction chain state
  const [chainModels, setChainModels] = useState<ModelEntry[]>(
    () => (compactionChain?.model_list ?? []).map(m => ({ ...m, _key: m._key || nextKey() }))
  )
  const [chainPrompt, setChainPrompt] = useState(compactionChain?.system_prompt ?? '')
  const [chainTemp, setChainTemp] = useState(compactionTemperature)
  const [chainSaved, setChainSaved] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const chainId = compactionChain?.id ?? null

  const addChainModel = () => {
    setChainModels(prev => [...prev, { id: '', provider: 'google', is_enabled: true, _key: nextKey() }])
  }

  const updateChainModel = (key: string, field: keyof ModelEntry, value: any) => {
    setChainModels(prev => prev.map(m => m._key === key ? { ...m, [field]: value } : m))
  }

  const removeChainModel = (key: string) => {
    setChainModels(prev => prev.filter(m => m._key !== key))
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    setChainModels(prev => {
      const next = [...prev]
      const dragged = next[draggedIndex]
      next.splice(draggedIndex, 1)
      next.splice(index, 0, dragged)
      return next
    })
    setDraggedIndex(index)
  }

  const handleDragEnd = () => setDraggedIndex(null)
  const handleDrop = () => setDraggedIndex(null)

  const saveCompactionChain = async () => {
    if (!chainId) return
    const modelList = chainModels.map(({ _key, ...rest }) => rest)
    await updateRouterChain(chainId, modelList)
    await updateRouterSystemPrompt(chainId, chainPrompt)
    await setRouterTemperature('COMPACTION', chainTemp)
    setChainSaved(true)
    setTimeout(() => setChainSaved(false), 1500)
  }

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

  const handleSyncFinal = () => {
    setFinalSyncStatus('syncing')
    startTransition(async () => {
      const result = await syncFinalPrompts()
      console.log('[FinalPrompts] Synced:', result.synced, 'Errors:', result.errors)
      setFinalSyncStatus('done')
      setTimeout(() => setFinalSyncStatus('idle'), 3000)
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
    <div className="flex flex-col gap-4 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-display font-normal">Global Settings</h1>
        <p className="text-sm text-bone-70">Author the bot's global identity — personality, rules, and behavior for all users.</p>
      </div>

      {/* Global toggles */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-6 py-4 rounded-big bg-white/5 border border-[var(--bone-12)]">
          <div>
            <p className="text-sm font-medium text-bone-100">Global Prompt Injection</p>
            <p className="text-xs text-bone-70 mt-0.5">Brain + Settings are active on every chat request</p>
          </div>
          <Toggle checked={globalOn} onChange={v => { setGlobalOn(v); startTransition(() => setGlobalPromptEnabled(v)) }} />
        </div>
        
        <div className="flex items-center justify-between px-6 py-4 rounded-big bg-white/5 border border-[var(--bone-12)]">
          <div>
            <p className="text-sm font-medium text-bone-100">Local Ollama</p>
            <p className="text-xs text-bone-70 mt-0.5">Your local Ollama instance is active for all users</p>
          </div>
          <Toggle checked={ollamaOn} onChange={v => { setOllamaOn(v); startTransition(() => setOllamaEnabled(v)) }} />
        </div>

        <div className="flex items-center justify-between px-6 py-4 rounded-big bg-white/5 border border-[var(--bone-12)]">
          <div>
            <p className="text-sm font-medium text-bone-100">Classifier Keywords</p>
            <p className="text-xs text-bone-70 mt-0.5">Enable keyword fast-path for intent classification</p>
          </div>
          <Toggle checked={keywordsOn} onChange={v => { setKeywordsOn(v); startTransition(() => setKeywordsEnabled(v)) }} />
        </div>

        <div className="flex items-center justify-between px-6 py-4 rounded-big bg-white/5 border border-[var(--bone-12)]">
          <div className="flex items-center gap-3">
            <Cpu className="w-4 h-4 text-bone-70" />
            <div>
              <p className="text-sm font-medium text-bone-100">Backend Model</p>
              <p className="text-xs text-bone-70 mt-0.5">Used for routine analysis, brain sync, and all backend AI actions</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-background/50 rounded-regular p-1.5 border border-[var(--bone-6)] relative min-w-[280px]">
            <ProviderSelector 
              value={backendProvider} 
              providers={allProviders} 
              onChange={setBackendProvider}
              className="border-r border-[var(--bone-6)] pr-1.5"
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
      <section className="flex flex-col gap-4 px-6 py-4 rounded-big bg-white/5 border border-[var(--bone-12)]">
        <h2 className="text-sm font-medium text-bone-80">Context & Compaction</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">Context Limit</p>
            <p className="text-xs text-bone-70">Max tokens per session before compaction</p>
          </div>
          <div className="flex gap-2">
            {[32000, 64000, 128000].map(v => (
              <button key={v} onClick={() => handleConfigChange('context_limit', v)}
                className={cn('px-2 py-1 text-xs rounded-[8px]', config.context_limit === v ? 'bg-accent/10 text-accent' : 'bg-white/5 text-bone-70 hover:text-bone-100 hover:bg-white/10')}>
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
            <p className="text-xs text-bone-70">Trigger compaction at this % of context limit</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="range" min={50} max={95} step={5} value={Math.round(config.compaction_threshold * 100)}
              onChange={e => handleConfigChange('compaction_threshold', parseInt(e.target.value) / 100)}
              className="w-24" />
            <span className="text-xs text-bone-70 w-8">{Math.round(config.compaction_threshold * 100)}%</span>
          </div>
        </div>

        {/* Compaction Chain Card */}
        {chainId && (
          <div className="flex flex-col gap-3 px-6 py-4 rounded-regular bg-white/5 border border-[var(--bone-12)]">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-bone-70 uppercase tracking-widest px-1">Compaction Chain</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-white/5 text-bone-70 text-[9px] font-bold uppercase tracking-wide">
                  <span>Temp</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={chainTemp}
                    onChange={(e) => setChainTemp(parseFloat(e.target.value) || 0)}
                    className="w-10 bg-transparent border-none p-0 focus:ring-0 text-[9px] font-mono text-center font-bold text-accent outline-none"
                  />
                </div>
                <button onClick={saveCompactionChain}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-sm bg-accent/10 text-accent hover:bg-accent/20 transition-colors">
                  {chainSaved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                  {chainSaved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
            <div
              className="flex flex-col gap-1"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {chainModels.map((m, index) => {
                const provider = m.provider
                return (
                  <div
                    key={m._key}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onDrop={handleDrop}
                    className={cn(
                      "flex items-center gap-2 bg-background/40 rounded-medium p-1.5 border border-[var(--bone-6)] cursor-grab active:cursor-grabbing transition-all",
                      draggedIndex === index ? "opacity-20 scale-[0.98]" : "opacity-100"
                    )}
                  >
                    <ProviderSelector
                      value={provider}
                      providers={allProviders}
                      onChange={(v) => { updateChainModel(m._key!, 'provider', v); updateChainModel(m._key!, 'id', '') }}
                    />
                    <ModelDropdown
                      value={m.id}
                      models={models}
                      providerFilter={m.provider}
                      onChange={(v) => updateChainModel(m._key!, 'id', v)}
                      className="flex-1 min-w-[180px] max-w-[280px]"
                    />
                    <div className="flex items-center gap-2 ml-auto shrink-0">
                      {m.provider.toLowerCase() === 'openrouter' ? (
                        <OpenRouterRoutingProviderSelector
                          value={m.openrouter_provider || ''}
                          onChange={(val) => updateChainModel(m._key!, 'openrouter_provider', val)}
                          isEnabled={m.is_enabled}
                        />
                      ) : null}
                      <button
                        onClick={() => updateChainModel(m._key!, 'is_enabled', !m.is_enabled)}
                        className={cn('p-1 rounded transition-colors', m.is_enabled ? 'text-green-400 hover:text-green-300' : 'text-bone-30 hover:text-bone-70')}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeChainModel(m._key!)} className="p-1 rounded text-danger hover:text-red-300 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
              <button onClick={addChainModel} className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold text-bone-70 hover:text-bone-100 transition-colors">
                <Plus className="w-3 h-3" />
                Add Model
              </button>
            </div>
            {/* System Prompt */}
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-bold text-bone-70 uppercase tracking-widest px-1">System Prompt</p>
              <textarea
                value={chainPrompt}
                onChange={(e) => setChainPrompt(e.target.value)}
                rows={4}
                className="w-full bg-background/50 rounded-medium p-2 text-[11px] font-mono text-bone-100 border border-[var(--bone-6)] focus:outline-none focus:border-accent/30 resize-y"
                placeholder="System prompt for the compaction chain..."
              />
            </div>
          </div>
        )}

        {saved && <p className="text-xs text-green-400">Saved</p>}
      </section>

      {/* Compiled prompts */}
      <section className="flex items-center justify-between px-6 py-4 rounded-big bg-white/5 border border-[var(--bone-12)]">
        <div className="flex items-center gap-3">
          <Globe className="w-4 h-4 text-bone-70" />
          <div>
            <p className="text-sm font-medium text-bone-100">Compiled Prompt</p>
            <p className="text-xs text-bone-70 mt-0.5" suppressHydrationWarning>
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
                  activeTab === tab.key ? "text-[var(--bone-100)]" : "text-bone-70 hover:text-foreground"
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
          <button onClick={handleSyncFinal} disabled={finalSyncStatus === 'syncing'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-accent/10 text-accent text-xs hover:bg-accent/20 transition-colors">
            {finalSyncStatus === 'done' ? <Check className="w-3.5 h-3.5" /> : <RefreshCw className={cn('w-3.5 h-3.5', finalSyncStatus === 'syncing' && 'animate-spin')} />}
            {finalSyncStatus === 'syncing' ? 'Syncing...' : finalSyncStatus === 'done' ? 'Done' : 'Sync Final Prompts'}
          </button>
        </div>
      </section>

      {showPreview && (
        <pre className="text-xs text-bone-70 bg-white/5 border border-[var(--bone-12)] rounded-regular p-6 overflow-auto max-h-64 whitespace-pre-wrap font-mono -mt-2">
          {meta[activeTab]?.content || 'No compiled content yet. Click Sync Brain.'}
        </pre>
      )}

      {/* Context & Settings */}
      <section className="flex flex-col gap-4 px-6 py-4 rounded-big bg-white/5 border border-[var(--bone-12)]">
        <div className="flex items-center gap-3">
          <Settings2 className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-bold text-bone-100 tracking-wider">Context & Settings</h2>
        </div>

        {/* History limit */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">History Limit</p>
            <p className="text-xs text-bone-70">Max messages sent to model as context</p>
          </div>
          <input type="number" value={historyLimit} min={0} max={100}
            onChange={e => handleSetting('history_limit', parseInt(e.target.value) || 20, setHistoryLimit)}
            className="w-16 px-2 py-1 text-xs bg-white/5 rounded-[8px] text-bone-100 focus:outline-none text-center" />
        </div>

        {/* History enabled categories */}
        <div>
          <p className="text-xs font-bold text-bone-70 uppercase tracking-wider mb-2">History Enabled Categories</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CATS.map(cat => (
              <button key={cat} onClick={() => handleSetting('history_enabled_categories', toggleCat(historyCats, cat), setHistoryCats)}
                className={cn('px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-sm transition-colors',
                  historyCats.includes(cat) ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-white/5 text-bone-70 border border-transparent hover:bg-white/10')}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Global prompt enabled categories */}
        <div>
          <p className="text-xs font-bold text-bone-70 uppercase tracking-wider mb-2">Global Prompt Enabled Categories</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CATS.map(cat => (
              <button key={cat} onClick={() => handleSetting('global_prompt_enabled_categories', toggleCat(globalCats, cat), setGlobalCats)}
                className={cn('px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-sm transition-colors',
                  globalCats.includes(cat) ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-white/5 text-bone-70 border border-transparent hover:bg-white/10')}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Token limit */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">Input Token Limit</p>
            <p className="text-xs text-bone-70">0 = unlimited</p>
          </div>
          <input type="number" value={inputTokenLimit} min={0} step={1000}
            onChange={e => handleSetting('input_token_limit', parseInt(e.target.value) || 0, setInputTokenLimit)}
            className="w-20 px-2 py-1 text-xs bg-white/5 rounded-[8px] text-bone-100 focus:outline-none text-center" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">Output Token Limit</p>
            <p className="text-xs text-bone-70">0 = unlimited</p>
          </div>
          <input type="number" value={outputTokenLimit} min={0} step={1000}
            onChange={e => handleSetting('output_token_limit', parseInt(e.target.value) || 0, setOutputTokenLimit)}
            className="w-20 px-2 py-1 text-xs bg-white/5 rounded-[8px] text-bone-100 focus:outline-none text-center" />
        </div>

        {/* Token limit enabled categories */}
        <div>
          <p className="text-xs font-bold text-bone-70 uppercase tracking-wider mb-2">Token Limit Enabled Categories</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CATS.map(cat => (
              <button key={cat} onClick={() => handleSetting('token_limit_enabled_categories', toggleCat(tokenLimitCats, cat), setTokenLimitCats)}
                className={cn('px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-sm transition-colors',
                  tokenLimitCats.includes(cat) ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-white/5 text-bone-70 border border-transparent hover:bg-white/10')}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Image gen auto last */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">Image Gen Auto Last</p>
            <p className="text-xs text-bone-70">Auto-move IMAGE_GEN to last pipeline position</p>
          </div>
          <Toggle checked={autoLast} onChange={v => handleSetting('image_gen_auto_last', v, setAutoLast)} />
        </div>
      </section>

      <PipelineStatusPanel initialMessages={initialStatusMessages} />
    </div>
  )
}
