'use client'

import { useState, useTransition, useCallback } from 'react'
import { Globe, RefreshCw, Check, Cpu, Plus, Trash2, Power, Save, ChevronDown, Settings2 } from 'lucide-react'
import { Toggle } from '@/components/ui/Toggle'
import ModelDropdown from '@/components/admin/ModelDropdown'
import ProviderSelector from '@/components/admin/ProviderSelector'
import OpenRouterRoutingProviderSelector from '@/components/admin/OpenRouterRoutingProviderSelector'
import { RegistryModel } from '@/components/admin/model-utils'
import { cn } from '@/lib/utils'
import {
  setOllamaEnabled, setBackendModel,
  updateCompactionConfig, setKeywordsEnabled,
} from './actions'
import { updateRouterChain, savePipelineSetting } from '@/app/admin/router/actions'
import type { CompactionConfig } from '@/lib/bot/compaction'

interface ModelEntry {
  id: string
  provider: string
  is_enabled: boolean
  openrouter_provider?: string
  _key?: string
}

interface Props {
  ollamaEnabled: boolean
  backendModel: string
  compactionConfig: CompactionConfig
  models: RegistryModel[]
  keywordsEnabled: boolean
  initialPipelinePrompts: { value: Record<string, string>; updated_at: string | null }
  initialPipelineSettings: any
  compactionChain: { id: string; category: string; model_list: ModelEntry[]; system_prompt: string | null } | null
}

let modelKeyCounter = 0
const nextKey = () => `model_${++modelKeyCounter}_${Date.now()}`

