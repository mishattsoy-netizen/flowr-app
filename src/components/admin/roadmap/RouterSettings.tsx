import React, { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Save, Power, Command, Share2, Zap, Wand2, Cpu, Image as ImageIcon, Mic, Brain, Camera } from 'lucide-react'
import { RoadmapRouterChain } from './RoadmapClient'
import { cn } from '@/lib/utils'
import ModelDropdown from '../ModelDropdown'

const CATEGORY_ICONS: Record<string, any> = {
  TOOL_CALLING: Command,
  WEB_SEARCH: Share2,
  FAST_SIMPLE: Zap,
  MEDIUM_THINKING: Wand2,
  COMPLEX_THINKING: Cpu,
  IMAGE_GEN: ImageIcon,
  AUDIO_VOICE: Mic,
  CLASSIFIER: Brain,
  VISION: Camera
}

const PROVIDER_COLORS: Record<string, string> = {
  google: 'text-blue-400',
  groq: 'text-orange-400',
  openrouter: 'text-purple-400',
  ollama: 'text-cyan-400',
  vault: 'text-emerald-400',
  pollinations: 'text-pink-400',
  huggingface: 'text-yellow-400',
  cloudflare: 'text-amber-400',
}

const PROVIDER_DOTS: Record<string, string> = {
  google: 'bg-blue-400',
  groq: 'bg-orange-400',
  openrouter: 'bg-purple-400',
  ollama: 'bg-cyan-400',
  vault: 'bg-emerald-400',
  pollinations: 'bg-pink-400',
  huggingface: 'bg-yellow-400',
  cloudflare: 'bg-amber-400',
}

