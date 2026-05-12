'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Cpu, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PROVIDER_COLORS, PROVIDER_ICONS, RegistryModel } from './model-utils'

interface ModelDropdownProps {
  value: string
  models: RegistryModel[]
  onChange: (val: string) => void
  providerFilter?: string
  placeholder?: string
  className?: string
}

export default function ModelDropdown({
  value,
  models,
  onChange,
  providerFilter,
  placeholder = 'Select model...',
  className
}: ModelDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [rect, setRect] = useState<DOMRect | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateRect = () => {
      if (isOpen && containerRef.current) {
        const rowEl = containerRef.current.closest('.group') || containerRef.current
        setRect(rowEl.getBoundingClientRect())
      }
    }
    if (isOpen) {
      updateRect()
      window.addEventListener('scroll', updateRect, true)
      window.addEventListener('resize', updateRect)
    }
    return () => {
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredModels = models
    .filter((m) => {
      const matchesSearch = m.id.toLowerCase().includes(search.toLowerCase())
      const matchesProvider = providerFilter ? m.provider.toLowerCase() === providerFilter.toLowerCase() : true
      return matchesSearch && matchesProvider
    })
    .sort((a, b) => {
      const aFav = a.is_favorite ? 1 : 0
      const bFav = b.is_favorite ? 1 : 0
      if (aFav !== bFav) return bFav - aFav
      return a.id.localeCompare(b.id)
    })

  const currentModel = models.find(m => m.id === value)
  const currentProvider = currentModel?.provider.toLowerCase() || 'google'

  return (
    <div className={cn("w-full relative", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={value || undefined}
        className="w-full flex items-center justify-between px-2 py-1 bg-background rounded-medium text-left transition-all duration-0 hover:bg-white/[0.02] group"
      >
        <div className="flex items-center gap-2 truncate">
          <span className={cn(
            "text-[13px] font-medium truncate",
            value ? "text-bone-100" : "text-muted-foreground/40"
          )}>
            {value || placeholder}
          </span>
        </div>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 text-muted-foreground/40 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && rect && (
        <div 
          className={cn(
            "fixed bg-panel border border-white/10 rounded-[16px] shadow-2xl z-[999] animate-in fade-in zoom-in-95 duration-100 overflow-hidden min-w-[240px]",
            rect.bottom + 300 > window.innerHeight ? "origin-bottom" : "origin-top"
          )}
          style={{
            top: rect.bottom + 300 > window.innerHeight ? 'auto' : rect.bottom + 6,
            bottom: rect.bottom + 300 > window.innerHeight ? window.innerHeight - rect.top + 6 : 'auto',
            left: rect.left,
            width: rect.width
          }}
        >
          {/* Search Header */}
          <div className="px-2 pt-2 pb-1.5 border-b border-white/5 bg-white/[0.01]">
            <div className="relative flex items-center gap-2 px-2 py-1 bg-background border border-white/5 rounded-[8px]">
              <Search className="w-3.5 h-3.5 text-muted-foreground/40" />
              <input 
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="bg-transparent border-none p-0 text-xs focus:ring-0 text-bone-100 placeholder:text-muted-foreground/30 w-full outline-none"
              />
            </div>
          </div>

          {/* Models List */}
          <div className="max-h-64 overflow-y-auto custom-scrollbar px-2 pt-1.5 pb-2 flex flex-col gap-0.5">
            {filteredModels.length > 0 ? (
              filteredModels.map((model) => {
                const provider = model.provider.toLowerCase()
                const colorClass = PROVIDER_COLORS[provider] || 'text-bone-60'
                
                return (
                  <button
                    key={model.id}
                    onClick={() => {
                      onChange(model.id)
                      setIsOpen(false)
                      setSearch('')
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-1.5 rounded-[8px] transition-all duration-0",
                      value === model.id ? "bg-[var(--bone-15)] text-[var(--bone-100)]" : "text-[var(--bone-60)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
                    )}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="flex items-center gap-2 truncate">
                        {model.is_favorite && (
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                        )}
                        <span className="text-[13px] font-medium truncate" title={model.id}>{model.id}</span>
                        <span className="text-[10px] text-muted-foreground/40 font-mono shrink-0">
                          {model.max_rpd !== null ? `${model.max_rpd.toLocaleString()} RPD` : '∞ RPD'}
                        </span>
                      </div>
                    </div>
                    <div className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                      colorClass
                    )}>
                      {provider}
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground/40 italic">
                No models found matching your search.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