export default function GlobalSettingsClient({
  ollamaEnabled, backendModel,
  compactionConfig, models, keywordsEnabled,
  initialPipelinePrompts, initialPipelineSettings,
  compactionChain
}: Props) {
  const [ollamaOn, setOllamaOn] = useState(ollamaEnabled)
  const [keywordsOn, setKeywordsOn] = useState(keywordsEnabled)
  const [backend, setBackend] = useState(backendModel)
  const [config, setConfig] = useState(compactionConfig)
  const [saved, setSaved] = useState(false)
  const ALL_CATS = ['REGULAR', 'COMPLEX', 'CODING', 'WEB_SEARCH', 'RESEARCH', 'IMAGE_GEN', 'VISION', 'AUDIO', 'CLASSIFIER', 'ADVISOR', 'THINKING', 'COMPACTION']

  // ── Hardcoded pipeline settings (read-only preview) ────────────────────────
  // Source of truth: src/lib/router-config.ts → HARDCODED_PIPELINE_SETTINGS
  const HISTORY_LIMIT = 50
  const INPUT_TOKEN_LIMIT = 0
  const OUTPUT_TOKEN_LIMIT = 0
  const AUTO_LAST = true
  const GLOBAL_CATS = ['REGULAR', 'COMPLEX', 'CODING', 'WEB_SEARCH', 'RESEARCH', 'IMAGE_GEN', 'AUDIO', 'VISION', 'ADVISOR']
  const HISTORY_CATS = ['REGULAR', 'COMPLEX', 'CODING', 'WEB_SEARCH', 'RESEARCH', 'AUDIO', 'VISION', 'ADVISOR', 'THINKING']
  // Source of truth: src/lib/bot/compaction.ts → HARDCODED_COMPACTION_CONFIG
  const CONTEXT_LIMIT = 16000
  const COMPACTION_THRESHOLD = 70 // percent

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
    setChainSaved(true)
    setTimeout(() => setChainSaved(false), 1500)
  }

  const allProviders = Array.from(new Set(models.map(m => m.provider.toLowerCase())))

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



      {/* Context & Compaction — read-only preview */}
      <section className="flex flex-col gap-4 px-6 py-4 rounded-big bg-white/5 border border-[var(--bone-12)]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-bone-80">Context &amp; Compaction</h2>
          <span className="text-[9px] font-bold uppercase tracking-wider text-bone-50 bg-white/5 border border-white/10 px-2 py-0.5 rounded-sm">Hardcoded in code</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">Context Limit</p>
            <p className="text-xs text-bone-70">Max tokens per session before compaction</p>
          </div>
          <div className="flex gap-2">
            {[32000, 64000, 128000].map(v => (
              <span key={v}
                className={cn('px-2 py-1 text-xs rounded-[8px]', CONTEXT_LIMIT === v ? 'bg-accent/10 text-accent' : 'bg-white/5 text-bone-70')}>
                {v / 1000}k
              </span>
            ))}
            <span className="w-20 px-2 py-1 text-xs bg-white/5 rounded-[8px] text-bone-100 text-center">{CONTEXT_LIMIT}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">Compaction Threshold</p>
            <p className="text-xs text-bone-70">Trigger compaction at this % of context limit</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="range" min={50} max={95} step={5} value={COMPACTION_THRESHOLD}
              readOnly disabled
              className="w-24 opacity-60 cursor-not-allowed" />
            <span className="text-xs text-bone-70 w-8">{COMPACTION_THRESHOLD}%</span>
          </div>
        </div>
      </section>



      {/* Context & Settings — read-only preview */}
      <section className="flex flex-col gap-4 px-6 py-4 rounded-big bg-white/5 border border-[var(--bone-12)]">
        <div className="flex items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <Settings2 className="w-5 h-5 text-accent" />
            <h2 className="text-sm font-bold text-bone-100 tracking-wider">Context &amp; Settings</h2>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-bone-50 bg-white/5 border border-white/10 px-2 py-0.5 rounded-sm">Hardcoded in code</span>
        </div>

        {/* History limit */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">History Limit</p>
            <p className="text-xs text-bone-70">Max messages sent to model as context</p>
          </div>
          <span className="w-16 px-2 py-1 text-xs bg-white/5 rounded-[8px] text-bone-100 text-center">{HISTORY_LIMIT}</span>
        </div>

        {/* History enabled categories */}
        <div>
          <p className="text-xs font-bold text-bone-70 uppercase tracking-wider mb-2">History Enabled Categories</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CATS.map(cat => (
              <span key={cat}
                className={cn('px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-sm',
                  HISTORY_CATS.includes(cat) ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-white/5 text-bone-70 border border-transparent')}>
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Global prompt enabled categories */}
        <div>
          <p className="text-xs font-bold text-bone-70 uppercase tracking-wider mb-2">Global Prompt Enabled Categories</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CATS.map(cat => (
              <span key={cat}
                className={cn('px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-sm',
                  GLOBAL_CATS.includes(cat) ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-white/5 text-bone-70 border border-transparent')}>
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Token limits */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">Input Token Limit</p>
            <p className="text-xs text-bone-70">0 = unlimited</p>
          </div>
          <span className="w-20 px-2 py-1 text-xs bg-white/5 rounded-[8px] text-bone-100 text-center">{INPUT_TOKEN_LIMIT}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">Output Token Limit</p>
            <p className="text-xs text-bone-70">0 = unlimited</p>
          </div>
          <span className="w-20 px-2 py-1 text-xs bg-white/5 rounded-[8px] text-bone-100 text-center">{OUTPUT_TOKEN_LIMIT}</span>
        </div>

        {/* Token limit enabled categories — removed (no longer configurable) */}

        {/* Image gen auto last */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">Image Gen Auto Last</p>
            <p className="text-xs text-bone-70">Auto-move IMAGE_GEN to last pipeline position</p>
          </div>
          <div className={cn('w-10 h-5 rounded-full relative transition-colors', AUTO_LAST ? 'bg-accent' : 'bg-white/10')}>
            <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm', AUTO_LAST ? 'left-5' : 'left-0.5')} />
          </div>
        </div>
      </section>
    </div>
  )
}