function ProviderSelector({ value, providers, onChange, isEnabled }: any) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const dotColor = PROVIDER_DOTS[value?.toLowerCase()] || 'bg-[var(--bone-60)]'

  return (
    <div className="relative shrink-0 flex items-center justify-center select-none" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={value}
        className={cn(
          "flex items-center justify-center w-6 h-6 rounded-sm transition-all duration-0 hover:bg-white/5 focus:outline-none",
          !isEnabled && "opacity-40"
        )}
      >
        <div className={cn("w-2 h-2 rounded-full shrink-0 transition-all duration-0", isEnabled ? dotColor : "bg-[var(--bone-60)]")} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-[#1A1A1A] border border-[var(--bone-10)] rounded-xl shadow-2xl z-50 min-w-[120px] max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-200 py-1 flex flex-col gap-0.5">
          {providers.map((p: string) => {
            const pDot = PROVIDER_DOTS[p] || 'bg-[var(--bone-60)]'
            const pColor = PROVIDER_COLORS[p] || 'text-[var(--bone-60)]'
            return (
              <button
                key={p}
                onClick={() => { onChange(p); setIsOpen(false) }}
                className={cn(
                  "w-full flex items-center justify-start gap-2.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-0 select-none hover:bg-white/5",
                  value === p ? "bg-white/[0.08] text-[var(--bone-100)]" : "text-[var(--bone-60)] hover:text-[var(--bone-100)]"
                )}
              >
                <div className={cn("w-2 h-2 rounded-full shrink-0", pDot)} />
                <span className={cn("capitalize text-[10.5px] tracking-wide font-bold", pColor)}>{p}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function RouterSettings({ initialChains }: { initialChains: RoadmapRouterChain[] }) {
  const [chains, setChains] = useState<RoadmapRouterChain[]>(initialChains)
  const [availableModels, setAvailableModels] = useState<any[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    fetch('/api/admin/models')
      .then(res => res.ok ? res.json() : [])
      .then(data => setAvailableModels(Array.isArray(data) ? data : []))
      .catch(console.error)
      
    if (chains.length === 0) {
      fetch('/api/admin/roadmap/router')
        .then(res => res.ok ? res.json() : [])
        .then(data => { if (Array.isArray(data) && data.length) setChains(data) })
        .catch(console.error)
    }
  }, [chains.length])

  const handleSave = async () => {
    setIsSaving(true)
    for (const chain of chains) {
      await fetch('/api/admin/roadmap/router', {
        method: 'PATCH',
        body: JSON.stringify({ category: chain.category, model_list: chain.model_list, temperature: chain.temperature ?? 0.7 })
      })
    }
    setIsSaving(false)
    setHasChanges(false)
  }

  const addModel = (categoryId: string) => {
    const existing = chains.find(c => c.category === categoryId)
    if (existing && existing.model_list && existing.model_list.length >= 10) {
      alert('Maximum of 10 models allowed per chain.')
      return
    }

    const firstModel = availableModels[0] || { id: 'gemma-3-2b-it', provider: 'google', max_rpd: null }

    setChains(prev => {
      if (existing) {
        return prev.map(c => c.category === categoryId ? { ...c, model_list: [...(c.model_list || []), { ...firstModel, is_enabled: true }] } : c)
      } else {
        return [...prev, { id: crypto.randomUUID(), category: categoryId as any, model_list: [{ ...firstModel, is_enabled: true }], temperature: 0.7, system_prompt: '' }]
      }
    })
    setHasChanges(true)
  }

  const removeModel = (categoryId: string, index: number) => {
    setChains(prev => prev.map(c => {
      if (c.category !== categoryId) return c
      const newList = [...(c.model_list || [])]
      newList.splice(index, 1)
      return { ...c, model_list: newList }
    }))
    setHasChanges(true)
  }

  const toggleModel = (categoryId: string, index: number) => {
    setChains(prev => prev.map(c => {
      if (c.category !== categoryId) return c
      const newList = [...(c.model_list || [])]
      newList[index].is_enabled = !newList[index].is_enabled
      return { ...c, model_list: newList }
    }))
    setHasChanges(true)
  }

  const updateLocalModel = (categoryId: string, index: number, field: string, value: any) => {
    setChains(prev => prev.map(c => {
      if (c.category !== categoryId) return c
      const newModels = [...(c.model_list || [])]
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
      return { ...c, model_list: newModels }
    }))
    setHasChanges(true)
  }

  const updateTemperature = (categoryId: string, val: number) => {
    setChains(prev => prev.map(c => {
      if (c.category !== categoryId) return c
      return { ...c, temperature: val }
    }))
    setHasChanges(true)
  }

  const providers = [...new Set(availableModels.map(m => m.provider.toLowerCase()))].sort()
  const categories = ['CLASSIFIER', 'COMPLEX', 'FAST', 'VISION', 'WEB_SEARCH']

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-[var(--bone-60)]">Independent routing configuration for the Planning Assistant.</p>
        {hasChanges && (
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bone-100)] text-black hover:opacity-90 text-[10px] uppercase font-bold tracking-widest transition-opacity disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : 'Save Matrix'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {categories.map(cat => {
          const chain = chains.find(c => c.category === cat)
          const models = chain?.model_list || []
          const Icon = CATEGORY_ICONS[cat] || Cpu

          const temperature = chain?.temperature ?? 0.7

          return (
            <div key={cat} className="bg-[#151515] rounded-2xl px-3 pb-2 pt-3 flex flex-col relative min-h-[140px]">
              <div className="px-2 py-1 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-[#eea047]" strokeWidth={2} />
                  <h3 className="text-[10px] font-bold text-[var(--bone-60)] tracking-widest uppercase">
                    {cat.replace(/_/g, ' ')}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-white/5 text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-white/[0.08] text-[9px] font-bold uppercase tracking-wide">
                  <span>Temp</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={temperature}
                    onChange={(e) => updateTemperature(cat, parseFloat(e.target.value) || 0)}
                    className="w-10 bg-transparent border-none p-0 focus:ring-0 text-[9px] font-mono text-center font-bold text-[#eea047] select-none outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1 pb-3">
                {models.map((m: any, i: number) => (
                  <div key={`${m.id}-${i}`} className="group flex items-center gap-3 px-2 py-0.5 rounded-xl hover:bg-white/[0.02] transition-all duration-0 relative">
                    <div className="flex-1 shrink-0 flex items-center min-w-0">
                      <ModelDropdown
                        value={m.id}
                        models={availableModels}
                        onChange={(val) => updateLocalModel(cat, i, 'id', val)}
                        providerFilter={m.provider}
                        className="bg-transparent border-none text-xs"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2.5 ml-auto shrink-0">
                      <div className="flex items-center gap-1 shrink-0 text-[var(--bone-60)] w-16 justify-end">
                        <span className="text-[9px] font-mono font-medium">
                          {(() => {
                            const matchingModel = availableModels.find(x => x.id === m.id)
                            return matchingModel && matchingModel.max_rpd !== null ? matchingModel.max_rpd.toLocaleString() : '∞'
                          })()}
                        </span>
                        <span className="text-[8px] font-bold uppercase tracking-tighter opacity-60">RPD</span>
                      </div>

                      <ProviderSelector
                        value={m.provider}
                        providers={providers}
                        onChange={(val: string) => updateLocalModel(cat, i, 'provider', val)}
                        isEnabled={m.is_enabled}
                      />
          
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button 
                          onClick={() => toggleModel(cat, i)}
                          className={cn(
                            "p-1 rounded-full transition-all duration-0",
                            m.is_enabled ? "bg-[#eea047]/10 text-[#eea047]" : "bg-white/5 text-[var(--bone-60)] opacity-20 hover:opacity-40"
                          )}
                        >
                          <Power className="w-3 h-3" />
                        </button>
                        
                        <button 
                          onClick={() => removeModel(cat, i)}
                          className="p-1 rounded-full bg-white/5 text-[var(--bone-60)] opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all duration-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-auto px-2 py-1 flex justify-between items-center border-t border-white/[0.03]">
                <button 
                  onClick={() => addModel(cat)}
                  disabled={models.length >= 10}
                  className="text-[10px] flex items-center gap-2 text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-white/5 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-[var(--bone-40)] font-bold tracking-widest px-2 py-1.5 rounded-lg uppercase transition-all duration-0"
                >
                  <Plus className="w-3 h-3" /> Add node
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
