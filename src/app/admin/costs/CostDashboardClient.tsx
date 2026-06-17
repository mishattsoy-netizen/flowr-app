'use client'

import { useState, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { CostSeriesChart } from './CostCharts'
import type { CostSummary, CostSeriesPoint, ModelCostRow, CostLogEntry } from './actions'

const FREE_MODELS_KEY = 'cost-analytics-free-models'

function getFreeModels(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(FREE_MODELS_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}

function saveFreeModels(set: Set<string>) {
  try {
    localStorage.setItem(FREE_MODELS_KEY, JSON.stringify([...set]))
  } catch {}
}

const TIMEFRAMES = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: 0 },
]

function fmtCurrency(n: number): string {
  if (n >= 100) return `$${n.toFixed(0)}`
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(6)}`
}

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

const CHAIN_COLORS: Record<string, string> = {
  CLASSIFIER: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
  ORCHESTRATOR: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20',
  THINKING: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  FAST_SIMPLE: 'text-green-300 bg-green-500/10 border-green-500/20',
  MEDIUM_THINKING: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
  COMPLEX: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  CODING: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  WEB_SEARCH: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  RESEARCH: 'text-lime-300 bg-lime-500/10 border-lime-500/20',
  VISION: 'text-purple-300 bg-purple-500/10 border-purple-500/20',
  IMAGE_GEN: 'text-pink-300 bg-pink-500/10 border-pink-500/20',
  PROMPT_EXPANSION: 'text-green-300 bg-green-500/10 border-green-500/20',
  IMAGE_NARRATION: 'text-purple-300 bg-purple-500/10 border-purple-500/20',
  TOOLS: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
  ADVISOR: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
  AI: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  KEYWORD: 'text-amber-400 bg-amber-500/10 border-amber-500/20 font-bold',
  TAG: 'text-blue-400 bg-blue-500/10 border-blue-500/20 font-bold',
}

function ChainBadge({ chain }: { chain: string | null | undefined }) {
  if (!chain) return null
  const c = CHAIN_COLORS[chain]
  const label = chain.replace(/_/g, ' ')
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-[8px] font-mono border leading-none inline-block truncate max-w-[90px]', c ?? 'border-[var(--bone-12)] text-bone-70 bg-white/5')}>
      {label}
    </span>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

const PAGE_SIZE = 25

export function CostDashboardClient({ initial }: {
  initial: { summary: CostSummary; series: CostSeriesPoint[]; models: ModelCostRow[] }
}) {
  const [tab, setTab] = useState<'overview' | 'recent'>('overview')
  const [days, setDays] = useState(30)
  const [summary, setSummary] = useState<CostSummary>(initial.summary)
  const [series, setSeries] = useState<CostSeriesPoint[]>(initial.series)
  const [models, setModels] = useState<ModelCostRow[]>(initial.models)
  const [loading, setLoading] = useState(false)
  const [sortKey, setSortKey] = useState<'total_cost' | 'requests' | 'prompt_tokens' | 'completion_tokens'>('total_cost')
  const [sortAsc, setSortAsc] = useState(false)
  const [freeModels, setFreeModels] = useState<Set<string>>(new Set())
  useEffect(() => { setFreeModels(getFreeModels()) }, [])
  const [recentRows, setRecentRows] = useState<CostLogEntry[]>([])
  const [recentTotal, setRecentTotal] = useState(0)
  const [recentOffset, setRecentOffset] = useState(0)
  const [recentLoading, setRecentLoading] = useState(false)

  const fetchRecent = useCallback(async (offset: number, append: boolean) => {
    setRecentLoading(true)
    const { rows, total } = await import('./actions').then(m => m.getRecentCostLogs(PAGE_SIZE, offset))
    if (append) {
      setRecentRows(prev => [...prev, ...rows])
    } else {
      setRecentRows(rows)
    }
    setRecentTotal(total)
    setRecentOffset(offset)
    setRecentLoading(false)
  }, [])

  const fetchData = useCallback(async (d: number) => {
    setLoading(true)
    const ex = [...freeModels]
    const [s, ser, m] = await Promise.all([
      import('./actions').then(m => m.getCostSummary(d, ex)),
      import('./actions').then(m => m.getCostSeries(d, ex)),
      import('./actions').then(m => m.getModelBreakdown(d)),
    ])
    setSummary(s)
    setSeries(ser)
    setModels(m)
    setLoading(false)
  }, [freeModels])

  const handleTimeframe = (d: number) => {
    setDays(d)
    fetchData(d)
  }

  const toggleFreeModel = useCallback((modelId: string) => {
    setFreeModels(prev => {
      const next = new Set(prev)
      if (next.has(modelId)) next.delete(modelId)
      else next.add(modelId)
      saveFreeModels(next)
      return next
    })
  }, [])

  const handleTabChange = (t: 'overview' | 'recent') => {
    setTab(t)
    if (t === 'recent' && recentRows.length === 0) {
      fetchRecent(0, false)
    }
  }

  const sortedModels = [...models].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  const avgCost = summary.total_requests > 0 ? summary.total_cost / summary.total_requests : 0
  const topModel = models.length > 0 ? models[0] : null
  const hasData = summary.total_requests > 0

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header + Tabs + Timeframe */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-[22px] font-medium tracking-tight text-foreground">Cost Analytics</h1>
          <div className="flex items-center gap-1 ml-2">
            {(['overview', 'recent'] as const).map(t => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium capitalize transition-all',
                  tab === t
                    ? 'bg-[var(--bone-15)] text-foreground'
                    : 'text-bone-70 hover:text-foreground hover:bg-[var(--bone-6)]'
                )}
              >
                {t === 'overview' ? 'Overview' : 'Recent Usage'}
              </button>
            ))}
          </div>
        </div>
        {tab === 'overview' && (
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map(t => (
              <button
                key={t.label}
                onClick={() => handleTimeframe(t.days)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-all',
                  days === t.days
                    ? 'bg-[var(--bone-15)] text-foreground'
                    : 'text-bone-70 hover:text-foreground hover:bg-[var(--bone-6)]'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'overview' ? (
        <>
          {loading && (
            <div className="text-[10px] text-accent font-mono animate-pulse">Loading...</div>
          )}

          {!hasData ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <span className="text-[11px] font-bold text-bone-70 opacity-20 uppercase tracking-widest">No cost data recorded yet</span>
              <span className="text-[10px] text-bone-70 opacity-30">Costs will appear here after model calls are made.</span>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <MetricCard label="Total Cost" value={fmtCurrency(summary.total_cost)} />
                <MetricCard label="Total Tokens" value={fmtNumber(summary.total_prompt_tokens + summary.total_completion_tokens)} />
                <MetricCard label="Requests" value={fmtNumber(summary.total_requests)} />
                <MetricCard
                  label="Avg Cost / Request"
                  value={fmtCurrency(avgCost)}
                  sub={topModel ? `Costliest: ${topModel.model_id.split('/').pop()}` : undefined}
                />
              </div>

              {/* Cost Over Time Chart */}
              <div className="bg-panel border border-[var(--bone-12)] rounded-[20px] p-5">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-bone-70 opacity-40 mb-4">Cost Over Time</h2>
                <CostSeriesChart data={series} />
              </div>

              {/* Per-Model Breakdown Table */}
              <div className="bg-panel rounded-[16px] overflow-hidden border border-[var(--bone-12)]">
                <div className="grid grid-cols-[1fr_100px_80px_120px_120px] gap-3 px-4 py-2.5 border-b border-[var(--bone-12)] bg-[var(--bone-6)]">
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-bone-70 opacity-30 self-center">Model</span>
                  <CostTh sortKey="total_cost" current={sortKey} asc={sortAsc} onClick={(k) => { setSortKey(k); setSortAsc(sortAsc ? !(k === sortKey) : false) }}>Cost</CostTh>
                  <CostTh sortKey="requests" current={sortKey} asc={sortAsc} onClick={(k) => { setSortKey(k); setSortAsc(sortAsc ? !(k === sortKey) : false) }}>Reqs</CostTh>
                  <CostTh sortKey="prompt_tokens" current={sortKey} asc={sortAsc} onClick={(k) => { setSortKey(k); setSortAsc(sortAsc ? !(k === sortKey) : false) }}>Prompt</CostTh>
                  <CostTh sortKey="completion_tokens" current={sortKey} asc={sortAsc} onClick={(k) => { setSortKey(k); setSortAsc(sortAsc ? !(k === sortKey) : false) }}>Completion</CostTh>
                </div>
                <div className="divide-y divide-[var(--bone-6)]">
                  {sortedModels.length === 0 && (
                    <div className="py-12 text-center text-[11px] font-bold text-bone-70 opacity-20 uppercase tracking-widest">No model data</div>
                  )}
                  {sortedModels.map(row => {
                    const isFree = freeModels.has(row.model_id)
                    return (
                    <div
                      key={`${row.model_id}|${row.provider}`}
                      className={cn(
                        "w-full grid grid-cols-[1fr_100px_80px_120px_120px] gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group",
                        isFree && "opacity-50"
                      )}
                    >
                      <div className="self-center min-w-0 truncate flex items-center gap-2">
                        <button
                          onClick={() => toggleFreeModel(row.model_id)}
                          className={cn(
                            'shrink-0 w-4 h-4 rounded-[3px] border flex items-center justify-center transition-all',
                            isFree
                              ? 'bg-green-400/20 border-green-400/40 text-green-400'
                              : 'border-white/10 hover:border-white/30 text-bone-70 opacity-0 group-hover:opacity-100'
                          )}
                          title={isFree ? 'Mark as paid' : 'Mark as free'}
                        >
                          {isFree ? <span className="text-[8px] font-bold">$0</span> : <span className="text-[8px]">$</span>}
                        </button>
                        <span className="font-mono text-[11px] text-bone-100">{row.model_id.split('/').pop()}</span>
                        <span className="text-[9px] text-bone-70 opacity-30">{row.provider}</span>
                      </div>
                      <span className={cn("self-center text-[11px] font-mono truncate", isFree ? 'text-green-400/60' : 'text-bone-70')}>
                        {isFree ? '$0.00' : fmtCurrency(row.total_cost)}
                      </span>
                      <span className="self-center text-[11px] font-mono text-bone-70 truncate">{row.requests.toLocaleString()}</span>
                      <span className="self-center text-[11px] font-mono text-bone-70 truncate">{fmtNumber(row.prompt_tokens)}</span>
                      <span className="self-center text-[11px] font-mono text-bone-70 truncate">{fmtNumber(row.completion_tokens)}</span>
                    </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        /* Recent Usage Tab */
        <div className="bg-panel rounded-[16px] overflow-hidden border border-[var(--bone-12)]">
          <div className="grid grid-cols-[130px_1fr_80px_70px_90px_90px_90px_100px] gap-3 px-4 py-2.5 border-b border-[var(--bone-12)] bg-[var(--bone-6)]">
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-bone-70 opacity-30 self-center">Date &amp; Time</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-bone-70 opacity-30 self-center">Model</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-bone-70 opacity-30 self-center">Provider</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-bone-70 opacity-30 self-center">Sub</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-bone-70 opacity-30 self-center">Chain</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-bone-70 opacity-30 self-center text-right">Input</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-bone-70 opacity-30 self-center text-right">Output</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-bone-70 opacity-30 self-center text-right">Cost</span>
          </div>
          <div className="divide-y divide-[var(--bone-6)]">
            {recentRows.length === 0 && !recentLoading && (
              <div className="py-12 text-center text-[11px] font-bold text-bone-70 opacity-20 uppercase tracking-widest">No usage logs yet</div>
            )}
            {recentRows.map(row => {
              const isFree = freeModels.has(row.model_id)
              const displayCost = isFree ? 0 : row.total_cost
              return (
              <div
                key={row.id}
                className={cn(
                  "w-full grid grid-cols-[130px_1fr_80px_70px_90px_90px_90px_100px] gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group",
                  isFree && "opacity-50"
                )}
              >
                <span className="self-center text-[10px] font-mono text-bone-70 opacity-60 truncate">{formatTime(row.created_at)}</span>
                <div className="self-center min-w-0 truncate">
                  <span className="text-[11px] font-mono text-bone-100">{row.model_id.split('/').pop()}</span>
                </div>
                <span className="self-center text-[10px] text-bone-70 opacity-40 truncate">{row.provider}</span>
                <span className="self-center text-[10px] text-bone-70 opacity-30 font-mono truncate">{row.subprovider ?? '—'}</span>
                <div className="self-center min-w-0">
                  <ChainBadge chain={row.chain} />
                </div>
                <span className="self-center text-[11px] font-mono text-bone-70 text-right truncate">{row.prompt_tokens.toLocaleString()}</span>
                <span className="self-center text-[11px] font-mono text-bone-70 text-right truncate">{row.completion_tokens.toLocaleString()}</span>
                <span className={cn("self-center text-[11px] font-mono text-right truncate", isFree ? 'text-green-400/60' : 'text-amber-400/70')}>
                  {fmtCurrency(displayCost)}
                </span>
              </div>
              )
            })}
            {recentLoading && (
              <div className="py-4 text-center text-[10px] text-accent font-mono animate-pulse">Loading...</div>
            )}
          </div>
          {recentOffset + PAGE_SIZE < recentTotal && (
            <div className="border-t border-[var(--bone-6)] px-4 py-3 flex items-center justify-center">
              <button
                onClick={() => fetchRecent(recentOffset + PAGE_SIZE, true)}
                disabled={recentLoading}
                className={cn(
                  'px-5 py-1.5 rounded-full text-xs font-medium transition-all',
                  'text-bone-70 hover:text-foreground hover:bg-[var(--bone-6)]',
                  recentLoading && 'opacity-40 pointer-events-none'
                )}
              >
                +{Math.min(PAGE_SIZE, recentTotal - recentOffset - PAGE_SIZE)} more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-panel border border-[var(--bone-12)] rounded-[20px] p-4 flex flex-col gap-1">
      <span className="text-[9px] font-bold uppercase tracking-widest text-bone-70 opacity-40">{label}</span>
      <span className="text-lg font-mono font-medium text-foreground">{value}</span>
      {sub && <span className="text-[9px] text-bone-70 opacity-30 truncate">{sub}</span>}
    </div>
  )
}

function CostTh({ sortKey, current, asc, onClick, children }: {
  sortKey: string
  current: string
  asc: boolean
  onClick: (k: any) => void
  children: React.ReactNode
}) {
  const isActive = current === sortKey
  return (
    <span
      className="text-[9px] font-bold uppercase tracking-[0.12em] text-bone-70 opacity-30 self-center cursor-pointer hover:opacity-60 select-none"
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isActive && <span className="text-[8px]">{asc ? '↑' : '↓'}</span>}
      </span>
    </span>
  )
}
