'use client'

import React, { useState, useTransition } from 'react'
import { getMessageExchanges, Exchange } from './actions'
import type { StepTrace } from '@/lib/bot/tracing'
import { cn } from '@/lib/utils'
import { MessageSquare, Search, Wrench, Eye, RefreshCw, ChevronLeft, ChevronRight, CheckCircle2, XCircle, ThumbsUp, ThumbsDown, Clock, X, ChevronDown, ChevronUp } from 'lucide-react'
import ClearLogsModal from '@/components/admin/ClearLogsModal'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const USAGE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  chat: { label: 'Chat', color: 'text-blue-400 bg-blue-400/10' },
  tool: { label: 'Tool', color: 'text-amber-400 bg-amber-400/10' },
  search: { label: 'Search', color: 'text-emerald-400 bg-emerald-400/10' },
  vision: { label: 'Vision', color: 'text-purple-400 bg-purple-400/10' },
  image: { label: 'Image', color: 'text-pink-400 bg-pink-400/10' },
}

const USAGE_ICONS: Record<string, React.ReactNode> = {
  chat: <MessageSquare className="w-3 h-3" />,
  tool: <Wrench className="w-3 h-3" />,
  search: <Search className="w-3 h-3" />,
  vision: <Eye className="w-3 h-3" />,
  image: <Eye className="w-3 h-3" />,
}

const CHAIN_COLORS: Record<string, string> = {
  CLASSIFIER:       'text-violet-300 bg-violet-500/10 border-violet-500/20',
  ORCHESTRATOR:     'text-indigo-300 bg-indigo-500/10 border-indigo-500/20',
  THINKING:         'text-sky-300 bg-sky-500/10 border-sky-500/20',
  FAST_SIMPLE:      'text-green-300 bg-green-500/10 border-green-500/20',
  MEDIUM_THINKING:  'text-teal-300 bg-teal-500/10 border-teal-500/20',
  COMPLEX_THINKING: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  CODING:           'text-amber-300 bg-amber-500/10 border-amber-500/20',
  WEB_SEARCH:       'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  DEEP_RESEARCH:    'text-lime-300 bg-lime-500/10 border-lime-500/20',
  VISION:           'text-purple-300 bg-purple-500/10 border-purple-500/20',
  IMAGE_GEN:        'text-pink-300 bg-pink-500/10 border-pink-500/20',
  IMAGE_UPSCALE:    'text-rose-300 bg-rose-500/10 border-rose-500/20',
  TOOL_CALLING:     'text-orange-300 bg-orange-500/10 border-orange-500/20',
  ADVISOR:          'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
}

function chainColor(chain: string) {
  return CHAIN_COLORS[chain] ?? 'text-bone-60 bg-white/5 border-white/10'
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function truncate(text: string | null, max = 100) {
  if (!text) return '—'
  if (text.includes('![')) {
    const imgMatch = text.match(/!\[(.*?)\]\s*\(\s*([^)]+?)\s*\)/)
    if (imgMatch) {
      const src = imgMatch[2].trim()
      return `[Image: ${src.startsWith('data:image/') ? 'Local' : 'Remote'}] ` + text.slice(0, 30) + '…'
    }
  }
  return text.length > max ? text.slice(0, max) + '…' : text
}

const KNOWN_CATEGORIES = new Set([
  'FAST_SIMPLE', 'COMPLEX_THINKING', 'MEDIUM_THINKING', 'AUDIO_VOICE',
  'TOOL_CALLING', 'IMAGE_GEN', 'WEB_SEARCH', 'CLASSIFIER', 'VISION', 'CODING', 'DEEP_RESEARCH',
  'THINKING', 'ORCHESTRATOR',
])

function parseChain(chain: string | null): { classifier: string; category: string; routed: string } | null {
  if (!chain) return null
  const parts = chain.split(' → ').map(p => p.split('|')[0]).filter(p => !p.toLowerCase().startsWith('advisor('))
  const catIdx = parts.findIndex(p => KNOWN_CATEGORIES.has(p))
  if (catIdx !== -1) {
    return { classifier: parts.slice(0, catIdx).join(' → '), category: parts[catIdx], routed: parts.slice(catIdx + 1).join(' → ') }
  }
  if (parts.length >= 2) return { classifier: parts[0], category: parts[1], routed: parts.slice(2).join(' → ') }
  return { classifier: '', category: '', routed: parts[0] }
}

