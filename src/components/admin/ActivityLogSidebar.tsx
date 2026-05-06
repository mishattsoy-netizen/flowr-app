'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { ClipboardList, RefreshCw, Settings, Brain, RotateCcw, Check, X, Edit2, Cpu, Zap, Users, Trash2, Key } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface ActivityLog {
  id: string
  action_type: string
  description: string
  details: Record<string, unknown> | null
  created_at: string
}

const ACTION_ICONS: Record<string, { icon: any; color: string }> = {
  settings_saved:      { icon: Settings,     color: 'text-purple-400' },
  brain_entry_added:   { icon: Brain,        color: 'text-violet-400' },
  brain_entry_deleted: { icon: Trash2,       color: 'text-red-400' },
  plan_accepted:       { icon: Check,        color: 'text-green-400' },
  plan_rejected:       { icon: X,            color: 'text-red-400' },
  plan_edited:         { icon: Edit2,        color: 'text-blue-400' },
  routine_ran:         { icon: RotateCcw,    color: 'text-blue-400' },
  prompt_synced:       { icon: RefreshCw,    color: 'text-cyan-400' },
  router_changed:      { icon: Cpu,          color: 'text-blue-400' },
  preset_changed:      { icon: Zap,          color: 'text-yellow-400' },
  user_blocked:        { icon: Users,        color: 'text-orange-400' },
  user_unblocked:      { icon: Users,        color: 'text-green-400' },
  logs_purged:         { icon: Trash2,       color: 'text-red-400' },
  vault_updated:       { icon: Key,          color: 'text-yellow-400' },
}

const DEFAULT_ICON = { icon: ClipboardList, color: 'text-muted-foreground' }

interface Props { defaultOpen?: boolean }

export default function ActivityLogSidebar({ defaultOpen = false }: Props) {
  const pathname = usePathname()
  if (pathname === '/admin/bot/brain' || pathname === '/admin/roadmap') return null

  const [open, setOpen] = useState(defaultOpen)
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const fetchLogs = useCallback(async (reset = false) => {
    setLoading(true)
    const off = reset ? 0 : offset
    const res = await fetch(`/api/admin/activity-log?offset=${off}`)
    const data = await res.json()
    const newLogs: ActivityLog[] = data.logs ?? []
    setLogs(prev => reset ? newLogs : [...prev, ...newLogs])
    setOffset(off + newLogs.length)
    setHasMore(newLogs.length === 50)
    setLoading(false)
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
    if (open && logs.length === 0) fetchLogs(true)
  }, [open])

  return (
    <>
      <div className={cn(
        "flex-shrink-0 bg-sidebar transition-all duration-200 overflow-hidden h-full flex flex-col",
        open ? "w-64" : "w-10"
      )}>
        {/* Toggle button */}
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center justify-center h-12 w-full border-b border-border hover:bg-[var(--bone-6)] transition-colors shrink-0"
          title={open ? 'Collapse activity log' : 'Open activity log'}
        >
          {open ? (
            <div className="flex items-center gap-2 w-full px-3">
              <ClipboardList className="w-3.5 h-3.5 text-[var(--bone-60)] shrink-0" strokeWidth={2} />
              <span className="text-xs font-medium text-[var(--bone-60)] flex-1">Activity Log</span>
              <button
                onClick={e => { e.stopPropagation(); fetchLogs(true) }}
                className="p-0.5 rounded hover:text-foreground text-[var(--bone-40)]"
                title="Refresh logs"
              >
                <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} strokeWidth={2} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setShowClearConfirm(true) }}
                className="p-0.5 rounded hover:text-red-400 text-[var(--bone-40)] ml-1"
                title="Clear activity logs"
              >
                <Trash2 className="w-3 h-3" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <ClipboardList className="w-3.5 h-3.5 text-[var(--bone-40)]" strokeWidth={2} />
          )}
        </button>

        {/* Log list */}
        {open && (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {logs.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground text-center py-8 px-3">No activity yet.</p>
            )}
            {logs.map(log => {
              const { icon: Icon, color } = ACTION_ICONS[log.action_type] ?? DEFAULT_ICON
              return (
                <div key={log.id} className="flex gap-2.5 px-3 py-2.5 border-b border-[var(--bone-6)] hover:bg-[var(--bone-4)]">
                  <div className="mt-0.5 shrink-0">
                    <Icon className={cn("w-3 h-3", color)} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground/80 leading-snug break-words">{log.description}</p>
                    <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              )
            })}
            {hasMore && (
              <button
                onClick={() => fetchLogs(false)}
                disabled={loading}
                className="w-full py-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowClearConfirm(false)} />
          <div className="relative bg-[#1A1A1A] border border-white/5 rounded-big w-full max-w-sm mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <h3 className="text-xs font-semibold text-foreground">Clear Activity Log</h3>
              </div>
              <button onClick={() => setShowClearConfirm(false)} className="text-bone-60 hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="px-4 py-3">
              <p className="text-xs text-bone-60 leading-normal">
                Are you sure you want to clear all activity logs? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-white/5 bg-white/[0.01]">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 rounded border border-white/10 text-[10px] font-bold text-bone-60 hover:text-foreground transition-all uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowClearConfirm(false)
                  await handleClearLogs()
                }}
                className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold uppercase tracking-wider transition-all"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
