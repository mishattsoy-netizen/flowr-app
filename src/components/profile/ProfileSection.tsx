"use client";

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { User, Camera, Check } from 'lucide-react'

export default function ProfileSection() {
  const { user, signInWithGoogle, signOut, updateProfile } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (user && !initialized.current) {
      initialized.current = true
      const meta = user.user_metadata || {}
      setDisplayName(meta.display_name || meta.full_name || user.email?.split('@')[0] || '')
      setAvatarUrl(meta.avatar_url || meta.picture || '')
    }
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await updateProfile({
        display_name: displayName.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
      })
      setMessage({ type: 'success', text: 'Profile updated' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to save profile' })
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 rounded-[24px] bg-accent/5 flex items-center justify-center mb-6">
          <User className="w-10 h-10 text-accent/60" />
        </div>
        <h4 className="text-[15px] font-semibold mb-2 text-bone-100">Not signed in</h4>
        <p className="text-bone-70 text-[13px] leading-relaxed mb-8 max-w-sm">
          Sign in to sync your data across devices and access admin features.
        </p>
        <button
          onClick={signInWithGoogle}
          className="inline-flex items-center gap-3 px-6 py-2.5 rounded-md bg-[#2a2a29] hover:bg-[#3f3f3e] text-bone-100 text-[13px] font-medium transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </button>
      </div>
    )
  }

  const meta = user.user_metadata || {}
  const effectiveAvatar = avatarUrl || meta.avatar_url || meta.picture || ''
  const provider = user.app_metadata?.provider || 'email'
  const email = user.email || ''

  return (
    <div className="space-y-6 text-[14px]">
      {/* Hero: Avatar + Full name + Email */}
      <div className="rounded-2xl bg-[var(--app-dark)] p-4 space-y-0">
        {/* Avatar */}
        <div className="flex items-center justify-between py-3 border-b border-[var(--bone-6)]">
          <div>
            <h4 className="text-[14px] font-medium text-bone-100">Avatar</h4>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-[#2a2a29] flex items-center justify-center overflow-hidden shrink-0 border border-[#3f3f3e]">
              {effectiveAvatar ? (
                <img src={effectiveAvatar} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              ) : (
                <Camera className="w-4 h-4 text-bone-70" />
              )}
            </div>
          </div>
        </div>

        {/* Display Name */}
        <div className="flex items-center justify-between py-3 border-b border-[var(--bone-6)]">
          <div>
            <h4 className="text-[14px] font-medium text-bone-100">Full name</h4>
          </div>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-64 bg-[var(--bone-6)] border border-transparent hover:border-[var(--bone-12)] focus:border-[var(--brand-blue)] focus:shadow-[0_0_0_0.5px_var(--brand-blue)] rounded-md px-3 py-1.5 text-[13px] text-bone-100 placeholder:text-bone-70/50 outline-none transition-colors"
          />
        </div>

        {/* Email */}
        <div className="flex items-center justify-between py-3">
          <div>
            <h4 className="text-[14px] font-medium text-bone-100">Email</h4>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[var(--bone-60)]">{email}</span>
            <span className="text-[10px] font-medium bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] px-1.5 py-0.5 rounded-sm uppercase tracking-wider">Verified</span>
          </div>
        </div>
      </div>

      {/* Connected Accounts — outside hero */}
      <div className="flex items-center justify-between py-3 border-b border-[var(--bone-6)]">
        <div>
          <h4 className="text-[14px] font-medium text-bone-100">Connected Accounts</h4>
        </div>
        <div className="flex items-center gap-2">
          {[
            { id: 'google', label: 'Google' },
            { id: 'apple', label: 'Apple' },
            { id: 'github', label: 'GitHub' }
          ].map(p => {
            const isConnected = provider === p.id;
            return (
              <div
                key={p.id}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold font-sans select-none border transition-colors ${
                  isConnected
                    ? 'bg-[var(--brand-blue)]/10 border-[var(--brand-blue)]/30 text-[var(--brand-blue)]'
                    : 'bg-[#1b1b1a] border-[var(--bone-10)] text-bone-70 opacity-40'
                }`}
              >
                {isConnected && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
                <span>{p.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className={`px-3 py-2 rounded-md text-[13px] ${
          message.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-red-500/10 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Actions — neutral Save, no danger actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={handleSignOut}
          className="px-3 py-1.5 rounded-md text-[13px] font-medium text-[var(--bone-60)] hover:bg-[#2b2a29] hover:text-bone-100 transition-colors"
        >
          Sign Out
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-md bg-[#3f3f3e] hover:bg-[#4a4a49] text-[13px] font-medium text-bone-100 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
