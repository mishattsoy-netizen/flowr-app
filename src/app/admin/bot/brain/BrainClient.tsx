'use client'

import { useState, useTransition, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, X, Send, Sparkles, Brain, Check, ArrowRight, ClipboardList, RefreshCw, Settings, RotateCcw, Cpu, Zap, Users, Key, Globe, Clock } from 'lucide-react'
import { addBrainEntry, deleteBrainEntry, toggleBrainEntry, updateBrainEntry } from './actions'
import type { BrainEntry, BrainCategory } from './actions'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

const CATEGORY_META: Record<BrainCategory, { label: string; color: string }> = {
  rules:       { label: 'Rules',       color: '#6366f1' },
  red_flags:   { label: 'Red Flags',   color: '#f87171' },
  tone:        { label: 'Tone',        color: '#4ade80' },
  personality: { label: 'Personality', color: '#a78bfa' },
  facts:       { label: 'Facts',       color: '#facc15' },
}

const CATEGORIES = Object.keys(CATEGORY_META) as BrainCategory[]

const ACTION_ICONS: Record<string, { icon: any; color: string }> = {
  settings_saved:      { icon: Settings,     color: 'text-purple-400' },
  brain_entry_added:   { icon: Brain,        color: 'text-violet-400' },
  brain_entry_deleted: { icon: Trash2,       color: 'text-red-400' },
  plan_accepted:       { icon: Check,        color: 'text-green-400' },
  plan_rejected:       { icon: X,            color: 'text-red-400' },
  plan_edited:         { icon: Sparkles,     color: 'text-blue-400' },
  routine_ran:         { icon: RotateCcw,    color: 'text-blue-400' },
  prompt_synced:       { icon: RefreshCw,    color: 'text-cyan-400' },
  router_changed:      { icon: Cpu,          color: 'text-blue-400' },
  preset_changed:      { icon: Zap,          color: 'text-yellow-400' },
  user_blocked:        { icon: Users,        color: 'text-orange-400' },
  user_unblocked:      { icon: Users,        color: 'text-green-400' },
  logs_purged:         { icon: Trash2,       color: 'text-red-400' },
  vault_updated:       { icon: Key,          color: 'text-yellow-400' },
}

const DEFAULT_ICON = { icon: ClipboardList, color: 'text-bone-70' }

interface Props { initialEntries: BrainEntry[] }

interface Message {
  role: 'user' | 'assistant'
  content: string
  actions?: {
    type: 'create' | 'update' | 'delete'
    entryId?: string
    category: BrainCategory
    title: string
    content: string
    applied?: boolean
  }[]
}

interface ActivityLog {
  id: string
  action_type: string
  description: string
  details: Record<string, unknown> | null
  created_at: string
}

