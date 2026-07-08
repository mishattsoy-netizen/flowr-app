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
  Brain,
  Layers,
  Layers2,
  X,
  Save,
  Edit2,
  MessageSquareCode,
  Sparkles,
  Search,
  Eye,
  ShieldCheck,
  ArrowUpRight,
  Maximize,
  GraduationCap
} from 'lucide-react'
import {
  updateRouterChain,
  getFallbackModes,
  setFallbackMode,
  getSubchainConfigsAction,
  saveSubchainConfigsAction,
} from '@/app/admin/router/actions'
import type { SubchainConfig } from '@/lib/subchain-config'
import type { IntentCategory } from '@/lib/router-config'
import { saveChainPreset, loadChainPreset, listChainPresets } from '@/app/admin/bot/registry/actions'
import { cn } from '@/lib/utils'
import ModelDropdown from './ModelDropdown'
import ProviderSelector from './ProviderSelector'
import OpenRouterRoutingProviderSelector from './OpenRouterRoutingProviderSelector'
import RowOptionsDropdown from './RowOptionsDropdown'
import { PROVIDER_DOTS, PROVIDER_COLORS, RegistryModel } from './model-utils'



interface ModelConfig {
  id: string
  provider: string
  is_enabled: boolean
  openrouter_provider?: string
  _key?: string
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
          className="w-full bg-transparent border-none p-0 focus:ring-0 text-[13.5px] font-medium text-bone-70 group-hover:text-bone-100 placeholder:text-bone-70/20 truncate tracking-wide"
          placeholder="Model node ID..."
        />
        
        <ChevronDown className="shrink-0 w-3 h-3 text-bone-70 opacity-20 group-hover:opacity-100" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1.5 bg-panel border border-white/10 rounded-medium shadow-2xl z-50 max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-0 py-1">
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
                  value === model.id ? "bg-accent/10 text-accent" : "text-bone-70 hover:bg-bone-hover hover:text-bone-100"
                )}
              >
                <span className="truncate" title={model.id}>{model.id}</span>
                <span className={cn(
                  "text-[8px] font-bold px-1 py-0.5 rounded-sm border",
                  value === model.id ? "bg-accent/20 border-accent/30 text-accent" : "bg-background border-white/5 text-bone-70 opacity-40 group-hover:opacity-100"
                )}>
                  {model.rpd}
                </span>
              </button>
            ))
          ) : !search && (
            <div className="px-4 py-4 text-center text-[9px] font-bold text-bone-70 opacity-30 italic tracking-tight uppercase">Empty node list</div>
          )}
        </div>
      )}
    </div>
  )
}

