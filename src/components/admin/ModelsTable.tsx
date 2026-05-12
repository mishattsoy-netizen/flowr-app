'use client'

import React, { useState, useTransition } from 'react'
import { Star, Trash2, Plus, Check, X, ChevronUp, ChevronDown } from 'lucide-react'
import { updateModel, deleteModel, addModel } from '@/app/admin/models/actions'
import { saveRegistryPreset, loadRegistryPreset, listRegistryPresets } from '@/app/admin/bot/registry/actions'
import { cn } from '@/lib/utils'

const MODALITY_OPTIONS = ['text', 'image', 'audio', 'video']

const PROVIDER_COLORS: Record<string, string> = {
  gemini:      'text-blue-400 border-blue-400/20 bg-blue-400/10',
  groq:        'text-orange-400 border-orange-400/20 bg-orange-400/10',
  openrouter:  'text-purple-400 border-purple-400/20 bg-purple-400/10',
  ollama:      'text-teal-400 border-teal-400/20 bg-teal-400/10',
  tavily:      'text-cyan-400 border-cyan-400/20 bg-cyan-400/10',
  core:        'text-emerald-400 border-emerald-400/20 bg-emerald-400/10',
  pollinations: 'text-pink-400 border-pink-400/20 bg-pink-400/10',
  huggingface: 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10',
  cloudflare:  'text-amber-400 border-amber-400/20 bg-amber-400/10',
  siliconflow: 'text-indigo-400 border-indigo-400/20 bg-indigo-400/10',
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
                  'px-1.5 py-0.5 rounded-medium text-[9px] font-bold uppercase tracking-wider border transition-all',
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
                'px-1.5 py-0.5 rounded-medium text-[9px] font-bold uppercase tracking-wider border',
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
  const formatVal = (v: number) => {
    if (v >= 1000) return (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'K'
    return v.toLocaleString()
  }

  return (
    <div className="flex flex-col gap-1 min-w-[100px]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-bone-60 opacity-50">
          {formatVal(used)} / {formatVal(max)}
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

function ProviderDropdown({
  value,
  onChange,
  up = false,
}: {
  value: string
  onChange: (val: string) => void
  up?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const providers = Object.keys(PROVIDER_COLORS)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-32 px-2.5 py-1.5 rounded-medium border text-[11px] font-bold uppercase tracking-wider transition-all",
          PROVIDER_COLORS[value.toLowerCase()] || "text-bone-60 border-white/10 bg-white/5"
        )}
      >
        <span>{value}</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className={cn(
            "absolute left-0 w-40 z-50 bg-background/80 backdrop-blur-xl border border-white/10 rounded-medium shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150",
            up ? "bottom-full mb-1 origin-bottom" : "top-full mt-1 origin-top"
          )}>
            <div className="max-h-60 overflow-y-auto p-1 py-1.5">
              {providers.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    onChange(p)
                    setIsOpen(false)
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider text-left rounded-small transition-all",
                    value.toLowerCase() === p 
                      ? PROVIDER_COLORS[p] 
                      : "text-bone-60 hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", PROVIDER_COLORS[p].split(' ')[0].replace('text-', 'bg-'))} />
                  {p}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
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
          className="bg-transparent border-none rounded-medium px-2 py-1 text-[12px] font-mono text-foreground w-full focus:outline-none"
        />
      </td>
      <td className="px-4 py-3">
        <ProviderDropdown
          value={draft.provider}
          onChange={(val) => setDraft((d) => ({ ...d, provider: val }))}
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
          className="bg-transparent border-none rounded-medium px-2 py-1 text-[12px] font-mono text-foreground w-24 focus:outline-none"
        />
      </td>
      <td className="px-4 py-3 text-center" colSpan={2}>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => onSave(draft)}
            className="flex items-center gap-1 px-3 py-1 rounded-medium bg-accent text-background text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all"
          >
            <Check className="w-3 h-3" /> Save
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-3 py-1 rounded-medium bg-background border border-white/10 text-bone-60 text-[10px] font-bold uppercase tracking-wider hover:text-foreground transition-all"
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
    provider: 'gemini',
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
          className="bg-transparent border-none rounded-medium px-2 py-1 text-[12px] font-mono text-foreground w-full focus:outline-none"
        />
      </td>
      <td className="px-4 py-3">
        <ProviderDropdown
          value={draft.provider}
          onChange={(val) => setDraft((d) => ({ ...d, provider: val }))}
          up={true}
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
          className="bg-transparent border-none rounded-medium px-2 py-1 text-[12px] font-mono text-foreground w-24 focus:outline-none"
        />
      </td>
      <td className="px-4 py-3 text-center" colSpan={2}>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => { onAdd(draft); setOpen(false) }}
            disabled={!draft.id.trim()}
            className="flex items-center gap-1 px-3 py-1 rounded-medium bg-accent text-background text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-30"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center gap-1 px-3 py-1 rounded-medium bg-background border border-white/10 text-bone-60 text-[10px] font-bold uppercase tracking-wider hover:text-foreground transition-all"
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

  const [presetName, setPresetName] = useState('')
  const [presetsList, setPresetsList] = useState<any[]>([])
  const [isSavingPreset, setIsSavingPreset] = useState(false)

  const loadPresets = async () => {
    try {
      const list = await listRegistryPresets()
      setPresetsList(list)
    } catch (err: any) {
      console.error(err)
    }
  }

  React.useEffect(() => {
    loadPresets()
  }, [])

  const handleSavePreset = async () => {
    if (!presetName.trim()) return
    setIsSavingPreset(true)
    try {
      await saveRegistryPreset(presetName, 'ModelsTable snapshot', models)
      setPresetName('')
      await loadPresets()
      alert('Preset saved successfully!')
    } catch (err: any) {
      alert(`Failed to save preset: ${err.message}`)
    } finally {
      setIsSavingPreset(false)
    }
  }

  const handleLoadPreset = async (presetId: string) => {
    if (!presetId) return
    try {
      const loadedModels = await loadRegistryPreset(presetId)
      if (loadedModels && Array.isArray(loadedModels)) {
        setModels(loadedModels)
        alert('Preset loaded successfully!')
      }
    } catch (err: any) {
      alert(`Failed to load preset: ${err.message}`)
    }
  }


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
        id: updates.id,
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
    <div className="bg-panel rounded-big overflow-hidden space-y-4">
      {/* Preset Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-white/[0.05] bg-white/[0.01]">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Preset Name..."
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            className="bg-white/5 hover:bg-white/10 focus:bg-white/15 rounded-medium px-3 py-1 text-[12px] text-foreground focus:outline-none w-48 font-sans h-8 transition-all"
          />
          <button
            onClick={handleSavePreset}
            disabled={isSavingPreset || !presetName.trim()}
            className="flex items-center gap-1.5 px-3 py-1 bg-accent text-background rounded-medium text-[10px] font-bold uppercase tracking-wider h-8 hover:brightness-110 disabled:opacity-50 transition-all select-none"
          >
            <Plus className="w-3.5 h-3.5" />
            {isSavingPreset ? 'Saving...' : 'Save as preset'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 select-none">
            Load preset:
          </span>
          <select
            onChange={(e) => handleLoadPreset(e.target.value)}
            defaultValue=""
            className="bg-white/5 text-foreground text-[11px] font-bold uppercase tracking-wider px-2 h-8 rounded-medium focus:outline-none hover:bg-white/10 select-none cursor-pointer"
          >
            <option value="" disabled>Select Preset...</option>
            {presetsList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="bg-panel rounded-big overflow-hidden">
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
                        'px-2 py-0.5 rounded-medium text-[10px] font-bold uppercase tracking-wider border',
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
                          className="px-2.5 py-1 rounded-medium bg-white/5 text-bone-60 hover:text-foreground hover:bg-white/10 transition-all uppercase tracking-wider"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(model.id)}
                          className="p-1.5 rounded-medium bg-white/5 text-bone-60 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleFavorite(model.id)}
                        className={cn(
                          'p-1.5 rounded-medium transition-all shrink-0',
                          model.is_favorite
                            ? 'text-amber-400 bg-amber-400/10'
                            : 'text-bone-60/30 bg-white/5 hover:text-amber-400 hover:bg-amber-400/10'
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
    </div>
  )
}
