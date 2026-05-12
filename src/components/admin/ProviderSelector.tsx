'use client'
import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { PROVIDER_COLORS, PROVIDER_DOTS } from './model-utils'

interface ProviderSelectorProps {
  value: string
  providers: string[]
  onChange: (val: string) => void
  isEnabled?: boolean
  className?: string
}

export default function ProviderSelector({
  value,
  providers,
  onChange,
  isEnabled = true,
  className
}: ProviderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
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

  const dotColor = PROVIDER_DOTS[value.toLowerCase()] || 'bg-bone-60'

  return (
    <div className={cn("relative shrink-0 flex items-center justify-center select-none", className)} ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        title={value}
        className={cn(
          "flex items-center justify-center w-6 h-6 rounded-sm transition-all duration-0 hover:bg-white/5 focus:outline-none",
          !isEnabled && "opacity-40"
        )}
      >
        <div className={cn(
          "w-2 h-2 rounded-full shrink-0 transition-all duration-0",
          isEnabled ? dotColor : "bg-bone-60"
        )} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          ref={menuRef}
          className={cn(
            "fixed bg-panel border border-white/10 rounded-medium shadow-2xl z-[9999] min-w-[120px] max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100 py-1 flex flex-col gap-0.5",
            (ref.current?.getBoundingClientRect().bottom ?? 0) + 200 > window.innerHeight ? "origin-bottom" : "origin-top"
          )}
          style={{
            top: (ref.current?.getBoundingClientRect().bottom ?? 0) + 200 > window.innerHeight ? 'auto' : (ref.current?.getBoundingClientRect().bottom ?? 0) + 4,
            bottom: (ref.current?.getBoundingClientRect().bottom ?? 0) + 200 > window.innerHeight ? window.innerHeight - (ref.current?.getBoundingClientRect().top ?? 0) + 4 : 'auto',
            left: (ref.current?.getBoundingClientRect().left ?? 0),
          }}
        >
          {providers.map((p) => {
            const pDot = PROVIDER_DOTS[p.toLowerCase()] || 'bg-bone-60'
            const pColor = PROVIDER_COLORS[p.toLowerCase()] || 'text-bone-60'
            return (
              <button
                type="button"
                key={p}
                onClick={() => {
                  onChange(p)
                  setIsOpen(false)
                }}
                className={cn(
                  "w-full flex items-center justify-start gap-2.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-0 select-none",
                  value.toLowerCase() === p.toLowerCase() 
                    ? "bg-white/[0.12] text-foreground" 
                    : "text-bone-60 hover:text-foreground hover:bg-white/5"
                )}
              >
                <div className={cn("w-2 h-2 rounded-full shrink-0", pDot)} />
                <span className={cn("text-[10.5px] tracking-wide font-bold", pColor)}>{p}</span>
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
