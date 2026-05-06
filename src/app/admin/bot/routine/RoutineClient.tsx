'use client'

import { useState, useRef, useTransition, useEffect } from 'react'
import { Play, Check, X, Edit2, Trash2, ChevronDown, ChevronUp, Calendar, MessageSquare, Compass, RefreshCw, Square, CheckSquare } from 'lucide-react'
import { acceptPlan, rejectPlan, submitPlanEdit, deletePlan, getLatestPlans, deletePlans } from './planActions'
import type { ImprovementPlan } from './planActions'
import { cn } from '@/lib/utils'

interface Props { initialPlans: ImprovementPlan[] }

const SOURCE_CONFIG = {
  'feedback analysis': {
    label: 'Feedback Analysis',
    desc: 'Plan was generated from feedback logs.',
    icon: MessageSquare,
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
    border: 'border-indigo-400/20'
  },
  'routine run': {
    label: 'Routine Run',
    desc: 'Plan was generated from routine scans.',
    icon: Calendar,
    color: 'text-pink-400',
    bg: 'bg-pink-400/10',
    border: 'border-pink-400/20'
  }
}

const TRIGGER_CONFIG = {
  manual: {
    label: 'Manual',
    desc: 'Analysis was triggered manually by an admin.',
    icon: Compass,
    color: 'text-teal-400',
    bg: 'bg-teal-400/10',
    border: 'border-teal-400/20'
  },
  auto: {
    label: 'Auto',
    desc: 'Analysis was automatically scheduled and run.',
    icon: RefreshCw,
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    border: 'border-cyan-400/20'
  }
}