export default function BrainClient({ initialEntries }: Props) {
  const [entries, setEntries] = useState<BrainEntry[]>(initialEntries)
  const [selected, setSelected] = useState<BrainCategory | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState<BrainCategory>('rules')
  const [isPending, startTransition] = useTransition()

  // Sidebar Layout
  const [sidebarWidth, setSidebarWidth] = useState(380)
  const [isResizing, setIsResizing] = useState(false)
  const isResizingRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const [activeTab, setActiveTab] = useState<'manager' | 'logs'>('manager')

  // Logs state
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Chat/Manager state
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your Brain AI Manager. I can help you analyze, merge, expand, or categorize your entries. Just ask me a question or pick a template below.'
    }
  ])
  const [isAiLoading, setIsAiLoading] = useState(false)

  const visibleEntries = selected ? entries.filter(e => e.category === selected) : entries

  const templates = [
    { label: 'Suggest merges', prompt: 'Analyze all entries and suggest any that can be merged or combined into one.' },
    { label: 'Better categorize', prompt: 'Look at my entries and suggest better categorization or sorting into correct groups.' },
    { label: 'Expand precise entries', prompt: 'Analyze entries and make them more precise or add missing context.' },
    { label: 'Find redundant entries', prompt: 'Are there any entries we can delete or remove because they are unnecessary?' },
  ]

  const fetchLogs = useCallback(async (reset = false) => {
    setLogsLoading(true)
    const off = reset ? 0 : offset
    try {
      const res = await fetch(`/api/admin/activity-log?offset=${off}`)
      const data = await res.json()
      const newLogs: ActivityLog[] = data.logs ?? []
      setLogs(prev => reset ? newLogs : [...prev, ...newLogs])
      setOffset(off + newLogs.length)
      setHasMore(newLogs.length === 50)
    } catch (err) {
      console.error(err)
    } finally {
      setLogsLoading(false)
    }
  }, [offset])

  const handleClearLogs = async () => {
    try {
      const res = await fetch('/api/admin/activity-log', { method: 'DELETE' })
      if (res.ok) {
        setLogs([])
        setOffset(0)
        setHasMore(false)
      }
    } catch (err) {
      console.error('Failed to clear logs:', err)
    }
  }

  useEffect(() => {
    if (activeTab === 'logs' && logs.length === 0) {
      fetchLogs(true)
    }
  }, [activeTab, fetchLogs, logs.length])

  // Mouse drag handles
  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true)
    isResizingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const newWidth = window.innerWidth - e.clientX
        if (newWidth >= 320 && newWidth <= 800) {
          setSidebarWidth(newWidth)
        }
      })
    }

    const handleMouseUp = () => {
      if (!isResizingRef.current) return
      setIsResizing(false)
      isResizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  async function handleChatSubmit(promptText: string) {
    const text = promptText.trim()
    if (!text) return

    setMessages(prev => [...prev, { role: 'user', content: text }])
    setChatInput('')
    setIsAiLoading(true)

    try {
      const res = await fetch('/api/ai/brain/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, entries })
      })
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.reasoning || 'I have analyzed the entries and recommended these actions:',
          actions: data.actions || []
        }
      ])
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}` }
      ])
    } finally {
      setIsAiLoading(false)
    }
  }

  function handleAdd() {
    if (!newTitle.trim() || !newContent.trim()) return
    startTransition(async () => {
      await addBrainEntry(newCategory, newTitle.trim(), newContent.trim())
      setEntries(prev => [{
        id: crypto.randomUUID(),
        category: newCategory,
        title: newTitle.trim(),
        content: newContent.trim(),
        source: 'manual',
        is_active: true,
        created_at: new Date().toISOString(),
      }, ...prev])
      setNewTitle('')
      setNewContent('')
      setShowAdd(false)
    })
  }

  function handleDelete(id: string, title: string) {
    startTransition(async () => {
      await deleteBrainEntry(id, title)
      setEntries(prev => prev.filter(e => e.id !== id))
    })
  }

  function handleToggle(id: string, current: boolean) {
    startTransition(async () => {
      await toggleBrainEntry(id, !current)
      setEntries(prev => prev.map(e => e.id === id ? { ...e, is_active: !current } : e))
    })
  }

  async function applyAction(msgIndex: number, actionIndex: number, action: any) {
    startTransition(async () => {
      if (action.type === 'create') {
        await addBrainEntry(action.category, action.title, action.content)
        setEntries(prev => [{
          id: crypto.randomUUID(),
          category: action.category,
          title: action.title,
          content: action.content,
          source: 'routine',
          is_active: true,
          created_at: new Date().toISOString()
        }, ...prev])
      } else if (action.type === 'update' && action.entryId) {
        await updateBrainEntry(action.entryId, action.category, action.title, action.content)
        setEntries(prev => prev.map(e => e.id === action.entryId ? {
          ...e,
          category: action.category,
          title: action.title,
          content: action.content
        } : e))
      } else if (action.type === 'delete' && action.entryId) {
        await deleteBrainEntry(action.entryId, action.title)
        setEntries(prev => prev.filter(e => e.id !== action.entryId))
      }

      // Mark the action as applied
      setMessages(prev => prev.map((m, mIdx) => {
        if (mIdx !== msgIndex || !m.actions) return m
        return {
          ...m,
          actions: m.actions.map((a, aIdx) => {
            if (aIdx !== actionIndex) return a
            return { ...a, applied: true }
          })
        }
      }))
    })
  }

  return (
    <div className="animate-in fade-in duration-500 relative">
      {/* MAIN CONTENT AREA */}
      <div 
        className="transition-all duration-300"
        style={{ paddingRight: sidebarWidth }}
      >
        <div className="max-w-[1200px] mx-auto px-8 py-5 pb-24">
          <div className="mb-6">
            <h1 className="text-4xl font-display font-medium text-foreground mb-1">
              Bot Brain
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Manage learned intelligence via AI Manager or manual controls.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-2 flex-wrap items-center">
              <button
                onClick={() => setSelected(null)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all',
                  !selected
                    ? 'bg-accent text-white shadow-md shadow-accent/20'
                    : 'bg-white/5 text-bone-70 hover:text-foreground hover:bg-white/10 border border-[var(--bone-6)]'
                )}
              >
                All ({entries.length})
              </button>
              {CATEGORIES.map(cat => {
                const meta = CATEGORY_META[cat]
                const count = entries.filter(e => e.category === cat).length
                const isSelected = selected === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setSelected(prev => prev === cat ? null : cat)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border',
                      isSelected
                        ? 'bg-white/10 text-foreground border-[var(--bone-15)] shadow-sm'
                        : 'bg-white/5 text-bone-70 hover:text-foreground hover:bg-white/10 border-[var(--bone-6)]'
                    )}
                  >
                    {meta.label} ({count})
                  </button>
                )
              })}

              <div className="flex-1" />

              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-md shadow-accent/20 active:scale-95"
              >
                <Plus className="w-3 h-3" /> Add Entry
              </button>
            </div>

            {showAdd && (
              <div className="bg-[var(--bone-6)] border border-[var(--bone-12)] rounded-xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-300 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-foreground tracking-tight">New Brain Entry</h3>
                  <button onClick={() => setShowAdd(false)}>
                    <X className="w-5 h-5 text-bone-70 hover:text-foreground transition-colors" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value as BrainCategory)}
                    className="bg-background border border-[var(--bone-6)] rounded-xl px-4 py-2 text-sm text-foreground focus:ring-1 focus:ring-accent/20 outline-none transition-all"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                    ))}
                  </select>
                  <input
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="Short title (e.g. Don't over-use bullets)"
                    className="md:col-span-3 bg-background border border-[var(--bone-6)] rounded-xl px-4 py-2 text-sm text-foreground placeholder:text-bone-70/30 focus:border-accent/50 outline-none transition-all"
                  />
                </div>
                <textarea
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  placeholder="Detailed content..."
                  rows={4}
                  className="w-full bg-background border border-[var(--bone-6)] rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-bone-70/30 resize-none focus:border-accent/50 outline-none transition-all leading-relaxed"
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowAdd(false)}
                    className="px-6 py-2 text-xs font-bold uppercase tracking-widest text-bone-70 hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={isPending || !newTitle.trim() || !newContent.trim()}
                    className="px-8 py-2 bg-foreground text-background rounded-xl text-xs font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-30 transition-all active:scale-95 shadow-xl"
                  >
                    {isPending ? 'Adding...' : 'Save Entry'}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {visibleEntries.length === 0 && !showAdd && (
                <div className="py-24 text-center bg-white/[0.02] border border-dashed border-white/5 rounded-2xl">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-4 opacity-40">
                    <Brain className="w-6 h-6 text-bone-70" />
                  </div>
                  <p className="text-bone-70 text-sm font-medium tracking-wide">No intelligence entries found in this category.</p>
                </div>
              )}
              {visibleEntries.map(entry => {
                const meta = CATEGORY_META[entry.category]
                return (
                  <div
                    key={entry.id}
                    className={cn(
                      'bg-[var(--bone-6)] border border-[var(--bone-12)] hover:border-white/10 rounded-xl p-4 flex gap-4 items-start group transition-all duration-300',
                      !entry.is_active && 'opacity-40'
                    )}
                  >
                    <div
                      className="w-1 self-stretch rounded-full flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
                      style={{ background: meta.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-foreground tracking-tight leading-none">{entry.title}</span>
                        <span
                          className="text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-widest"
                          style={{ background: meta.color + '15', color: meta.color, border: `1px solid ${meta.color}25` }}
                        >
                          {meta.label}
                        </span>
                        {!entry.is_active && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/5 text-bone-70 font-bold uppercase tracking-widest border border-[var(--bone-6)]">
                            disabled
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed font-medium">{entry.content}</p>
                      <div className="mt-4 flex items-center gap-4 text-[9px] font-bold text-bone-70/40 uppercase tracking-[0.15em]">
                        <span className="flex items-center gap-1.5"><Globe className="w-3 h-3" /> {entry.source.replace('_', ' ')}</span>
                        <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {new Date(entry.updated_at || entry.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <button
                        onClick={() => handleToggle(entry.id, entry.is_active)}
                        className={cn(
                          'w-8 h-8 flex items-center justify-center rounded-lg transition-all border',
                          entry.is_active
                            ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                            : 'bg-white/5 text-bone-70 border-white/10 hover:text-green-400 hover:border-green-500/20'
                        )}
                      >
                        <Zap className={cn("w-3.5 h-3.5", entry.is_active && "fill-current")} />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id, entry.title)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-[var(--bone-6)] text-bone-70 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR PANEL - FIXED DOCKED CHATBOT */}
      <div
        className="fixed top-0 right-0 bottom-0 bg-sidebar border-l border-[var(--bone-6)] flex flex-col overflow-hidden z-[100] group/sidebar"
        style={{ width: sidebarWidth }}
      >
        {/* Resize Handler - Synced with Shell.tsx */}
        <div
          onMouseDown={startResizing}
          className={cn(
            "w-2 h-full cursor-col-resize absolute left-0 top-0 z-[110] transition-colors group",
            isResizing ? "bg-[var(--bone-15)]" : "bg-transparent hover:bg-[var(--bone-6)]"
          )}
        >
          <div className={cn(
            "absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] transition-all duration-300",
            isResizing ? "bg-[var(--bone-70)] opacity-100" : "bg-[var(--bone-30)] opacity-0 group-hover:opacity-100"
          )} />
        </div>

        {/* Sidebar Header */}
        <div className="py-3 border-b border-[var(--bone-6)] flex items-center justify-between shrink-0 bg-sidebar px-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-[20px] font-semibold tracking-tight text-foreground leading-none" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                AI Manager
              </h1>
              <div className="w-1.5 h-1.5 rounded-full mt-1 bg-[#22C55E] shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
            </div>
            <p className="text-[10px] font-bold text-bone-70 tracking-[0.1em] uppercase mt-1 opacity-60">
              Brain Intelligence
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex p-0.5 bg-white/5 rounded-lg border border-[var(--bone-6)]">
              <button
                onClick={() => setActiveTab('manager')}
                className={cn(
                  'px-3.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all',
                  activeTab === 'manager' ? 'bg-white/10 text-foreground shadow-sm' : 'text-bone-70 hover:text-foreground'
                )}
              >
                Chat
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={cn(
                  'px-3.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all',
                  activeTab === 'logs' ? 'bg-white/10 text-foreground shadow-sm' : 'text-bone-70 hover:text-foreground'
                )}
              >
                Logs
              </button>
            </div>
            {activeTab === 'logs' && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-bone-70 hover:text-red-400 hover:bg-red-400/10 transition-all border border-transparent hover:border-red-400/20"
                title="Clear logs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Sidebar Content Area */}
        <div className="flex-1 overflow-hidden relative flex flex-col bg-sidebar">
          {activeTab === 'manager' && (
            <>
              <div className="flex-1 px-6 py-8 overflow-y-auto space-y-8 scrollbar-thin">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6">
                    <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-5 border border-accent/20 shadow-xl">
                      <Brain className="w-7 h-7 text-accent" />
                    </div>
                    <h3 className="text-base font-bold text-foreground mb-2 tracking-tight">Intelligence Manager</h3>
                    <p className="text-xs text-bone-70 leading-relaxed max-w-[220px] font-medium opacity-80">
                      I can help you analyze, merge, or refine your bot's learned behavior patterns.
                    </p>
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div key={idx} className={cn("flex flex-col group animate-in fade-in slide-in-from-bottom-2 duration-300", msg.role === 'user' ? "items-end" : "items-start")}>
                    <div className={cn("flex gap-3.5 w-full items-start", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                      {msg.role === 'assistant' && (
                        <div className="w-6 h-6 shrink-0 flex items-center justify-center mt-1 select-none">
                          <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30 shadow-[0_0_8px_rgba(var(--accent-rgb),0.2)]">
                            <Sparkles className="w-3 h-3 text-accent" />
                          </div>
                        </div>
                      )}
                      
                      <div className={cn(
                        "flex flex-col min-w-0",
                        msg.role === 'user' ? "items-end max-w-[88%]" : "items-start max-w-[92%] flex-1"
                      )}>
                        <div
                          className={cn(
                            "leading-relaxed font-medium text-sm tracking-wide",
                            msg.role === 'user' 
                              ? "px-4 py-3 bg-[var(--bone-6)] border border-[var(--bone-12)] text-foreground/95" 
                              : "px-0 py-1 text-foreground/95"
                          )}
                          style={msg.role === 'user' ? { borderRadius: '18px 18px 4px 18px' } : undefined}
                        >
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>

                        {msg.actions && msg.actions.length > 0 && (
                          <div className="mt-5 w-full space-y-4">
                            {msg.actions.map((action, aIdx) => {
                              const meta = CATEGORY_META[action.category] || { label: action.category, color: 'var(--bone-30)' }
                              return (
                                <div key={aIdx} className="bg-white/[0.04] border border-[var(--bone-12)] rounded-2xl p-5 flex flex-col gap-4 group/card hover:border-white/20 transition-all duration-300">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(var(--accent-rgb),0.6)]" style={{ background: meta.color }} />
                                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-bone-70 opacity-80">Suggested {meta.label}</span>
                                    </div>
                                    {action.applied && (
                                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-400 uppercase tracking-[0.2em]">
                                        <Check className="w-3.5 h-3.5" /> Applied
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <h4 className="text-[15px] font-bold text-foreground tracking-tight leading-snug">{action.title}</h4>
                                    <p className="text-[13px] text-bone-70/90 leading-relaxed font-medium line-clamp-4 opacity-90">{action.content}</p>
                                  </div>
                                  
                                  <div className="flex items-center justify-end pt-2">
                                    {!action.applied && (
                                      <button
                                        onClick={() => applyAction(idx, aIdx, action)}
                                        className="flex items-center gap-2 text-[11px] font-bold bg-accent text-white hover:opacity-95 px-5 py-2.5 rounded-xl transition-all shadow-xl shadow-accent/25 active:scale-95"
                                      >
                                        <Check className="w-3.5 h-3.5" /> Apply Intelligence
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {isAiLoading && (
                  <div className="flex items-center gap-4 px-0 py-2">
                    <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                       <div className="w-5 h-5 rounded-full bg-accent/15 flex items-center justify-center border border-accent/20">
                          <Sparkles className="w-3 h-3 text-accent animate-pulse" />
                       </div>
                    </div>
                    <span className="text-sm font-medium text-bone-70 animate-pulse tracking-wide italic opacity-70">AI is analyzing brain state...</span>
                  </div>
                )}
              </div>

              {/* Chat Input Area */}
              <div className="px-6 pb-8 pt-4 shrink-0 bg-sidebar border-t border-[var(--bone-6)] relative">
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-4">
                  {templates.map((t, idx) => (
                    <button
                      key={idx}
                      disabled={isAiLoading}
                      onClick={() => handleChatSubmit(t.prompt)}
                      className="text-[9.5px] px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-bone-70 hover:text-foreground border border-[var(--bone-6)] rounded-full font-bold uppercase tracking-[0.15em] transition-all select-none shrink-0"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="bg-white/[0.05] border border-[var(--bone-6)] rounded-[22px] p-2.5 flex items-center gap-2.5 focus-within:border-accent/40 transition-all">
                  <form
                    onSubmit={e => { e.preventDefault(); handleChatSubmit(chatInput) }}
                    className="flex-1 flex items-center gap-2.5"
                  >
                    <input
                      disabled={isAiLoading}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder="Ask the manager anything..."
                      className="flex-1 bg-transparent border-none px-4 py-2 text-sm text-foreground placeholder:text-bone-70/25 outline-none font-medium"
                    />
                    <button
                      disabled={isAiLoading || !chatInput.trim()}
                      type="submit"
                      className="w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 shadow-xl shadow-accent/40"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}

          {activeTab === 'logs' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-2">
              {logs.length === 0 && !logsLoading && (
                <div className="py-24 text-center">
                  <p className="text-[13px] text-bone-70 font-medium tracking-wide opacity-40 italic">Activity history is empty.</p>
                </div>
              )}
              <div className="space-y-2">
                {logs.map(log => {
                  const { icon: Icon, color } = ACTION_ICONS[log.action_type] ?? DEFAULT_ICON
                  return (
                    <div key={log.id} className="flex gap-4 p-4 rounded-2xl border border-[var(--bone-12)] bg-white/[0.02] group hover:border-white/10 transition-all duration-300 shadow-sm">
                      <div className="mt-0.5 shrink-0">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 shadow-inner transition-colors", color)}>
                          <Icon className="w-4.5 h-4.5" strokeWidth={2.5} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-foreground/90 leading-snug font-medium break-words tracking-tight">{log.description}</p>
                        <p className="text-[10px] text-bone-70/30 mt-2 font-bold uppercase tracking-[0.2em]">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {hasMore && (
                <button
                  onClick={() => fetchLogs(false)}
                  disabled={logsLoading}
                  className="w-full py-6 mt-2 text-[10px] font-bold text-bone-70 hover:text-foreground uppercase tracking-[0.25em] transition-all opacity-40 hover:opacity-100 active:scale-[0.98]"
                >
                  {logsLoading ? 'Loading archive...' : 'View Older Records'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setShowClearConfirm(false)} />
          <div className="relative bg-[#0F0F0F] border border-[var(--bone-12)] rounded-[24px] w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-[20px] bg-rose-500/10 flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
                <Trash2 className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2 tracking-tight">Clear Activity Logs?</h3>
              <p className="text-sm text-bone-70 leading-relaxed font-medium">
                This will permanently delete all recorded intelligence actions. This cannot be undone.
              </p>
            </div>
            
            <div className="flex items-center gap-3 p-8 pt-0">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3.5 rounded-2xl border border-white/10 text-xs font-bold text-bone-70 hover:text-foreground transition-all uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowClearConfirm(false)
                  await handleClearLogs()
                }}
                className="flex-1 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-xl shadow-rose-600/30 uppercase tracking-widest"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
