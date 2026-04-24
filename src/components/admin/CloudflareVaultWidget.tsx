'use client'

import React, { useState } from 'react'
import { Eye, EyeOff, Pencil, RotateCcw, X, Check } from 'lucide-react'
import { addVaultKey, updateVaultKey, revealVaultKey } from '@/app/admin/vault/actions'
import { cn } from '@/lib/utils'

interface Field {
  key_id: string
  label: string
  placeholder: string
  exists: boolean
}

interface FieldState {
  key_id: string
  label: string
  placeholder: string
  exists: boolean
  isRevealing: boolean
  revealedValue: string | null
  isEditing: boolean
  editValue: string
  isSaving: boolean
}

const FIELDS: Field[] = [
  { key_id: 'CLOUDFLARE_TOKEN',      label: 'API Token',   placeholder: 'Paste your Cloudflare API token...', exists: false },
  { key_id: 'CLOUDFLARE_ACCOUNT_ID', label: 'Account ID',  placeholder: 'Paste your Cloudflare Account ID...', exists: false },
]

function buildState(initialKeys: { key_id: string }[]): FieldState[] {
  const existingIds = new Set(initialKeys.map(k => k.key_id))
  return FIELDS.map(f => ({
    ...f,
    exists: existingIds.has(f.key_id),
    isRevealing: false,
    revealedValue: null,
    isEditing: false,
    editValue: '',
    isSaving: false,
  }))
}

export default function CloudflareVaultWidget({ initialKeys }: { initialKeys: { key_id: string }[] }) {
  const [fields, setFields] = useState<FieldState[]>(buildState(initialKeys))

  function update(index: number, patch: Partial<FieldState>) {
    setFields(prev => prev.map((f, i) => i === index ? { ...f, ...patch } : f))
  }

  async function handleReveal(index: number) {
    const f = fields[index]
    if (!f.exists) return
    if (f.revealedValue !== null) { update(index, { revealedValue: null }); return }
    update(index, { isRevealing: true })
    try {
      const value = await revealVaultKey(f.key_id)
      update(index, { revealedValue: value, isRevealing: false })
    } catch {
      update(index, { isRevealing: false })
    }
  }

  function handleStartEdit(index: number) {
    update(index, { isEditing: true, editValue: fields[index].revealedValue ?? '' })
  }

  async function handleSave(index: number) {
    const f = fields[index]
    if (!f.editValue) return
    update(index, { isSaving: true })
    try {
      if (f.exists) {
        await updateVaultKey(f.key_id, f.editValue)
      } else {
        await addVaultKey(f.key_id, f.editValue)
      }
      update(index, { isEditing: false, isSaving: false, exists: true, revealedValue: f.editValue, editValue: '' })
    } catch {
      update(index, { isSaving: false })
    }
  }

  function handleCancel(index: number) {
    update(index, { isEditing: false, editValue: '' })
  }

  return (
    <div className="bg-panel border border-white/5 rounded-big px-5 pb-5 pt-4 h-full flex flex-col relative">
      {/* Header */}
      <div className="px-2 py-2 mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          <h3 className="text-[11px] font-ui-label font-bold tracking-widest uppercase opacity-35 text-orange-500">
            Cloudflare
          </h3>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tight">
          {fields.filter(f => f.exists).length}/{fields.length} set
        </span>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-1">
        {fields.map((field, index) => (
          <div
            key={field.key_id}
            className={cn(
              'group flex items-center gap-3 px-3 py-2 rounded-medium hover:bg-[var(--bone-6)] transition-all',
              field.isEditing && 'bg-accent/5 border border-accent/10'
            )}
          >
            {/* Status dot */}
            <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', field.exists ? 'bg-orange-500' : 'bg-bone-60/20')} />

            {/* Label + value */}
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-[12px] font-semibold text-bone-100">{field.label}</span>
              {field.isEditing ? (
                <input
                  autoFocus
                  type="password"
                  value={field.editValue}
                  onChange={e => update(index, { editValue: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(index); if (e.key === 'Escape') handleCancel(index) }}
                  placeholder={field.placeholder}
                  className="w-full bg-background border border-accent/20 rounded-small px-2 py-1 text-[11px] font-mono text-accent focus:outline-none focus:border-accent/40"
                />
              ) : field.isRevealing ? (
                <span className="text-[10px] font-mono text-bone-60/40 flex items-center gap-2">
                  <RotateCcw className="w-2.5 h-2.5 animate-spin" />
                  Decrypting...
                </span>
              ) : field.revealedValue !== null ? (
                <span className="text-[10px] font-mono text-bone-60/70 truncate">
                  {field.revealedValue.slice(0, 6)}{'•'.repeat(16)}{field.revealedValue.slice(-4)}
                </span>
              ) : field.exists ? (
                <span className="text-[10px] font-mono text-bone-60/30">{'•'.repeat(32)}</span>
              ) : (
                <span className="text-[10px] text-bone-60/30 italic">Not set</span>
              )}
            </div>

            {/* Actions */}
            {field.isEditing ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleSave(index)}
                  disabled={!field.editValue || field.isSaving}
                  className="p-1.5 rounded-medium bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 disabled:opacity-20 transition-all"
                  title="Save"
                >
                  {field.isSaving ? <RotateCcw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => handleCancel(index)}
                  className="p-1.5 rounded-medium bg-background border border-white/5 text-bone-60 hover:text-bone-100 transition-all"
                  title="Cancel"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {field.exists && (
                  <button
                    onClick={() => handleReveal(index)}
                    className={cn(
                      'p-1.5 rounded-medium border transition-all',
                      field.revealedValue !== null
                        ? 'bg-accent/10 border-accent/20 text-accent'
                        : 'bg-background border-white/5 text-bone-60 hover:text-bone-100'
                    )}
                    title={field.revealedValue !== null ? 'Hide' : 'Reveal'}
                  >
                    {field.revealedValue !== null ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                )}
                <button
                  onClick={() => handleStartEdit(index)}
                  className="p-1.5 rounded-medium bg-background border border-white/5 text-bone-60 hover:text-sky-400 hover:border-sky-400/20 transition-all"
                  title={field.exists ? 'Edit value' : 'Set value'}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
