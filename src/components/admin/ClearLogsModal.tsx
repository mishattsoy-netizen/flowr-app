'use client'

import React, { useState, useTransition } from 'react'
import { Trash2, X, AlertTriangle, Loader2 } from 'lucide-react'
import { deleteLogs } from '@/app/admin/logs/actions'
import { cn } from '@/lib/utils'

type Mode = 'all' | '1day' | '1week' | 'ids'

const PRESET_OPTIONS: { value: Mode; label: string; desc: string }[] = [
  { value: '1day',  label: 'Last 24 hours', desc: 'Delete logs from the past day' },
  { value: '1week', label: 'Last 7 days',   desc: 'Delete logs from the past week' },
  { value: 'all',   label: 'Everything',    desc: 'Wipe entire log history' },
]

export default function ClearLogsModal({
  selectedIds,
  onDone,
}: {
  selectedIds: number[]
  onDone: (deletedCount: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode | null>(null)
  const [isPending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState('')

  const hasSelection = selectedIds.length > 0
  const needsConfirm = mode === 'all'
  const canSubmit = mode !== null && (!needsConfirm || confirm === 'delete')

  function close() {
    setOpen(false)
    setMode(null)
    setConfirm('')
  }

  function handleDelete() {
    if (!mode) return
    startTransition(async () => {
      const { deleted } = await deleteLogs(mode, mode === 'ids' ? selectedIds : undefined)
      onDone(deleted)
      close()
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] border border-rose-500/20 bg-rose-500/5 text-rose-400 text-[10px] font-bold uppercase tracking-wider hover:bg-rose-500/15 transition-all"
      >
        <Trash2 className="w-3 h-3" />
        Clear logs
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

          {/* Modal */}
          <div className="relative bg-panel border border-white/10 rounded-big w-full max-w-md mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-[5px] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <h2 className="text-[14px] font-display text-foreground">Clear Logs</h2>
              </div>
              <button onClick={close} className="text-bone-60 hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {/* Selected rows option */}
              {hasSelection && (
                <button
                  onClick={() => setMode('ids')}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-[5px] border text-left transition-all',
                    mode === 'ids'
                      ? 'border-accent/40 bg-accent/10'
                      : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                  )}
                >
                  <div>
                    <p className={cn('text-[12px] font-bold', mode === 'ids' ? 'text-accent' : 'text-foreground')}>
                      Selected rows
                    </p>
                    <p className="text-[10px] text-bone-60 opacity-50 mt-0.5">
                      Delete {selectedIds.length} selected log{selectedIds.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 shrink-0 transition-all',
                    mode === 'ids' ? 'border-accent bg-accent' : 'border-white/20'
                  )} />
                </button>
              )}

              {/* Preset options */}
              {PRESET_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setMode(opt.value); setConfirm('') }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-[5px] border text-left transition-all',
                    mode === opt.value
                      ? opt.value === 'all'
                        ? 'border-rose-500/40 bg-rose-500/10'
                        : 'border-accent/40 bg-accent/10'
                      : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                  )}
                >
                  <div>
                    <p className={cn(
                      'text-[12px] font-bold',
                      mode === opt.value
                        ? opt.value === 'all' ? 'text-rose-400' : 'text-accent'
                        : 'text-foreground'
                    )}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-bone-60 opacity-50 mt-0.5">{opt.desc}</p>
                  </div>
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 shrink-0 transition-all',
                    mode === opt.value
                      ? opt.value === 'all' ? 'border-rose-500 bg-rose-500' : 'border-accent bg-accent'
                      : 'border-white/20'
                  )} />
                </button>
              ))}

              {/* Confirm input for "all" */}
              {mode === 'all' && (
                <div className="mt-1 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-rose-400/80">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    Type <span className="font-mono font-bold px-1 py-0.5 bg-rose-500/10 rounded">delete</span> to confirm
                  </div>
                  <input
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="delete"
                    className="w-full bg-background/60 border border-white/10 rounded-[5px] px-3 py-2 text-[12px] font-mono text-foreground focus:outline-none focus:border-rose-500/40 placeholder:text-bone-60/20"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/5">
              <button
                onClick={close}
                className="px-4 py-1.5 rounded-[5px] border border-white/10 text-[11px] font-bold text-bone-60 hover:text-foreground transition-all uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!canSubmit || isPending}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1.5 rounded-[5px] text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-30',
                  mode === 'all'
                    ? 'bg-rose-500 text-white hover:bg-rose-400'
                    : 'bg-accent text-background hover:brightness-110'
                )}
              >
                {isPending ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Deleting…</>
                ) : (
                  <><Trash2 className="w-3 h-3" /> Delete</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
