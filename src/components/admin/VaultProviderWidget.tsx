'use client'

import React, { useState } from 'react'
import {
  ArrowUp, ArrowDown, Eye, EyeOff, Pencil, Trash2, Plus, RotateCcw, X, Check, Power
} from 'lucide-react'
import {
  addVaultAccount,
  updateVaultAccount,
  toggleVaultAccount,
  deleteVaultAccount,
  reorderVaultAccounts,
  addVaultKey,
  updateVaultKey,
  deleteVaultKey,
  revealVaultKey,
  reorderProviderKeys
} from '@/app/admin/vault/actions'
import { cn } from '@/lib/utils'

interface VaultAccount {
  id: string
  provider: string
  name: string
  is_active: boolean
  sort_order: number
}

interface VaultKey {
  id: string
  key_id: string
  account_id: string
  key_index: number
  description?: string | null
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
  tavily:      { name: 'Tavily',      color: 'text-cyan-400',   bg: 'bg-cyan-400/10',   border: 'border-cyan-400/20',   dot: 'bg-cyan-400'   },
  huggingface: { name: 'Hugging Face', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', dot: 'bg-yellow-500' },
  pollinations: { name: 'Pollinations', color: 'text-pink-400',   bg: 'bg-pink-400/10',   border: 'border-pink-400/20',   dot: 'bg-pink-400'   },
  general:     { name: 'General',     color: 'text-bone-60',    bg: 'bg-bone-60/10',    border: 'border-bone-60/20',    dot: 'bg-bone-60'    },
}

export default function VaultProviderWidget({
  provider,
  initialAccounts,
  initialKeys,
}: {
  provider: string
  initialAccounts: VaultAccount[]
  initialKeys: VaultKey[]
}) {
  const info = PROVIDER_INFO[provider.toLowerCase()] ?? PROVIDER_INFO.general

  const [accounts, setAccounts] = useState<VaultAccount[]>(initialAccounts.sort((a, b) => a.sort_order - b.sort_order))
  const [keys, setKeys] = useState<VaultKey[]>(initialKeys.sort((a, b) => a.key_index - b.key_index))

  // UI state maps
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [revealing, setRevealing] = useState<Record<string, boolean>>({})
  
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null)
  const [editingKeyValue, setEditingKeyValue] = useState('')

  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [editingAccountName, setEditingAccountName] = useState('')

  const [isAddingAccount, setIsAddingAccount] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')

  const [addingKeyToAccountId, setAddingKeyToAccountId] = useState<string | null>(null)
  const [newKeyValue, setNewKeyValue] = useState('')

  // --- ACCOUNT ACTIONS ---
  async function handleAddAccount() {
    if (!newAccountName) return
    await addVaultAccount(provider, newAccountName)
    window.location.reload()
  }

