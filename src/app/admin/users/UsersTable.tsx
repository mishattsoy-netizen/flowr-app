'use client'

import React, { useState } from 'react'
import { 
  MoreVertical, 
  ShieldAlert, 
  ShieldCheck,
  Trash2,
  MessageSquare
} from 'lucide-react'
import { toggleUserBlock, deleteUser } from './actions'
import { cn } from '@/lib/utils'

export default function UsersTable({ initialUsers }: { initialUsers: any[] }) {
  const [users, setUsers] = useState(initialUsers)

  const handleToggleBlock = async (id: number, currentStatus: boolean) => {
    try {
      await toggleUserBlock(id, currentStatus)
      setUsers(prev => prev.map(u => 
        u.telegram_id === id ? { ...u, is_blocked: !currentStatus } : u
      ))
    } catch (err) {
      console.error('Failed to toggle block status:', err)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user? All usage history will be wiped.')) return
    try {
      await deleteUser(id)
      setUsers(prev => prev.filter(u => u.telegram_id !== id))
    } catch (err) {
      console.error('Failed to delete user:', err)
    }
  }

  if (users.length === 0) {
    return (
      <div className="p-12 text-center text-bone-60">
        <p className="text-sm font-bold tracking-tight">No users registered yet.</p>
        <p className="text-[10px] mt-2 font-bold opacity-30 tracking-tight">Awaiting first bot interaction</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto bg-panel rounded-big border border-border">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white/5 border-b border-border">
            <th className="px-8 py-4 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">User details</th>
            <th className="px-8 py-4 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">Preset / Plan</th>
            <th className="px-8 py-4 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">Daily usage</th>
            <th className="px-8 py-4 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase text-center">Status</th>
            <th className="px-8 py-4 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase">Linked Workspace</th>
            <th className="px-8 py-4 text-[11px] font-ui-label font-bold text-muted-foreground/40 tracking-widest uppercase text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.03]">
          {users.map((user) => (
            <tr key={user.telegram_id} className="hover:bg-[var(--bone-6)] transition-all duration-200 group cursor-pointer">
              <td className="px-8 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center text-[11px] font-bold text-muted-foreground group-hover:text-foreground group-hover:border-accent/30 transition-all">
                    {user.username?.[0]?.toUpperCase() || '#'}
                  </div>
                  <div>
                    <div className="text-[14px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">@{user.username || 'unknown'}</div>
                    <div className="text-[10px] text-muted-foreground opacity-20 font-mono tracking-tighter mt-0.5">ID: {user.telegram_id}</div>
                  </div>
                </div>
              </td>
              <td className="px-8 py-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-background border border-border text-[10px] font-bold text-muted-foreground tracking-widest uppercase group-hover:text-foreground group-hover:border-white/10 transition-all">
                  {user.limit_presets?.name || 'Standard'}
                </div>
              </td>
              <td className="px-8 py-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                    <span className="flex items-center gap-1.5 opacity-40">
                      <MessageSquare className="w-3 h-3" />
                      {user.messages_used_today} / {user.limit_presets?.daily_msg_limit || 50}
                    </span>
                    <span className="font-mono opacity-20">{Math.round(((user.messages_used_today || 0) / (user.limit_presets?.daily_msg_limit || 50)) * 100)}%</span>
                  </div>
                  <div className="w-32 h-1 bg-background rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="h-full bg-accent/40" 
                      style={{ width: `${Math.min(100, ((user.messages_used_today || 0) / (user.limit_presets?.daily_msg_limit || 50)) * 100)}%` }}
                    />
                  </div>
                </div>
              </td>
              <td className="px-8 py-4 text-center">
                <div className="flex justify-center">
                  <button 
                    onClick={() => handleToggleBlock(user.telegram_id, user.is_blocked)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-bold tracking-widest uppercase border transition-all",
                      user.is_blocked 
                        ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20" 
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                    )}
                  >
                    {user.is_blocked ? (
                      <><ShieldAlert className="w-3 h-3" /> Blocked</>
                    ) : (
                      <><ShieldCheck className="w-3 h-3" /> Active</>
                    )}
                  </button>
                </div>
              </td>
              <td className="px-8 py-4">
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-background border border-border text-[10px] font-bold text-muted-foreground tracking-tighter group-hover:text-foreground group-hover:border-white/10 transition-all">
                  {user.workspace_id || 'Not Linked'}
                </div>
              </td>
              <td className="px-8 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button 
                    onClick={() => handleDelete(user.telegram_id)}
                    className="p-2 text-muted-foreground hover:text-red-400 bg-background border border-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-2 text-muted-foreground hover:text-foreground bg-background border border-white/5 rounded-lg transition-all">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
