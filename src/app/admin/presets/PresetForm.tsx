'use client'

import React, { useState, useEffect } from 'react'
import { savePreset } from './actions'
import { 
  CheckCircle2, 
  Search, 
  Eye, 
  Image as ImageIcon 
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function PresetForm({ preset, onSuccess }: { preset?: any, onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    id: preset?.id || '',
    name: preset?.name || '',
    msg_limit: preset?.daily_msg_limit || 10,
    image_limit: preset?.daily_image_limit || 0,
    has_vision: preset?.has_vision || false,
    has_web_search: preset?.has_web_search || false,
    has_image_gen: preset?.has_image_gen || false,
  })

  useEffect(() => {
    if (preset) {
      setForm({
        id: preset.id,
        name: preset.name,
        msg_limit: preset.daily_msg_limit,
        image_limit: preset.daily_image_limit || 0,
        has_vision: preset.has_vision,
        has_web_search: preset.has_web_search,
        has_image_gen: preset.has_image_gen,
      })
    }
  }, [preset])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await savePreset(form)
      if (onSuccess) onSuccess()
      if (!preset) {
        setForm({ id: '', name: '', msg_limit: 10, image_limit: 0, has_vision: false, has_web_search: false, has_image_gen: false })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-500">
      <div className="space-y-1.5">
        <label className="text-[9px] font-bold text-bone-60 tracking-tight uppercase opacity-50">Tier label</label>
        <input 
          required
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          placeholder="VIP, Standard, Pro..."
          className="w-full bg-background border border-white/5 rounded-medium px-3.5 py-2.5 text-xs font-bold text-bone-100 focus:outline-none focus:border-accent/30 placeholder:text-bone-60/10"
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-3 bg-background/30 p-4 rounded-medium border border-white/5">
          <label className="text-[9px] font-bold text-bone-60 flex items-center justify-between tracking-tight uppercase opacity-50">
            Messages
            <span className="text-accent font-mono text-[10px]">{form.msg_limit}</span>
          </label>
          <input 
            type="range"
            min="1"
            max="1000"
            value={form.msg_limit}
            onChange={e => setForm({ ...form, msg_limit: parseInt(e.target.value) })}
            className="w-full h-1 bg-white/5 rounded-none appearance-none cursor-pointer accent-accent"
          />
        </div>
        <div className="space-y-3 bg-background/30 p-4 rounded-medium border border-white/5">
          <label className="text-[9px] font-bold text-bone-60 flex items-center justify-between tracking-tight uppercase opacity-50">
            Images
            <span className="text-accent font-mono text-[10px]">{form.image_limit}</span>
          </label>
          <input 
            type="range"
            min="0"
            max="100"
            value={form.image_limit}
            onChange={e => setForm({ ...form, image_limit: parseInt(e.target.value) })}
            className="w-full h-1 bg-white/5 rounded-none appearance-none cursor-pointer accent-accent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        <Toggle 
          label="Vision node access" 
          icon={Eye}
          active={form.has_vision} 
          onClick={() => setForm({ ...form, has_vision: !form.has_vision })} 
        />
        <Toggle 
          label="Search engine link" 
          icon={Search}
          active={form.has_web_search} 
          onClick={() => setForm({ ...form, has_web_search: !form.has_web_search })} 
        />
        <Toggle 
          label="Gfx generation" 
          icon={ImageIcon}
          active={form.has_image_gen} 
          onClick={() => setForm({ ...form, has_image_gen: !form.has_image_gen })} 
        />
      </div>

      <button 
        disabled={loading}
        className="btn-primary w-full py-3.5 text-[10px] font-bold tracking-tight font-instrument uppercase"
      >
        {loading ? 'Synching...' : preset ? 'Update Tier' : 'Initialize Preset'}
      </button>
    </form>
  )
}

function Toggle({ label, icon: Icon, active, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between p-3 px-3.5 rounded-regular border group relative overflow-hidden transition-all",
        active 
          ? "bg-accent/10 border-accent/30 text-accent" 
          : "bg-background border-white/5 text-bone-60 hover:text-bone-100 hover:border-white/10 instrument-hover"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon 
          className={cn("w-3.5 h-3.5", active ? "text-accent fill-accent/10" : "text-bone-60 opacity-30")} 
          strokeWidth={2}
        />
        <span className="text-[10px] font-bold tracking-tight">{label}</span>
      </div>
      {active && (
        <CheckCircle2 className="w-3 h-3 text-accent animate-in zoom-in-50 duration-300" strokeWidth={2} />
      )}
    </button>
  )
}
