'use client'

import React, { useState } from 'react'
import { addVaultKey } from '@/app/admin/vault/actions'
import { Plus, RotateCcw } from 'lucide-react'

export default function VaultRegisterForm() {
  const [keyName, setKeyName] = useState('')
  const [value, setValue] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyName || !value) return
    setIsAdding(true)
    try {
      await addVaultKey(keyName.toUpperCase().trim(), value.trim())
      setKeyName('')
      setValue('')
      window.location.reload()
    } catch (err: any) {
      alert(`Failed to add key: ${err.message}`)
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="relative z-10 widget border-dashed border-[var(--bone-15)] bg-transparent">
      <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-bone-60 tracking-[0.05em] uppercase opacity-40">Key identifier</label>
          <input 
            placeholder="E.G. OPENAI_PRO"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            required
            className="w-full bg-background border border-[var(--bone-15)] rounded-regular px-3 py-2 text-[12px] font-medium text-bone-100 focus:outline-none focus:border-accent/30 uppercase placeholder:text-bone-60/10 transition-all focus:ring-4 focus:ring-accent/5"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-bone-60 tracking-[0.05em] uppercase opacity-40">Secret token</label>
          <input 
            type="password"
            placeholder="Required credential"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            className="w-full bg-background border border-[var(--bone-15)] rounded-regular px-3 py-2 text-[12px] font-medium text-bone-100 focus:outline-none focus:border-accent/30 placeholder:text-bone-60/10 transition-all focus:ring-4 focus:ring-accent/5"
          />
        </div>
        <div className="flex items-end">
          <button 
            type="submit"
            disabled={isAdding || !keyName || !value}
            className="w-full py-2.5 h-[38px] rounded-regular bg-accent text-on-accent text-[10px] font-bold uppercase tracking-[0.05em] flex items-center justify-center gap-2 group hover:opacity-90 disabled:opacity-20 disabled:grayscale transition-all active:scale-[0.98]"
          >
            {isAdding ? (
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300" strokeWidth={2} />
                Register Key
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