export default function RoutineClient({ initialPlans }: Props) {
  const [plans, setPlans] = useState<ImprovementPlan[]>(initialPlans)
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({})
  const [logLines, setLogLines] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState('')
  const [autoRun, setAutoRun] = useState('Manual only')
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [planFilter, setPlanFilter] = useState('All')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchOnMount() {
      const fresh = await getLatestPlans()
      if (fresh && fresh.length > 0) {
        setPlans(fresh)
      }
    }
    fetchOnMount()
  }, [])

  useEffect(() => {
    if (autoRun === 'Manual only') {
      setTimeLeft(null)
      return
    }
    
    let hours = 0;
    if (autoRun === 'Every 6 hours') hours = 6;
    else if (autoRun === 'Every 12 hours') hours = 12;
    else if (autoRun === 'Every 24 hours') hours = 24;
    else if (autoRun === 'Every 3 days') hours = 72;
    else if (autoRun === 'Every week') hours = 168;
    
    setTimeLeft(hours * 3600 - 1); 
    
    const interval = setInterval(() => {
      setTimeLeft(prev => prev !== null && prev > 0 ? prev - 1 : 0)
    }, 1000)
    
    return () => clearInterval(interval)
  }, [autoRun])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    
    if (h > 48) {
      const d = Math.floor(h / 24)
      return `${d}d ${h % 24}h ${m}m`
    }
    
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  async function runAnalysis() {
    setRunning(true)
    setLogLines([])
    setPlans([])

    const res = await fetch('/api/ai/brain/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
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
            setLogLines(prev => {
              const next = [...prev, msg.line]
              setTimeout(() => logRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50)
              return next
            })
          } else if (msg.type === 'complete') {
            setPlans(msg.plans ?? [])
          }
        } catch { /**/ }
      }
    }
    setRunning(false)
  }

  function handleAccept(plan: ImprovementPlan) {
    startTransition(async () => {
      await acceptPlan(plan)
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, status: 'accepted' } : p))
    })
  }

  function handleReject(plan: ImprovementPlan) {
    startTransition(async () => {
      await rejectPlan(plan.id, plan.title)
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, status: 'rejected' } : p))
    })
  }

  function handleDelete(plan: ImprovementPlan) {
    startTransition(async () => {
      await deletePlan(plan.id, plan.title)
      setPlans(prev => prev.filter(p => p.id !== plan.id))
    })
  }

  async function handleEditSubmit(plan: ImprovementPlan) {
    startTransition(async () => {
      const updated = await submitPlanEdit(plan.id, editNote)
      setPlans(prev => prev.map(p => p.id === plan.id ? updated : p))
      setEditingId(null)
      setEditNote('')
    })
  }

  function toggleSelectAll(filteredPlans: ImprovementPlan[]) {
    if (selectedIds.size === filteredPlans.length && filteredPlans.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredPlans.map(p => p.id)))
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleBulkDelete() {
    if (!selectedIds.size) return
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} plans permanently?`)) return
    
    startTransition(async () => {
      await deletePlans(Array.from(selectedIds))
      setPlans(prev => prev.filter(p => !selectedIds.has(p.id)))
      setSelectedIds(new Set())
    })
  }

  const statusColors: Record<string, string> = {
    pending: 'text-yellow-400 bg-yellow-400/10',
    accepted: 'text-green-400 bg-green-400/10',
    rejected: 'text-red-400 bg-red-400/10',
    edited: 'text-blue-400 bg-blue-400/10',
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display text-foreground mb-1">Routine</h1>
        <p className="text-muted-foreground text-sm font-medium">
          Run analysis sessions to find improvement patterns and generate plans.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-[var(--bone-6)] rounded-xl p-4 flex flex-col gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={runAnalysis}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {running ? 'Running…' : 'Run Now'}
          </button>
          
          <div className="w-px h-6 bg-[var(--bone-10)]" />
          
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground/60" />
            <span className="text-sm font-medium text-muted-foreground/80 mr-2">Auto-run:</span>
            <div className="flex items-center">
              {['Manual only', 'Every 6 hours', 'Every 12 hours', 'Every 24 hours', 'Every 3 days', 'Every week'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setAutoRun(opt)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-all rounded-md",
                    autoRun === opt 
                      ? "bg-foreground text-background" 
                      : "bg-transparent text-muted-foreground hover:bg-[var(--bone-6)]"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-4 shrink-0 select-none">
            {autoRun !== 'Manual only' && timeLeft !== null && (
              <div className="flex flex-col items-end leading-tight">
                <span className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-widest mb-0.5 leading-none">Next run in</span>
                <span className="text-lg font-mono text-foreground font-medium leading-none">
                  {formatTime(timeLeft)}
                </span>
              </div>
            )}
            {running && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400 font-medium select-none leading-none">LIVE</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plan Origin & Trigger Legend */}
      <div className="bg-panel rounded-xl px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-1.5">
        <h4 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest select-none">Legend:</h4>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {Object.entries({ ...SOURCE_CONFIG, ...TRIGGER_CONFIG }).map(([key, config]) => {
            const Icon = config.icon
            return (
              <div key={key} className="flex items-center gap-2 select-none">
                <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full border border-opacity-20 shrink-0", config.bg, config.border)}>
                  <Icon className={cn("w-2.5 h-2.5", config.color)} />
                  <span className={cn("text-[10px] font-semibold", config.color)}>{config.label}</span>
                </div>
                <span className="text-[11px] text-muted-foreground/80 leading-tight">{config.desc}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Terminal log */}
      {(running || logLines.length > 0) && (
        <div className="bg-[#0a0d14] border border-[var(--bone-10)] rounded-xl p-4">
          <div
            ref={logRef}
            className="font-mono text-xs leading-6 space-y-0.5 max-h-64 overflow-y-auto custom-scrollbar"
          >
            {logLines.map((line, i) => {
              const color = line.startsWith('✓') ? 'text-green-400'
                : line.startsWith('✗') ? 'text-red-400'
                : line.startsWith('⟳') ? 'text-blue-400'
                : line.startsWith('$') ? 'text-green-300'
                : 'text-[var(--bone-40)]'
              return <div key={i} className={color}>{line}</div>
            })}
            {running && <div className="text-[var(--bone-40)]">▌</div>}
          </div>
        </div>
      )}

      {/* Plan cards */}
      {plans.length > 0 && (() => {
        const filteredPlans = plans.filter(p => planFilter === 'All' ? true : p.status === planFilter.toLowerCase())
        
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => toggleSelectAll(filteredPlans)}
                  className="p-1 hover:bg-[var(--bone-10)] rounded transition-colors text-muted-foreground"
                >
                  {selectedIds.size > 0 && selectedIds.size === filteredPlans.length 
                    ? <CheckSquare className="w-4 h-4 text-accent" /> 
                    : <Square className="w-4 h-4" />
                  }
                </button>
                <h3 className="text-sm font-semibold text-foreground">{filteredPlans.length} plans generated</h3>
                
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200 ml-2">
                    <div className="w-px h-4 bg-[var(--bone-20)] mx-1" />
                    <span className="text-xs font-bold text-accent">{selectedIds.size} selected</span>
                    <button
                      onClick={handleBulkDelete}
                      disabled={isPending}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" /> Delete Selected
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {['All', 'Pending', 'Accepted', 'Rejected'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setPlanFilter(opt)}
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-bold transition-all rounded-md uppercase tracking-wider",
                      planFilter === opt 
                        ? "bg-[var(--bone-10)] text-foreground" 
                        : "bg-transparent text-muted-foreground hover:bg-[var(--bone-6)] hover:text-foreground/80"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            
            {filteredPlans.map(plan => {
            const isExpanded = expandedId === plan.id
            const isEditing = editingId === plan.id

            function parsePlanField(planField: string) {
              try {
                const parsed = JSON.parse(planField)
                if (parsed && typeof parsed === 'object' && 'final_prompt' in parsed) {
                  return {
                    mode: parsed.mode || 'new',
                    entryId: parsed.entry_id,
                    existingContent: parsed.existing_content,
                    finalPrompt: parsed.final_prompt,
                    isJson: true
                  }
                }
              } catch (err) {}
              return {
                mode: 'new',
                entryId: undefined,
                existingContent: undefined,
                finalPrompt: planField,
                isJson: false
              }
            }

            const parsedPlan = parsePlanField(plan.plan)
            const overrideCategory = selectedCategories[plan.id] || plan.topic || 'rules'

            function handleAcceptWithOverride(p: ImprovementPlan) {
              const cat = selectedCategories[p.id] || p.topic || 'rules'
              startTransition(async () => {
                await acceptPlan(p, cat)
                setPlans(prev => prev.map(item => item.id === p.id ? { ...item, status: 'accepted' } : item))
              })
            }

            return (
              <div key={plan.id} className="bg-[var(--bone-6)] rounded-xl overflow-hidden">
                {/* Card header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[var(--bone-8)]"
                >
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleSelectOne(plan.id) }}
                    className="p-1 hover:bg-[var(--bone-10)] rounded transition-colors text-muted-foreground shrink-0"
                  >
                    {selectedIds.has(plan.id) 
                      ? <CheckSquare className="w-4 h-4 text-accent" /> 
                      : <Square className="w-4 h-4" />
                    }
                  </button>

                  <div className="flex-1 min-w-0" onClick={() => setExpandedId(isExpanded ? null : plan.id)}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-foreground truncate">{plan.title}</span>
                      <span className="text-[10px] text-muted-foreground opacity-50 shrink-0 font-mono">
                        {new Date(plan.created_at).toLocaleDateString()} {new Date(plan.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bone-10)] text-muted-foreground shrink-0">{plan.topic}</span>
                      
                      {(() => {
                        const sourceKey = (plan.source || 'routine run').toLowerCase() as keyof typeof SOURCE_CONFIG
                        const sourceConfig = SOURCE_CONFIG[sourceKey] || SOURCE_CONFIG['routine run']
                        const SourceIcon = sourceConfig.icon

                        const triggerKey = (plan.trigger || 'manual').toLowerCase() as keyof typeof TRIGGER_CONFIG
                        const triggerConfig = TRIGGER_CONFIG[triggerKey] || TRIGGER_CONFIG['manual']
                        const TriggerIcon = triggerConfig.icon

                        return (
                          <div className="flex items-center gap-1.5 shrink-0 select-none">
                            <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded-full border", sourceConfig.bg, sourceConfig.border)}>
                              <SourceIcon className={cn("w-2.5 h-2.5", sourceConfig.color)} />
                              <span className={cn("text-[9px] font-bold uppercase tracking-wider", sourceConfig.color)}>{sourceConfig.label}</span>
                            </div>
                            <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded-full border", triggerConfig.bg, triggerConfig.border)}>
                              <TriggerIcon className={cn("w-2.5 h-2.5", triggerConfig.color)} />
                              <span className={cn("text-[9px] font-bold uppercase tracking-wider", triggerConfig.color)}>{triggerConfig.label}</span>
                            </div>
                          </div>
                        )
                      })()}

                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0", statusColors[plan.status])}>
                        {plan.status}
                      </span>
                      {plan.status === 'edited' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-400/10 text-blue-400 font-medium shrink-0">✎ Revised</span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-[var(--bone-10)]">
                    <div className="pt-3">
                      <p className="text-xs text-muted-foreground font-medium mb-1">Reasoning</p>
                      <p className="text-sm text-foreground/80 leading-relaxed">{plan.reasoning}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">State / Mode</p>
                      <span className={cn("text-xs font-semibold px-2 py-1 rounded inline-block", parsedPlan.mode === 'update' ? 'bg-blue-400/10 text-blue-400' : 'bg-green-400/10 text-green-400')}>
                        {parsedPlan.mode === 'update' ? 'Update existing entry' : 'Create new entry'}
                      </span>
                    </div>

                    {parsedPlan.mode === 'update' && parsedPlan.existingContent && (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Existing entry content</p>
                        <p className="text-sm text-foreground/70 bg-[var(--bone-8)] p-2 rounded leading-relaxed border border-[var(--bone-10)]">{parsedPlan.existingContent}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">Final prompt / New content after update</p>
                      <p className="text-sm text-foreground bg-[var(--bone-8)] p-2 rounded font-mono leading-relaxed border border-[var(--bone-10)]">{parsedPlan.finalPrompt}</p>
                    </div>

                    <div className="flex items-center gap-2 py-1">
                      <span className="text-xs text-muted-foreground font-medium shrink-0">Target Brain Category:</span>
                      <select
                        value={overrideCategory}
                        onChange={e => setSelectedCategories(prev => ({ ...prev, [plan.id]: e.target.value }))}
                        className="bg-background border border-[var(--bone-10)] rounded px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--bone-30)] font-medium"
                      >
                        {['rules', 'tone', 'personality', 'facts', 'red_flags'].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Edit note display */}
                    {plan.edit_notes && (
                      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                        <p className="text-xs text-blue-400 font-medium mb-0.5">Your edit note</p>
                        <p className="text-xs text-foreground/70">{plan.edit_notes}</p>
                      </div>
                    )}

                    {/* Edit input */}
                    {isEditing && (
                      <div className="space-y-2">
                        <textarea
                          value={editNote}
                          onChange={e => setEditNote(e.target.value)}
                          placeholder="Describe what to change or do differently…"
                          rows={2}
                          className="w-full bg-background border border-[var(--bone-10)] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[var(--bone-30)]"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditSubmit(plan)}
                            disabled={isPending || !editNote.trim()}
                            className="px-3 py-1.5 bg-foreground text-background rounded-lg text-xs font-medium hover:opacity-80 disabled:opacity-50"
                          >
                            {isPending ? 'Rewriting…' : 'Submit revision'}
                          </button>
                          <button onClick={() => { setEditingId(null); setEditNote('') }} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {plan.status === 'pending' || plan.status === 'edited' ? (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleAcceptWithOverride(plan)}
                          disabled={isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-xs font-medium hover:bg-green-500/20 transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" /> Accept
                        </button>
                        <button
                          onClick={() => handleReject(plan)}
                          disabled={isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                          <X className="w-3 h-3" /> Reject
                        </button>
                        {!isEditing && (
                          <button
                            onClick={() => { setEditingId(plan.id); setEditNote('') }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bone-10)] text-muted-foreground border border-[var(--bone-10)] rounded-lg text-xs font-medium hover:text-foreground transition-colors"
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                        )}
                        <button
                          onClick={() => handleReject(plan)}
                          className="ml-auto flex items-center gap-1 px-2 py-1.5 text-muted-foreground hover:text-red-400 text-xs transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pt-1 w-full">
                        <span className={cn("text-xs font-medium", statusColors[plan.status])}>
                          {plan.status === 'accepted' ? '✓ Applied to brain' : '✗ Rejected'}
                        </span>
                        {plan.status === 'rejected' && (
                          <button
                            onClick={() => handleDelete(plan)}
                            disabled={isPending}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" /> Delete completely
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
      })()}
    </div>
  )
}