const CATEGORY_ICONS: Record<string, any> = {
  TOOLS: Command,
  WEB_SEARCH: Share2,
  FAST_SIMPLE: Zap,
  MEDIUM_THINKING: Wand2,
  COMPLEX: Cpu,
  IMAGE_GEN: Image,
  AUDIO: Mic,
  CLASSIFIER: Brain,
  THINKING: Sparkles,
  ORCHESTRATOR: Layers,
  CODING: MessageSquareCode,
  RESEARCH: GraduationCap,
  VISION: Eye,
  ADVISOR: ShieldCheck,
  PROMPT_EXPANSION: ArrowUpRight,
  IMAGE_NARRATION: Mic
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
  const [models, setModels] = useState<ModelConfig[]>(() => 
    chain.model_list.map((m: any) => ({ 
      ...m, 
      _key: m._key || Math.random().toString(36).substr(2, 9) 
    }))
  )
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Subchain state
  const SUBCHAIN_PARENTS: Record<string, true> = { IMAGE_GEN: true, RESEARCH: true }
  const hasSubchains = category ? SUBCHAIN_PARENTS[category] === true : false
  const ALL_CATEGORIES: IntentCategory[] = [
    'REGULAR', 'COMPLEX', 'CLASSIFIER',
    'VISION', 'IMAGE_GEN', 'WEB_SEARCH', 'RESEARCH',
    'CODING', 'THINKING', 'ADVISOR',
  ]
  const [isSubchainView, setIsSubchainView] = useState(false)
  const [isPromptOpen, setIsPromptOpen] = useState(false)
  const [subchains, setSubchains] = useState<SubchainConfig[]>([])
  const [activeSubchainId, setActiveSubchainId] = useState<string | null>(null)
  const [isSavingSubchain, setIsSavingSubchain] = useState(false)

  useEffect(() => {
    if (!isSubchainView || !category) return
    getSubchainConfigsAction().then(all => {
      const mine = all.filter(s => s.parent_category === category)
      setSubchains(mine)
      if (mine.length > 0 && !activeSubchainId) setActiveSubchainId(mine[0].id)
    })
  }, [isSubchainView, category])

  const activeSubchain = subchains.find(s => s.id === activeSubchainId) ?? null

  const handleSubchainChainChange = (subchainId: string, newCategory: IntentCategory) => {
    setSubchains(prev => prev.map(s => s.id === subchainId ? { ...s, chain_category: newCategory } : s))
  }

  const handleSubchainPromptChange = (value: string) => {
    if (!activeSubchainId) return
    setSubchains(prev => prev.map(s => s.id === activeSubchainId ? { ...s, system_prompt: value } : s))
  }

  const handleSaveSubchains = async () => {
    if (!subchains.length) return
    setIsSavingSubchain(true)
    try {
      const all = await getSubchainConfigsAction()
      const others = all.filter(s => s.parent_category !== category)
      await saveSubchainConfigsAction([...others, ...subchains])
    } catch (err: any) {
      alert(`Failed to save subchain config: ${err.message}`)
    } finally {
      setIsSavingSubchain(false)
    }
  }
  const [isPresetOpen, setIsPresetOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetsList, setPresetsList] = useState<any[]>([])
  const [isSavingPreset, setIsSavingPreset] = useState(false)
  const [fallbackMode, setFallbackModeState] = useState<'model_first' | 'api_key_first'>('model_first')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    
    const newModels = [...models]
    const draggedItem = newModels[draggedIndex]
    
    newModels.splice(draggedIndex, 1)
    newModels.splice(index, 0, draggedItem)
    
    setModels(newModels)
    setDraggedIndex(index)
    setHasChanges(true)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    setDraggedIndex(null)
  }

  useEffect(() => {
    const loadFallbackMode = async () => {
      if (!category) return
      const modes = await getFallbackModes()
      if (modes[category]) {
        setFallbackModeState(modes[category])
      }
    }
    loadFallbackMode()
  }, [category])

  const handleToggleMode = async () => {
    if (!category) return
    const nextMode = fallbackMode === 'model_first' ? 'api_key_first' : 'model_first'
    setFallbackModeState(nextMode)
    await setFallbackMode(category, nextMode)
  }

  const loadPresets = async () => {
    if (!category) return
    try {
      const list = await listChainPresets(category)
      setPresetsList(list)
    } catch (err: any) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadPresets()
  }, [category])

  const handleSavePreset = async () => {
    if (!presetName.trim() || !category) return
    setIsSavingPreset(true)
    try {
      await saveChainPreset(presetName, category, models)
      setPresetName('')
      await loadPresets()
      alert('Chain preset saved successfully!')
    } catch (err: any) {
      alert(`Failed to save chain preset: ${err.message}`)
    } finally {
      setIsSavingPreset(false)
    }
  }

  const handleLoadPreset = async (presetId: string) => {
    if (!presetId) return
    try {
      const loadedModelList = await loadChainPreset(presetId)
      if (loadedModelList && Array.isArray(loadedModelList)) {
        setModels(loadedModelList)
        setHasChanges(true)
        alert('Chain preset loaded successfully!')
      }
    } catch (err: any) {
      alert(`Failed to load chain preset: ${err.message}`)
    }
  }

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
    
    // Drop openrouter_provider mapping if target switches off openrouter
    if (field === 'provider' && (value as string).toLowerCase() !== 'openrouter') {
      delete newModels[index].openrouter_provider
    }
    
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

  const providers = [...new Set([
    ...Object.keys(PROVIDER_COLORS),
    ...availableModels.map(m => m.provider.toLowerCase())
  ])].sort()

  const addModel = () => {
    if (models.length >= 10) {
      alert('Maximum of 10 models allowed per chain.')
      return
    }
    const firstModel = availableModels[0]
    setModels([...models, { 
      id: firstModel?.id ?? '', 
      provider: firstModel?.provider ?? 'google', 
      is_enabled: true,
      _key: Math.random().toString(36).substr(2, 9)
    }])
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
      "bg-panel border border-[var(--bone-6)] rounded-big px-3 pb-2 pt-3 h-full flex flex-col relative",
      hasChanges ? "ring-1 ring-accent/20" : ""
    )}>
      {/* Preset Manager Popup */}
      {isPresetOpen && (
        <div className="absolute top-12 right-4 w-72 bg-panel/95 backdrop-blur-xl border border-[var(--bone-6)] rounded-big shadow-2xl z-50 animate-in zoom-in-95 fade-in duration-0 p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-foreground/80">Chain Presets</h4>
            <button 
              onClick={() => setIsPresetOpen(false)}
              className="p-1 rounded-sm hover:bg-white/5 text-muted-foreground/40 hover:text-foreground transition-all duration-0"
              title="Preset Manager"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 p-2 bg-white/[0.02] rounded-medium border border-[var(--bone-6)]">
              <input
                type="text"
                placeholder="New preset name..."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="bg-background border border-[var(--bone-6)] rounded-sm px-2 py-1 text-[11px] text-foreground focus:outline-none w-full h-7 transition-all duration-0"
              />
              <button
                onClick={handleSavePreset}
                disabled={isSavingPreset || !presetName.trim()}
                className="flex items-center justify-center gap-1 w-full h-7 bg-accent text-background rounded-sm text-[9px] font-bold uppercase tracking-wider hover:brightness-110 disabled:opacity-50 transition-all duration-0"
              >
                <Save className="w-2.5 h-2.5" /> Save Preset
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
              {presetsList.length > 0 ? (
                presetsList.map((p) => (
                  <div 
                    key={p.id} 
                    className="group flex items-center justify-between p-2 rounded-sm hover:bg-white/5 border border-transparent hover:border-white/5 transition-all duration-0"
                  >
                    <span className="text-[11px] font-medium text-bone-70 truncate mr-2">{p.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-0">
                      <button 
                        onClick={() => handleLoadPreset(p.id)}
                        className="p-1 text-accent hover:text-accent-foreground transition-colors duration-0"
                        title="Load"
                      >
                        <Plus className="w-3 h-3 rotate-45" />
                      </button>
                      <button 
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors duration-0"
                        title="Edit"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-[10px] text-muted-foreground/40 italic">No presets saved</div>
              )}
            </div>
          </div>
        </div>
      )}

      {isSubchainView && isPromptOpen && (
        <div className="px-3 py-3 mb-3 bg-white/[0.02] border border-[var(--bone-6)] rounded-medium animate-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-bold text-bone-70 uppercase tracking-widest">
              {activeSubchain?.label ?? ''} — System Prompt
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPromptOpen(false)}
                className="text-[9px] font-bold text-bone-40 hover:text-bone-100 uppercase"
              >
                Dismiss
              </button>
              <button
                onClick={handleSaveSubchains}
                disabled={isSavingSubchain}
                className="text-[9px] font-bold text-accent hover:brightness-110 uppercase"
              >
                {isSavingSubchain ? 'Saving...' : 'Save Prompt'}
              </button>
            </div>
          </div>
          <textarea
            value={activeSubchain?.system_prompt ?? ''}
            onChange={(e) => handleSubchainPromptChange(e.target.value)}
            className="w-full h-32 bg-background/50 border border-[var(--bone-6)] rounded-sm p-2 text-[11px] text-bone-100 font-mono focus:outline-none focus:ring-1 focus:ring-accent/30 resize-none custom-scrollbar"
            placeholder="Enter instructions for this chain node..."
          />
        </div>
      )}

      {title && (
        <div className="px-3 py-2 mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {category && CATEGORY_ICONS[category] && (
              <div>
                {React.createElement(CATEGORY_ICONS[category], { className: "w-3 h-3 text-accent", strokeWidth: 2.5 })}
              </div>
            )}
            <h3 className="text-[10px] font-ui-label font-bold text-muted-foreground tracking-widest uppercase">
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Subchain tabs — shown only in subchain view */}
            {isSubchainView && subchains.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSubchainId(s.id)}
                className={cn(
                  'px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wide transition-all duration-0',
                  activeSubchainId === s.id ? 'bg-accent/20 text-accent' : 'text-bone-60 hover:text-foreground hover:bg-white/5'
                )}
              >
                {s.label}
              </button>
            ))}

            {/* Normal controls — hidden in subchain view */}
            {!isSubchainView && (<>
              <button
                onClick={handleToggleMode}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded-sm transition-all duration-0 text-[9px] font-bold tracking-wide uppercase",
                  fallbackMode === 'api_key_first'
                    ? "bg-accent/10 text-accent"
                    : "bg-white/5 text-bone-70 hover:text-foreground hover:bg-white/[0.08]"
                )}
                title={fallbackMode === 'api_key_first' ? 'Try alternative API keys first' : 'Try next model first'}
              >
                <span className="w-1 h-1 rounded-full bg-current" />
                {fallbackMode === 'api_key_first' ? 'Keys' : 'Models'}
              </button>
            </>)}

            {isSubchainView && (
              <button
                onClick={() => setIsPromptOpen(!isPromptOpen)}
                className={cn(
                  "p-1 rounded-sm transition-all duration-0",
                  isPromptOpen ? "bg-accent/20 text-accent" : "hover:bg-white/5 text-muted-foreground/40 hover:text-foreground"
                )}
                title="Subchain System Prompt"
              >
              <MessageSquareCode className="w-3.5 h-3.5" />
            </button>
            )}
            {hasSubchains && (
              <button
                onClick={() => setIsSubchainView(v => !v)}
                className={cn(
                  'p-1 rounded-sm transition-all duration-0',
                  isSubchainView ? 'bg-accent/20 text-accent' : 'hover:bg-white/5 text-muted-foreground/40 hover:text-foreground'
                )}
                title="Subchain View"
              >
                <Layers2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setIsPresetOpen(true)}
              className="p-1 rounded-sm hover:bg-white/5 text-muted-foreground/40 hover:text-foreground transition-all"
              title="Preset Manager"
            >
              <Layers className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {isSubchainView ? (
        <div className="flex flex-col gap-1 pb-3">
          {subchains.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-2 py-1.5 rounded-medium hover:bg-white/[0.02]">
              <span className="text-[11px] font-medium text-bone-60 w-[130px] shrink-0 truncate">{s.label}</span>
              <div className="relative flex-1">
                <select
                  value={s.chain_category}
                  onChange={(e) => handleSubchainChainChange(s.id, e.target.value as IntentCategory)}
                  className="w-full bg-transparent border border-white/10 rounded-sm px-2 py-0.5 text-[11px] font-mono text-bone-100 focus:outline-none focus:ring-1 focus:ring-accent/30 appearance-none cursor-pointer hover:border-white/20 transition-all"
                >
                  {ALL_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="bg-[#0f0f0f] text-bone-100">{cat.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-bone-60 opacity-40 pointer-events-none" />
              </div>
              <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', activeSubchainId === s.id ? 'bg-accent' : 'bg-white/10')} />
            </div>
          ))}
          <div className="mt-2 px-2 flex justify-end">
            <button
              onClick={handleSaveSubchains}
              disabled={isSavingSubchain}
              className="bg-accent text-background px-3 py-1.5 rounded-medium text-[10px] font-bold tracking-widest hover:brightness-110 transition-all duration-0 uppercase disabled:opacity-50"
            >
              {isSavingSubchain ? 'Saving...' : 'Save Subchains'}
            </button>
          </div>
        </div>
      ) : (
      <div
        className="flex flex-col gap-1 pb-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
         {models.map((model, index) => {
           const matchingModel = availableModels.find(m => m.id === model.id)
           const isPaid = matchingModel?.is_paid === true
           
           return (
             <div 
               key={model._key || `${model.id}-${index}`} 
               draggable
               onDragStart={(e) => handleDragStart(e, index)}
               onDragOver={(e) => handleDragOver(e, index)}
               onDragEnd={handleDragEnd}
               onDrop={handleDrop}
               className={cn(
                 "group flex items-center gap-3 px-2 py-0.5 rounded-medium hover:bg-white/[0.02] transition-all duration-200 relative cursor-grab active:cursor-grabbing",
                 draggedIndex === index ? "opacity-20 scale-[0.98] bg-white/5" : "opacity-100"
               )}
             >
               {/* Col 1: Model ID */}
               <div className="w-[190px] shrink-0 flex items-center gap-1.5">
                 <ModelDropdown
                   value={model.id}
                   models={availableModels}
                   onChange={(val) => updateLocalModel(index, 'id', val)}
                   providerFilter={model.provider}
                 />
                 {isPaid && (
                   <div className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-accent/10 border border-accent/20 shrink-0" title="Paid Model">
                     <span className="text-[9px] font-bold text-accent select-none leading-none">$</span>
                   </div>
                 )}
               </div>
             
             <div className="flex items-center gap-1 ml-auto">
               {/* Col 2: RPD */}
               <div className="flex items-center gap-1 shrink-0 text-bone-70 group-hover:text-bone-80 transition-colors duration-0 w-12 justify-end">
                 <span className={cn(
                    "text-[9px] font-mono font-medium",
                    (() => {
                      const matchingModel = availableModels.find(m => m.id === model.id)
                      const isFree = matchingModel?.provider.toLowerCase() === 'pollinations' || matchingModel?.provider.toLowerCase() === 'ollama'
                      return isFree ? "text-accent/60" : ""
                    })()
                  )}>
                    {(() => {
                      const matchingModel = availableModels.find(m => m.id === model.id)
                      if (!matchingModel) return '∞'
                      if (matchingModel.provider.toLowerCase() === 'pollinations' || matchingModel.provider.toLowerCase() === 'ollama') return 'FREE'
                      
                      const val = matchingModel.max_rpd
                      if (val === null) return '∞'
                      if (val >= 1000) {
                        return (val / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'K'
                      }
                      return val.toLocaleString()
                    })()}
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-tighter opacity-60">
                    {(() => {
                       const matchingModel = availableModels.find(m => m.id === model.id)
                       if (matchingModel?.provider.toLowerCase() === 'ollama') return 'LOCAL'
                       if (matchingModel?.provider.toLowerCase() === 'pollinations') return 'API'
                       return 'RPD'
                    })()}
                  </span>
               </div>

               {/* Col 3: Provider Selector (Dot only) */}
               <ProviderSelector
                 value={model.provider}
                 providers={providers}
                 onChange={(val) => updateLocalModel(index, 'provider', val)}
                 isEnabled={model.is_enabled}
               />

               {model.provider.toLowerCase() === 'openrouter' ? (
                 <OpenRouterRoutingProviderSelector
                   value={model.openrouter_provider || ''}
                   onChange={(val) => updateLocalModel(index, 'openrouter_provider', val)}
                   isEnabled={model.is_enabled}
                 />
               ) : (
                 <div className="w-6 shrink-0" />
               )}
   
               <RowOptionsDropdown
                 isEnabled={model.is_enabled}
                 onToggle={() => toggle(index)}
                 onDelete={() => deleteModel(index)}
               />
             </div>
           </div>
           )
         })}
      </div>
      )}

      {!isSubchainView && (
        <div className="mt-auto px-3 py-1 flex justify-between items-center border-t border-[var(--bone-6)]">
          <button
            onClick={addModel}
            disabled={models.length >= 10}
            className="text-[10px] flex items-center gap-2 text-bone-70 hover:text-foreground hover:bg-white/5 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-bone-70 font-bold tracking-widest px-3 py-1.5 rounded-medium uppercase transition-all duration-0"
          >
            <Plus className="w-3 h-3" /> Add node
          </button>

          {hasChanges && (
            <div className="flex items-center gap-4 animate-in slide-in-from-right-2 duration-300">
              <button
                onClick={() => { setModels(chain.model_list); setHasChanges(false) }}
                className="text-[10px] font-bold tracking-widest text-bone-70 hover:text-rose-500 uppercase transition-all duration-0"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-accent text-background px-3 py-1.5 rounded-medium text-[10px] font-bold tracking-widest hover:brightness-110 transition-all duration-0 uppercase"
              >
                {isSaving ? 'Syncing...' : 'Commit changes'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
