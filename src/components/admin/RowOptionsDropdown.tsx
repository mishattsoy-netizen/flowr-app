'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { MoreHorizontal, Power, Trash2 } from 'lucide-react'

interface RowOptionsDropdownProps {
  isEnabled: boolean
  onToggle: () => void
  onDelete: () => void
}

export default function RowOptionsDropdown({
  isEnabled,
  onToggle,
  onDelete
}: RowOptionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative shrink-0 flex items-center justify-center select-none" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-center w-6 h-6 rounded-sm transition-all duration-0 hover:bg-white/5 focus:outline-none",
          isOpen ? "text-bone-100 bg-white/5" : "text-bone-60 hover:text-bone-100"
        )}
        title="Options"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed popup-glass-small z-[9999] min-w-[120px] p-1.5 flex flex-col gap-[3px] shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: (ref.current?.getBoundingClientRect().bottom ?? 0) + 120 > window.innerHeight ? 'auto' : (ref.current?.getBoundingClientRect().bottom ?? 0) + 4,
            bottom: (ref.current?.getBoundingClientRect().bottom ?? 0) + 120 > window.innerHeight ? window.innerHeight - (ref.current?.getBoundingClientRect().top ?? 0) + 4 : 'auto',
            left: (ref.current?.getBoundingClientRect().left ?? 0) - 96, // align with right edge of button
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Toggle Enable/Disable Option */}
          <button
            type="button"
            onClick={() => {
              onToggle()
              setIsOpen(false)
            }}
            className="popup-item gap-2 px-2.5 py-1.5 rounded-sm hover:bg-white/5 flex items-center text-left text-[11px] font-bold text-bone-80 hover:text-bone-100 transition-all w-full"
          >
            <Power className={cn("w-3.5 h-3.5 shrink-0", isEnabled ? "text-accent" : "text-bone-40")} />
            <span>{isEnabled ? 'Disable' : 'Enable'}</span>
          </button>

          <div className="h-[1px] bg-white/5 my-[2px]" />

          {/* Delete Option */}
          <button
            type="button"
            onClick={() => {
              onDelete()
              setIsOpen(false)
            }}
            className="popup-item gap-2 px-2.5 py-1.5 rounded-sm hover:bg-rose-500/10 hover:text-rose-400 text-rose-500/80 flex items-center text-left text-[11px] font-bold transition-all w-full"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>Delete</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}
