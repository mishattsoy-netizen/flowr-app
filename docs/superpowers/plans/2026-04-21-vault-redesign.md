# Vault Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat vault key list with a 2-column grid of per-provider widgets (Gemini, Groq, OpenRouter, General) where each widget supports inline add, reveal, edit, reorder, and delete.

**Architecture:** A new `VaultProviderWidget` client component handles all per-provider CRUD locally then persists via server actions. The page groups keys by provider and renders one widget per provider. A new `reorderProviderKeys` server action atomically renames all keys for a provider to `PROVIDER_0..N` on any mutation.

**Tech Stack:** Next.js 14 App Router, React server/client components, Supabase (supabaseAdmin), Tailwind CSS, Lucide icons, existing encryption utilities.

---

## File Map

| File | Action |
|------|--------|
| `src/app/admin/vault/actions.ts` | Modify — add `reorderProviderKeys`, update `addVaultKey` signature |
| `src/app/admin/vault/page.tsx` | Rewrite — grid layout with VaultProviderWidget per provider |
| `src/components/admin/VaultProviderWidget.tsx` | Create — full per-provider widget |
| `src/components/admin/VaultItem.tsx` | Delete |
| `src/app/admin/vault/VaultRegisterForm.tsx` | Delete |

---

### Task 1: Add `reorderProviderKeys` server action

**Files:**
- Modify: `src/app/admin/vault/actions.ts`

- [ ] **Step 1: Add `reorderProviderKeys` to actions.ts**

Open `src/app/admin/vault/actions.ts` and append this function at the end of the file:

```ts
/**
 * Renames all keys for a provider atomically to PROVIDER_0, PROVIDER_1, ...
 * matching the given ordered array of current key_ids.
 */
export async function reorderProviderKeys(provider: string, orderedKeyIds: string[]) {
  const prefix = provider.toUpperCase()

  // Use temp names first to avoid unique constraint conflicts during rename
  for (let i = 0; i < orderedKeyIds.length; i++) {
    const { error } = await supabase
      .from('vault')
      .update({ key_id: `${prefix}_TEMP_${i}` })
      .eq('key_id', orderedKeyIds[i])
    if (error) throw error
  }

  for (let i = 0; i < orderedKeyIds.length; i++) {
    const { error } = await supabase
      .from('vault')
      .update({ key_id: `${prefix}_${i}` })
      .eq('key_id', `${prefix}_TEMP_${i}`)
    if (error) throw error
  }

  revalidatePath('/admin/vault')
  return { success: true }
}
```

- [ ] **Step 2: Update `addVaultKey` signature to accept a pre-formed keyId**

Replace the existing `addVaultKey` function body so it accepts the full `keyId` (caller computes `PROVIDER_N`):

```ts
export async function addVaultKey(keyId: string, plainValue: string) {
  if (!keyId || !plainValue) throw new Error('Key name and Value cannot be empty')

  const encrypted = encrypt(plainValue)

  const { error } = await supabase
    .from('vault')
    .insert({
      key_id: keyId,
      encrypted_value: `${encrypted.iv}:${encrypted.encryptedData}`,
      updated_at: new Date().toISOString()
    })

  if (error) throw error
  revalidatePath('/admin/vault')
  return { success: true }
}
```

