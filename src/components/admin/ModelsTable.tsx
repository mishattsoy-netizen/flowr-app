'use client'

import React, { useState, useTransition } from 'react'
import { Star, Trash2, Plus, Check, X, ChevronUp, ChevronDown } from 'lucide-react'
import { updateModel, deleteModel, addModel } from '@/app/admin/models/actions'
import { cn } from '@/lib/utils'

const MODALITY_OPTIONS = ['text', 'image', 'audio', 'video']

const PROVIDER_COLORS: Record<string, string> = {
  google: 'text-blue-400 border-blue-400/20 bg-blue-400/10',
  groq: 'text-orange-400 border-orange-400/20 bg-orange-400/10',
  cloudflare: 'text-amber-400 border-amber-400/20 bg-amber-400/10',
  huggingface: 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10',
  vault: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10',
  pollinations: 'text-pink-400 border-pink-400/20 bg-pink-400/10',
}

const MODALITY_COLORS: Record<string, string> = {
  text: 'text-sky-400 border-sky-400/20 bg-sky-400/10',
  image: 'text-violet-400 border-violet-400/20 bg-violet-400/10',
  audio: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10',
  video: 'text-rose-400 border-rose-400/20 bg-rose-400/10',
}

function ModalityBadges({
  modalities,
  editable,
  onToggle,
}: {
  modalities: string[]
  editable: boolean
  onToggle?: (m: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {editable
        ? MODALITY_OPTIONS.map((m) => {
            const active = modalities.includes(m)
            return (
              <button
                key={m}
                onClick={() => onToggle?.(m)}
                className={cn(
                  'px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold uppercase tracking-wider border transition-all',
                  active ? MODALITY_COLORS[m] : 'text-bone-60/30 border-white/5 bg-transparent'
                )}
              >
                {m}
              </button>
            )
          })
        : modalities.map((m) => (
            <span
              key={m}
              className={cn(
                'px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold uppercase tracking-wider border',
                MODALITY_COLORS[m] ?? 'text-bone-60 border-white/10 bg-white/5'
              )}
            >
              {m}
            </span>
          ))}
    </div>
  )
}

function RpdBar({ used, max }: { used: number; max: number | null }) {
  if (max === null || max === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-bone-60 opacity-30">{used} / ∞</span>
      </div>
    )
  }
  const pct = Math.min(100, (used / max) * 100)
  const color =
    pct >= 90 ? 'bg-rose-400' : pct >= 70 ? 'bg-amber-400' : 'bg-accent/60'
  return (
    <div className="flex flex-col gap-1 min-w-[100px]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-bone-60 opacity-50">
          {used} / {max.toLocaleString()}
        </span>
        <span className="text-[9px] font-bold text-bone-60 opacity-30 ml-2">
          {Math.round(pct)}%
        </span>
      </div>
      <div className="w-full h-1 bg-background rounded-full overflow-hidden border border-white/5">
        <div className={cn('h-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

interface ModelRow {
  id: string
  provider: string
  input_modalities: string[]
  output_modalities: string[]
  max_rpd: number | null
  is_favorite: boolean
  usage_today: number
  sort_order: number
}

function EditableRow({
  model,
  onSave,
  onCancel,
}: {
  model: ModelRow
  onSave: (updates: Partial<ModelRow>) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState({ ...model })

  const toggleInput = (m: string) =>
    setDraft((d) => ({
      ...d,
      input_modalities: d.input_modalities.includes(m)
        ? d.input_modalities.filter((x) => x !== m)
        : [...d.input_modalities, m],
    }))

  const toggleOutput = (m: string) =>
    setDraft((d) => ({
      ...d,
      output_modalities: d.output_modalities.includes(m)
        ? d.output_modalities.filter((x) => x !== m)
        : [...d.output_modalities, m],
    }))

  return (
    <tr className="border-b border-white/5">
      <td className="px-4 py-3">
        <input
          value={draft.id}
          onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))}
          className="bg-transparent border-none rounded-[5px] px-2 py-1 text-[12px] font-mono text-foreground w-full focus:outline-none"
        />
      </td>
      <td className="px-4 py-3">
        <input
          value={draft.provider}
          onChange={(e) => setDraft((d) => ({ ...d, provider: e.target.value }))}
          className="bg-transparent border-none rounded-[5px] px-2 py-1 text-[12px] text-foreground w-28 focus:outline-none"
        />
      </td>
      <td className="px-4 py-3">
        <ModalityBadges modalities={draft.input_modalities} editable onToggle={toggleInput} />
      </td>
      <td className="px-4 py-3">
        <ModalityBadges modalities={draft.output_modalities} editable onToggle={toggleOutput} />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          value={draft.max_rpd ?? ''}
          placeholder="∞"
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              max_rpd: e.target.value === '' ? null : Number(e.target.value),
            }))
          }
          className="bg-transparent border-none rounded-[5px] px-2 py-1 text-[12px] font-mono text-foreground w-24 focus:outline-none"
        />
      </td>
      <td className="px-4 py-3 text-center" colSpan={2}>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => onSave(draft)}
            className="flex items-center gap-1 px-3 py-1 rounded-[5px] bg-accent text-background text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all"
          >
            <Check className="w-3 h-3" /> Save
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-3 py-1 rounded-[5px] bg-background border border-white/10 text-bone-60 text-[10px] font-bold uppercase tracking-wider hover:text-foreground transition-all"
          >
            <X className="w-3 h-3" /> Cancel
          </button>
        </div>
      </td>
    </tr>
  )
}

