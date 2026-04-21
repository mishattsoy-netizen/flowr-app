'use client'

import React, { useState } from 'react'
import { 
  Fingerprint, 
  Trash2, 
  Eye, 
  EyeOff 
} from 'lucide-react'
import { deleteVaultKey } from '@/app/admin/vault/actions'
import { cn } from '@/lib/utils'

export default function VaultItem({ item }: { item: any }) {
  const [showValue, setShowValue] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const getProviderInfo = (keyId: string) => {
    const id = keyId.toLowerCase()
    if (id.includes('openrouter')) return { name: 'OpenRouter', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' }
    if (id.includes('gemini')) return { name: 'Gemini', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' }
    if (id.includes('groq')) return { name: 'Groq', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' }
    if (id.includes('ollama')) return { name: 'Ollama', color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/20' }
    if (id.includes('supabase')) return { name: 'Supabase', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' }
    return { name: 'General', color: 'text-bone-60', bg: 'bg-bone-60/10', border: 'border-bone-60/20' }
  }

  const provider = getProviderInfo(item.key_id)

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${item.key_id}?`)) return
    setIsDeleting(true)
    try {
      await deleteVaultKey(item.key_id)
      window.location.reload()
    } catch (err: any) {
      alert(`Failed to delete key: ${err.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className={cn(
      "flex items-center justify-between px-6 py-3.5 hover:bg-sidebar/40 transition-colors group relative",
      isDeleting && "opacity-20 grayscale pointer-events-none"
    )}>
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className={cn(
          "w-8 h-8 shrink-0 flex items-center justify-center rounded-[var(--radius-8)] bg-background border transition-all",
          provider.border,
          "group-hover:border-accent/30"
        )}>
          <Fingerprint className={cn("w-3.5 h-3.5", provider.color)} strokeWidth={1.5} />
        </div>
        
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-bone-100 truncate font-display">{item.key_id}</span>
            <span className={cn(
              "text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest shrink-0",
              provider.bg,
              provider.color
            )}>
              {provider.name}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-bone-60 opacity-60">
            <span className="truncate">{showValue ? item.key_value : '••••••••••••••••••••••••••••••••'}</span>
            <div className={cn(
              "w-1 h-1 rounded-full shrink-0",
              showValue ? "bg-accent" : "bg-white/10"
            )} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 ml-4">
        <button 
          onClick={() => setShowValue(!showValue)}
          className="p-2 rounded-[var(--radius-8)] bg-background border border-[var(--bone-15)] text-bone-60 hover:text-bone-100 hover:bg-bone-hover transition-all"
          title={showValue ? "Hide key" : "Show key"}
        >
          {showValue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
        <button 
          onClick={handleDelete}
          className="p-2 rounded-[var(--radius-8)] bg-background border border-[var(--bone-15)] text-bone-60 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
          title="Delete key"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
