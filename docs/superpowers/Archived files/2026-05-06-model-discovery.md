![alt text](image.png)# Model Discovery Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin page at `/admin/discover` that fetches free/free-tier models from all supported providers, displays them in a normalized table, and lets the operator add or update them in the model registry with one click.

**Architecture:** Server component shell → `DiscoverClient` client component → single `fetchProviderModels` server action that dispatches to per-provider fetchers and normalizes results to a shared `DiscoveredModel` interface. Add/Update reuse existing `addModel`/`updateModel` actions from `src/app/admin/models/actions.ts`.

**Tech Stack:** Next.js 14 App Router, React, Supabase (admin client), Tailwind, Lucide React, existing vault/models actions.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/app/admin/discover/page.tsx` | Create | Server component shell — fetches initial vault key list, renders `DiscoverClient` |
| `src/app/admin/discover/actions.ts` | Create | `fetchProviderModels` + per-provider fetchers + `DiscoveredModel` type |
| `src/app/admin/discover/DiscoverClient.tsx` | Create | All UI: controls bar, results table, add/update interactions |
| `src/components/admin/Sidebar.tsx` | Modify | Add "Discover" nav entry |

---

### Task 1: Define the `DiscoveredModel` type and server action scaffold

**Files:**
- Create: `src/app/admin/discover/actions.ts`

- [ ] **Step 1: Create the actions file with the shared type and action signature**

```ts
'use server'

import { supabaseAdmin } from '@/lib/supabase'
import { addModel, updateModel } from '@/app/admin/models/actions'
import { getVaultKey } from '@/lib/vault'

export interface DiscoveredModel {
  id: string
  displayName: string
  provider: string
  contextWindow: number | null
  maxOutputTokens: number | null
  rpd: number | null
  rpm: number | null
  modalities: {
    input: string[]
    output: string[]
  }
  inRegistry: boolean
}

export async function fetchProviderModels(
  provider: string,
  apiKey: string
): Promise<DiscoveredModel[]> {
  // fetch from provider
  let raw: DiscoveredModel[] = []

  switch (provider) {
    case 'google':
      raw = await fetchGoogle(apiKey)
      break
    case 'groq':
      raw = await fetchGroq(apiKey)
      break
    case 'pollinations':
      raw = await fetchPollinations(apiKey)
      break
    case 'huggingface':
      raw = await fetchHuggingFace(apiKey)
      break
    case 'openrouter':
      raw = await fetchOpenRouter(apiKey)
      break
    case 'cloudflare':
      raw = await fetchCloudflare(apiKey)
      break
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }

  // cross-reference registry
  const { data: existing } = await supabaseAdmin
    .from('models')
    .select('id')

  const registryIds = new Set((existing ?? []).map((m: any) => m.id))
  return raw.map(m => ({ ...m, inRegistry: registryIds.has(m.id) }))
}

