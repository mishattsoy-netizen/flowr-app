'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { Link, Copy, Check } from 'lucide-react'

interface Invite {
  id: string
  token: string
  label: string
  used_by_email: string | null
  used_at: string | null
  created_at: string
}

export default function BetaPage() {
  const { session } = useAuth()
  const [invites, setInvites] = useState<Invite[]>([])
  const [label, setLabel] = useState('')
  const [newLink, setNewLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  const getAuthHeaders = (): Record<string, string> => {
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` }
    }
    return {}
  }

  async function fetchInvites() {
    const res = await fetch('/api/admin/beta', { headers: getAuthHeaders() })
    const data = await res.json()
    setInvites(data.invites || [])
  }

  useEffect(() => { fetchInvites() }, [session])

  async function handleGenerate() {
    if (!label.trim()) return
    setLoading(true)
    setNewLink(null)
    const res = await fetch('/api/admin/beta', {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label.trim() }),
    })
    const data = await res.json()
    if (data.token) {
      const origin = window.location.origin
      setNewLink(`${origin}/invite/${data.token}`)
      setLabel('')
      fetchInvites()
    }
    setLoading(false)
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display font-medium text-foreground mb-1">Beta Invites</h1>
        <p className="text-muted-foreground text-sm font-medium">Generate and track personal invite links.</p>
      </div>

      <div className="bg-panel border border-[var(--bone-6)] px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow space-y-3">
        <div className="text-[10px] font-bold text-bone-70 tracking-[0.1em] uppercase opacity-40">Generate Invite</div>
        <div className="flex gap-2">
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            placeholder="Who is this for? e.g. Alex"
            className="flex-1 px-3 py-2 rounded-lg border border-[var(--bone-12)] bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !label.trim()}
            className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50 transition-all hover:opacity-90"
          >
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {newLink && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20">
            <span className="flex-1 text-xs text-foreground font-mono truncate">{newLink}</span>
            <button onClick={() => copyLink(newLink)} className="shrink-0 text-accent hover:opacity-70 transition-opacity">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      <div className="bg-panel border border-[var(--bone-6)] px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow">
        <div className="text-[10px] font-bold text-bone-70 tracking-[0.1em] uppercase opacity-40 mb-4">All Invites</div>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invites generated yet.</p>
        ) : (
          <div className="space-y-2">
            {invites.map(invite => (
              <div key={invite.id} className="flex items-center justify-between gap-4 py-2 border-b border-[var(--bone-6)] last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{invite.label}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{invite.token}</div>
                </div>
                <div className="text-right shrink-0">
                  {invite.used_by_email ? (
                    <div>
                      <div className="text-xs text-accent font-medium">Claimed</div>
                      <div className="text-xs text-muted-foreground">{invite.used_by_email}</div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Pending</div>
                  )}
                </div>
                <button
                  onClick={() => copyLink(`${window.location.origin}/invite/${invite.token}`)}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Link className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
