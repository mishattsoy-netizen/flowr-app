'use client'

import React, { useState, useTransition } from 'react'
import { RefreshCw, CheckCircle2, Plus, RotateCcw } from 'lucide-react'
import { cn, formatCostPerMillion, formatCompactNumber } from '@/lib/utils'
import { fetchProviderModels, addModel, updateModel, type DiscoveredModel } from './actions'
import { useStore } from '@/data/store'

const PROVIDERS = [
  { value: 'google',      label: 'Google' },
  { value: 'groq',        label: 'Groq' },
  { value: 'pollinations',label: 'Pollinations' },
  { value: 'huggingface', label: 'HuggingFace' },
  { value: 'openrouter',  label: 'OpenRouter' },
  { value: 'cloudflare',  label: 'Cloudflare' },
  { value: 'siliconflow', label: 'SiliconFlow' },
]

const PROVIDER_KEY_PREFIX: Record<string, string> = {
  google:       'GEMINI',
  groq:         'GROQ',
  pollinations: 'POLLINATIONS',
  huggingface:  'HUGGINGFACE',
  openrouter:   'OPENROUTER',
  cloudflare:   'CLOUDFLARE',
  siliconflow:  'SILICONFLOW',
}

const MODALITY_COLORS: Record<string, string> = {
  text:  'text-sky-400 border-sky-400/20 bg-sky-400/10',
  image: 'text-violet-400 border-violet-400/20 bg-violet-400/10',
  audio: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10',
  video: 'text-rose-400 border-rose-400/20 bg-rose-400/10',
}


type SortField = 'id' | 'displayName' | 'contextWindow' | 'maxOutputTokens' | 'rpd' | 'rpm' | 'input' | 'output' | 'inRegistry'

interface SortConfig {
  field: SortField
  direction: 'asc' | 'desc'
}

const HEADERS: { label: string; field: SortField | null }[] = [
  { label: 'Model ID',     field: 'id' },
  { label: 'Display Name', field: 'displayName' },
  { label: 'Context',      field: 'contextWindow' },
  { label: 'Max Out',      field: 'maxOutputTokens' },
  { label: 'RPD',          field: 'rpd' },
  { label: 'RPM',          field: 'rpm' },
  { label: 'Input',        field: 'input' },
  { label: 'Output',       field: 'output' },
  { label: 'Cost',         field: null },
  { label: 'Saved',        field: 'inRegistry' },
  { label: '',             field: null },
]