function AddRow({ onAdd }: { onAdd: (m: ModelRow) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ModelRow>({
    id: '',
    provider: 'google',
    input_modalities: ['text'],
    output_modalities: ['text'],
    max_rpd: null,
    is_favorite: false,
    usage_today: 0,
    sort_order: 9999,
  })

  const toggleInput = (m: string) =>
    setDraft((d) => ({
      ...d,
      input_modalities: d.input_modalities.includes(m)
        ? d.input_modalities.filter((x) => x !== m)
        : [...d.input_modalities, m],
    }))

  const toggleOutput = (m: string) =>
    setDraft((d) => ({
      ...d,
      output_modalities: d.output_modalities.includes(m)
        ? d.output_modalities.filter((x) => x !== m)
        : [...d.output_modalities, m],
    }))

  if (!open) {
    return (
      <tr>
        <td colSpan={7} className="px-4 py-2">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-bone-60 hover:text-foreground transition-colors"
          >
            <Plus className="w-3 h-3" /> Add model
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="bg-white/[0.02] border-b border-white/5">
      <td className="px-4 py-3">
        <input
          value={draft.id}
          placeholder="model-id"
          onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))}
          className="bg-transparent border-none rounded-[5px] px-2 py-1 text-[12px] font-mono text-foreground w-full focus:outline-none"
        />
      </td>
      <td className="px-4 py-3">
        <input
          value={draft.provider}
          onChange={(e) => setDraft((d) => ({ ...d, provider: e.target.value }))}
          className="bg-transparent border-none rounded-[5px] px-2 py-1 text-[12px] text-foreground w-28 focus:outline-none"
        />
      </td>
      <td className="px-4 py-3">
        <ModalityBadges modalities={draft.input_modalities} editable onToggle={toggleInput} />
      </td>
      <td className="px-4 py-3">
        <ModalityBadges modalities={draft.output_modalities} editable onToggle={toggleOutput} />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          value={draft.max_rpd ?? ''}
          placeholder="∞"
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              max_rpd: e.target.value === '' ? null : Number(e.target.value),
            }))
          }
          className="bg-transparent border-none rounded-[5px] px-2 py-1 text-[12px] font-mono text-foreground w-24 focus:outline-none"
        />
      </td>
      <td className="px-4 py-3 text-center" colSpan={2}>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => { onAdd(draft); setOpen(false) }}
            disabled={!draft.id.trim()}
            className="flex items-center gap-1 px-3 py-1 rounded-[5px] bg-accent text-background text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-30"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center gap-1 px-3 py-1 rounded-[5px] bg-background border border-white/10 text-bone-60 text-[10px] font-bold uppercase tracking-wider hover:text-foreground transition-all"
          >
            <X className="w-3 h-3" /> Cancel
          </button>
        </div>
      </td>
    </tr>
  )
}

type SortKey = 'id' | 'provider' | 'usage_today' | 'is_favorite'

