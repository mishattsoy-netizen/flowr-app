import React, { useState } from 'react'
import { Plus, Check, Edit2 } from 'lucide-react'
import { RoadmapPhase, RoadmapTask } from './RoadmapClient'
import { cn } from '@/lib/utils'

interface Props {
  phases: RoadmapPhase[]
  tasks: RoadmapTask[]
  activePhaseId: string | null
  setActivePhaseId: (id: string) => void
  setPhases: React.Dispatch<React.SetStateAction<RoadmapPhase[]>>
}

export default function PhaseStrip({ phases, tasks, activePhaseId, setActivePhaseId, setPhases }: Props) {
  const [isAdding, setIsAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const handleAdd = async () => {
    if (!newTitle.trim()) {
      setIsAdding(false)
      return
    }
    const res = await fetch('/api/admin/roadmap/phases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, sort_order: phases.length, color: '#E09952' })
    })
    if (res.ok) {
      const p = await res.json()
      setPhases(prev => [...prev, p])
      if (!activePhaseId) setActivePhaseId(p.id)
    }
    setNewTitle('')
    setIsAdding(false)
  }

  const handleEdit = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingId(null)
      return
    }
    const res = await fetch('/api/admin/roadmap/phases', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title: editTitle })
    })
    if (res.ok) {
      setPhases(prev => prev.map(p => p.id === id ? { ...p, title: editTitle } : p))
    }
    setEditingId(null)
  }

  return (
    <div className="flex items-center gap-3 w-full overflow-x-auto pb-2 custom-scrollbar">
      {phases.map(phase => {
        const phaseTasks = tasks.filter(t => t.phase_id === phase.id)
        const progress = phaseTasks.length === 0 ? 0 : Math.round((phaseTasks.filter(t => t.status === 'done').length / phaseTasks.length) * 100)
        const isActive = activePhaseId === phase.id
        const isEditing = editingId === phase.id

        return (
          <div 
            key={phase.id}
            onClick={() => !isEditing && setActivePhaseId(phase.id)}
            className={cn(
              "flex items-center gap-3 px-4 py-2 rounded-[var(--radius-8)] border-none shrink-0 cursor-pointer transition-all duration-150",
              isActive 
                ? "bg-[var(--bone-10)]" 
                : "bg-[var(--bone-3)] hover:bg-[var(--bone-6)]"
            )}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: phase.color }} />
            
            {isEditing ? (
              <input
                autoFocus
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onBlur={() => handleEdit(phase.id)}
                onKeyDown={e => e.key === 'Enter' && handleEdit(phase.id)}
                className="bg-transparent text-[var(--bone-100)] text-sm font-medium outline-none w-32"
              />
            ) : (
              <span className="text-sm font-medium text-[var(--bone-100)] select-none">
                {phase.title}
              </span>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--bone-60)]">{progress}%</span>
              {isActive && !isEditing && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setEditTitle(phase.title); setEditingId(phase.id); }}
                  className="p-1 hover:bg-[var(--bone-10)] rounded text-[var(--bone-60)] hover:text-[var(--bone-100)] transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )
      })}

      {isAdding ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-8)] bg-[var(--bone-6)] shrink-0">
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onBlur={handleAdd}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Phase name..."
            className="bg-transparent text-[var(--bone-100)] text-sm outline-none w-32"
          />
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-8)] bg-[var(--bone-3)] hover:bg-[var(--bone-6)] text-[var(--bone-60)] hover:text-[var(--bone-100)] transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
