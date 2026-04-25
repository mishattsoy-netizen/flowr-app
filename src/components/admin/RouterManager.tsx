'use client'

import React, { useState, useRef, useEffect } from 'react'
import { 
  ArrowUp, 
  ArrowDown, 
  Power, 
  Trash2, 
  Plus, 
  ChevronDown,
  Cpu,
  Command,
  Share2,
  Zap,
  Wand2,
  Image,
  Mic,
  Brain
} from 'lucide-react'
import { updateRouterChain } from '@/app/admin/router/actions'
import { cn } from '@/lib/utils'

interface RegistryModel {
  id: string
  provider: string
  max_rpd: number | null
}

const PROVIDER_COLORS: Record<string, string> = {
  google: 'text-blue-400',
  groq: 'text-orange-400',
  openrouter: 'text-purple-400',
  ollama: 'text-cyan-400',
  vault: 'text-emerald-400'
}

const PROVIDER_DOTS: Record<string, string> = {
  google: 'bg-blue-400',
  groq: 'bg-orange-400',
  openrouter: 'bg-purple-400',
  ollama: 'bg-cyan-400',
  vault: 'bg-emerald-400'
}

interface ModelConfig {
  id: string
  provider: string
  is_enabled: boolean
}

function ModelSelector({
  value,
  provider,
  registryModels,
  onChange,
}: {
  value: string
  provider: string
  registryModels: RegistryModel[]
  onChange: (val: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState(value)
  const containerRef = useRef<HTMLDivElement>(null)

  const models = registryModels
    .filter(m => m.provider.toLowerCase() === provider.toLowerCase())
    .map(m => ({ id: m.id, rpd: m.max_rpd !== null ? m.max_rpd.toLocaleString() : '∞' }))
  const filtered = models.filter(m => m.id.toLowerCase().includes(search.toLowerCase()))

  const currentModel = models.find(m => m.id === value)

  // Sync search with value when not open
  useEffect(() => {
    if (!isOpen) setSearch(value)
  }, [value, isOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch(value)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [value])

  return (
    <div className="relative flex-1" ref={containerRef}>
      <div className="relative group flex items-center gap-2">
        <input 
          value={search}
          title={search}
          onChange={(e) => {
            const newVal = e.target.value
            setSearch(newVal)
            onChange(newVal)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={(e) => {
            setIsOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setIsOpen(false)
            } else if (e.key === 'Escape') {
              setIsOpen(false)
              setSearch(value)
            }
          }}
          className="w-full bg-transparent border-none p-0 focus:ring-0 text-[13.5px] font-medium text-bone-60 group-hover:text-bone-100 placeholder:text-bone-60/20 truncate tracking-wide"
          placeholder="Model node ID..."
        />
        
        {!isOpen && currentModel && (
          <span className="shrink-0 text-[9px] font-bold px-1 py-0.5 rounded-sm bg-background border border-white/5 text-bone-60 tracking-tight opacity-40 group-hover:opacity-100">
            {currentModel.rpd} RPD
          </span>
        )}
        
        <ChevronDown className="shrink-0 w-3 h-3 text-bone-60 opacity-20 group-hover:opacity-100" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1.5 bg-panel border border-white/10 rounded-medium shadow-2xl z-50 max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-200 py-1">
          {search && !models.some(m => m.id === search) && (
            <button
              onClick={() => {
                onChange(search)
                setIsOpen(false)
              }}
              className="w-full flex flex-col items-start gap-0.5 px-3 py-2 border-b border-white/5 hover:bg-bone-hover group/custom"
            >
              <span className="text-[8px] font-bold text-accent uppercase tracking-wider opacity-60 group-hover/custom:opacity-100">Custom ID</span>
              <span className="text-[11px] font-medium text-bone-100 truncate w-full tracking-wide" title={search}>{search}</span>
            </button>
          )}
          
          {filtered.length > 0 ? (
            filtered.map(model => (
              <button
                key={model.id}
                onClick={() => {
                  onChange(model.id)
                  setIsOpen(false)
                  setSearch(model.id)
                }}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-3 py-1.5 text-[11px] font-medium tracking-wide",
                  value === model.id ? "bg-accent/10 text-accent" : "text-bone-60 hover:bg-bone-hover hover:text-bone-100"
                )}
              >
                <span className="truncate" title={model.id}>{model.id}</span>
                <span className={cn(
                  "text-[8px] font-bold px-1 py-0.5 rounded-sm border",
                  value === model.id ? "bg-accent/20 border-accent/30 text-accent" : "bg-background border-white/5 text-bone-60 opacity-40 group-hover:opacity-100"
                )}>
                  {model.rpd}
                </span>
              </button>
            ))
          ) : !search && (
            <div className="px-4 py-4 text-center text-[9px] font-bold text-bone-60 opacity-30 italic tracking-tight uppercase">Empty node list</div>
          )}
        </div>
      )}
    </div>
  )
}

