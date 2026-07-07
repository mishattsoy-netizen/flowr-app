'use client'
import { useState, useTransition } from 'react'
import { MessageSquare, Save } from 'lucide-react'
import { saveStatusMessage } from '@/app/admin/router/actions'

interface Props {
  initialMessages: Record<string, { label: string; emoji: string }>
}

const CHAIN_TYPES = [
  'REGULAR', 'COMPLEX',
  'VISION', 'WEB_SEARCH', 'RESEARCH', 'CODING',
  'IMAGE_GEN', 'AUDIO',
  'CLASSIFIER', 'ADVISOR', 'THINKING', 'COMPACTION',
]

export default function PipelineStatusPanel({ initialMessages }: Props) {
  const [messages, setMessages] = useState(initialMessages)
  const [saving, setSaving] = useState<string | null>(null)
  const [savingAll, setSavingAll] = useState(false)
  const [, startTransition] = useTransition()

  const handleSave = (type: string) => {
    const msg = messages[type] || { label: '', emoji: '' }
    setSaving(type)
    startTransition(async () => {
      await saveStatusMessage(type, msg.label, msg.emoji)
      setSaving(null)
    })
  }

  const handleSaveAll = () => {
    setSavingAll(true)
    startTransition(async () => {
      await Promise.all(CHAIN_TYPES.map(async (type) => {
        const msg = messages[type] || { label: '', emoji: '' }
        await saveStatusMessage(type, msg.label, msg.emoji)
      }))
      setSavingAll(false)
    })
  }

  return (
    <section className="flex flex-col gap-4 px-6 py-4 rounded-big bg-white/5 border border-[var(--bone-6)]">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-accent" />
          <div>
            <h2 className="text-sm font-bold text-bone-100 tracking-wider">Pipeline Status Messages</h2>
            <p className="text-[11px] text-bone-70">custom labels shown in chat during execution</p>
          </div>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={savingAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-accent/10 text-accent text-xs font-bold hover:bg-accent/20 transition-colors disabled:opacity-50"
        >
          <Save className="w-3 h-3" />
          {savingAll ? 'Saving All...' : 'Save All'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {CHAIN_TYPES.map(type => {
          const msg = messages[type] || { label: '', emoji: '' }
          return (
            <div key={type} className="flex flex-col gap-2 p-3 rounded-regular bg-background/40 border border-[var(--bone-6)]">
              <span className="text-[10px] font-mono font-bold text-bone-70">{type}</span>
              <div className="flex gap-2">
                <input
                  value={msg.emoji}
                  onChange={e => setMessages({ ...messages, [type]: { ...msg, emoji: e.target.value } })}
                  placeholder="🚀"
                  className="w-10 bg-black/20 border border-white/5 rounded-sm px-2 py-1 text-xs text-center focus:outline-none"
                />
                <input
                  value={msg.label}
                  onChange={e => setMessages({ ...messages, [type]: { ...msg, label: e.target.value } })}
                  placeholder="Searching..."
                  className="flex-1 bg-black/20 border border-white/5 rounded-sm px-2 py-1 text-xs text-bone-100 focus:outline-none"
                />
                <button
                  onClick={() => handleSave(type)}
                  disabled={saving === type}
                  className="p-1.5 rounded-sm bg-accent text-background hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  <Save className="w-3 h-3" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