// ── Step Trace Modal ─────────────────────────────────────────────────────────

function StepTraceModal({ trace, onClose }: { trace: StepTrace; onClose: () => void }) {
  const [tab, setTab] = useState<'input' | 'output'>('input')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-5xl max-h-[85vh] bg-[#0f0f0f] border border-white/10 rounded-[20px] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 shrink-0">
          <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border', chainColor(trace.chain))}>
            {trace.chain}
          </span>
          <span className="text-sm font-mono text-bone-100 truncate">{trace.model}</span>
          {trace.matched_keyword && (
            <span className="text-[10px] font-mono text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-md">
              keyword: &quot;{trace.matched_keyword}&quot;
            </span>
          )}
          <span className="text-[10px] text-bone-60 opacity-40 font-mono">{trace.provider}</span>
          {trace.key && <span className="text-[10px] text-bone-60 opacity-30 font-mono ml-1">{trace.key}</span>}
          <div className="ml-auto flex items-center gap-3">
            <span className={cn('text-[10px] font-bold uppercase tracking-widest', trace.success ? 'text-green-400' : 'text-red-400')}>
              {trace.success ? '✓ success' : '✗ failed'}
            </span>
            <span className="text-[10px] text-bone-60 opacity-30 font-mono">{trace.duration_ms}ms</span>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-white/5 text-bone-60 opacity-40 hover:opacity-80 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 shrink-0">
          {(['input', 'output'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all',
                tab === t ? 'bg-white/10 text-bone-100' : 'text-bone-60 opacity-40 hover:opacity-70'
              )}
            >
              {t === 'input' ? 'Input' : 'Output'}
            </button>
          ))}
          {trace.error && (
            <span className="ml-auto text-[10px] text-red-400 font-mono self-center px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-md">
              {trace.error}
            </span>
          )}
        </div>

        {/* Content — two-column for input */}
        <div className="flex-1 overflow-auto px-5 pb-5 pt-3">
          {tab === 'input' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-bone-60 opacity-40">System Prompt</span>
                  {trace.input_history_count !== undefined && (
                    <span className="text-[9px] text-bone-60 opacity-25 font-mono">{trace.input_history_count} history msgs</span>
                  )}
                </div>
                <pre className="flex-1 text-[11px] font-mono text-bone-60 opacity-70 whitespace-pre-wrap break-words bg-white/[0.02] border border-white/5 rounded-[12px] p-3 overflow-auto max-h-[55vh] select-text">
                  {trace.input_system || <span className="opacity-30 italic">— no system prompt —</span>}
                </pre>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-bone-60 opacity-40">User Prompt</span>
                <pre className="flex-1 text-[11px] font-mono text-bone-60 opacity-70 whitespace-pre-wrap break-words bg-white/[0.02] border border-white/5 rounded-[12px] p-3 overflow-auto max-h-[55vh] select-text">
                  {trace.input_user || <span className="opacity-30 italic">— no user prompt —</span>}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 h-full">
              <span className="text-[9px] font-bold uppercase tracking-widest text-bone-60 opacity-40">Model Output</span>
              <pre className="flex-1 text-[11px] font-mono text-bone-60 opacity-80 whitespace-pre-wrap break-words bg-white/[0.02] border border-white/5 rounded-[12px] p-3 overflow-auto max-h-[60vh] select-text">
                {trace.output || trace.error || <span className="opacity-30 italic">— no output —</span>}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Chain Pills ───────────────────────────────────────────────────────────────

function ChainPills({ traces, modelChain }: { traces: StepTrace[] | null; modelChain: string | null }) {
  const [activeTrace, setActiveTrace] = useState<StepTrace | null>(null)

  // Build pills from step_traces when available; fall back to model_chain string
  const pills: Array<{ label: string; success: boolean; trace?: StepTrace; isCategory?: boolean }> = []

  if (traces && traces.length > 0) {
    for (const t of traces) {
      const label = t.matched_keyword ? `"${t.matched_keyword}"` : (t.model || t.chain)
      pills.push({ label, success: t.success, trace: t })
    }
  } else if (modelChain) {
    const rawParts = modelChain.split(' → ')
    for (const part of rawParts) {
      const [model, , successStr] = part.split('|')
      const isCategory = KNOWN_CATEGORIES.has(model)
      pills.push({ label: model, success: successStr !== 'false', isCategory })
    }
  }

  if (pills.length === 0) return <span className="text-[9px] text-bone-60 opacity-20">—</span>

  return (
    <>
      {activeTrace && <StepTraceModal trace={activeTrace} onClose={() => setActiveTrace(null)} />}
      <div className="flex flex-wrap items-center gap-1.5">
        {pills.map((pill, i) => {
          const isCategory = KNOWN_CATEGORIES.has(pill.label) && !pill.trace
          const colorClass = pill.trace && !pill.trace.success
            ? 'text-red-400 bg-red-500/10 border-red-500/20'
            : pill.trace
              ? chainColor(pill.trace.chain)
              : isCategory
                ? chainColor(pill.label)
                : pill.success
                  ? 'text-bone-100 bg-white/5 border-white/10'
                  : 'text-red-400 bg-red-500/10 border-red-500/20'

          const chainLabel = pill.trace
            ? pill.trace.chain.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            : null

          return (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-bone-60 opacity-20 text-[9px] self-center">→</span>}
              <div className="flex flex-col items-center gap-0.5">
                <button
                  onClick={() => pill.trace && setActiveTrace(pill.trace)}
                  disabled={!pill.trace}
                  title={pill.trace ? `Click to inspect ${pill.trace.model} (${pill.trace.chain})` : pill.label}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono transition-all',
                    colorClass,
                    pill.trace ? 'cursor-pointer hover:brightness-125 hover:scale-[1.03]' : 'cursor-default opacity-70',
                    !pill.success && 'font-bold'
                  )}
                >
                  {pill.label}
                  {!pill.success && <XCircle className="w-2.5 h-2.5 opacity-70 shrink-0" />}
                  {pill.success && pill.trace && <CheckCircle2 className="w-2.5 h-2.5 opacity-40 shrink-0" />}
                </button>
                {chainLabel && (
                  <span className="text-[8px] text-bone-60 opacity-40 leading-none tracking-wide">
                    {chainLabel}
                  </span>
                )}
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Filters {
  platform: 'all' | 'app' | 'telegram'
  usage_type: string
}

export default function LogsTable({ initialExchanges, initialTotal }: { initialExchanges: Exchange[]; initialTotal: number }) {
  const [exchanges, setExchanges] = useState<Exchange[]>(initialExchanges)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState<Filters>({ platform: 'all', usage_type: 'all' })
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [isPending, startTransition] = useTransition()

  const PAGE_SIZE = 50
  const totalPages = Math.ceil(total / PAGE_SIZE)

  async function load(newFilters: Filters, newPage: number) {
    startTransition(async () => {
      const { exchanges: data, total: count } = await getMessageExchanges({
        platform: newFilters.platform,
        usage_type: newFilters.usage_type,
        limit: PAGE_SIZE,
        offset: newPage * PAGE_SIZE,
      })
      setExchanges(data)
      setTotal(count)
      setPage(newPage)
    })
  }

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    const next = { ...filters, [key]: value }
    setFilters(next)
    setExpanded(new Set())
    setSelected(new Set())
    load(next, 0)
  }

  function toggleSelect(id: number, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function toggleSelectAll() {
    if (selected.size === exchanges.length && exchanges.length > 0) setSelected(new Set())
    else setSelected(new Set(exchanges.map(e => e.id)))
  }

  function toggleExpand(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function handleClearDone(_deleted: number) {
    setSelected(new Set())
    load(filters, 0)
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {(['all', 'app', 'telegram'] as const).map(p => (
          <button key={p} onClick={() => setFilter('platform', p)}
            className={cn("px-3 py-1 rounded-full text-xs font-medium capitalize transition-all",
              filters.platform === p ? "bg-[var(--bone-15)] text-foreground" : "bg-[var(--bone-6)] text-bone-60 hover:text-foreground"
            )}>
            {p}
          </button>
        ))}
        <div className="w-px h-4 bg-white/10 mx-1" />
        {(['all', 'chat', 'tool', 'search', 'vision', 'image'] as const).map(t => (
          <button key={t} onClick={() => setFilter('usage_type', t)}
            className={cn("px-3 py-1 rounded-full text-xs font-medium capitalize transition-all",
              filters.usage_type === t ? "bg-[var(--bone-15)] text-foreground" : "bg-[var(--bone-6)] text-bone-60 hover:text-foreground"
            )}>
            {t}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3">
          {isPending && <RefreshCw className="w-3.5 h-3.5 text-accent animate-spin" />}
          {selected.size > 0 && (
            <span className="text-[10px] font-bold text-accent opacity-70 uppercase tracking-widest">{selected.size} selected</span>
          )}
          <span className="text-[10px] font-bold text-bone-60 opacity-40 uppercase tracking-widest">{total.toLocaleString()} exchanges</span>
          <ClearLogsModal selectedIds={[...selected]} onDone={handleClearDone} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-panel rounded-[16px] overflow-hidden border border-white/5 animate-in fade-in duration-500">
        {/* Header */}
        <div className="grid grid-cols-[28px_90px_32px_120px_1fr_1fr_200px_64px_48px_28px] gap-3 px-4 py-2.5 border-b border-white/5 bg-[var(--bone-6)]">
          <button
            onClick={toggleSelectAll}
            className={cn('w-4 h-4 rounded-[3px] border flex items-center justify-center transition-all self-center shrink-0',
              selected.size === exchanges.length && exchanges.length > 0 ? 'bg-accent border-accent' : 'border-white/20 hover:border-white/40'
            )}
          >
            {selected.size === exchanges.length && exchanges.length > 0 && <CheckCircle2 className="w-2.5 h-2.5 text-background" />}
          </button>
          {['Time', '', 'Mode', 'Prompt', 'Response', 'Chain', 'Type', 'Status', ''].map((h, i) => (
            <span key={i} className="text-[9px] font-bold uppercase tracking-[0.12em] text-bone-60 opacity-30 self-center">{h}</span>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/[0.03]">
          {exchanges.length === 0 && (
            <div className="py-16 text-center text-[11px] font-bold text-bone-60 opacity-20 uppercase tracking-widest">No exchanges found</div>
          )}
          {exchanges.map((ex) => {
            const isExpanded = expanded.has(ex.id)
            const usageCfg = USAGE_TYPE_CONFIG[ex.usage_type || '']
            const chain = parseChain(ex.model_chain)

            return (
              <div key={ex.id}>
                <div className="w-full grid grid-cols-[28px_90px_32px_120px_1fr_1fr_200px_64px_48px_28px] gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group">
                  {/* Checkbox */}
                  <button onClick={(e) => toggleSelect(ex.id, e)}
                    className={cn('w-4 h-4 rounded-[3px] border flex items-center justify-center transition-all self-center shrink-0 cursor-pointer',
                      selected.has(ex.id) ? 'bg-accent border-accent' : 'border-white/10 hover:border-white/30 opacity-0 group-hover:opacity-100'
                    )}>
                    {selected.has(ex.id) && <CheckCircle2 className="w-2.5 h-2.5 text-background" />}
                  </button>

                  <div onClick={(e) => toggleExpand(ex.id, e)} className="contents text-left cursor-pointer">
                    {/* Time */}
                    <span className="text-[10px] text-bone-60 opacity-40 font-mono truncate self-center">{formatTime(ex.created_at)}</span>

                    {/* Feedback */}
                    <div className="flex items-center self-center">
                      {ex.feedback === 'like' ? <ThumbsUp className="w-3.5 h-3.5 text-green-400/80 shrink-0" strokeWidth={2} />
                        : ex.feedback === 'dislike' ? <ThumbsDown className="w-3.5 h-3.5 text-red-400/80 shrink-0" strokeWidth={2} />
                        : <div className="w-3.5 h-3.5" />}
                    </div>

                    {/* Mode */}
                    <div className="flex items-center self-center min-w-0">
                      <span className="text-[9px] font-bold text-accent opacity-70 uppercase tracking-widest truncate">
                        {chain?.category?.replace(/_/g, ' ') || '—'}
                      </span>
                    </div>

                    {/* Prompt */}
                    <span className="text-[11px] text-bone-60 opacity-60 self-center truncate">{truncate(ex.user_prompt)}</span>

                    {/* Response */}
                    <span className={cn("text-[11px] text-bone-60 self-center truncate transition-colors", isExpanded ? 'text-bone-100' : 'group-hover:text-bone-80')}>
                      {truncate(ex.model_response)}
                    </span>

                    {/* Chain pills (compact — just names, no click in row) */}
                    <div className="self-center min-w-0 flex flex-wrap gap-1 items-center">
                      {(ex.step_traces ?? []).slice(0, 4).map((t, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <span className="text-bone-60 opacity-20 text-[8px]">→</span>}
                          <span className={cn('text-[8px] font-mono px-1.5 py-0.5 rounded border truncate max-w-[60px]', chainColor(t.chain), !t.success && 'font-bold')}>
                            {t.model.split('/').pop()?.slice(0, 14) ?? t.model}
                          </span>
                        </React.Fragment>
                      ))}
                      {(ex.step_traces?.length ?? 0) > 4 && (
                        <span className="text-[8px] text-bone-60 opacity-30">+{(ex.step_traces?.length ?? 0) - 4}</span>
                      )}
                      {!ex.step_traces && chain && (
                        <span className="text-[8px] font-mono text-bone-60 opacity-40 truncate">{chain.routed || chain.classifier}</span>
                      )}
                    </div>

                    {/* Usage type */}
                    <div className="self-center">
                      {usageCfg ? (
                        <span className={cn("inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded-full border", usageCfg.color)}>
                          {USAGE_ICONS[ex.usage_type || '']}
                          {usageCfg.label}
                        </span>
                      ) : <span className="text-[9px] text-bone-60 opacity-20">—</span>}
                    </div>

                    {/* Status */}
                    <div className="self-center flex items-center justify-center">
                      {ex.status === 'success' || ex.status === 'done' || ex.status === 'completed'
                        ? <CheckCircle2 className="w-4 h-4 text-green-400/70" />
                        : ex.status === 'error' || ex.status === 'failed'
                          ? <XCircle className="w-4 h-4 text-red-400/70" />
                          : <span className="text-[9px] font-mono text-bone-60 opacity-40 capitalize">{ex.status || '—'}</span>}
                    </div>

                    {/* Expand indicator */}
                    <div className="self-center flex justify-end">
                      {isExpanded
                        ? <ChevronUp className="w-3.5 h-3.5 text-bone-60 opacity-30" />
                        : <ChevronDown className="w-3.5 h-3.5 text-bone-60 opacity-0 group-hover:opacity-30 transition-opacity" />}
                    </div>
                  </div>
                </div>

                {/* Expanded row */}
                <div className={cn("grid transition-all duration-150 ease-out", isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                  <div className="overflow-hidden">
                    <div className="px-4 py-4 bg-panel border-t border-white/[0.03]">
                      <div className="space-y-5 cursor-default" onClick={e => e.stopPropagation()}>

                        {/* Meta row */}
                        <div className="flex flex-wrap gap-4 text-[10px] text-bone-60 opacity-40 font-mono select-text bg-white/[0.02] border border-white/5 rounded-[12px] px-3 py-1.5">
                          {ex.user_email && <span>Email: {ex.user_email}</span>}
                          {ex.telegram_id && <span>Telegram: {ex.telegram_id}</span>}
                          {ex.auth_user_id && <span>User: {ex.auth_user_id}</span>}
                          <span>Exchange #{ex.id}</span>
                          {ex.duration_ms !== null && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />{(ex.duration_ms / 1000).toFixed(2)}s
                            </span>
                          )}
                          {ex.status && (
                            <span className={ex.status === 'error' ? 'text-red-400 opacity-80' : 'text-emerald-400 opacity-80'}>
                              {ex.status.toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* Full chain — pills with click-to-inspect */}
                        <div>
                          <h5 className="text-[10px] font-bold text-bone-60 uppercase tracking-widest mb-2 opacity-40">
                            CHAIN TRACE {ex.step_traces ? `(${ex.step_traces.length} steps)` : ''}
                          </h5>
                          <ChainPills traces={ex.step_traces} modelChain={ex.model_chain} />
                        </div>

                        {/* User request / Model response */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white/[0.03] rounded-[16px] px-3 py-2">
                            <h5 className="text-[10px] font-bold text-bone-60 uppercase tracking-widest mb-1.5 opacity-50">USER REQUEST</h5>
                            <p className="text-xs text-foreground/80 font-mono break-words leading-relaxed select-text">
                              {ex.user_prompt || '(content unavailable)'}
                            </p>
                          </div>
                          <div className="bg-white/[0.03] rounded-[16px] px-3 py-2">
                            <h5 className="text-[10px] font-bold text-bone-60 uppercase tracking-widest mb-1.5 opacity-50">MODEL RESPONSE</h5>
                            <div className="text-xs text-foreground/80 font-sans break-words leading-relaxed select-text prose prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 max-w-none">
                              {ex.model_response ? (() => {
                                const trimmed = ex.model_response.trim()
                                const isPureImage = /^!\[.*?\]\s*\(\s*(data:image\/|https?:\/\/)[\s\S]*?\s*\)$/.test(trimmed)
                                if (isPureImage) {
                                  const imgMatch = trimmed.match(/!\[(.*?)\]\s*\(\s*([^)]+?)(?:\s+"[^"]+")?\s*\)/)
                                  if (imgMatch) {
                                    const cleanSrc = imgMatch[2].trim().replace(/\s/g, '')
                                    return (
                                      <div className="my-2 flex justify-center">
                                        <div
                                          className="rounded-lg overflow-hidden border border-white/10 bg-black/20 cursor-pointer hover:border-white/30 transition-all"
                                          onClick={() => { const { useStore } = require('@/data/store'); useStore.getState().openModal({ kind: 'mediaViewer', url: cleanSrc, mediaType: 'image', description: ex.image_description || undefined, messageId: ex.id.toString() }) }}
                                        >
                                          <img src={cleanSrc} alt={imgMatch[1] || ''} className="max-w-full max-h-[320px] w-auto h-auto object-contain" />
                                        </div>
                                      </div>
                                    )
                                  }
                                }
                                return (
                                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                                    p: ({ children }: any) => <div className="my-1">{children}</div>,
                                    img: ({ src, alt }: any) => {
                                      if (!src) return null
                                      return <div className="my-2 rounded-lg overflow-hidden border border-white/10 bg-black/20"><img src={src.trim()} alt={alt || ''} className="max-w-full h-auto" /></div>
                                    }
                                  }}>
                                    {ex.model_response}
                                  </ReactMarkdown>
                                )
                              })() : '(content unavailable)'}
                              {ex.image_description && (
                                <div className="mt-2 pt-2 border-t border-white/5">
                                  <h5 className="text-[9px] font-bold text-bone-60 uppercase tracking-widest mb-1 opacity-40">IMAGE NARRATION</h5>
                                  <p className="text-[11px] text-bone-60 italic leading-relaxed">{ex.image_description}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-bone-60 opacity-30 uppercase tracking-widest">Page {page + 1} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => load(filters, page - 1)} disabled={page === 0 || isPending}
              className="p-1.5 rounded-medium bg-panel text-bone-60 hover:text-bone-100 disabled:opacity-20 transition-all">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => load(filters, page + 1)} disabled={page >= totalPages - 1 || isPending}
              className="p-1.5 rounded-medium bg-panel text-bone-60 hover:text-bone-100 disabled:opacity-20 transition-all">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
