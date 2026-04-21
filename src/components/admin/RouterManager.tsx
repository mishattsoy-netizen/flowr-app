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
  Mic
} from 'lucide-react'
import { updateRouterChain } from '@/app/admin/router/actions'
import { cn } from '@/lib/utils'

const PROVIDER_MODELS: Record<string, { id: string; rpd: string }[]> = {
  google: [
    { id: 'gemini-3.1-flash-lite', rpd: '500' },
    { id: 'gemini-3-flash', rpd: '20' },
    { id: 'gemini-3-flash-live', rpd: 'Unlimited' },
    { id: 'gemini-2.5-flash', rpd: '20' },
    { id: 'gemini-2.5-flash-lite', rpd: '20' },
    { id: 'gemini-2.5-flash-8b', rpd: '1,500' },
    { id: 'gemini-3.1-flash-tts', rpd: 'Unlimited' },
    { id: 'gemini-2.5-flash-native-audio-dialog', rpd: 'Unlimited' },
    { id: 'google-search-grounding', rpd: '1,500' },
    { id: 'imagen-4-ultra-generate', rpd: '25' },
    { id: 'imagen-4-fast-generate', rpd: '25' },
    { id: 'imagen-4-generate', rpd: '25' },
    { id: 'gemma-4-31b', rpd: '1,500' },
    { id: 'gemma-4-26b', rpd: '1,500' },
    { id: 'gemma-3-4b', rpd: '1,500' },
    { id: 'allam-2-7b', rpd: 'Unlimited' }
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', rpd: '1,000' },
    { id: 'llama-3.1-8b-instant', rpd: '14,400' },
    { id: 'qwen/qwen3-32b', rpd: '1,000' },
    { id: 'openai/gpt-oss-120b', rpd: '1,000' },
    { id: 'whisper-large-v3-turbo', rpd: '2,000' },
    { id: 'whisper-large-v3', rpd: '2,000' }
  ],
  cloudflare: [
    { id: 'cloudflare-workers-ai', rpd: '100,000' }
  ],
  huggingface: [
    { id: 'huggingface-stable-diffusion', rpd: 'Unlimited' }
  ],
  vault: [
    { id: 'tavily-search', rpd: 'Vault' },
    { id: 'duckduckgo-search', rpd: 'Vault' }
  ]
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

const PROVIDERS = Object.keys(PROVIDER_MODELS)

interface ModelConfig {
  id: string
  provider: string
  is_enabled: boolean
}

function ModelSelector({ 
  value, 
  provider, 
  onChange 
}: { 
  value: string; 
  provider: string; 
  onChange: (val: string) => void 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState(value)
  const containerRef = useRef<HTMLDivElement>(null)

  const models = PROVIDER_MODELS[provider.toLowerCase()] || []
  const filtered = models.filter(m => m.id.toLowerCase().includes(search.toLowerCase()))
  
  const currentModel = models.find(m => m.id === value)

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
          value={isOpen ? search : value}
          onChange={(e) => {
            setSearch(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => {
            setSearch('')
            setIsOpen(true)
          }}
          className="w-full bg-transparent border-none p-0 focus:ring-0 text-[13.5px] font-medium text-bone-60 group-hover:text-bone-100 placeholder:text-bone-60/20"
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
                  "w-full flex items-center justify-between gap-3 px-3 py-1.5 text-[11px] font-medium",
                  value === model.id ? "bg-accent/10 text-accent" : "text-bone-60 hover:bg-bone-hover hover:text-bone-100"
                )}
              >
                <span className="truncate">{model.id}</span>
                <span className={cn(
                  "text-[8px] font-bold px-1 py-0.5 rounded-sm border",
                  value === model.id ? "bg-accent/20 border-accent/30 text-accent" : "bg-background border-white/5 text-bone-60 opacity-40 group-hover:opacity-100"
                )}>
                  {model.rpd}
                </span>
              </button>
            ))
          ) : (
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
  AUDIO_VOICE: Mic
}

export default function RouterManager({ 
  chain,
  title,
  category
}: { 
  chain: any,
  title?: string,
  category?: string
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
    newModels[index] = { ...newModels[index], [field]: value }
    
    if (field === 'provider') {
      const available = PROVIDER_MODELS[value.toLowerCase()] || []
      if (available.length > 0 && !available.some(m => m.id === newModels[index].id)) {
        newModels[index].id = available[0].id
      }
    }

    setModels(newModels)
    setHasChanges(true)
  }

  const addModel = () => {
    setModels([...models, { id: PROVIDER_MODELS.google[0].id, provider: 'google', is_enabled: true }])
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
    <div className="bg-panel border border-white/5 rounded-big relative shadow-lg flex flex-col p-2">
      {/* Integrated Header */}
      {title && (
        <div className="px-2 py-2 mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {category && CATEGORY_ICONS[category] && (
              <div className="text-accent opacity-50">
                {React.createElement(CATEGORY_ICONS[category], { className: "w-3 h-3", strokeWidth: 2.5 })}
              </div>
            )}
            <h3 className="text-[10px] font-black text-bone-100 tracking-[0.1em] uppercase opacity-30">
              {title}
            </h3>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {models.map((model, index) => (
          <div key={`${model.id}-${index}`} className="group flex items-center gap-3 px-3 py-2 rounded-medium hover:bg-white/[0.03] transition-all">
            {/* Left: Model & Provider Pair */}
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <div className={cn("flex-1 min-w-0 flex items-center gap-2", !model.is_enabled && "opacity-25 grayscale")}>
                <ModelSelector 
                  value={model.id}
                  provider={model.provider}
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
                    {PROVIDERS.map(p => (
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
          className="text-[9px] flex items-center gap-2 text-bone-60 hover:text-bone-100 hover:bg-white/[0.03] font-bold tracking-[0.02em] px-3 py-1.5 rounded-medium uppercase transition-all"
        >
          <Plus className="w-3 h-3" /> Add node registry
        </button>
        
        {hasChanges && (
          <div className="flex items-center gap-4 animate-in slide-in-from-right-2 duration-300">
            <button 
              onClick={() => setModels(chain.model_list)}
              className="text-[10px] font-black tracking-[0.05em] text-bone-60 hover:text-rose-500 uppercase"
            >
              Reset
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-accent text-background px-4 py-1.5 rounded-medium text-[9px] font-bold tracking-[0.02em] hover:brightness-110 shadow-lg uppercase transition-all"
            >
              {isSaving ? 'Syncing...' : 'Commit changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
