'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Settings2, Plus, Check, X } from 'lucide-react'

interface OpenRouterRoutingProviderSelectorProps {
  value: string
  onChange: (val: string) => void
  isEnabled?: boolean
  className?: string
}

const DEFAULT_ROUTING_PROVIDERS = [
  'google-ai-studio',
  'deepseek',
  'siliconflow',
  'together',
  'deepinfra',
  'novita',
  'lepton',
  'groq',
  'fireworks',
  'mistral',
  'anthropic',
  'openai'
]

export default function OpenRouterRoutingProviderSelector({
  value,
  onChange,
  isEnabled = true,
  className
}: OpenRouterRoutingProviderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [newProvider, setNewProvider] = useState('')
  const [customProviders, setCustomProviders] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('flowr_openrouter_custom_providers')
        return stored ? JSON.parse(stored) : []
      } catch {
        return []
      }
    }
    return []
  })

  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const isTrigger = ref.current?.contains(target)
      const isMenu = menuRef.current?.contains(target)
      
      if (!isTrigger && !isMenu) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAddCustom = () => {
    const trimmed = newProvider.trim().toLowerCase()
    if (!trimmed) return
    
    if (!DEFAULT_ROUTING_PROVIDERS.includes(trimmed) && !customProviders.includes(trimmed)) {
      const updated = [...customProviders, trimmed]
      setCustomProviders(updated)
      if (typeof window !== 'undefined') {
        localStorage.setItem('flowr_openrouter_custom_providers', JSON.stringify(updated))
      }
    }
    onChange(trimmed)
    setNewProvider('')
    setIsOpen(false)
  }

  const handleDeleteCustom = (providerToDelete: string) => {
    const updated = customProviders.filter(p => p !== providerToDelete)
    setCustomProviders(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('flowr_openrouter_custom_providers', JSON.stringify(updated))
    }
    if (value.toLowerCase() === providerToDelete) {
      onChange('')
    }
  }

  const allProviders = Array.from(new Set([
    ...DEFAULT_ROUTING_PROVIDERS,
    ...customProviders,
    ...(value ? [value.toLowerCase()] : [])
  ]))

  return (
    <div className={cn("relative shrink-0 flex items-center justify-center select-none", className)} ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        title={value ? `OpenRouter Provider: ${value}` : "Select OpenRouter Target Provider"}
        className={cn(
          "flex items-center justify-center w-6 h-6 rounded-sm transition-all duration-0 hover:bg-white/5 focus:outline-none group",
          !isEnabled && "opacity-40",
          isOpen ? "bg-white/5 text-bone-100" : (value ? "text-accent bg-accent/5" : "text-bone-40")
        )}
      >
        <Settings2 className={cn("w-3.5 h-3.5 transition-all group-hover:text-bone-100", isOpen && "text-bone-100")} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          ref={menuRef}
          className="fixed popup-glass-small z-[9999] min-w-[160px] max-h-72 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-1 shadow-2xl border border-white/10"
          style={{
            top: (ref.current?.getBoundingClientRect().bottom ?? 0) + 4,
            left: (ref.current?.getBoundingClientRect().left ?? 0) - 134, // align with right edge of button
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="text-[9px] font-bold uppercase tracking-wider text-bone-40 px-2 pb-1.5 mb-1.5 border-b border-white/5">
            Routing Provider
          </div>

          {/* Add New Input */}
          <div className="flex items-center gap-1 px-1.5 pb-2 mb-1.5 border-b border-white/5">
            <input
              type="text"
              value={newProvider}
              onChange={(e) => setNewProvider(e.target.value)}
              placeholder="Custom slug..."
              className="bg-black/30 border border-white/5 rounded-sm px-1.5 py-1 text-[10px] text-bone-100 placeholder:text-bone-70/20 focus:outline-none focus:border-accent/40 w-full h-6 leading-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCustom()
              }}
            />
            <button
              type="button"
              onClick={handleAddCustom}
              disabled={!newProvider.trim()}
              className="w-6 h-6 shrink-0 flex items-center justify-center bg-accent text-background rounded-sm hover:brightness-110 disabled:opacity-30 transition-all"
              title="Add custom provider"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Providers List */}
          <div className="flex flex-col gap-[3px] max-h-44 overflow-y-auto custom-scrollbar pr-1">
            {allProviders.map((p) => {
              const isSelected = value.toLowerCase() === p.toLowerCase()
              const isCustom = customProviders.includes(p)
              return (
                <div key={p} className="group/item flex items-center justify-between gap-1 w-full rounded-sm hover:bg-white/5 pr-1">
                  <button
                    type="button"
                    onClick={() => {
                      onChange(p)
                      setIsOpen(false)
                    }}
                    className={cn(
                      "popup-item gap-2 px-2.5 py-1.5 rounded-sm text-left flex-1 flex items-center justify-between hover:bg-transparent",
                      isSelected && "!text-accent"
                    )}
                  >
                    <span className="text-[10px] tracking-wide font-medium truncate">{p}</span>
                    {isSelected && !isCustom && <Check className="w-3 h-3 text-accent shrink-0" />}
                  </button>
                  {isCustom && (
                    <div className="flex items-center gap-1">
                      {isSelected && <Check className="w-3 h-3 text-accent shrink-0" />}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteCustom(p)
                        }}
                        className="opacity-0 group-hover/item:opacity-100 p-0.5 rounded-sm hover:bg-rose-500/15 text-rose-500/80 hover:text-rose-400 transition-all focus:outline-none"
                        title="Delete provider"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
