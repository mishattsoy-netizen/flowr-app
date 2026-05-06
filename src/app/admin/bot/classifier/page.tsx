'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { CheckCircle2, RefreshCw, Zap, Sliders, AlignLeft, Info } from 'lucide-react'
import { getClassifierConfig, saveClassifierConfig } from './actions'
import { cn } from '@/lib/utils'

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  FAST_SIMPLE:      { label: 'Fast Simple', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  MEDIUM_THINKING:  { label: 'Medium Thinking', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  COMPLEX_THINKING: { label: 'Complex Thinking', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  IMAGE_GEN:        { label: 'Image Generation', color: 'text-pink-400 bg-pink-400/10 border-pink-400/20' },
  WEB_SEARCH:       { label: 'Web Search', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  TOOL_CALLING:     { label: 'Tool Calling', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
  AUDIO_VOICE:      { label: 'Audio Voice', color: 'text-teal-400 bg-teal-400/10 border-teal-400/20' }
}

export default function ClassifierPage() {
  const [prompt, setPrompt] = useState<string>('')
  const [keywords, setKeywords] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const config = await getClassifierConfig()
      setPrompt(config.prompt ?? '')
      const mapped: Record<string, string> = {}
      const kw = config.keywords ?? {}
      for (const cat in CATEGORY_LABELS) {
        mapped[cat] = (kw[cat] || []).join(', ')
      }
      setKeywords(mapped)
    }
    load()
  }, [])

  function handleSave() {
    startTransition(async () => {
      try {
        const parsed: Record<string, string[]> = {}
        for (const cat in CATEGORY_LABELS) {
          parsed[cat] = (keywords[cat] || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        }
        await saveClassifierConfig(prompt, parsed)
        setSaveStatus('success')
        setTimeout(() => setSaveStatus(null), 3000)
      } catch (err: any) {
        alert(`Failed to save configuration: ${err.message}`)
      }
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      <div>
        <h1 className="text-4xl font-display text-foreground mb-1 select-none flex items-center gap-2.5">
          <Zap className="w-8 h-8 text-accent animate-pulse" />
          Intent Classifier Settings
        </h1>
        <p className="text-muted-foreground text-sm font-medium select-none">
          Define routing rules, classification prompts, and custom keywords to direct the bot precisely.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Classification Prompt */}
        <div className="bg-panel rounded-big border border-white/5 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="text-accent mt-0.5 shrink-0 opacity-60">
              <AlignLeft className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-foreground">AI System Prompt</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Prompt used by classifier models for routing fallback decisions</p>
            </div>
          </div>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={12}
            className="w-full bg-background border border-white/[0.04] rounded-medium px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 resize-y font-mono leading-relaxed focus:outline-none focus:border-accent transition-all"
            placeholder="Write the classification system instructions prompt here..."
          />
        </div>

        {/* Category Keywords */}
        <div className="bg-panel rounded-big border border-white/5 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="text-accent mt-0.5 shrink-0 opacity-60">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-foreground">Intent Keyword Fast-Pass</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Short phrases or keywords that trigger categorization instantly with zero token overhead</p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {Object.keys(CATEGORY_LABELS).map(cat => (
              <div key={cat} className="space-y-1.5 p-3.5 bg-background/50 border border-white/[0.02] rounded-xl hover:border-white/[0.05] transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider border", CATEGORY_LABELS[cat].color)}>
                      {CATEGORY_LABELS[cat].label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/40 font-mono tracking-widest">{cat}</span>
                  </div>
                </div>
                <input
                  type="text"
                  value={keywords[cat] || ''}
                  onChange={e => setKeywords(k => ({ ...k, [cat]: e.target.value }))}
                  placeholder={`e.g., keyword1, keyword2`}
                  className="w-full bg-background/60 border border-white/[0.04] rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:border-accent transition-all font-sans"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between bg-panel border border-white/5 p-4 rounded-big">
        <div className="flex items-center gap-2 text-xs text-muted-foreground/50 select-none">
          <Info className="w-4 h-4 shrink-0 text-accent/50" />
          <span>Keyword checks are performed first, bypassing expensive AI calls.</span>
        </div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-1.5 px-5 h-10 bg-foreground text-background rounded-medium text-sm font-semibold hover:opacity-90 active:scale-[0.99] disabled:opacity-50 transition-all select-none cursor-pointer"
        >
          {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {isPending ? 'Saving...' : saveStatus ? 'Saved Configuration!' : 'Save Configuration'}
        </button>
      </div>
    </div>
  )
}
