'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Download } from 'lucide-react'
import PhaseStrip from './PhaseStrip'
import TaskCard from './TaskCard'
import PlanningAssistant from './PlanningAssistant'

export type RoadmapPhase = {
  id: string
  title: string
  description: string
  status: 'planned' | 'in_progress' | 'completed'
  sort_order: number
  color: string
  created_at?: string
  updated_at?: string
}

export type RoadmapTask = {
  id: string
  phase_id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high' | 'critical'
  sort_order: number
  sub_tasks: { id: string, title: string, done: boolean }[]
  tags: string[]
  agent_prompt: string
  prompt_context: string
  created_at?: string
  updated_at?: string
}

export type RoadmapRouterChain = {
  id: string
  category: string
  model_list: any[]
  system_prompt: string
  temperature?: number
}

interface Props {
  initialPhases: RoadmapPhase[]
  initialTasks: RoadmapTask[]
  initialRouterChains: RoadmapRouterChain[]
}

export default function RoadmapClient({ initialPhases, initialTasks, initialRouterChains }: Props) {
  const [phases, setPhases] = useState<RoadmapPhase[]>(initialPhases)
  const [tasks, setTasks] = useState<RoadmapTask[]>(initialTasks)
  const [activePhaseId, setActivePhaseId] = useState<string | null>(initialPhases[0]?.id || null)
  const [sidebarWidth, setSidebarWidth] = useState(400)
  const [isSidebarDragging, setIsSidebarDragging] = useState(false)

  // Overall progress
  const overallProgress = tasks.length === 0 ? 0 : Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100)
  const activePhaseTasks = tasks.filter(t => t.phase_id === activePhaseId).sort((a, b) => a.sort_order - b.sort_order)

  // Resizing logic
  const handleMouseDown = useCallback(() => { setIsSidebarDragging(true) }, [])
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isSidebarDragging) return
      // e.clientX is from left of screen.
      const newWidth = window.innerWidth - e.clientX
      setSidebarWidth(Math.min(Math.max(newWidth, 300), 600))
    }
    const handleMouseUp = () => setIsSidebarDragging(false)
    if (isSidebarDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isSidebarDragging])

  // Export functions
  const calculateProgress = (phaseTasks: RoadmapTask[]) => {
    if (phaseTasks.length === 0) return 0
    return Math.round((phaseTasks.filter(t => t.status === 'done').length / phaseTasks.length) * 100)
  }

  const exportPhaseAsMarkdown = (phase: RoadmapPhase, phaseTasks: RoadmapTask[]) => {
    let md = `# Phase: ${phase.title}\n`
    md += `**Status:** ${phase.status} | **Progress:** ${calculateProgress(phaseTasks)}%\n`
    if (phase.description) md += `\n${phase.description}\n`
    md += `\n---\n`

    phaseTasks.forEach((task, i) => {
      md += `\n## Task ${i + 1}: ${task.title}\n`
      md += `**Priority:** ${task.priority} | **Status:** ${task.status}\n`
      if (task.description) md += `\n${task.description}\n`
      if (task.agent_prompt) md += `\n### Agent Prompt\n\`\`\`text\n${task.agent_prompt}\n\`\`\`\n`
      if (task.sub_tasks?.length) {
        md += `\n### Sub-tasks\n`
        task.sub_tasks.forEach((st: any) => {
          md += `- [${st.done ? 'x' : ' '}] ${st.title}\n`
        })
      }
      if (task.tags?.length) md += `\n**Tags:** ${task.tags.join(', ')}\n`
    })
    return md
  }

  const handleExportAll = () => {
    const allMd = phases.map(p => exportPhaseAsMarkdown(p, tasks.filter(t => t.phase_id === p.id))).join('\n\n')
    navigator.clipboard.writeText(allMd)
    alert('Copied to clipboard!') // Replace with toast later
  }

  return (
    <div className="flex flex-col h-full w-full" style={{ paddingRight: sidebarWidth }}>
      {/* Left Zone: Roadmap Content */}
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-8 shrink-0 border-b border-[var(--bone-6)]">
          <div className="max-w-[1200px] mx-auto w-full flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-normal tracking-tight leading-none text-[var(--bone-100)]">Project Roadmap</h1>
              <div className="flex items-center gap-3 mt-2 text-[var(--bone-60)] text-sm">
                <span>Overall Progress</span>
                <div className="w-48 h-2 bg-[var(--bone-6)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--bone-100)]" style={{ width: `${overallProgress}%` }} />
                </div>
                <span>{overallProgress}%</span>
              </div>
            </div>
            <button 
              onClick={handleExportAll}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bone-6)] hover:bg-[var(--bone-10)] text-[var(--bone-100)] text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export All
            </button>
          </div>
        </div>

        {/* Phase Strip */}
        <div className="px-8 py-4 shrink-0 border-b border-[var(--bone-6)] bg-[var(--bone-2)]">
          <div className="max-w-[1200px] mx-auto w-full overflow-x-auto custom-scrollbar">
            <PhaseStrip 
              phases={phases} 
              tasks={tasks}
              activePhaseId={activePhaseId} 
              setActivePhaseId={setActivePhaseId}
              setPhases={setPhases}
            />
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar bg-[var(--bone-2)]">
          <div className="max-w-[1200px] mx-auto w-full flex flex-col gap-3">
            {activePhaseTasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                setTasks={setTasks}
              />
            ))}
            {activePhaseId && (
              <button 
                onClick={async () => {
                  const res = await fetch('/api/admin/roadmap/tasks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phase_id: activePhaseId, title: 'New Task' })
                  })
                  if (res.ok) {
                    const newTask = await res.json()
                    setTasks(prev => [...prev, newTask])
                  }
                }}
                className="w-full py-4 rounded-[var(--radius-8)] bg-[var(--bone-6)] hover:bg-[var(--bone-10)] text-[var(--bone-60)] hover:text-[var(--bone-100)] transition-all flex items-center justify-center font-medium text-sm"
              >
                + Add Task
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right Zone: Planning Assistant */}
      <div 
        className="fixed top-0 right-0 h-screen bg-sidebar border-l border-[var(--bone-6)] z-30 flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-right duration-300"
        style={{ width: sidebarWidth }}
      >
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-[var(--bone-30)] active:bg-[var(--bone-100)] transition-colors z-40"
          onMouseDown={handleMouseDown}
        />
        <div className="flex-1 overflow-hidden">
          <PlanningAssistant 
            phases={phases}
            tasks={tasks}
            setPhases={setPhases}
            setTasks={setTasks}
            routerChains={initialRouterChains}
          />
        </div>
      </div>
    </div>
  )
}
