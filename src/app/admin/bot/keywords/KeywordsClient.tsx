'use client'

import { useState, useTransition, useMemo } from 'react'
import { Check, Tag, RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveClassifierKeywords, getClassifierKeywords } from '@/app/admin/bot/classifier/actions'

const INTENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  FAST_SIMPLE:      { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/20' },
  MEDIUM_THINKING:  { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  COMPLEX_THINKING: { bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/20' },
  IMAGE_GEN:        { bg: 'bg-pink-500/10',   text: 'text-pink-400',   border: 'border-pink-500/20' },
  WEB_SEARCH:       { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  TOOL_CALLING:     { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  AUDIO_VOICE:      { bg: 'bg-teal-500/10',   text: 'text-teal-400',   border: 'border-teal-500/20' },
  VISION:           { bg: 'bg-cyan-500/10',   text: 'text-cyan-400',   border: 'border-cyan-500/20' },
  CODING:           { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  DEEP_RESEARCH:    { bg: 'bg-rose-500/10',   text: 'text-rose-400',   border: 'border-rose-500/20' },
}

const CATEGORIES = [
  'FAST_SIMPLE', 'MEDIUM_THINKING', 'COMPLEX_THINKING', 'IMAGE_GEN',
  'WEB_SEARCH', 'TOOL_CALLING', 'AUDIO_VOICE', 'VISION', 'CODING', 'DEEP_RESEARCH',
]

function toInputs(kw: Record<string, string[]>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const cat of CATEGORIES) result[cat] = (kw[cat] ?? []).join(', ')
  return result
}

interface Props {
  initialKeywords: Record<string, string[]>
}

export default function KeywordsClient({ initialKeywords }: Props) {
  const [dbInputs, setDbInputs] = useState<Record<string, string>>(() => toInputs(initialKeywords))
  const [inputs, setInputs] = useState<Record<string, string>>(() => toInputs(initialKeywords))
  const [saved, setSaved] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isOutOfSync = useMemo(
    () => CATEGORIES.some(cat => (inputs[cat] ?? '') !== (dbInputs[cat] ?? '')),
    [inputs, dbInputs]
  )

  async function handleSync() {
    setIsSyncing(true)
    try {
      const kw = await getClassifierKeywords()
      const fresh = toInputs(kw)
      setDbInputs(fresh)
      setInputs(fresh)
    } finally {
      setIsSyncing(false)
    }
  }

  function handleSave() {
    startTransition(async () => {
      const keywords: Record<string, string[]> = {}
      for (const cat of CATEGORIES) {
        const words = (inputs[cat] ?? '').split(',').map(w => w.trim()).filter(Boolean)
        if (words.length > 0) keywords[cat] = words
      }
      await saveClassifierKeywords(keywords)
      setDbInputs({ ...inputs })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-normal tracking-tight text-foreground mb-1 flex items-center gap-2.5">
            <Tag className="w-8 h-8 text-accent" />
            Intent Keywords
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Shared across all modes. Keywords bypass the AI classifier — matched messages are routed instantly with zero latency.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          {isOutOfSync && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded-md">
              <AlertCircle className="w-3 h-3" /> Out of sync
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            title="Overwrite local inputs with current DB values"
            className="flex items-center gap-1.5 px-3 h-8 bg-white/5 border border-white/10 text-bone-60 hover:text-foreground hover:bg-white/10 rounded-medium text-[11px] font-semibold disabled:opacity-50 transition-all"
          >
            <RefreshCw className={cn('w-3 h-3', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Syncing...' : 'Sync from DB'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {CATEGORIES.map(cat => {
          const colors = INTENT_COLORS[cat] ?? { bg: 'bg-white/10', text: 'text-bone-100', border: 'border-white/10' }
          return (
            <div key={cat} className="p-4 rounded-[16px] bg-panel border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <span className={cn('text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-[6px] border', colors.bg, colors.text, colors.border)}>
                  {cat.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] text-bone-60 font-mono">{cat}</span>
              </div>
              <input
                value={inputs[cat] ?? ''}
                onChange={e => setInputs(prev => ({ ...prev, [cat]: e.target.value }))}
                placeholder="keyword1, keyword2, keyword phrase"
                className="w-full bg-background rounded-[8px] px-4 py-3 text-sm text-foreground font-sans focus:outline-none focus:ring-1 focus:ring-accent/30 placeholder:text-muted-foreground/30 transition-all border border-white/[0.04]"
              />
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between bg-panel border border-white/5 p-4 rounded-big">
        <p className="text-xs text-muted-foreground/50">
          Separate keywords with commas. Use phrases for more precision (e.g. "create a note").
        </p>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-1.5 px-5 h-10 bg-foreground text-background rounded-medium text-sm font-semibold hover:opacity-90 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
        >
          {saved ? <Check className="w-4 h-4" /> : null}
          {isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Keywords'}
        </button>
      </div>
    </div>
  )
}