export { addModel, updateModel }
```

- [ ] **Step 2: Commit scaffold**

```bash
git add src/app/admin/discover/actions.ts
git commit -m "feat(discover): scaffold actions file and DiscoveredModel type"
```

---

### Task 2: Implement per-provider fetchers

**Files:**
- Modify: `src/app/admin/discover/actions.ts`

- [ ] **Step 1: Add Google fetcher**

Append to `actions.ts`:

```ts
async function fetchGoogle(apiKey: string): Promise<DiscoveredModel[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`
  )
  if (!res.ok) throw new Error(`Google API error: ${res.status} ${res.statusText}`)
  const data = await res.json()

  return (data.models ?? [])
    .filter((m: any) =>
      Array.isArray(m.supportedGenerationMethods) &&
      m.supportedGenerationMethods.includes('generateContent')
    )
    .map((m: any) => {
      const id = m.name.replace('models/', '')
      const nameLower = id.toLowerCase()
      const hasVision = nameLower.includes('vision') || nameLower.includes('pro') || nameLower.includes('flash')
      return {
        id,
        displayName: m.displayName ?? id,
        provider: 'google',
        contextWindow: m.inputTokenLimit ?? null,
        maxOutputTokens: m.outputTokenLimit ?? null,
        rpd: null,
        rpm: null,
        modalities: {
          input: hasVision ? ['text', 'image'] : ['text'],
          output: ['text'],
        },
        inRegistry: false,
      }
    })
}
```

- [ ] **Step 2: Add Groq fetcher**

```ts
async function fetchGroq(apiKey: string): Promise<DiscoveredModel[]> {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${res.statusText}`)
  const data = await res.json()

  return (data.data ?? []).map((m: any) => {
    const idLower = (m.id ?? '').toLowerCase()
    const isAudio = idLower.includes('whisper')
    return {
      id: m.id,
      displayName: m.id,
      provider: 'groq',
      contextWindow: m.context_window ?? null,
      maxOutputTokens: null,
      rpd: null,
      rpm: null,
      modalities: {
        input: isAudio ? ['audio'] : ['text'],
        output: ['text'],
      },
      inRegistry: false,
    }
  })
}
```

- [ ] **Step 3: Add Pollinations fetcher**

```ts
async function fetchPollinations(apiKey: string): Promise<DiscoveredModel[]> {
  const headers: Record<string, string> = {}
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const res = await fetch('https://text.pollinations.ai/models', { headers })
  if (!res.ok) throw new Error(`Pollinations API error: ${res.status} ${res.statusText}`)
  const data = await res.json()

  const models = Array.isArray(data) ? data : (data.models ?? [])
  return models.map((m: any) => ({
    id: typeof m === 'string' ? m : (m.name ?? m.id ?? String(m)),
    displayName: typeof m === 'string' ? m : (m.description ?? m.name ?? m.id ?? String(m)),
    provider: 'pollinations',
    contextWindow: m.contextLength ?? null,
    maxOutputTokens: null,
    rpd: null,
    rpm: null,
    modalities: { input: ['text'], output: ['text'] },
    inRegistry: false,
  }))
}
```

- [ ] **Step 4: Add HuggingFace fetcher**

```ts
async function fetchHuggingFace(apiKey: string): Promise<DiscoveredModel[]> {
  const res = await fetch(
    'https://huggingface.co/api/models?filter=text-generation&sort=downloads&limit=100',
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )
  if (!res.ok) throw new Error(`HuggingFace API error: ${res.status} ${res.statusText}`)
  const data = await res.json()

  return (data ?? [])
    .filter((m: any) => !m.gated)
    .map((m: any) => ({
      id: m.modelId ?? m.id,
      displayName: m.modelId ?? m.id,
      provider: 'huggingface',
      contextWindow: null,
      maxOutputTokens: null,
      rpd: null,
      rpm: null,
      modalities: { input: ['text'], output: ['text'] },
      inRegistry: false,
    }))
}
```

- [ ] **Step 5: Add OpenRouter fetcher**

```ts
async function fetchOpenRouter(apiKey: string): Promise<DiscoveredModel[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status} ${res.statusText}`)
  const data = await res.json()

  return (data.data ?? [])
    .filter((m: any) => {
      const isFreeId = (m.id ?? '').endsWith(':free')
      const price = m.pricing?.prompt
      const isFreePrice = price === '0' || price === '0.000' || price === 0
      return isFreeId || isFreePrice
    })
    .map((m: any) => {
      const arch = m.architecture ?? {}
      return {
        id: m.id,
        displayName: m.name ?? m.id,
        provider: 'openrouter',
        contextWindow: m.context_length ?? null,
        maxOutputTokens: null,
        rpd: null,
        rpm: null,
        modalities: {
          input: arch.input_modalities ?? ['text'],
          output: arch.output_modalities ?? ['text'],
        },
        inRegistry: false,
      }
    })
}
```

- [ ] **Step 6: Add Cloudflare fetcher**

```ts
async function fetchCloudflare(apiKey: string): Promise<DiscoveredModel[]> {
  const accountId = await getVaultKey('CLOUDFLARE_ACCOUNT_ID')
  if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID not found in vault')

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )
  if (!res.ok) throw new Error(`Cloudflare API error: ${res.status} ${res.statusText}`)
  const data = await res.json()

  return ((data.result ?? data.models ?? []) as any[]).map((m: any) => {
    const taskName = (m.task?.name ?? '').toLowerCase()
    const hasImage = taskName.includes('image') || taskName.includes('vision')
    const hasAudio = taskName.includes('audio') || taskName.includes('speech')
    const input = hasAudio ? ['audio'] : hasImage ? ['text', 'image'] : ['text']
    const output = hasImage && taskName.includes('generat') ? ['image'] : ['text']
    return {
      id: m.name ?? m.id,
      displayName: m.description ?? m.name ?? m.id,
      provider: 'cloudflare',
      contextWindow: null,
      maxOutputTokens: null,
      rpd: null,
      rpm: null,
      modalities: { input, output },
      inRegistry: false,
    }
  })
}
```

- [ ] **Step 7: Commit all fetchers**

```bash
git add src/app/admin/discover/actions.ts
git commit -m "feat(discover): implement per-provider model fetchers"
```

---

### Task 3: Build the server component page shell

