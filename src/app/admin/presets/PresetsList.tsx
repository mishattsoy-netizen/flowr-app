'use client'

import React from 'react'
import { 
  Activity, 
  MessageSquare, 
  Image as ImageIcon, 
  Trash2, 
  ArrowRight 
} from 'lucide-react'
import { deletePreset } from '@/app/admin/presets/actions'

export default function PresetsList({ initialPresets = [] }: { initialPresets: any[] }) {
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this limit preset? Users on this plan will revert to default.')) return
    try {
      await deletePreset(id)
      window.location.reload()
    } catch (err) {
      console.error('Failed to delete preset:', err)
    }
  }

  if (!initialPresets || initialPresets.length === 0) {
    return (
      <div className="widget p-12 text-center border-dashed border-white/5 bg-transparent">
        <div className="text-bone-60 text-sm font-bold tracking-tight mb-2">No presets configured</div>
        <p className="text-[10px] text-bone-60 opacity-30 font-bold tracking-tight uppercase">Define usage limits to begin</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-[10px]">
      {initialPresets.map((preset) => (
        <div key={preset.id} className="widget p-6 instrument-hover group">
          <div className="flex items-start justify-between mb-6">
            <div className="space-y-0.5">
              <h3 className="text-xl font-bold text-bone-100 tracking-tight leading-none">{preset.name}</h3>
              <p className="text-[9px] text-bone-60 font-bold tracking-tight opacity-40">System usage configuration</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => handleDelete(preset.id)}
                className="p-2.5 rounded-regular bg-background border border-white/5 text-bone-60 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all font-bold"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <div className="p-2.5 rounded-regular bg-accent/10 border border-accent/20 text-accent">
                <Activity className="w-3.5 h-3.5" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 mb-6">
            <div className="p-3.5 rounded-medium bg-background border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-[8px] font-bold text-bone-60 tracking-[0.05em] uppercase opacity-60">
                <MessageSquare className="w-2.5 h-2.5" />
                Messages
              </div>
              <div className="text-lg font-bold text-bone-100 tracking-tight leading-none">
                {preset.daily_msg_limit} <span className="text-[9px] opacity-20 font-bold ml-1">/ day</span>
              </div>
            </div>
            <div className="p-3.5 rounded-medium bg-background border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-[8px] font-bold text-bone-60 tracking-[0.05em] uppercase opacity-60">
                <ImageIcon className="w-2.5 h-2.5" />
                Images
              </div>
              <div className="text-lg font-bold text-bone-100 tracking-tight leading-none">
                {preset.allow_image_generation ? 'Enabled' : 'Locked'}
              </div>
            </div>
          </div>

          <button className="w-full flex items-center justify-between p-3.5 rounded-regular bg-white/[0.02] border border-white/5 text-bone-60 hover:text-bone-100 hover:border-white/10 hover:bg-bone-hover group/btn transition-colors">
            <span className="text-[10px] font-bold tracking-[0.05em] uppercase">Edit configuration</span>
            <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>

        </div>
      ))}
    </div>
  )
}
