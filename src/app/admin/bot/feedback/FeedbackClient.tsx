'use client'

import React, { useState, useEffect } from 'react'
import { ThumbsUp, ThumbsDown, Send, Trash2, ChevronRight, ChevronDown, CheckCircle2, ArrowRight, XCircle, MessageSquare, Search, Wrench, Eye } from 'lucide-react'
import type { FeedbackLog } from './actions'
import { deleteSelectedFeedback, toggleFeedbackLock } from './actions'
import { cn } from '@/lib/utils'

interface Props { initialLogs: FeedbackLog[] }

const USAGE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  chat: { label: 'Chat', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  tool: { label: 'Tool', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  search: { label: 'Search', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  vision: { label: 'Vision', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  image: { label: 'Image', color: 'text-pink-400 bg-pink-400/10 border-pink-400/20' },
}

const USAGE_ICONS: Record<string, React.ReactNode> = {
  chat: <MessageSquare className="w-3 h-3" />,
  tool: <Wrench className="w-3 h-3" />,
  search: <Search className="w-3 h-3" />,
  vision: <Eye className="w-3 h-3" />,
  image: <Eye className="w-3 h-3" />,
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function truncate(text: string | null, max = 100) {
  if (!text) return '—'
  return text.length > max ? text.slice(0, max) + '…' : text
}

function parseChain(chain: string | null): { classifier: string; routed: string } | null {
  if (!chain) return null
  const parts = chain.split(' → ').map(p => p.split('|')[0])
  if (parts.length >= 2) return { classifier: parts[0], routed: parts.slice(1).join(' → ') }
  return { classifier: '', routed: parts[0] }
}

export default function FeedbackClient({ initialLogs }: Props) {
  const [logs, setLogs] = useState<FeedbackLog[]>(initialLogs)
  const [filter, setFilter] = useState<'all' | 'like' | 'dislike'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [running, setRunning] = useState(false)
  const [logLines, setLogLines] = useState<string[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [reasoning, setReasoning] = useState<string | null>(null)
  const [directive, setDirective] = useState<string>('')

  useEffect(() => {
    setLogs(initialLogs)
  }, [initialLogs])

  const filtered = logs.filter(l => filter === 'all' || l.feedback === filter)

  async function handleToggleLock(id: string, current: boolean, e: React.MouseEvent) {
    e.stopPropagation()
    const nextLocked = !current
    setLogs(prev => prev.map(l => l.id === id ? { ...l, is_locked: nextLocked } : l))
    try {
      await toggleFeedbackLock(id, nextLocked)
    } catch (err: any) {
      alert(`Update failed: ${err.message}`)
      setLogs(prev => prev.map(l => l.id === id ? { ...l, is_locked: current } : l))
    }
  }

  function toggleSelect(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(l => l.id)))
    }
  }

  function toggleExpand(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleDelete() {
    if (!selected.size) return
    const confirmed = confirm(`Are you sure you want to delete ${selected.size} selected feedback entries?`)
    if (!confirmed) return
    try {
      await deleteSelectedFeedback(Array.from(selected))
      setSelected(new Set())
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`)
    }
  }

  async function sendToAnalysis(overrideDirective?: string) {
    const selectedLogs = initialLogs.filter(l => selected.has(l.id))
    const logIds = selectedLogs.map(l => String(l.message_log_id))

    if (logIds.length === 0) {
      alert("Please select at least one feedback message.")
      return
    }

    setRunning(true)
    setLogLines([])
    setReasoning(null)

    const res = await fetch('/api/ai/brain/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        log_ids: logIds,
        mandatory_directive: overrideDirective || directive || undefined
      })
    })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const parts = buf.split('\n\n')
      buf = parts.pop() ?? ''
      for (const part of parts) {
        if (!part.startsWith('data: ')) continue
        try {
          const msg = JSON.parse(part.slice(6))
          if (msg.type === 'log') {
            setLogLines(prev => [...prev, msg.line])
          } else if (msg.type === 'reasoning') {
            setReasoning(msg.content)
          }
        } catch { /**/ }
      }
    }
    setRunning(false)
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display font-medium text-foreground mb-1">Feedback Logs</h1>
        <p className="text-bone-70 text-sm font-medium">
          Liked and disliked messages. Select any to send for targeted analysis.
        </p>
      </div>

      {/* Filters + actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {(['all', 'like', 'dislike'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 py-1 rounded-full text-xs font-medium capitalize transition-all",
              filter === f ? "bg-[var(--bone-15)] text-foreground" : "bg-[var(--bone-6)] text-bone-70 hover:text-foreground"
            )}>
            {f === 'all' ? `All (${initialLogs.length})` : f === 'like' ? `👍 Liked (${initialLogs.filter(l => l.feedback === 'like').length})` : `👎 Disliked (${initialLogs.filter(l => l.feedback === 'dislike').length})`}
          </button>
        ))}
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-all">
              <Trash2 className="w-3 h-3" />
              Delete {selected.size}
            </button>
            <button onClick={() => sendToAnalysis()} disabled={running}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-foreground text-background rounded-lg text-xs font-medium hover:opacity-80 disabled:opacity-50">
              <Send className="w-3 h-3" />
              {running ? 'Analyzing…' : `Send ${selected.size} to Analysis`}
            </button>
          </div>
        )}
      </div>

      {/* Log stream */}
      {logLines.length > 0 && (
        <div className="bg-panel border border-[var(--bone-12)] rounded-[16px] p-4">
          <div className="font-mono text-xs leading-6 space-y-0.5 max-h-40 overflow-y-auto">
            {logLines.map((line, i) => (
              <div key={i} className={line.startsWith('✓') ? 'text-green-400' : line.startsWith('✗') ? 'text-red-400' : 'text-[var(--bone-40)]'}>{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* AI Reasoning Box */}
      {reasoning && (
        <div className="bg-panel border border-[var(--bone-12)] rounded-[16px] p-4 space-y-1.5 animate-in fade-in duration-300">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-accent uppercase tracking-widest text-[9px]">AI REASONING</span>
          </div>
          <p className="text-[12px] text-foreground/80 leading-relaxed font-sans select-text break-words">
            {reasoning}
          </p>
        </div>
      )}

      {/* Override directive box */}
      {selected.size > 0 && (
        <div className="bg-[var(--bone-4)] rounded-[16px] p-4 space-y-2.5 animate-in fade-in duration-300">
          <div>
            <h4 className="text-[10px] font-bold text-bone-70 uppercase tracking-widest">
              ⚡ MANUAL CLARIFICATION / OVERRIDE
            </h4>
            <p className="text-[10px] text-bone-70">
              If the AI missed something or you disagree with its reasoning, type your clarification below. It will be sent as a Mandatory Directive to force a re-analysis.
            </p>
          </div>
          <textarea
            value={directive}
            onChange={e => setDirective(e.target.value)}
            placeholder="e.g., 'The bot switched from images to text incorrectly. Investigate why.'"
            className="w-full bg-[var(--bone-6)] focus:border-[var(--bone-20)] rounded-lg p-3 text-xs text-foreground resize-none h-20 font-sans outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => sendToAnalysis(directive)}
              disabled={running || !directive.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background rounded-lg text-xs font-medium hover:opacity-80 disabled:opacity-50">
              ▶ RE-ANALYZE WITH CONTEXT
            </button>
            <button onClick={() => setDirective('')} className="px-3 py-1.5 bg-[var(--bone-10)] text-bone-70 hover:text-foreground hover:bg-[var(--bone-15)] rounded-lg text-xs font-medium transition-all">
              CLEAR
            </button>
          </div>
        </div>
      )}

      {/* Table Style messages list */}
      <div className="bg-panel rounded-[16px] overflow-hidden border border-[var(--bone-12)] animate-in fade-in duration-500">
        {/* Header */}
        <div className="grid grid-cols-[28px_90px_32px_120px_1fr_1fr_140px_64px_48px_28px] gap-3 px-4 py-2.5 border-b border-[var(--bone-6)] bg-[var(--bone-6)]">
          <button
            onClick={toggleSelectAll}
            className={cn(
              'w-4 h-4 rounded-[3px] border flex items-center justify-center transition-all self-center',
              selected.size === filtered.length && filtered.length > 0
                ? 'bg-accent border-accent'
                : 'border-white/20 hover:border-white/40'
            )}
          >
            {selected.size === filtered.length && filtered.length > 0 && (
              <CheckCircle2 className="w-2.5 h-2.5 text-background" />
            )}
          </button>
          {[
            { id: 'time', label: 'Time' },
            { id: 'fb', label: '' },
            { id: 'user', label: 'User' },
            { id: 'prompt', label: 'Prompt' },
            { id: 'response', label: 'Response' },
            { id: 'routing', label: 'Routing' },
            { id: 'type', label: 'Type' },
            { id: 'status', label: 'Status' },
            { id: 'chevron', label: 'Done' }
          ].map(h => (
            <span key={h.id} className="text-[9px] font-bold uppercase tracking-[0.12em] text-bone-70 opacity-30">{h.label}</span>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-[var(--bone-6)]">
          {filtered.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-12">No feedback yet.</p>
          )}
          {filtered.map(log => {
            const isExpanded = expanded.has(log.id)
            const isSelected = selected.has(log.id)
            const routeParts = log.model_chain ? log.model_chain.split(' → ') : []
            const chain = parseChain(log.model_chain)
            const usageCfg = USAGE_TYPE_CONFIG[log.usage_type || '']

            return (
              <div key={log.id}>
                <div className="w-full grid grid-cols-[28px_90px_32px_120px_1fr_1fr_140px_64px_48px_28px] gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group">
                  {/* Checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(log.id) }}
                    className={cn(
                      'w-4 h-4 rounded-[3px] border flex items-center justify-center transition-all self-center shrink-0 cursor-pointer',
                      isSelected
                        ? 'bg-accent border-accent'
                        : 'border-white/10 hover:border-white/30 opacity-0 group-hover:opacity-100'
                    )}
                  >
                    {isSelected && <CheckCircle2 className="w-2.5 h-2.5 text-background" />}
                  </button>

                  <div
                    onClick={(e) => toggleExpand(log.id, e)}
                    className="contents text-left cursor-pointer"
                  >
                    {/* Time */}
                    <span className="text-[10px] text-bone-70 opacity-40 font-mono truncate self-center">
                      {formatTime(log.created_at)}
                    </span>

                    {/* Feedback Icon Only */}
                    <div className="flex items-center gap-1.5 self-center min-w-0">
                      {log.feedback === 'like' ? (
                        <ThumbsUp className="w-3.5 h-3.5 text-green-400 opacity-80 shrink-0" strokeWidth={2} />
                      ) : (
                        <ThumbsDown className="w-3.5 h-3.5 text-red-400 opacity-80 shrink-0" strokeWidth={2} />
                      )}
                    </div>

                    {/* User */}
                    <div className="flex items-center gap-1.5 self-center min-w-0">
                      <span className="text-[9px] font-mono text-bone-70 opacity-50 truncate" title={log.user_email || log.auth_user_id || String(log.telegram_id) || '—'}>
                        {log.user_email
                          ? log.user_email
                          : log.telegram_id
                            ? `tg:${log.telegram_id}`
                            : log.auth_user_id
                              ? log.auth_user_id.slice(0, 8)
                              : '—'
                        }
                      </span>
                    </div>

                    {/* Prompt */}
                    <span className="text-[11px] text-bone-70 opacity-60 self-center truncate">
                      {truncate(log.user_prompt || log.message_content)}
                    </span>

                    {/* Response */}
                    <span className={cn(
                      "text-[11px] text-bone-70 self-center truncate transition-colors",
                      isExpanded ? 'text-bone-100' : 'group-hover:text-bone-80'
                    )}>
                      {truncate(log.model_response)}
                    </span>

                    {/* Routing chain */}
                    <div className="self-center min-w-0">
                      {chain ? (
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={cn(
                            "text-[8px] font-mono truncate shrink-0 max-w-[72px]",
                            chain.classifier === 'keyword' || chain.classifier === 'fallback'
                              ? 'text-accent/50'
                              : 'text-bone-70 opacity-35'
                          )} title={chain.classifier}>
                            {chain.classifier || '?'}
                          </span>
                          <ArrowRight className="w-2.5 h-2.5 text-bone-70 opacity-20 shrink-0" />
                          <span className="text-[8px] font-mono text-bone-70 opacity-70 truncate" title={chain.routed}>
                            {chain.routed}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[9px] text-bone-70 opacity-30 font-mono">No routing</span>
                      )}
                    </div>

                    {/* Type/Usage type */}
                    <div className="self-center">
                      {usageCfg ? (
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded-full border",
                          usageCfg.color
                        )}>
                          {USAGE_ICONS[log.usage_type || '']}
                          {usageCfg.label}
                        </span>
                      ) : (
                        <span className="text-[9px] text-bone-70 opacity-20">—</span>
                      )}
                    </div>

                    {/* Status */}
                    <div className="self-center flex items-center justify-center">
                      {log.status === 'success' || log.status === 'done' || log.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400/70" />
                      ) : log.status === 'error' || log.status === 'failed' ? (
                        <XCircle className="w-4 h-4 text-red-400/70" />
                      ) : (
                        <span className="text-[9px] font-mono text-bone-70 opacity-40 capitalize">{log.status || '—'}</span>
                      )}
                    </div>

                    {/* Lock / Done Checkbox */}
                    <div className="self-center flex justify-end">
                      <button
                        onClick={(e) => handleToggleLock(log.id, !!log.is_locked, e)}
                        className={cn(
                          'w-4 h-4 rounded-[3px] border flex items-center justify-center transition-all self-center shrink-0 cursor-pointer',
                          log.is_locked
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                            : 'border-white/10 hover:border-white/30'
                        )}
                      >
                        {log.is_locked && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expansion panel */}
                <div
                  className={cn(
                    "grid transition-all duration-100 ease-out",
                    isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="px-4 py-3 bg-panel border-t border-[var(--bone-6)]">
                      <div className="mt-2 space-y-4 cursor-default" onClick={e => e.stopPropagation()}>
                        {/* USER DETAILS */}
                        <div className="flex flex-wrap gap-4 text-[10px] text-bone-70 opacity-40 font-mono select-text bg-white/[0.02] border border-[var(--bone-6)] rounded-[16px] px-3 py-1.5">
                          {log.user_email && <span>Email: {log.user_email}</span>}
                          {log.telegram_id && <span>Telegram ID: {log.telegram_id}</span>}
                          {log.auth_user_id && <span>Auth User ID: {log.auth_user_id}</span>}
                        </div>

                        {/* Routing & Keys Trace */}
                        {log.context_messages && (
                          <div className="space-y-3">
                            {/* ROUTE CHAIN */}
                            <div>
                              <h5 className="text-[10px] font-bold text-bone-70 uppercase tracking-widest mb-2">
                                ROUTING CHAIN
                              </h5>
                              <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
                                {routeParts.length > 0 ? (
                                  routeParts.map((part, i) => {
                                    const [model, key, successStr] = part.split('|')
                                    const success = successStr !== 'false'
                                    const isAction = model.toUpperCase().includes('_') || !model.includes('/')

                                    return (
                                      <React.Fragment key={i}>
                                        <div className="flex flex-col items-center">
                                          <span className={cn(
                                            "px-2 py-0.5 rounded-small h-[22px] flex items-center justify-center border text-[10px] transition-all",
                                            success
                                              ? (isAction ? "bg-white/[0.03] border-white/5 text-muted-foreground/60" : "bg-white/[0.05] border-white/10 text-bone-100")
                                              : "bg-red-500/10 border-red-500/20 text-red-400 font-bold"
                                          )} title={key ? `Used key: ${key}` : model}>
                                            {model}
                                            {!success && <XCircle className="w-2.5 h-2.5 ml-1.5 opacity-80" />}
                                          </span>
                                        </div>
                                        {i < routeParts.length - 1 && (
                                          <span className="text-bone-70 opacity-20">→</span>
                                        )}
                                      </React.Fragment>
                                    )
                                  })
                                ) : (
                                  <p className="text-[10px] text-bone-20 font-mono">No routing chain found</p>
                                )}
                              </div>
                            </div>

                            {/* API KEYS USED */}
                            <div>
                              <h5 className="text-[10px] font-bold text-bone-70 uppercase tracking-widest mb-2">
                                API KEYS USED
                              </h5>
                              <div className="space-y-2">
                                {/* Classify Row */}
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-bone-70 w-16 shrink-0">classify</span>
                                  <div className="flex flex-wrap gap-1">
                                    {log.context_messages.classify?.map((c, i) => {
                                      const getProviderFromModelId = (modelId: string): string => {
                                        const m = (modelId || '').toLowerCase()
                                        if (m.includes('gemini') || m.includes('gemma')) return 'GEMINI'
                                        if (m.includes('llama') || m.includes('mixtral') || m.includes('gemma-2-9b') || m.includes('deepseek')) return 'GROQ'
                                        if (m.includes('flux') || m.includes('sd-') || m.includes('stable-diffusion') || m.includes('pollinations')) return 'POLLINATIONS'
                                        if (m.includes('huggingface') || m.includes('hf')) return 'HUGGINGFACE'
                                        if (m.includes('cf') || m.includes('cloudflare')) return 'CLOUDFLARE'
                                        if (m.includes('tavily') || m.includes('search')) return 'TAVILY'
                                        if (m.includes('exa')) return 'EXA'
                                        return 'GEMINI'
                                      }
                                      return (
                                        <span key={i} className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded-small h-[22px] flex items-center justify-center gap-1 border",
                                          c.success ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                                        )}>
                                          {(() => {
                                            let baseKey = c.key === 'DEFAULT' ? getProviderFromModelId((c as any).model || '') : (c.key || getProviderFromModelId((c as any).model || ''))
                                            if (!/\d+$/.test(baseKey)) baseKey = `${baseKey} 1`
                                            return baseKey
                                          })()} {c.success ? '✓' : '✗'}
                                        </span>
                                      )
                                    }) || <span className="text-[10px] text-bone-20 font-mono">No trace</span>}
                                  </div>
                                </div>

                                {/* Routing Row */}
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-bone-70 w-16 shrink-0">routing</span>
                                  <div className="flex flex-wrap gap-1">
                                    {log.context_messages.routing?.map((r, i) => {
                                      const getProviderFromModelId = (modelId: string): string => {
                                        const m = (modelId || '').toLowerCase()
                                        if (m.includes('gemini') || m.includes('gemma')) return 'GEMINI'
                                        if (m.includes('llama') || m.includes('mixtral') || m.includes('gemma-2-9b') || m.includes('deepseek')) return 'GROQ'
                                        if (m.includes('flux') || m.includes('sd-') || m.includes('stable-diffusion') || m.includes('pollinations')) return 'POLLINATIONS'
                                        if (m.includes('huggingface') || m.includes('hf')) return 'HUGGINGFACE'
                                        if (m.includes('cf') || m.includes('cloudflare')) return 'CLOUDFLARE'
                                        if (m.includes('tavily')) return 'TAVILY'
                                        if (m.includes('exa')) return 'EXA'
                                        return 'GEMINI'
                                      }
                                      return (
                                        <span key={i} className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded-small h-[22px] flex items-center justify-center gap-1 border",
                                          r.success ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                                        )}>
                                          {(() => {
                                            let baseKey = r.key === 'DEFAULT' ? getProviderFromModelId((r as any).model || '') : (r.key || getProviderFromModelId((r as any).model || ''))
                                            if (!/\d+$/.test(baseKey)) baseKey = `${baseKey} 1`
                                            return baseKey
                                          })()} {r.success ? '✓' : '✗'}
                                        </span>
                                      )
                                    }) || <span className="text-[10px] text-bone-20 font-mono">No trace</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Conversation history */}
                        {log.context_messages?.history && (
                          <div className="bg-white/[0.02] border border-[var(--bone-6)] rounded-[16px] p-3">
                            <h5 className="text-[10px] font-bold text-bone-70 uppercase tracking-widest mb-2 opacity-50">
                              PRIOR CONTEXT (CONVERSATION HISTORY - MAX 10)
                            </h5>
                            <div className="font-mono text-[10px] leading-relaxed max-h-32 overflow-y-auto space-y-1.5 select-text">
                              {log.context_messages.history.map((turn, i) => (
                                <div key={i} className="flex gap-2">
                                  <span className={cn("font-bold min-w-[20px] shrink-0",
                                    turn.role === 'user' ? "text-bone-70" : "text-green-500/80"
                                  )}>
                                    {turn.role === 'user' ? 'U:' : 'A:'}
                                  </span>
                                  <span className="text-bone-30 break-words flex-1">
                                    {turn.content}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* USER REQUEST vs MODEL RESPONSE side-by-side */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white/[0.02] border border-[var(--bone-6)] rounded-[16px] px-3 py-1.5">
                            <h5 className="text-[10px] font-bold text-bone-70 uppercase tracking-widest mb-1.5 opacity-50">
                              USER REQUEST
                            </h5>
                            <p className="text-xs text-foreground/80 font-mono break-words leading-relaxed select-text">
                              {log.user_prompt ?? '(content unavailable)'}
                            </p>
                          </div>
                          <div className="bg-white/[0.02] border border-[var(--bone-6)] rounded-[16px] px-3 py-1.5">
                            <h5 className="text-[10px] font-bold text-bone-70 uppercase tracking-widest mb-1.5 opacity-50">
                              MODEL RESPONSE
                            </h5>
                            <p className="text-xs text-foreground/80 font-sans break-words leading-relaxed select-text">
                              {log.model_response ?? '(response unavailable)'}
                            </p>
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
    </div>
  )
}
