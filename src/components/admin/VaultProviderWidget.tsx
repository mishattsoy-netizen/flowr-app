'use client'

import React, { useState } from 'react'
import {
  ArrowUp, ArrowDown, Eye, EyeOff, Pencil, Trash2, Plus, RotateCcw, X, Check
} from 'lucide-react'
import {
  addVaultKey,
  updateVaultKey,
  deleteVaultKey,
  revealVaultKey,
  reorderProviderKeys
} from '@/app/admin/vault/actions'
import { cn } from '@/lib/utils'

interface VaultKey {
  key_id: string
}

interface ProviderInfo {
  name: string
  color: string
  bg: string
  border: string
  dot: string
}

const PROVIDER_INFO: Record<string, ProviderInfo> = {
  gemini:      { name: 'Gemini',      color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/20',   dot: 'bg-blue-400'   },
  groq:        { name: 'Groq',        color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20', dot: 'bg-orange-400' },
  openrouter:  { name: 'OpenRouter',  color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20', dot: 'bg-purple-400' },
  general:     { name: 'General',     color: 'text-bone-60',    bg: 'bg-bone-60/10',    border: 'border-bone-60/20',    dot: 'bg-bone-60'    },
}

interface RowState {
  key_id: string
  // ui state
  isRevealing: boolean
  revealedValue: string | null
  isEditing: boolean
  editValue: string
  isDeleting: boolean
}

function buildRows(keys: VaultKey[]): RowState[] {
  return keys.map(k => ({
    key_id: k.key_id,
    isRevealing: false,
    revealedValue: null,
    isEditing: false,
    editValue: '',
    isDeleting: false,
  }))
}

export default function VaultProviderWidget({
  provider,
  initialKeys,
}: {
  provider: string
  initialKeys: VaultKey[]
}) {
  const info = PROVIDER_INFO[provider.toLowerCase()] ?? PROVIDER_INFO.general
  const prefix = provider.toUpperCase()

  const [rows, setRows] = useState<RowState[]>(buildRows(initialKeys))
  const [isAdding, setIsAdding] = useState(false)
  const [newKeyValue, setNewKeyValue] = useState('')
  const [isSavingNew, setIsSavingNew] = useState(false)

  // ── helpers ──────────────────────────────────────────────

  function updateRow(index: number, patch: Partial<RowState>) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, ...patch } : r))
  }

  // ── reveal ───────────────────────────────────────────────

  async function handleReveal(index: number) {
    const row = rows[index]
    if (row.revealedValue !== null) {
      // toggle mask off
      updateRow(index, { revealedValue: null })
      return
    }
    updateRow(index, { isRevealing: true })
    try {
      const value = await revealVaultKey(row.key_id)
      updateRow(index, { revealedValue: value, isRevealing: false })
    } catch {
      updateRow(index, { isRevealing: false })
    }
  }

  // ── edit ─────────────────────────────────────────────────

  function handleStartEdit(index: number) {
    const row = rows[index]
    updateRow(index, { isEditing: true, editValue: row.revealedValue ?? '' })
  }

  async function handleSaveEdit(index: number) {
    const row = rows[index]
    if (!row.editValue) return
    updateRow(index, { isDeleting: true }) // reuse opacity effect
    try {
      await updateVaultKey(row.key_id, row.editValue)
      updateRow(index, { isEditing: false, isDeleting: false, revealedValue: row.editValue })
    } catch {
      updateRow(index, { isDeleting: false })
    }
  }

  function handleCancelEdit(index: number) {
    updateRow(index, { isEditing: false, editValue: '' })
  }

  // ── delete ───────────────────────────────────────────────

  async function handleDelete(index: number) {
    const row = rows[index]
    updateRow(index, { isDeleting: true })
    try {
      await deleteVaultKey(row.key_id)
      const newRows = rows.filter((_, i) => i !== index)
      // reindex
      await reorderProviderKeys(prefix, newRows.map(r => r.key_id))
      const newKeyIds = newRows.map((_, i) => `${prefix}_${i}`)
      setRows(newRows.map((r, i) => ({ ...r, key_id: newKeyIds[i] })))
    } catch {
      updateRow(index, { isDeleting: false })
    }
  }

  // ── reorder ──────────────────────────────────────────────

  async function handleMove(index: number, direction: 'up' | 'down') {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= rows.length) return
    const newRows = [...rows]
    ;[newRows[index], newRows[target]] = [newRows[target], newRows[index]]
    const oldKeyIds = newRows.map(r => r.key_id)
    await reorderProviderKeys(prefix, oldKeyIds)
    const newKeyIds = newRows.map((_, i) => `${prefix}_${i}`)
    setRows(newRows.map((r, i) => ({ ...r, key_id: newKeyIds[i] })))
  }

  // ── add ──────────────────────────────────────────────────

  async function handleAddSave() {
    if (!newKeyValue) return
    setIsSavingNew(true)
    try {
      const newKeyId = `${prefix}_${rows.length}`
      await addVaultKey(newKeyId, newKeyValue)
      setRows(prev => [...prev, {
        key_id: newKeyId,
        isRevealing: false,
        revealedValue: null,
        isEditing: false,
        editValue: '',
        isDeleting: false,
      }])
      setNewKeyValue('')
      setIsAdding(false)
    } catch {
      // keep form open on error
    } finally {
      setIsSavingNew(false)
    }
  }

  // ── render ───────────────────────────────────────────────

  return (
    <div className="bg-panel border border-white/5 rounded-big px-5 pb-5 pt-4 h-full flex flex-col relative">
      {/* Header */}
      <div className="px-2 py-2 mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('w-1.5 h-1.5 rounded-full', info.dot)} />
          <h3 className={cn('text-[11px] font-ui-label font-bold tracking-widest uppercase opacity-35', info.color)}>
            {info.name}
          </h3>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tight">
          {rows.length} {rows.length === 1 ? 'key' : 'keys'}
        </span>
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-1">
        {rows.map((row, index) => (
          <div
            key={row.key_id}
            className={cn(
              'group flex items-center gap-3 px-3 py-2 rounded-medium hover:bg-[var(--bone-6)] transition-all',
              row.isDeleting && 'opacity-20 grayscale pointer-events-none',
              row.isEditing && 'bg-accent/5 border border-accent/10'
            )}
          >
            {/* Index */}
            <span className="text-[9px] font-bold text-bone-60/30 w-4 text-center shrink-0">
              {index + 1}
            </span>

            {/* Name + value */}
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-[12px] font-semibold text-bone-100">Key {index + 1}</span>
              {row.isEditing ? (
                <input
                  autoFocus
                  type="password"
                  value={row.editValue}
                  onChange={e => updateRow(index, { editValue: e.target.value })}
                  placeholder="New secret value..."
                  className="w-full bg-background border border-accent/20 rounded-small px-2 py-1 text-[11px] font-mono text-accent focus:outline-none focus:border-accent/40"
                />
              ) : row.isRevealing ? (
                <span className="text-[10px] font-mono text-bone-60/40 flex items-center gap-2">
                  <RotateCcw className="w-2.5 h-2.5 animate-spin" />
                  Decrypting...
                </span>
              ) : row.revealedValue !== null ? (
                <span className="text-[10px] font-mono text-bone-60/70 truncate">
                  {row.revealedValue.slice(0, 6)}{'•'.repeat(16)}{row.revealedValue.slice(-4)}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-bone-60/30">
                  {'•'.repeat(32)}
                </span>
              )}
            </div>

            {/* Actions */}
            {row.isEditing ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleSaveEdit(index)}
                  disabled={!row.editValue}
                  className="p-1.5 rounded-medium bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 disabled:opacity-20 transition-all"
                  title="Save"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleCancelEdit(index)}
                  className="p-1.5 rounded-medium bg-background border border-white/5 text-bone-60 hover:text-bone-100 transition-all"
                  title="Cancel"
                >
                  <X className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(index)}
                  className="p-1.5 rounded-medium bg-background border border-white/5 text-bone-60 hover:text-rose-500 hover:border-rose-500/20 transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Reorder */}
                <div className="flex items-center bg-background/50 rounded-small border border-white/5 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0}
                    className="text-bone-60 hover:text-accent disabled:opacity-20 p-1 transition-colors"
                    title="Move up"
                  >
                    <ArrowUp className="w-2.5 h-2.5" />
                  </button>
                  <div className="w-px h-3 bg-white/5" />
                  <button
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === rows.length - 1}
                    className="text-bone-60 hover:text-accent disabled:opacity-20 p-1 transition-colors"
                    title="Move down"
                  >
                    <ArrowDown className="w-2.5 h-2.5" />
                  </button>
                </div>

                {/* Reveal */}
                <button
                  onClick={() => handleReveal(index)}
                  className={cn(
                    'p-1.5 rounded-medium border transition-all',
                    row.revealedValue !== null
                      ? 'bg-accent/10 border-accent/20 text-accent'
                      : 'bg-background border-white/5 text-bone-60 hover:text-bone-100'
                  )}
                  title={row.revealedValue !== null ? 'Hide' : 'Reveal'}
                >
                  {row.revealedValue !== null ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>

                {/* Edit */}
                <button
                  onClick={() => handleStartEdit(index)}
                  className="p-1.5 rounded-medium bg-background border border-white/5 text-bone-60 hover:text-sky-400 hover:border-sky-400/20 transition-all"
                  title="Edit value"
                >
                  <Pencil className="w-3 h-3" />
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(index)}
                  className="p-1.5 rounded-medium bg-background border border-white/5 text-bone-60 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:border-rose-500/20 transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add new key row */}
        {isAdding ? (
          <div className="flex items-center gap-3 px-3 py-2 rounded-medium bg-accent/5 border border-accent/10">
            <span className="text-[9px] font-bold text-bone-60/30 w-4 text-center shrink-0">
              {rows.length + 1}
            </span>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-[12px] font-semibold text-bone-100">Key {rows.length + 1}</span>
              <input
                autoFocus
                type="password"
                value={newKeyValue}
                onChange={e => setNewKeyValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSave(); if (e.key === 'Escape') { setIsAdding(false); setNewKeyValue('') } }}
                placeholder="Secret value..."
                className="w-full bg-background border border-accent/20 rounded-small px-2 py-1 text-[11px] font-mono text-accent focus:outline-none focus:border-accent/40"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleAddSave}
                disabled={!newKeyValue || isSavingNew}
                className="p-1.5 rounded-medium bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 disabled:opacity-20 transition-all"
                title="Save"
              >
                {isSavingNew ? <RotateCcw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              </button>
              <button
                onClick={() => { setIsAdding(false); setNewKeyValue('') }}
                className="p-1.5 rounded-medium bg-background border border-white/5 text-bone-60 hover:text-bone-100 transition-all"
                title="Cancel"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer: Add key button */}
      <div className="mt-2 px-2 py-2 border-t border-white/[0.03]">
        <button
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
          className="text-[9px] flex items-center gap-2 text-bone-60 hover:text-bone-100 hover:bg-[var(--bone-6)] font-bold tracking-[0.02em] px-3 py-1.5 rounded-medium uppercase transition-all disabled:opacity-30"
        >
          <Plus className="w-3 h-3" /> Add key
        </button>
      </div>
    </div>
  )
}