(This is already the existing signature — verify it matches and make no change if so.)

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/vault/actions.ts
git commit -m "feat: add reorderProviderKeys server action"
```

---

### Task 2: Create `VaultProviderWidget` component

**Files:**
- Create: `src/components/admin/VaultProviderWidget.tsx`

- [ ] **Step 1: Create the file with full implementation**

```tsx
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
    <div className="bg-panel border border-white/5 rounded-big shadow-lg flex flex-col p-2">
      {/* Header */}
      <div className="px-2 py-2 mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('w-1.5 h-1.5 rounded-full', info.dot)} />
          <h3 className={cn('text-[10px] font-black tracking-[0.1em] uppercase opacity-35', info.color)}>
            {info.name}
          </h3>
        </div>
        <span className="text-[9px] font-bold text-bone-60/40 uppercase tracking-tight">
          {rows.length} {rows.length === 1 ? 'key' : 'keys'}
        </span>
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-1">
        {rows.map((row, index) => (
          <div
            key={row.key_id}
            className={cn(
              'group flex items-center gap-3 px-3 py-2 rounded-medium hover:bg-white/[0.03] transition-all',
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
          className="text-[9px] flex items-center gap-2 text-bone-60 hover:text-bone-100 hover:bg-white/[0.03] font-bold tracking-[0.02em] px-3 py-1.5 rounded-medium uppercase transition-all disabled:opacity-30"
        >
          <Plus className="w-3 h-3" /> Add key
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/VaultProviderWidget.tsx
git commit -m "feat: add VaultProviderWidget component"
```

---

### Task 3: Rewrite vault page, delete old components

**Files:**
- Modify: `src/app/admin/vault/page.tsx`
- Delete: `src/components/admin/VaultItem.tsx`
- Delete: `src/app/admin/vault/VaultRegisterForm.tsx`

- [ ] **Step 1: Rewrite `src/app/admin/vault/page.tsx`**

Replace the entire file contents with:

```tsx
import { getVaultKeys } from './actions'
import VaultProviderWidget from '@/components/admin/VaultProviderWidget'
import { ShieldCheck } from 'lucide-react'

const KNOWN_PROVIDERS = ['gemini', 'groq', 'openrouter']

function detectProvider(keyId: string): string {
  const id = keyId.toLowerCase()
  if (id.includes('openrouter')) return 'openrouter'
  if (id.includes('gemini'))     return 'gemini'
  if (id.includes('groq'))       return 'groq'
  return 'general'
}

export default async function VaultPage() {
  const keys = await getVaultKeys()

  // Group keys by provider
  const grouped: Record<string, { key_id: string }[]> = {}
  for (const provider of KNOWN_PROVIDERS) {
    grouped[provider] = []
  }
  for (const key of keys) {
    const provider = detectProvider(key.key_id)
    if (!grouped[provider]) grouped[provider] = []
    grouped[provider].push(key)
  }

  const providers = Object.entries(grouped)

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="flex flex-col gap-1.5 mb-2">
        <h1 className="text-3xl font-bold tracking-tight text-bone-100 font-instrument">Security Vault</h1>
        <p className="text-bone-60 text-[11px] font-bold tracking-tight opacity-60">Encrypted storage for infrastructure orchestration keys.</p>
      </div>

      {keys.length === 0 ? (
        <div className="widget p-20 flex flex-col items-center justify-center text-center">
          <ShieldCheck className="w-12 h-12 text-bone-60 opacity-10 mb-6" strokeWidth={1} />
          <p className="text-bone-60 text-sm font-bold tracking-tight mb-2">Internal vault is secured and empty.</p>
          <p className="text-[10px] text-bone-60 opacity-30 font-bold tracking-[0.05em] uppercase">Initialize infrastructure to proceed</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {providers.map(([provider, providerKeys]) => (
            <VaultProviderWidget
              key={provider}
              provider={provider}
              initialKeys={providerKeys}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Delete old components**

```bash
rm src/components/admin/VaultItem.tsx
rm src/app/admin/vault/VaultRegisterForm.tsx
```

- [ ] **Step 3: Verify the app builds without errors**

```bash
cd "c:/Users/misha/Documents/Vibe Coding/flowr-4-main"
npm run build 2>&1 | tail -30
```

Expected: no TypeScript or build errors. If errors appear, fix them before committing.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/vault/page.tsx
git rm src/components/admin/VaultItem.tsx src/app/admin/vault/VaultRegisterForm.tsx
git commit -m "feat: redesign vault page with per-provider widgets"
```

---

### Task 4: Show all widgets even when vault is empty (empty state per widget)

The current page shows the big empty state when `keys.length === 0`. But after the redesign, the page should always show all known provider widgets (with 0 keys and an "Add key" button), so the user can add keys to any provider at any time.

**Files:**
- Modify: `src/app/admin/vault/page.tsx`

- [ ] **Step 1: Remove the empty-state gate, always render widgets**

Replace the conditional block in `page.tsx`:

```tsx
// Remove this:
{keys.length === 0 ? (
  <div className="widget p-20 ..."> ... </div>
) : (
  <div className="grid ...">...</div>
)}

// Replace with just:
<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
  {providers.map(([provider, providerKeys]) => (
    <VaultProviderWidget
      key={provider}
      provider={provider}
      initialKeys={providerKeys}
    />
  ))}
</div>
```

Full updated `page.tsx` after this change:

```tsx
import { getVaultKeys } from './actions'
import VaultProviderWidget from '@/components/admin/VaultProviderWidget'

const KNOWN_PROVIDERS = ['gemini', 'groq', 'openrouter']

function detectProvider(keyId: string): string {
  const id = keyId.toLowerCase()
  if (id.includes('openrouter')) return 'openrouter'
  if (id.includes('gemini'))     return 'gemini'
  if (id.includes('groq'))       return 'groq'
  return 'general'
}

export default async function VaultPage() {
  const keys = await getVaultKeys()

  const grouped: Record<string, { key_id: string }[]> = {}
  for (const provider of KNOWN_PROVIDERS) {
    grouped[provider] = []
  }
  for (const key of keys) {
    const provider = detectProvider(key.key_id)
    if (!grouped[provider]) grouped[provider] = []
    grouped[provider].push(key)
  }

  const providers = Object.entries(grouped)

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="flex flex-col gap-1.5 mb-2">
        <h1 className="text-3xl font-bold tracking-tight text-bone-100 font-instrument">Security Vault</h1>
        <p className="text-bone-60 text-[11px] font-bold tracking-tight opacity-60">Encrypted storage for infrastructure orchestration keys.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {providers.map(([provider, providerKeys]) => (
          <VaultProviderWidget
            key={provider}
            provider={provider}
            initialKeys={providerKeys}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/vault/page.tsx
git commit -m "feat: always show provider widgets, remove top-level empty state"
```

---

## Self-Review Checklist

- [x] **Grid layout** — Task 3 + 4 render 2-col grid with one widget per provider
- [x] **Auto-naming** — `Key N` derived from index in VaultProviderWidget
- [x] **Reveal** — calls `revealVaultKey`, spinner during fetch, eye toggles mask
- [x] **Edit** — inline input for secret value, calls `updateVaultKey`, cancel resets
- [x] **Delete** — calls `deleteVaultKey` then `reorderProviderKeys` to compact indices
- [x] **Reorder** — swaps locally + calls `reorderProviderKeys`; arrows disabled at bounds
- [x] **Add** — inline row at bottom, auto-names `PROVIDER_N`, calls `addVaultKey`
- [x] **Migration** — `reorderProviderKeys` in Task 1 renames all keys on any mutation
- [x] **Old files deleted** — VaultItem.tsx + VaultRegisterForm.tsx removed in Task 3
- [x] **No placeholders** — all code blocks are complete and self-contained
- [x] **Type consistency** — `VaultKey`, `RowState`, `ProviderInfo` defined once in Task 2 and used consistently
