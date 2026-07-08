'use client'
import { useState, useTransition } from 'react'
import { Code2, Save, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { saveInternalPrompt, resetInternalPrompt } from '@/app/admin/router/actions'
import { cn } from '@/lib/utils'
import { useUnsavedChanges } from '@/components/admin/shared/UnsavedChangesGuard'

interface Props {
  initialPrompts: {
    value: Record<string, string>
    updated_at: string | null
  }
}

const CHAIN_TYPES = [
  'ORCHESTRATOR', 'THINKING', 'VISION', 'WEB_SEARCH', 'RESEARCH', 'CODING', 'IMAGE_GEN'
]

export default function PipelinePromptsPanel({ initialPrompts }: Props) {
  const [prompts, setPrompts] = useState(initialPrompts.value)
  const [lastSaved, setLastSaved] = useState(initialPrompts.updated_at)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleSave = (type: string) => {
    setSaving(type)
    startTransition(async () => {
      await saveInternalPrompt(type, prompts[type] || '')
      setLastSaved(new Date().toISOString())
      setSaving(null)
    })
  }

  const handleReset = (type: string) => {
    startTransition(async () => {
      await resetInternalPrompt(type)
      const next = { ...prompts }
      delete next[type]
      setPrompts(next)
    })
  }

  // DIRTY STATE TRACKING
  const isDirty = CHAIN_TYPES.some(type => {
    const initial = initialPrompts.value[type] || ''
    return (prompts[type] || '') !== initial
  })

  const handleGlobalSave = async () => {
    for (const type of CHAIN_TYPES) {
      const initial = initialPrompts.value[type] || ''
      if ((prompts[type] || '') !== initial) {
        await saveInternalPrompt(type, prompts[type] || '')
      }
    }
  }

  useUnsavedChanges(isDirty, handleGlobalSave)

  return (
    <section className="flex flex-col gap-4 p-4 rounded-[16px] bg-white/5 border border-[var(--bone-6)]">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Code2 className="w-5 h-5 text-accent" />
          <div>
            <h2 className="text-sm font-bold text-bone-100 uppercase tracking-wider">Internal Pipeline Prompts</h2>
            <p className="text-[11px] text-bone-70">system-level directives for specific chain steps</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastSaved && (
            <div className="text-right flex flex-col items-end">
              <span className="text-[9px] font-bold text-bone-40 uppercase tracking-tighter">Last Global Sync</span>
              <span className="text-[10px] font-mono text-bone-70 opacity-60" suppressHydrationWarning>
                {new Date(lastSaved).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {CHAIN_TYPES.map(type => {
          const isExpanded = expanded === type
          const hasCustom = !!prompts[type]
          
          return (
            <div key={type} className={cn(
              "rounded-[12px] border transition-all duration-200 overflow-hidden",
              isExpanded ? "bg-background border-accent/20" : "bg-white/5 border-transparent hover:border-[var(--bone-6)]"
            )}>
              <button 
                onClick={() => setExpanded(isExpanded ? null : type)}
                className="w-full flex items-center justify-between p-3"
              >
                <div className="flex items-center gap-3">
                  <span className={cn("text-[11px] font-mono font-bold tracking-tight px-1.5 py-0.5 rounded-sm border border-[var(--bone-6)]", hasCustom ? "bg-accent/20 text-accent" : "bg-white/5 text-bone-70")}>
                    {type}
                  </span>
                  {!isExpanded && prompts[type] && (
                    <span className="text-[10px] text-bone-40 italic truncate max-w-[300px]">
                      {prompts[type].substring(0, 50)}...
                    </span>
                  )}
                </div>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-bone-40" /> : <ChevronDown className="w-3.5 h-3.5 text-bone-40" />}
              </button>

              {isExpanded && (
                <div className="p-3 pt-0 flex flex-col gap-3">
                  <textarea
                    value={prompts[type] || ''}
                    onChange={e => setPrompts({ ...prompts, [type]: e.target.value })}
                    placeholder="Enter custom internal prompt for this chain... (leave empty to use default)"
                    className="w-full h-32 bg-black/40 border border-[var(--bone-6)] rounded-[8px] p-3 text-xs text-bone-80 focus:outline-none focus:border-accent/40 font-mono leading-relaxed"
                  />
                  <div className="flex items-center justify-between mt-1 pt-2 border-t border-[var(--bone-6)]">
                    <div className="flex flex-col">
                      {initialPrompts.value[type] && (
                        <div className="flex flex-col items-start">
                          <span className="text-[9px] font-bold text-bone-40 uppercase tracking-tighter">Last Synced</span>
                          <span className="text-[10px] font-mono text-bone-70 opacity-60">
                            {new Date(initialPrompts.updated_at || '').toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end mr-2">
                        <span className="text-[9px] font-bold text-bone-40 uppercase tracking-tighter">Length</span>
                        <span className="text-[10px] font-mono text-bone-70 opacity-60">
                          {(prompts[type] || '').length.toLocaleString()} chars
                        </span>
                      </div>

                      {hasCustom && (
                        <button 
                          onClick={() => handleReset(type)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] bg-rose-500/10 text-rose-400 text-[10px] font-bold uppercase tracking-wider hover:bg-rose-500/20 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset Default
                        </button>
                      )}
                      
                      <button 
                        onClick={() => handleSave(type)} 
                        disabled={saving === type || (prompts[type] || '') === (initialPrompts.value[type] || '')} 
                        className="flex items-center gap-2 px-6 py-2 bg-accent text-on-accent rounded-[8px] text-[10px] font-bold uppercase tracking-widest hover:brightness-110 disabled:opacity-30 transition-all shadow-lg"
                      >
                        {saving === type ? <RotateCcw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        {saving === type ? 'Saving...' : 'Save Prompt'}
                      </button>
                    </div>
                  </div>
                  {(prompts[type] || '') !== (initialPrompts.value[type] || '') && (
                    <div className="flex justify-end mt-1">
                      <span className="text-[9px] font-bold text-accent animate-pulse uppercase tracking-widest">Unsaved Changes</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