**Files:**
- Create: `src/app/admin/discover/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { getVaultKeys } from '@/app/admin/vault/actions'
import DiscoverClient from './DiscoverClient'
import { Telescope } from 'lucide-react'

export default async function DiscoverPage() {
  const vaultKeys = await getVaultKeys()
  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display text-foreground mb-1">Discover</h1>
        <p className="text-muted-foreground text-sm font-medium">
          Fetch available free-tier models from providers and add them to your registry.
        </p>
      </div>
      <DiscoverClient vaultKeys={vaultKeys} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/discover/page.tsx
git commit -m "feat(discover): add server component page shell"
```

---

### Task 4: Build DiscoverClient — controls bar

**Files:**
- Create: `src/app/admin/discover/DiscoverClient.tsx`

- [ ] **Step 1: Create client component with controls bar**

```tsx
'use client'

import React, { useState, useTransition } from 'react'
import { RefreshCw, CheckCircle2, Plus, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchProviderModels, addModel, updateModel, type DiscoveredModel } from './actions'

const PROVIDERS = [
  { value: 'google',      label: 'Google' },
  { value: 'groq',        label: 'Groq' },
  { value: 'pollinations',label: 'Pollinations' },
  { value: 'huggingface', label: 'HuggingFace' },
  { value: 'openrouter',  label: 'OpenRouter' },
  { value: 'cloudflare',  label: 'Cloudflare' },
]

const PROVIDER_KEY_PREFIX: Record<string, string> = {
  google:       'GEMINI',
  groq:         'GROQ',
  pollinations: 'POLLINATIONS',
  huggingface:  'HUGGINGFACE',
  openrouter:   'OPENROUTER',
  cloudflare:   'CLOUDFLARE',
}

const MODALITY_COLORS: Record<string, string> = {
  text:  'text-sky-400 border-sky-400/20 bg-sky-400/10',
  image: 'text-violet-400 border-violet-400/20 bg-violet-400/10',
  audio: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10',
  video: 'text-rose-400 border-rose-400/20 bg-rose-400/10',
}

function formatNum(n: number | null, fallback = '—'): string {
  if (n === null) return fallback
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`
  return String(n)
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
    const key = providerKeys.find(k => k.key_id === selectedKeyId)
    const apiKey = key?.key_id ?? ''
    setError(null)
    startFetch(async () => {
      try {
        const results = await fetchProviderModels(provider, apiKey)
        setModels(results)
      } catch (e: any) {
        setError(e.message ?? 'Fetch failed')
        setModels([])
      }
    })
  }

  async function handleAdd(model: DiscoveredModel) {
    setAddingIds(prev => new Set(prev).add(model.id))
    try {
      if (model.inRegistry) {
        await updateModel(model.id, {
          input_modalities: model.modalities.input,
          output_modalities: model.modalities.output,
          max_rpd: model.rpd,
          provider: model.provider,
        })
      } else {
        await addModel({
          id: model.id,
          provider: model.provider,
          input_modalities: model.modalities.input,
          output_modalities: model.modalities.output,
          max_rpd: model.rpd,
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
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {/* API Key */}
        {providerKeys.length > 0 ? (
          <select
            value={selectedKeyId}
            onChange={e => setSelectedKeyId(e.target.value)}
            className="bg-white/5 text-foreground text-[12px] px-3 py-1 h-8 rounded-medium focus:outline-none cursor-pointer hover:bg-white/10 transition-all"
          >
            <option value="">Select key…</option>
            {providerKeys.map(k => (
              <option key={k.key_id} value={k.key_id}>{k.key_id}</option>
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
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-[12px] px-4 py-3 text-[12px] text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {models.length > 0 && (
        <ResultsTable
          models={models}
          addingIds={addingIds}
          onAdd={handleAdd}
          onAddAll={handleAddAll}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit controls bar**

```bash
git add src/app/admin/discover/DiscoverClient.tsx
git commit -m "feat(discover): add DiscoverClient controls bar"
```

---

### Task 5: Build DiscoverClient — results table

**Files:**
- Modify: `src/app/admin/discover/DiscoverClient.tsx`

- [ ] **Step 1: Add ResultsTable component to the same file (append before the default export)**

```tsx
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
  const notInRegistry = models.filter(m => !m.inRegistry)

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
            className="flex items-center gap-1.5 px-3 py-1 rounded-medium bg-accent/10 border border-accent/20 text-accent text-[10px] font-bold uppercase tracking-wider hover:bg-accent/20 transition-all"
          >
            <Plus className="w-3 h-3" />
            Add All ({notInRegistry.length})
          </button>
        )}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[2fr_1.5fr_80px_80px_70px_70px_100px_100px_60px_80px] gap-2 px-4 py-2 border-b border-white/5 bg-[var(--bone-6)]">
        {['Model ID', 'Display Name', 'Context', 'Max Out', 'RPD', 'RPM', 'Input', 'Output', 'Saved', ''].map((h, i) => (
          <span key={i} className="text-[9px] font-bold uppercase tracking-[0.12em] text-bone-60 opacity-30 self-center">
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/[0.03]">
        {models.map(m => (
          <div
            key={m.id}
            className="grid grid-cols-[2fr_1.5fr_80px_80px_70px_70px_100px_100px_60px_80px] gap-2 px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
          >
            <span className="text-[11px] font-mono text-bone-60 opacity-70 truncate self-center" title={m.id}>
              {m.id}
            </span>
            <span className="text-[11px] text-bone-60 opacity-50 truncate self-center" title={m.displayName}>
              {m.displayName}
            </span>
            <span className="text-[10px] font-mono text-bone-60 opacity-40 self-center">
              {formatNum(m.contextWindow, '—')}
            </span>
            <span className="text-[10px] font-mono text-bone-60 opacity-40 self-center">
              {formatNum(m.maxOutputTokens, '—')}
            </span>
            <span className="text-[10px] font-mono text-bone-60 opacity-40 self-center">
              {m.rpd === null ? '∞' : m.rpd}
            </span>
            <span className="text-[10px] font-mono text-bone-60 opacity-40 self-center">
              {m.rpm === null ? '—' : m.rpm}
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
                  'flex items-center gap-1 px-2.5 py-1 rounded-medium text-[10px] font-bold uppercase tracking-wider border transition-all disabled:opacity-40',
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
```

- [ ] **Step 2: Commit results table**

```bash
git add src/app/admin/discover/DiscoverClient.tsx
git commit -m "feat(discover): add results table with add/update actions"
```

---

### Task 6: Add nav entry to Sidebar and verify the page loads

**Files:**
- Modify: `src/components/admin/Sidebar.tsx`

- [ ] **Step 1: Add Telescope import and nav link**

In `src/components/admin/Sidebar.tsx`, add `Telescope` to the lucide-react import line, then add a `NavLink` for Discover inside the appropriate `PlatformSection`. Place it near the Models entry:

```tsx
// Add to lucide-react imports:
import { ..., Telescope } from 'lucide-react'

// Add NavLink (next to or after the Models NavLink):
<NavLink href="/admin/discover" icon={Telescope}>Discover</NavLink>
```

- [ ] **Step 2: Start the dev server and open `/admin/discover`**

```bash
npm run dev
```

Open `http://localhost:3000/admin/discover`. Verify:
- Page renders with title "Discover" and subtitle
- Provider dropdown shows all 6 providers
- Selecting Google shows GEMINI keys from vault in the key dropdown
- Fetch button is visible

- [ ] **Step 3: Test a real fetch**

Select Google, pick a GEMINI key, click Fetch Models. Verify:
- Spinner appears during fetch
- Results table renders with model rows
- Gemma 3 models do NOT appear (confirmed 404 from earlier)
- Gemma 4 models DO appear (`gemma-4-26b-a4b-it`, `gemma-4-31b-it`)
- Context window and output token limits show correctly
- Modality badges render

- [ ] **Step 4: Test Add to Registry**

Click `+ Add` on a model not in registry. Verify:
- Button shows spinner then changes to `↺ Update`
- Green checkmark appears in the Saved column
- Go to `/admin/models` and confirm the model appears there

- [ ] **Step 5: Test Update**

Click `↺ Update` on a model already in registry. Verify it completes without error.

- [ ] **Step 6: Test Add All**

Click `Add All (N)`. Verify all rows flip to showing the checkmark.

- [ ] **Step 7: Test error state**

Enter a bad API key manually (edit the vault temporarily or pass a garbage key). Verify the red error banner appears and no table is shown.

- [ ] **Step 8: Commit nav entry**

```bash
git add src/components/admin/Sidebar.tsx
git commit -m "feat(discover): add Discover nav entry to admin sidebar"
```

---

### Task 7: Test remaining providers

- [ ] **Step 1: Test Groq**

Select Groq, pick a GROQ key, fetch. Verify models list including Llama and Whisper models. Whisper models should show `audio` input modality.

- [ ] **Step 2: Test Pollinations**

Select Pollinations, pick key, fetch. Verify models list. All modalities should be `text`.

- [ ] **Step 3: Test OpenRouter**

Select OpenRouter, pick key, fetch. Verify only `:free` or zero-price models appear. Confirm no paid models slip through.

- [ ] **Step 4: Test HuggingFace**

Select HuggingFace, pick key, fetch. Verify only non-gated text-generation models appear.

- [ ] **Step 5: Test Cloudflare**

Select Cloudflare, pick CLOUDFLARE_TOKEN key, fetch. Verify Workers AI models appear. Confirm `CLOUDFLARE_ACCOUNT_ID` is read from vault automatically.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(discover): complete model discovery page with all providers"
```