const CATEGORY_ICONS: Record<string, any> = {
  TOOL_CALLING: Command,
  WEB_SEARCH: Share2,
  FAST_SIMPLE: Zap,
  MEDIUM_THINKING: Wand2,
  COMPLEX_THINKING: Cpu,
  IMAGE_GEN: Image,
  AUDIO_VOICE: Mic,
  CLASSIFIER: Brain
}

export default function RouterManager({
  chain,
  title,
  category,
  availableModels = [],
}: {
  chain: any
  title?: string
  category?: string
  availableModels?: RegistryModel[]
}) {
  const [models, setModels] = useState<ModelConfig[]>(chain.model_list)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const move = (index: number, direction: 'up' | 'down') => {
    const newModels = [...models]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= models.length) return
    
    [newModels[index], newModels[targetIndex]] = [newModels[targetIndex], newModels[index]]
    setModels(newModels)
    setHasChanges(true)
  }

  const toggle = (index: number) => {
    const newModels = [...models]
    newModels[index].is_enabled = !newModels[index].is_enabled
    setModels(newModels)
    setHasChanges(true)
  }

  const updateLocalModel = (index: number, field: keyof ModelConfig, value: any) => {
    const newModels = [...models]
    const oldProvider = newModels[index].provider
    const oldId = newModels[index].id
    newModels[index] = { ...newModels[index], [field]: value }
    
    if (field === 'provider') {
      const oldProviderModels = availableModels.filter(m => m.provider.toLowerCase() === oldProvider.toLowerCase())
      const wasKnownModel = oldProviderModels.some(m => m.id === oldId)
      const newProviderModels = availableModels.filter(m => m.provider.toLowerCase() === (value as string).toLowerCase())
      if (wasKnownModel && newProviderModels.length > 0 && !newProviderModels.some(m => m.id === oldId)) {
        newModels[index].id = newProviderModels[0].id
      }
    }

    setModels(newModels)
    setHasChanges(true)
  }

  const providers = [...new Set(availableModels.map(m => m.provider.toLowerCase()))].sort()

  const addModel = () => {
    const firstModel = availableModels[0]
    setModels([...models, { id: firstModel?.id ?? '', provider: firstModel?.provider ?? 'google', is_enabled: true }])
    setHasChanges(true)
  }

  const deleteModel = (index: number) => {
    const newModels = models.filter((_, i) => i !== index)
    setModels(newModels)
    setHasChanges(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateRouterChain(chain.id, models)
      setHasChanges(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={cn(
      "bg-panel border border-white/5 rounded-big px-5 pb-5 pt-4 h-full flex flex-col relative",
      hasChanges ? "ring-1 ring-accent/20" : ""
    )}>
      {/* Integrated Header */}
      {title && (
        <div className="px-2 py-2 mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {category && CATEGORY_ICONS[category] && (
              <div className="text-accent opacity-50">
                {React.createElement(CATEGORY_ICONS[category], { className: "w-3 h-3", strokeWidth: 2.5 })}
              </div>
            )}
            <h3 className="text-[11px] font-ui-label font-bold text-muted-foreground tracking-widest uppercase opacity-40">
              {title}
            </h3>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {models.map((model, index) => (
          <div key={`${model.id}-${index}`} className="group flex items-center gap-3 px-3 py-2 rounded-medium hover:bg-[var(--bone-6)] transition-all">
            {/* Left: Model & Provider Pair */}
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <div className={cn("flex-1 min-w-0 flex items-center gap-2", !model.is_enabled && "opacity-25 grayscale")}>
                <ModelSelector
                  value={model.id}
                  provider={model.provider}
                  registryModels={availableModels}
                  onChange={(val) => updateLocalModel(index, 'id', val)}
                />
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <div className={cn("w-px h-3", model.is_enabled ? (PROVIDER_COLORS[model.provider.toLowerCase()] || 'bg-white/5') : 'bg-white/5', "opacity-20")} />
                <div className="relative flex items-center gap-1.5">
                  <div className={cn("w-1 h-1 rounded-full shrink-0", model.is_enabled ? (PROVIDER_DOTS[model.provider.toLowerCase()] || 'bg-bone-60') : 'bg-bone-60', "opacity-40")} />
                  <select 
                    value={model.provider.toLowerCase()}
                    onChange={(e) => updateLocalModel(index, 'provider', e.target.value)}
                    className={cn(
                      "bg-transparent border-none p-0 focus:ring-0 text-[10px] font-bold tracking-tight cursor-pointer appearance-none capitalize transition-all",
                      model.is_enabled ? (PROVIDER_COLORS[model.provider.toLowerCase()] || 'text-bone-60') : 'text-bone-60',
                      "opacity-40 group-hover:opacity-100"
                    )}
                  >
                    {providers.map(p => (
                      <option key={p} value={p} className="bg-panel text-bone-100 capitalize">{p}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center bg-background/50 rounded-small border border-white/5 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => move(index, 'up')}
                  disabled={index === 0}
                  className="text-bone-60 hover:text-accent disabled:opacity-20 p-1 transition-colors"
                >
                  <ArrowUp className="w-2.5 h-2.5" />
                </button>
                <div className="w-px h-3 bg-white/5" />
                <button 
                  onClick={() => move(index, 'down')}
                  disabled={index === models.length - 1}
                  className="text-bone-60 hover:text-accent disabled:opacity-20 p-1 transition-colors"
                >
                  <ArrowDown className="w-2.5 h-2.5" />
                </button>
              </div>

              <button 
                onClick={() => toggle(index)}
                className={cn(
                  "p-1.5 rounded-medium border transition-all",
                  model.is_enabled 
                    ? "bg-accent/10 border-accent/20 text-accent" 
                    : "bg-background border-white/5 text-bone-60 opacity-20"
                )}
              >
                <Power className="w-3 h-3" />
              </button>
              
              <button 
                onClick={() => deleteModel(index)}
                className="p-1.5 rounded-medium bg-background border border-white/5 text-bone-60 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:border-rose-500/20 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 px-2 py-2 flex justify-between items-center border-t border-white/[0.03]">
        <button 
          onClick={addModel}
          className="text-[9px] flex items-center gap-2 text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] font-bold tracking-[0.02em] px-3 py-1.5 rounded-medium uppercase transition-all"
        >
          <Plus className="w-3 h-3" /> Add node registry
        </button>
        
        {hasChanges && (
          <div className="flex items-center gap-4 animate-in slide-in-from-right-2 duration-300">
            <button 
              onClick={() => setModels(chain.model_list)}
              className="text-[10px] font-bold tracking-[0.05em] text-bone-60 hover:text-rose-500 uppercase"
            >
              Reset
            </button>
               <button 
                 onClick={handleSave}
                 disabled={isSaving}
                 className="bg-accent text-background px-4 py-1.5 rounded-[var(--radius-medium)] text-[11px] font-bold tracking-wide hover:brightness-110 transition-all uppercase"
               >
                 {isSaving ? 'Syncing...' : 'Commit changes'}
               </button>
          </div>
        )}
      </div>
    </div>
  )
}