export default function ModelsTable({ initialModels }: { initialModels: ModelRow[] }) {
  const [models, setModels] = useState<ModelRow[]>(initialModels)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [sortKey, setSortKey] = useState<SortKey>('is_favorite')
  const [sortAsc, setSortAsc] = useState(false)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((a) => !a)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const sorted = [...models].sort((a, b) => {
    let av: any = a[sortKey]
    let bv: any = b[sortKey]
    if (typeof av === 'boolean') { av = av ? 0 : 1; bv = bv ? 0 : 1 }
    if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortAsc ? av - bv : bv - av
  })

  const handleFavorite = (id: string) => {
    const model = models.find((m) => m.id === id)!
    const next = !model.is_favorite
    setModels((ms) => ms.map((m) => (m.id === id ? { ...m, is_favorite: next } : m)))
    startTransition(() => updateModel(id, { is_favorite: next }))
  }

  const handleDelete = (id: string) => {
    if (!confirm(`Delete model "${id}"?`)) return
    setModels((ms) => ms.filter((m) => m.id !== id))
    startTransition(() => deleteModel(id))
  }

  const handleSave = (id: string, updates: Partial<ModelRow>) => {
    setModels((ms) => ms.map((m) => (m.id === id ? { ...m, ...updates } : m)))
    setEditingId(null)
    startTransition(() =>
      updateModel(id, {
        provider: updates.provider,
        input_modalities: updates.input_modalities,
        output_modalities: updates.output_modalities,
        max_rpd: updates.max_rpd,
      })
    )
  }

  const handleAdd = (draft: ModelRow) => {
    if (!draft.id.trim()) return
    setModels((ms) => [...ms, draft])
    startTransition(() =>
      addModel({
        id: draft.id,
        provider: draft.provider,
        input_modalities: draft.input_modalities,
        output_modalities: draft.output_modalities,
        max_rpd: draft.max_rpd,
      })
    )
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortAsc ? <ChevronUp className="w-3 h-3 inline ml-1 opacity-60" /> : <ChevronDown className="w-3 h-3 inline ml-1 opacity-60" />
    ) : null

  return (
    <div className="bg-panel border border-white/5 rounded-big overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.03] border-b border-white/5">
              <th
                className="px-4 py-3 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase cursor-pointer hover:text-muted-foreground/70 transition-colors select-none"
                onClick={() => handleSort('id')}
              >
                Model ID <SortIcon k="id" />
              </th>
              <th
                className="px-4 py-3 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase cursor-pointer hover:text-muted-foreground/70 transition-colors select-none"
                onClick={() => handleSort('provider')}
              >
                Provider <SortIcon k="provider" />
              </th>
              <th className="px-4 py-3 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">
                Input
              </th>
              <th className="px-4 py-3 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">
                Output
              </th>
              <th
                className="px-4 py-3 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase cursor-pointer hover:text-muted-foreground/70 transition-colors select-none"
                onClick={() => handleSort('usage_today')}
              >
                RPD Usage <SortIcon k="usage_today" />
              </th>
              <th
                className="px-4 py-3 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase cursor-pointer hover:text-muted-foreground/70 transition-colors select-none text-right"
                onClick={() => handleSort('is_favorite')}
              >
                Actions <SortIcon k="is_favorite" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.025]">
            {sorted.map((model) =>
              editingId === model.id ? (
                <EditableRow
                  key={model.id}
                  model={model}
                  onSave={(updates) => handleSave(model.id, updates)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <tr
                  key={model.id}
                  className="hover:bg-[var(--bone-6)] transition-all duration-150 group"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {model.is_favorite && (
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                      )}
                      <span className="text-[12px] font-mono text-bone-60 group-hover:text-foreground transition-colors truncate max-w-[320px]" title={model.id}>
                        {model.id}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-[5px] text-[10px] font-bold uppercase tracking-wider border',
                        PROVIDER_COLORS[model.provider.toLowerCase()] ?? 'text-bone-60 border-white/10 bg-white/5'
                      )}
                    >
                      {model.provider}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ModalityBadges modalities={model.input_modalities} editable={false} />
                  </td>
                  <td className="px-4 py-3">
                    <ModalityBadges modalities={model.output_modalities} editable={false} />
                  </td>
                  <td className="px-4 py-3">
                    <RpdBar used={model.usage_today} max={model.max_rpd} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingId(model.id)}
                          className="px-2.5 py-1 rounded-[5px] border border-white/10 bg-background text-[10px] font-bold text-bone-60 hover:text-foreground hover:border-white/20 transition-all uppercase tracking-wider"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(model.id)}
                          className="p-1.5 rounded-[5px] border border-white/5 bg-background text-bone-60 hover:text-rose-400 hover:border-rose-400/20 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleFavorite(model.id)}
                        className={cn(
                          'p-1.5 rounded-[5px] border transition-all shrink-0',
                          model.is_favorite
                            ? 'text-amber-400 border-amber-400/20 bg-amber-400/10'
                            : 'text-bone-60/30 border-white/5 hover:text-amber-400 hover:border-amber-400/20'
                        )}
                      >
                        <Star className={cn('w-3 h-3', model.is_favorite && 'fill-amber-400')} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
            <AddRow onAdd={handleAdd} />
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-white/[0.03] flex items-center justify-between">
        <span className="text-[10px] font-bold text-bone-60/30 uppercase tracking-wider">
          {models.length} models registered
        </span>
        <span className="text-[10px] font-bold text-bone-60/20 uppercase tracking-wider">
          Usage resets daily
        </span>
      </div>
    </div>
  )
}
