'use client'

import React, { useState, useTransition } from 'react'
import { getMessageExchanges, Exchange } from './actions'
import { cn } from '@/lib/utils'
import { Bot, Globe, MessageSquare, Search, Wrench, Eye, RefreshCw, ChevronLeft, ChevronRight, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'
import ClearLogsModal from '@/components/admin/ClearLogsModal'

const USAGE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  chat:   { label: 'Chat',   color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  tool:   { label: 'Tool',   color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  search: { label: 'Search', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  vision: { label: 'Vision', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  image:  { label: 'Image',  color: 'text-pink-400 bg-pink-400/10 border-pink-400/20' },
}

const USAGE_ICONS: Record<string, React.ReactNode> = {
  chat:   <MessageSquare className="w-3 h-3" />,
  tool:   <Wrench className="w-3 h-3" />,
  search: <Search className="w-3 h-3" />,
  vision: <Eye className="w-3 h-3" />,
  image:  <Eye className="w-3 h-3" />,
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function truncate(text: string | null, max = 100) {
  if (!text) return '—'
  return text.length > max ? text.slice(0, max) + '…' : text
}

// Parse "classifierModel → routedModel" into parts
function parseChain(chain: string | null): { classifier: string; routed: string } | null {
  if (!chain) return null
  const parts = chain.split(' → ')
  if (parts.length === 2) return { classifier: parts[0], routed: parts[1] }
  return { classifier: '', routed: parts[0] }
}

interface Filters {
  platform: 'all' | 'app' | 'telegram'
  usage_type: string
}

export default function LogsTable({ initialExchanges, initialTotal }: { initialExchanges: Exchange[]; initialTotal: number }) {
  const [exchanges, setExchanges] = useState<Exchange[]>(initialExchanges)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState<Filters>({ platform: 'all', usage_type: 'all' })
  const [expanded, setExpanded] = useState<number | null>(null)
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
    setExpanded(null)
    setSelected(new Set())
    load(next, 0)
  }

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === exchanges.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(exchanges.map(e => e.id)))
    }
  }

  function handleClearDone(deleted: number) {
    setSelected(new Set())
    load(filters, 0)
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChips
          label="Platform"
          options={[
            { value: 'all', label: 'All' },
            { value: 'app', label: 'App' },
            { value: 'telegram', label: 'Telegram' },
          ]}
          value={filters.platform}
          onChange={(v) => setFilter('platform', v as Filters['platform'])}
        />
        <div className="w-px h-4 bg-white/10" />
        <FilterChips
          label="Type"
          options={[
            { value: 'all', label: 'All' },
            { value: 'chat', label: 'Chat' },
            { value: 'tool', label: 'Tool' },
            { value: 'search', label: 'Search' },
            { value: 'vision', label: 'Vision' },
            { value: 'image', label: 'Image' },
          ]}
          value={filters.usage_type}
          onChange={(v) => setFilter('usage_type', v)}
        />

        <div className="ml-auto flex items-center gap-3">
          {isPending && <RefreshCw className="w-3.5 h-3.5 text-accent animate-spin" />}
          {selected.size > 0 && (
            <span className="text-[10px] font-bold text-accent opacity-70 uppercase tracking-widest">
              {selected.size} selected
            </span>
          )}
          <span className="text-[10px] font-bold text-bone-60 opacity-40 uppercase tracking-widest">
            {total.toLocaleString()} exchanges
          </span>
          <ClearLogsModal selectedIds={[...selected]} onDone={handleClearDone} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-panel border border-white/5 rounded-big overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[28px_100px_140px_1fr_1fr_220px_72px_28px] gap-3 px-4 py-2.5 border-b border-white/5 bg-background/40">
          <button
            onClick={toggleSelectAll}
            className={cn(
              'w-4 h-4 rounded-[3px] border flex items-center justify-center transition-all self-center',
              selected.size === exchanges.length && exchanges.length > 0
                ? 'bg-accent border-accent'
                : 'border-white/20 hover:border-white/40'
            )}
          >
            {selected.size === exchanges.length && exchanges.length > 0 && (
              <CheckCircle2 className="w-2.5 h-2.5 text-background" />
            )}
          </button>
          {['Time', 'User', 'Prompt', 'Response', 'Routing', 'Type', ''].map(h => (
            <span key={h} className="text-[9px] font-bold uppercase tracking-[0.12em] text-bone-60 opacity-30">{h}</span>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/[0.03]">
          {exchanges.length === 0 && (
            <div className="py-16 text-center text-[11px] font-bold text-bone-60 opacity-20 uppercase tracking-widest">
              No exchanges found
            </div>
          )}
          {exchanges.map((ex) => {
            const isExpanded = expanded === ex.id
            const usageCfg = USAGE_TYPE_CONFIG[ex.usage_type || '']
            const chain = parseChain(ex.model_chain)

            return (
              <div key={ex.id}>
                <div className="w-full grid grid-cols-[28px_100px_140px_1fr_1fr_220px_72px_28px] gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group">
                  {/* Checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(ex.id) }}
                    className={cn(
                      'w-4 h-4 rounded-[3px] border flex items-center justify-center transition-all self-center shrink-0',
                      selected.has(ex.id)
                        ? 'bg-accent border-accent'
                        : 'border-white/10 hover:border-white/30 opacity-0 group-hover:opacity-100'
                    )}
                  >
                    {selected.has(ex.id) && <CheckCircle2 className="w-2.5 h-2.5 text-background" />}
                  </button>
                <button
                  onClick={() => setExpanded(isExpanded ? null : ex.id)}
                  className="contents text-left"
                >
                  {/* Time */}
                  <span className="text-[10px] text-bone-60 opacity-40 font-mono truncate self-center">
                    {formatTime(ex.created_at)}
                  </span>

                  {/* User */}
                  <div className="flex items-center gap-1.5 self-center min-w-0">
                    {ex.platform === 'app'
                      ? <Globe className="w-3 h-3 text-blue-400 opacity-50 shrink-0" />
                      : <Bot className="w-3 h-3 text-orange-400 opacity-50 shrink-0" />
                    }
                    <span className="text-[9px] font-mono text-bone-60 opacity-50 truncate" title={ex.user_email || ex.auth_user_id || String(ex.telegram_id) || '—'}>
                      {ex.user_email
                        ? ex.user_email
                        : ex.telegram_id
                          ? `tg:${ex.telegram_id}`
                          : ex.auth_user_id
                            ? ex.auth_user_id.slice(0, 8)
                            : '—'
                      }
                    </span>
                  </div>

                  {/* User prompt */}
                  <span className="text-[11px] text-bone-60 opacity-60 self-center truncate">
                    {truncate(ex.user_prompt)}
                  </span>

                  {/* Model response */}
                  <span className={cn(
                    "text-[11px] text-bone-60 self-center truncate transition-colors",
                    isExpanded ? 'text-bone-100' : 'group-hover:text-bone-80'
                  )}>
                    {truncate(ex.model_response)}
                  </span>

                  {/* Routing chain */}
                  <div className="self-center min-w-0">
                    {chain ? (
                      <div className="flex items-center gap-1 min-w-0">
                        <span className={cn(
                          "text-[8px] font-mono truncate shrink-0 max-w-[72px]",
                          chain.classifier === 'keyword' || chain.classifier === 'fallback'
                            ? 'text-accent/50'
                            : 'text-bone-60 opacity-35'
                        )} title={chain.classifier}>
                          {chain.classifier || '?'}
                        </span>
                        <ArrowRight className="w-2.5 h-2.5 text-bone-60 opacity-20 shrink-0" />
                        <span className="text-[8px] font-mono text-bone-60 opacity-70 truncate" title={chain.routed}>
                          {chain.routed}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[9px] text-bone-60 opacity-20">—</span>
                    )}
                  </div>

                  {/* Usage type */}
                  <div className="self-center">
                    {usageCfg ? (
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded-full border",
                        usageCfg.color
                      )}>
                        {USAGE_ICONS[ex.usage_type || '']}
                        {usageCfg.label}
                      </span>
                    ) : (
                      <span className="text-[9px] text-bone-60 opacity-20">—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="self-center flex justify-center">
                    {ex.status === 'error' ? (
                      <XCircle className="w-3.5 h-3.5 text-red-400 opacity-70" />
                    ) : ex.status === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 opacity-60" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-bone-60 opacity-20 inline-block" />
                    )}
                  </div>
                </button>
                </div>

                {/* Expanded row */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 bg-background/40 border-t border-white/[0.03] space-y-3">
                    {/* Meta */}
                    <div className="flex flex-wrap gap-4 text-[10px] text-bone-60 opacity-40 font-mono">
                      {ex.telegram_id && <span>Telegram: {ex.telegram_id}</span>}
                      {ex.auth_user_id && <span>User: {ex.auth_user_id}</span>}
                      <span>ID: {ex.id}</span>
                      {ex.status && (
                        <span className={ex.status === 'error' ? 'text-red-400 opacity-80' : 'text-emerald-400 opacity-80'}>
                          {ex.status.toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Routing breakdown */}
                    {ex.model_chain && (
                      <div className="flex items-center gap-2 text-[10px] font-mono">
                        <span className="text-bone-60 opacity-30 uppercase tracking-widest text-[8px]">Route</span>
                        {(() => {
                          const c = parseChain(ex.model_chain)
                          if (!c) return <span className="text-bone-60 opacity-50">{ex.model_chain}</span>
                          return (
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[9px]",
                                c.classifier === 'keyword' || c.classifier === 'fallback'
                                  ? 'bg-accent/10 text-accent/70'
                                  : 'bg-white/5 text-bone-60 opacity-60'
                              )}>
                                {c.classifier || '?'}
                              </span>
                              <ArrowRight className="w-3 h-3 text-bone-60 opacity-30" />
                              <span className="px-1.5 py-0.5 rounded bg-white/5 text-bone-60 opacity-80">{c.routed}</span>
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    {/* Messages */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[8px] font-bold uppercase tracking-widest text-bone-60 opacity-30 mb-1">User</div>
                        <p className="text-[11px] text-bone-60 leading-relaxed whitespace-pre-wrap break-words">
                          {ex.user_prompt || '(no prompt)'}
                        </p>
                      </div>
                      <div>
                        <div className="text-[8px] font-bold uppercase tracking-widest text-accent opacity-50 mb-1">Model</div>
                        <p className="text-[11px] text-bone-80 leading-relaxed whitespace-pre-wrap break-words">
                          {ex.model_response || '(empty)'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-bone-60 opacity-30 uppercase tracking-widest">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => load(filters, page - 1)}
              disabled={page === 0 || isPending}
              className="p-1.5 rounded-medium bg-panel border border-white/5 text-bone-60 hover:text-bone-100 disabled:opacity-20 transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => load(filters, page + 1)}
              disabled={page >= totalPages - 1 || isPending}
              className="p-1.5 rounded-medium bg-panel border border-white/5 text-bone-60 hover:text-bone-100 disabled:opacity-20 transition-all"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterChips({
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-2.5 py-1 rounded-medium text-[9px] font-bold uppercase tracking-widest transition-all border",
            value === opt.value
              ? "bg-accent/10 border-accent/30 text-accent"
              : "bg-panel border-white/5 text-bone-60 opacity-40 hover:opacity-100"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
