import React, { useState } from 'react'
import { CheckCircle2, Circle, ChevronDown, ChevronRight, Copy, Trash2, Plus } from 'lucide-react'
import { RoadmapTask } from './RoadmapClient'
import { cn } from '@/lib/utils'

interface Props {
  task: RoadmapTask
  setTasks: React.Dispatch<React.SetStateAction<RoadmapTask[]>>
}

export default function TaskCard({ task, setTasks }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)

  const updateTask = async (updates: Partial<RoadmapTask>) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t))
    
    const res = await fetch('/api/admin/roadmap/tasks', {
      method: 'PATCH',
      body: JSON.stringify({ id: task.id, ...updates })
    })
    if (!res.ok) {
      // Revert on failure (simple version: just fetch all, but here we ignore for brevity)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return
    setTasks(prev => prev.filter(t => t.id !== task.id))
    await fetch('/api/admin/roadmap/tasks', {
      method: 'DELETE',
      body: JSON.stringify({ id: task.id })
    })
  }

  const toggleStatus = () => {
    const nextStatus = task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo'
    updateTask({ status: nextStatus })
  }

  const toggleSubTask = (index: number) => {
    const newSubs = [...(task.sub_tasks || [])]
    newSubs[index].done = !newSubs[index].done
    updateTask({ sub_tasks: newSubs })
  }

  const addSubTask = () => {
    const newSubs = [...(task.sub_tasks || []), { id: crypto.randomUUID(), title: 'New Sub-task', done: false }]
    updateTask({ sub_tasks: newSubs })
  }

  const copyPrompt = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(task.agent_prompt || '')
    // Add toast later
  }

  const statusColor = task.status === 'done' ? 'text-green-500' : task.status === 'in_progress' ? 'text-blue-400' : 'text-[var(--bone-30)]'
  const priorityColor = task.priority === 'critical' ? 'text-red-400 bg-red-400/10' :
                        task.priority === 'high' ? 'text-orange-400 bg-orange-400/10' :
                        task.priority === 'medium' ? 'text-yellow-400 bg-yellow-400/10' :
                        'text-[var(--bone-60)] bg-[var(--bone-6)]'

  return (
    <div className="flex flex-col border-none bg-white/5 hover:bg-white/10 rounded-[var(--radius-8)] transition-colors overflow-hidden">
      {/* Header (always visible) */}
      <div 
        className="flex items-center p-3 gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <button onClick={(e) => { e.stopPropagation(); toggleStatus(); }} className={cn("shrink-0", statusColor)}>
          {task.status === 'done' ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          {isEditingTitle ? (
            <input
              autoFocus
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={() => { setIsEditingTitle(false); updateTask({ title: editTitle }); }}
              onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
              className="bg-transparent text-[var(--bone-100)] text-sm font-medium outline-none w-full"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span 
              className={cn("text-sm font-medium truncate select-none", task.status === 'done' ? "text-[var(--bone-60)] line-through" : "text-[var(--bone-100)]")}
              onDoubleClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }}
            >
              {task.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide", priorityColor)}>
            {task.priority}
          </span>
          {task.tags?.map(tag => (
            <span key={tag} className="px-2 py-0.5 rounded bg-[var(--bone-6)] text-[var(--bone-60)] text-[10px] uppercase font-medium">
              {tag}
            </span>
          ))}
          <div className="w-5 h-5 flex items-center justify-center text-[var(--bone-40)]">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-4 pt-0 border-t border-[var(--bone-6)] flex flex-col gap-4 mt-2">
          
          {/* Description */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[var(--bone-60)] uppercase tracking-wide font-medium">Description</span>
            <textarea
              value={task.description}
              onChange={e => updateTask({ description: e.target.value })}
              placeholder="Add description..."
              className="w-full bg-transparent border border-transparent hover:border-[var(--bone-15)] focus:border-[var(--bone-30)] rounded p-2 text-sm text-[var(--bone-100)] outline-none resize-none min-h-[60px] transition-colors"
            />
          </div>

          {/* Sub Tasks */}
          <div className="flex flex-col gap-2">
            <span className="text-xs text-[var(--bone-60)] uppercase tracking-wide font-medium">Sub-tasks</span>
            <div className="flex flex-col gap-1.5">
              {task.sub_tasks?.map((st, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <button onClick={() => toggleSubTask(i)} className={st.done ? "text-green-500" : "text-[var(--bone-40)] hover:text-[var(--bone-60)]"}>
                    {st.done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  </button>
                  <input
                    value={st.title}
                    onChange={(e) => {
                      const newSubs = [...(task.sub_tasks || [])]
                      newSubs[i].title = e.target.value
                      updateTask({ sub_tasks: newSubs })
                    }}
                    className={cn("bg-transparent text-sm outline-none w-full border-b border-transparent focus:border-[var(--bone-30)] transition-colors", st.done ? "text-[var(--bone-60)] line-through" : "text-[var(--bone-100)]")}
                  />
                  <button 
                    onClick={() => {
                      const newSubs = [...(task.sub_tasks || [])]
                      newSubs.splice(i, 1)
                      updateTask({ sub_tasks: newSubs })
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[var(--bone-40)] hover:text-red-400 transition-all p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button 
                onClick={addSubTask}
                className="flex items-center gap-2 text-sm text-[var(--bone-60)] hover:text-[var(--bone-100)] transition-colors py-1 w-fit"
              >
                <Plus className="w-3.5 h-3.5" /> Add sub-task
              </button>
            </div>
          </div>

          {/* Agent Prompt */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--bone-60)] uppercase tracking-wide font-medium">Agent Prompt</span>
              <button 
                onClick={copyPrompt}
                className="flex items-center gap-1.5 text-xs text-[var(--bone-60)] hover:text-[var(--bone-100)] transition-colors px-2 py-1 rounded hover:bg-[var(--bone-6)]"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <textarea
              value={task.agent_prompt}
              onChange={e => updateTask({ agent_prompt: e.target.value })}
              placeholder="Prompt for coding assistant..."
              className="w-full bg-[var(--bone-6)] border-none rounded-[var(--radius-8)] p-3 text-sm text-[var(--bone-80)] font-mono outline-none resize-y min-h-[100px] transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-2">
            <button 
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-400/10 px-2 py-1.5 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Task
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