function ResultsTable({
  models,
  addingIds,
  onAdd,
  onAddAll,
}: {
  models: DiscoveredModel[]
  addingIds: Set<string>
  onAdd: (m: DiscoveredModel) => void
  onAddAll: () => void
}) {
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([{ field: 'id', direction: 'asc' }])

  const handleSort = (field: SortField) => {
    setSortConfigs(prev => {
      const index = prev.findIndex(c => c.field === field)
      
      if (index === -1) {
        // None -> Asc (Appended to active sorts)
        return [...prev, { field, direction: 'asc' }]
      }
      
      const current = prev[index]
      if (current.direction === 'asc') {
        // Asc -> Desc
        const next = [...prev]
        next[index] = { field, direction: 'desc' }
        return next
      } else {
        // Desc -> None (Removed from active sorts)
        return prev.filter(c => c.field !== field)
      }
    })
  }

  const sortedModels = React.useMemo(() => {
    if (sortConfigs.length === 0) return models

    return [...models].sort((a, b) => {
      for (const config of sortConfigs) {
        const field = config.field
        const isAsc = config.direction === 'asc'

        let av: any = (a as any)[field]
        let bv: any = (b as any)[field]

        if (field === 'input') {
          av = a.modalities.input.join(',')
          bv = b.modalities.input.join(',')
        } else if (field === 'output') {
          av = a.modalities.output.join(',')
          bv = b.modalities.output.join(',')
        }

        if (av === null && bv === null) continue
        if (av === null) return isAsc ? 1 : -1
        if (bv === null) return isAsc ? -1 : 1

        if (typeof av === 'string' && typeof bv === 'string') {
          const cmp = av.localeCompare(bv)
          if (cmp !== 0) return isAsc ? cmp : -cmp
        } else if (typeof av === 'boolean' && typeof bv === 'boolean') {
          if (av !== bv) {
            const an = av ? 1 : 0
            const bn = bv ? 1 : 0
            return isAsc ? an - bn : bn - an
          }
        } else {
          const diff = (av as number) - (bv as number)
          if (diff !== 0) return isAsc ? diff : -diff
        }
      }
      return 0
    })
  }, [models, sortConfigs])

  const notInRegistry = sortedModels.filter(m => !m.inRegistry)

  return (
    <div className="bg-panel rounded-[16px] overflow-hidden border border-white/5">
      {/* Table header row */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-[var(--bone-6)]">
        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-bone-60 opacity-30">
          {models.length} models found
        </span>
        {notInRegistry.length > 0 && (
          <button
            onClick={onAddAll}
            className="flex items-center gap-1.5 px-3 py-1 rounded-medium bg-accent/10 border border-accent/20 text-accent text-[10px] font-bold uppercase tracking-wider hover:bg-accent/20 transition-colors duration-150"
          >
            <Plus className="w-3 h-3" />
            Add All ({notInRegistry.length})
          </button>
        )}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[2fr_1.5fr_80px_80px_70px_70px_100px_100px_100px_60px_80px] gap-2 px-4 py-2 border-b border-white/5 bg-[var(--bone-6)] select-none">
        {HEADERS.map((h, i) => {
          if (h.field) {
            const configIndex = sortConfigs.findIndex(c => c.field === h.field)
            const isSorted = configIndex !== -1
            const config = isSorted ? sortConfigs[configIndex] : null
            return (
              <button
                key={i}
                onClick={() => handleSort(h.field!)}
                className={cn(
                  "flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-bone-60 opacity-30 hover:opacity-75 transition-opacity self-center text-left focus:outline-none",
                  isSorted && "opacity-75 text-accent"
                )}
              >
                <span>{h.label}</span>
                {isSorted && (
                  <div className="flex items-center gap-0.5 text-[8px] font-sans font-bold">
                    <span>{config!.direction === 'asc' ? '▲' : '▼'}</span>
                    {sortConfigs.length > 1 && (
                      <span className="text-[7px] bg-accent/20 px-1 py-0.2 rounded-small leading-none text-accent">
                        {configIndex + 1}
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          }
          return (
            <span key={i} className="text-[9px] font-bold uppercase tracking-[0.12em] text-bone-60 opacity-30 self-center">
              {h.label}
            </span>
          )
        })}
      </div>

      {/* Rows */}
      <div className="">
        {sortedModels.map(m => (
          <div
            key={m.id}
            className="grid grid-cols-[2fr_1.5fr_80px_80px_70px_70px_100px_100px_100px_60px_80px] gap-2 px-4 py-2.5 hover:bg-white/[0.02] border-b border-white/[0.03] last:border-b-0 transition-colors duration-150"
          >
            <span className="text-[11px] font-mono text-bone-60 opacity-70 truncate self-center" title={m.id}>
              {m.id}
            </span>
            <span className="text-[11px] text-bone-60 opacity-50 truncate self-center" title={m.displayName}>
              {m.displayName}
            </span>
            <span className="text-[10px] font-mono text-bone-60 opacity-40 self-center">
              {m.contextWindow ? formatCompactNumber(m.contextWindow) : '—'}
            </span>
            <span className="text-[10px] font-mono text-bone-60 opacity-40 self-center">
              {m.maxOutputTokens ? formatCompactNumber(m.maxOutputTokens) : '—'}
            </span>
            <span className="text-[10px] font-mono text-bone-60 opacity-40 self-center">
              {formatCompactNumber(m.rpd)}
            </span>
            <span className="text-[10px] font-mono text-bone-60 opacity-40 self-center">
              {formatCompactNumber(m.rpm)}
            </span>
            {/* Input modalities */}
            <div className="flex flex-wrap gap-1 self-center">
              {m.modalities.input.map(mod => (
                <span key={mod} className={cn('px-1.5 py-0.5 rounded-medium text-[8px] font-bold uppercase tracking-wider border', MODALITY_COLORS[mod] ?? 'text-bone-60 border-white/10 bg-white/5')}>
                  {mod}
                </span>
              ))}
            </div>
            {/* Output modalities */}
            <div className="flex flex-wrap gap-1 self-center">
              {m.modalities.output.map(mod => (
                <span key={mod} className={cn('px-1.5 py-0.5 rounded-medium text-[8px] font-bold uppercase tracking-wider border', MODALITY_COLORS[mod] ?? 'text-bone-60 border-white/10 bg-white/5')}>
                  {mod}
                </span>
              ))}
            </div>
            {/* Cost */}
            <div className="flex flex-wrap gap-1 self-center">
              {m.isPaid ? (
                <span className="px-1.5 py-0.5 rounded-medium text-[8px] font-bold uppercase tracking-wider border text-amber-400 border-amber-400/20 bg-amber-400/10" title={`Prompt: ${m.promptCost} / Comp: ${m.completionCost} (per 1M tokens)`}>
                  ${formatCostPerMillion(m.promptCost)} / ${formatCostPerMillion(m.completionCost)} per 1M
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded-medium text-[8px] font-bold uppercase tracking-wider border text-green-400 border-green-400/20 bg-green-400/10">
                  Free
                </span>
              )}
            </div>
            {/* In registry */}
            <div className="self-center flex items-center justify-center">
              {m.inRegistry ? (
                <CheckCircle2 className="w-4 h-4 text-green-400/70" />
              ) : (
                <div className="w-4 h-4" />
              )}
            </div>
            {/* Action */}
            <div className="self-center">
              <button
                onClick={() => onAdd(m)}
                disabled={addingIds.has(m.id)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-medium text-[10px] font-bold uppercase tracking-wider border transition-colors duration-150 disabled:opacity-40',
                  m.inRegistry
                    ? 'bg-white/5 border-white/10 text-bone-60 hover:text-foreground hover:bg-white/10'
                    : 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
                )}
              >
                {addingIds.has(m.id) ? (
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                ) : m.inRegistry ? (
                  <><RotateCcw className="w-2.5 h-2.5" /> Update</>
                ) : (
                  <><Plus className="w-2.5 h-2.5" /> Add</>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DiscoverClient({
  vaultKeys,
}: {
  vaultKeys: { key_id: string; description: string | null; updated_at: string }[]
}) {
  const [provider, setProvider] = useState('google')
  const [selectedKeyId, setSelectedKeyId] = useState('')
  const [models, setModels] = useState<DiscoveredModel[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isFetching, startFetch] = useTransition()
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set())
  const showPaid = useStore(s => s.showPaidModels)
  const setShowPaid = useStore(s => s.setShowPaidModels)

  // Keys for selected provider
  const prefix = PROVIDER_KEY_PREFIX[provider] ?? provider.toUpperCase()
  const cfSpecial = ['CLOUDFLARE_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']
  const providerKeys = provider === 'cloudflare'
    ? vaultKeys.filter(k => cfSpecial.includes(k.key_id))
    : vaultKeys.filter(k => k.key_id.toUpperCase().startsWith(prefix))

  // When provider changes, reset key selection and results
  function handleProviderChange(p: string) {
    setProvider(p)
    setSelectedKeyId('')
    setModels([])
    setError(null)
  }

  function handleFetch() {
    setError(null)
    startFetch(async () => {
      try {
        const results = await fetchProviderModels(provider, selectedKeyId)
        setModels(results)
      } catch (e: any) {
        setError(e.message ?? 'Fetch failed')
        setModels([])
      }
    })
  }

  async function handleAdd(model: DiscoveredModel) {
    // Paid model confirmation guard
    if (model.isPaid && !model.inRegistry) {
      const confirmed = window.confirm(
        `⚠️ "${model.id}" is a PAID model.\n\n` +
        `Prompt cost: $${formatCostPerMillion(model.promptCost)} per 1M tokens\n` +
        `Completion cost: $${formatCostPerMillion(model.completionCost)} per 1M tokens\n\n` +
        `Adding it to the registry will allow routing, ` +
        `potentially incurring charges on your OpenRouter account.\n\n` +
        `Are you sure you want to add this paid model?`
      )
      if (!confirmed) return
    }

    setAddingIds(prev => new Set(prev).add(model.id))
    try {
      if (model.inRegistry) {
        await updateModel(model.id, {
          input_modalities: model.modalities.input,
          output_modalities: model.modalities.output,
          max_rpd: model.rpd,
          provider: model.provider,
          is_paid: model.isPaid ?? false,
          prompt_cost: model.promptCost ?? null,
          completion_cost: model.completionCost ?? null,
        })
      } else {
        await addModel({
          id: model.id,
          provider: model.provider,
          input_modalities: model.modalities.input,
          output_modalities: model.modalities.output,
          max_rpd: model.rpd,
          is_paid: model.isPaid ?? false,
          prompt_cost: model.promptCost ?? null,
          completion_cost: model.completionCost ?? null,
        })
      }
      setModels(prev => prev.map(m => m.id === model.id ? { ...m, inRegistry: true } : m))
    } finally {
      setAddingIds(prev => { const s = new Set(prev); s.delete(model.id); return s })
    }
  }

  async function handleAddAll() {
    const toAdd = models.filter(m => !m.inRegistry)
    for (const m of toAdd) await handleAdd(m)
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-panel rounded-[16px] border border-white/5 px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Provider */}
        <select
          value={provider}
          onChange={e => handleProviderChange(e.target.value)}
          className="bg-white/5 text-foreground text-[12px] px-3 py-1 h-8 rounded-medium focus:outline-none cursor-pointer hover:bg-white/10 transition-all"
        >
          {PROVIDERS.map(p => (
            <option key={p.value} value={p.value} className="bg-background text-foreground">{p.label}</option>
          ))}
        </select>

        {/* API Key */}
        {providerKeys.length > 0 ? (
          <select
            value={selectedKeyId}
            onChange={e => setSelectedKeyId(e.target.value)}
            className="bg-white/5 text-foreground text-[12px] px-3 py-1 h-8 rounded-medium focus:outline-none cursor-pointer hover:bg-white/10 transition-all"
          >
            <option value="" className="bg-background text-foreground">Select key…</option>
            {providerKeys.map(k => (
              <option key={k.key_id} value={k.key_id} className="bg-background text-foreground">{k.key_id}</option>
            ))}
          </select>
        ) : (
          <span className="text-[11px] text-bone-60 opacity-40 italic h-8 flex items-center px-2">
            No key required
          </span>
        )}

        {/* Fetch */}
        <button
          onClick={handleFetch}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-1 h-8 rounded-medium bg-accent text-background text-[11px] font-bold uppercase tracking-wider hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {isFetching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
          {isFetching ? 'Fetching…' : 'Fetch Models'}
        </button>

        {provider === 'openrouter' && (
          <label className="flex items-center gap-2 text-[11px] text-bone-60 cursor-pointer select-none ml-2">
            <input
              type="checkbox"
              checked={showPaid}
              onChange={e => setShowPaid(e.target.checked)}
              className="accent-accent w-3.5 h-3.5 rounded bg-white/5 border-white/10 focus:ring-0"
            />
            Show paid models
          </label>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-[12px] px-4 py-3 text-[12px] text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {(() => {
        const visibleModels = provider === 'openrouter' && !showPaid
          ? models.filter(m => !m.isPaid)
          : models
          
        return visibleModels.length > 0 && (
          <ResultsTable
            models={visibleModels}
            addingIds={addingIds}
            onAdd={handleAdd}
            onAddAll={handleAddAll}
          />
        )
      })()}
    </div>
  )
}