  async function handleUpdateAccount(id: string) {
    if (!editingAccountName) return
    await updateVaultAccount(id, editingAccountName)
    setEditingAccountId(null)
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, name: editingAccountName } : a))
  }

  async function handleToggleAccount(id: string, current: boolean) {
    await toggleVaultAccount(id, !current)
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, is_active: !current } : a))
  }

  async function handleDeleteAccount(id: string) {
    if (!confirm('Are you sure you want to delete this account and all its keys?')) return
    await deleteVaultAccount(id)
    setAccounts(prev => prev.filter(a => a.id !== id))
    setKeys(prev => prev.filter(k => k.account_id !== id))
  }

  async function handleMoveAccount(index: number, direction: 'up' | 'down') {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= accounts.length) return
    const newAccounts = [...accounts]
    ;[newAccounts[index], newAccounts[target]] = [newAccounts[target], newAccounts[index]]
    setAccounts(newAccounts)
    await reorderVaultAccounts(newAccounts.map(a => a.id))
  }

  // --- KEY ACTIONS ---
  async function handleAddKey(accountId: string) {
    if (!newKeyValue) return
    await addVaultKey(accountId, provider, newKeyValue)
    window.location.reload()
  }

  async function handleUpdateKey(keyId: string) {
    if (!editingKeyValue) {
      setEditingKeyId(null)
      return
    }
    await updateVaultKey(keyId, editingKeyValue)
    setEditingKeyId(null)
    setRevealed(prev => ({ ...prev, [keyId]: editingKeyValue }))
  }

  async function handleDeleteKey(keyId: string) {
    await deleteVaultKey(keyId)
    setKeys(prev => prev.filter(k => k.key_id !== keyId))
  }

  async function handleRevealKey(keyId: string) {
    if (revealed[keyId] !== undefined) {
      const newR = { ...revealed }
      delete newR[keyId]
      setRevealed(newR)
      return
    }
    setRevealing(prev => ({ ...prev, [keyId]: true }))
    try {
      const val = await revealVaultKey(keyId)
      setRevealed(prev => ({ ...prev, [keyId]: val }))
    } finally {
      setRevealing(prev => ({ ...prev, [keyId]: false }))
    }
  }

  async function handleMoveKey(accountId: string, index: number, direction: 'up' | 'down') {
    const accountKeys = keys.filter(k => k.account_id === accountId)
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= accountKeys.length) return
    
    const newAccountKeys = [...accountKeys]
    ;[newAccountKeys[index], newAccountKeys[target]] = [newAccountKeys[target], newAccountKeys[index]]
    
    // update global keys state
    setKeys(prev => {
      const other = prev.filter(k => k.account_id !== accountId)
      const updated = [...other, ...newAccountKeys]
      return updated.sort((a, b) => a.key_index - b.key_index) // logical resort for safety
    })

    await reorderProviderKeys(newAccountKeys.map(k => k.key_id))
  }

  return (
    <div className="bg-panel rounded-big px-5 pb-5 pt-4 h-full flex flex-col relative gap-4 overflow-hidden">
      {/* Provider Header */}
      <div className="px-2 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className={cn('w-1.5 h-1.5 rounded-full', info.dot)} />
          <h3 className={cn('text-[11px] font-ui-label font-bold tracking-widest uppercase opacity-35', info.color)}>
            {info.name}
          </h3>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tight">
          {keys.length} {keys.length === 1 ? 'key' : 'keys'} in {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
        </span>
      </div>

      {/* Accounts List - Scrollable space if too long */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto no-scrollbar">
        {accounts.map((account, accountIdx) => {
          const accountKeys = keys.filter(k => k.account_id === account.id)
          const isEditingAccount = editingAccountId === account.id

          return (
            <div key={account.id} className={cn(
              "flex flex-col rounded-medium border shadow-md transition-all duration-300 shrink-0",
              account.is_active 
                ? "border-white/[0.08] bg-background/40 backdrop-blur-sm" 
                : "border-white/[0.03] bg-background/10 opacity-60 grayscale-[40%]"
            )}>
              {/* Account Header */}
              <div className={cn(
                "flex items-center justify-between px-4 py-2 group border-b",
                account.is_active ? "bg-gradient-to-r from-white/[0.03] via-transparent to-transparent border-white/[0.06]" : "bg-transparent border-white/[0.02]"
              )}>
                {isEditingAccount ? (
                  <div className="flex-1 flex items-center gap-2 mr-2 animate-in slide-in-from-left-2 duration-200">
                    <input
                      autoFocus
                      type="text"
                      value={editingAccountName}
                      onChange={e => setEditingAccountName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdateAccount(account.id); if (e.key === 'Escape') setEditingAccountId(null) }}
                      className="w-full bg-background/60 border border-accent/30 rounded-small px-3 py-1 text-[12px] font-sans text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                    />
                    <button onClick={() => handleUpdateAccount(account.id)} className="p-1 bg-accent/10 text-accent rounded-full hover:bg-accent/20 transition-colors"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditingAccountId(null)} className="p-1 bg-white/5 text-bone-60 rounded-full hover:bg-white/10 transition-colors"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0 flex items-center gap-3 py-0.5">
                    <div className={cn("w-2 h-2 rounded-full shrink-0", account.is_active ? info.dot : "bg-bone-60/20")} />
                    <span className="text-[11px] font-bold text-bone-100 tracking-wider uppercase truncate">{account.name}</span>
                    {!account.is_active && (
                      <span className="text-[8px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-bone-60/60 font-bold uppercase tracking-widest">Disabled</span>
                    )}
                  </div>
                )}

                {/* Account Actions */}
                {!isEditingAccount && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0">
                    <div className="flex items-center bg-black/40 backdrop-blur-md rounded-full border border-white/[0.08] p-0.5 mr-1">
                      <button onClick={() => handleMoveAccount(accountIdx, 'up')} disabled={accountIdx === 0} className="text-bone-60 hover:text-bone-100 disabled:opacity-20 p-1 transition-colors"><ArrowUp className="w-2.5 h-2.5" /></button>
                      <div className="w-px h-3 bg-white/[0.08]" />
                      <button onClick={() => handleMoveAccount(accountIdx, 'down')} disabled={accountIdx === accounts.length - 1} className="text-bone-60 hover:text-bone-100 disabled:opacity-20 p-1 transition-colors"><ArrowDown className="w-2.5 h-2.5" /></button>
                    </div>
                    <button onClick={() => handleToggleAccount(account.id, account.is_active)} className={cn("p-1.5 rounded-full transition-colors", account.is_active ? "text-bone-60 hover:text-rose-400 hover:bg-rose-400/10" : "text-bone-60 hover:text-emerald-400 hover:bg-emerald-400/10")} title={account.is_active ? "Disable" : "Enable"}><Power className="w-3 h-3" /></button>
                    <button onClick={() => { setEditingAccountId(account.id); setEditingAccountName(account.name) }} className="p-1.5 rounded-full text-bone-60 hover:text-sky-400 hover:bg-sky-400/10 transition-colors" title="Rename"><Pencil className="w-3 h-3" /></button>
                    <button onClick={() => handleDeleteAccount(account.id)} className="p-1.5 rounded-full text-bone-60 hover:text-rose-500 hover:bg-rose-500/10 transition-colors" title="Delete Account"><Trash2 className="w-3 h-3" /></button>
                  </div>
                )}
              </div>

              {/* Keys List - Compact! */}
              <div className="flex flex-col gap-1 p-2 bg-black/10">
                {accountKeys.map((k, keyIdx) => {
                  const isEditing = editingKeyId === k.id
                  const isRevealing = revealing[k.key_id]
                  const revealedVal = revealed[k.key_id]

                  return (
                    <div key={k.id} className={cn(
                      "group flex items-center gap-3 px-3 py-1.5 rounded-medium transition-all duration-150",
                      isEditing 
                        ? "bg-accent/5 border border-accent/20" 
                        : "bg-white/[0.01] border border-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.05] shadow-sm"
                    )}>
                      {/* Clean Counter */}
                      <span className="text-[10px] font-mono font-bold text-bone-60/30 shrink-0 w-4">{String(keyIdx + 1).padStart(2, '0')}</span>
                      
                      {/* Value Track */}
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        {isEditing ? (
                          <div className="flex-1 flex items-center animate-in fade-in duration-100">
                            <input
                              autoFocus
                              type="password"
                              value={editingKeyValue}
                              onChange={e => setEditingKeyValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleUpdateKey(k.key_id); if (e.key === 'Escape') setEditingKeyId(null) }}
                              placeholder="Secret value..."
                              className="w-full bg-black/30 border border-accent/20 rounded-small px-2 py-1 text-[11px] font-mono text-accent focus:outline-none focus:border-accent"
                            />
                          </div>
                        ) : isRevealing ? (
                          <div className="flex-1 text-[11px] font-mono text-bone-60/50 flex items-center gap-2"><RotateCcw className="w-2.5 h-2.5 animate-spin" />Loading...</div>
                        ) : revealedVal ? (
                          <div className="flex-1 text-[12px] font-mono text-accent drop-shadow-[0_0_5px_rgba(var(--accent-rgb),0.3)] truncate font-bold">
                            {revealedVal.slice(0, 6)}{'•'.repeat(12)}{revealedVal.slice(-4)}
                          </div>
                        ) : (
                          <div className="flex-1 text-[10px] font-mono text-bone-60/15 tracking-[0.1em]">{'•'.repeat(24)}</div>
                        )}
                        
                        {/* Description - Clean horizontal fit */}
                        {!isEditing && k.description && (
                          <span className="text-[9px] text-bone-60/30 italic truncate max-w-[140px] hidden sm:inline-block" title={k.description}>
                            ({k.description.replace('Migrated from ', '')})
                          </span>
                        )}
                      </div>

                      {/* Compact Action Buttons */}
                      {isEditing ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleUpdateKey(k.key_id)} disabled={!editingKeyValue} className="p-1 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors"><Check className="w-3 h-3" /></button>
                          <button onClick={() => setEditingKeyId(null)} className="p-1 rounded-full bg-white/5 text-bone-60 hover:bg-white/10 transition-colors"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0">
                          <div className="flex items-center bg-black/30 rounded-full border border-white/5 p-0.5 mr-1">
                            <button onClick={() => handleMoveKey(account.id, keyIdx, 'up')} disabled={keyIdx === 0} className="text-bone-60 hover:text-bone-100 disabled:opacity-20 p-1 transition-colors"><ArrowUp className="w-2.5 h-2.5" /></button>
                            <div className="w-px h-2.5 bg-white/5" />
                            <button onClick={() => handleMoveKey(account.id, keyIdx, 'down')} disabled={keyIdx === accountKeys.length - 1} className="text-bone-60 hover:text-bone-100 disabled:opacity-20 p-1 transition-colors"><ArrowDown className="w-2.5 h-2.5" /></button>
                          </div>
                          <button onClick={() => handleRevealKey(k.key_id)} className={cn("p-1.5 rounded-full transition-all", revealedVal ? "text-accent bg-accent/10" : "text-bone-60 hover:bg-white/5 hover:text-bone-100")}>
                            {revealedVal ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                          <button onClick={() => { setEditingKeyId(k.id); setEditingKeyValue('') }} className="p-1.5 rounded-full text-bone-60 hover:bg-sky-500/10 hover:text-sky-400 transition-colors"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => handleDeleteKey(k.key_id)} className="p-1.5 rounded-full text-bone-60 hover:bg-rose-500/10 hover:text-rose-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Add Key Form - Compact */}
                {addingKeyToAccountId === account.id ? (
                  <div className="flex items-center gap-2 mt-1 px-2 py-2 rounded border border-dashed border-accent/30 bg-accent/5 animate-in duration-150">
                    <input
                      autoFocus
                      type="password"
                      value={newKeyValue}
                      onChange={e => setNewKeyValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddKey(account.id); if (e.key === 'Escape') setAddingKeyToAccountId(null) }}
                      placeholder="Key value..."
                      className="flex-1 bg-black/40 border border-accent/20 rounded-small px-2 py-1 text-[11px] font-mono text-accent focus:outline-none focus:border-accent"
                    />
                    <button onClick={() => handleAddKey(account.id)} disabled={!newKeyValue} className="p-1 bg-accent/20 text-accent rounded-full hover:bg-accent/30 transition-colors"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setAddingKeyToAccountId(null)} className="p-1 text-bone-60 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingKeyToAccountId(account.id); setNewKeyValue('') }}
                    disabled={accountKeys.length >= 5}
                    className="group/btn relative text-[9px] flex items-center justify-center gap-2 text-bone-60/50 hover:text-accent font-bold tracking-wider py-1.5 rounded border border-dashed border-white/[0.04] hover:border-accent/20 hover:bg-accent/[0.02] transition-all disabled:opacity-30 disabled:pointer-events-none overflow-hidden mt-0.5"
                  >
                    <Plus className="w-3 h-3" /> {accountKeys.length >= 5 ? 'THRESHOLD REACHED' : 'Append Key'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Account Form - Anchored to bottom */}
      <div className="pt-2 mt-auto shrink-0 border-t border-white/[0.02]">
        {isAddingAccount ? (
          <div className="flex items-center gap-3 p-3 rounded-medium border border-accent/20 bg-accent/5 animate-in slide-in-from-bottom-1 duration-200">
            <input
              autoFocus
              type="text"
              value={newAccountName}
              onChange={e => setNewAccountName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddAccount(); if (e.key === 'Escape') setIsAddingAccount(false) }}
              placeholder="Account Alias..."
              className="flex-1 bg-background/80 border border-accent/20 rounded-medium px-3 py-1.5 text-[12px] font-sans text-foreground focus:outline-none focus:border-accent"
            />
            <button onClick={handleAddAccount} disabled={!newAccountName} className="p-1.5 bg-accent text-black rounded hover:brightness-110 transition-all"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setIsAddingAccount(false)} className="p-1.5 bg-white/5 text-bone-60 rounded hover:bg-white/10 transition-colors"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button
            onClick={() => { setIsAddingAccount(true); setNewAccountName('') }}
            className="group/addac w-full flex items-center justify-center gap-2 text-[10px] text-bone-60/50 hover:text-bone-100 hover:bg-white/[0.02] font-bold tracking-[0.05em] py-2 rounded-medium border border-dashed border-white/[0.05] hover:border-white/[0.1] uppercase transition-all duration-200"
          >
            <Plus className="w-3.5 h-3.5 group-hover/addac:rotate-90 transition-transform duration-200" /> Provision Account
          </button>
        )}
      </div>
    </div>
  )
}
