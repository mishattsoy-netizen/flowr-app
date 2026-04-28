'use client'

import { useState, useTransition, useCallback } from 'react'
import ReactFlow, {
  Background, Controls,
  type Node, type Edge, type NodeMouseHandler,
  MarkerType, useNodesState, useEdgesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Plus, Trash2, X } from 'lucide-react'
import { addBrainEntry, deleteBrainEntry, toggleBrainEntry } from './actions'
import type { BrainEntry, BrainCategory } from './actions'
import { cn } from '@/lib/utils'

const CATEGORY_META: Record<BrainCategory, { label: string; color: string }> = {
  rules:       { label: 'Rules',       color: '#6366f1' },
  mistakes:    { label: 'Mistakes',    color: '#f87171' },
  patterns:    { label: 'Patterns',    color: '#4ade80' },
  personality: { label: 'Personality', color: '#a78bfa' },
  questions:   { label: 'Questions',   color: '#facc15' },
}

const CATEGORIES = Object.keys(CATEGORY_META) as BrainCategory[]

function buildGraph(entries: BrainEntry[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: 'brain',
      type: 'default',
      position: { x: 300, y: 180 },
      data: { label: '🧠 BRAIN' },
      style: {
        background: '#6366f1', color: '#fff', border: 'none',
        borderRadius: '50%', width: 70, height: 70,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 11,
      },
    },
  ]
  const edges: Edge[] = []
  const positions = [
    { x: 80,  y: 60  },
    { x: 500, y: 60  },
    { x: 580, y: 260 },
    { x: 460, y: 360 },
    { x: 60,  y: 300 },
  ]
  CATEGORIES.forEach((cat, i) => {
    const count = entries.filter(e => e.category === cat).length
    const pos = positions[i]
    const meta = CATEGORY_META[cat]
    nodes.push({
      id: cat,
      type: 'default',
      position: pos,
      data: { label: `${meta.label} (${count})` },
      style: {
        background: 'var(--color-background, #0f1117)',
        color: meta.color,
        border: `1.5px solid ${meta.color}`,
        borderRadius: 20,
        padding: '4px 14px',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap' as const,
      },
    })
    edges.push({
      id: `brain-${cat}`,
      source: 'brain',
      target: cat,
      style: { stroke: meta.color, strokeWidth: 1.5, opacity: 0.4 },
      markerEnd: { type: MarkerType.Arrow, color: meta.color },
    })
  })
  return { nodes, edges }
}

interface Props { initialEntries: BrainEntry[] }

export default function BrainClient({ initialEntries }: Props) {
  const [entries, setEntries] = useState<BrainEntry[]>(initialEntries)
  const [selected, setSelected] = useState<BrainCategory | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState<BrainCategory>('rules')
  const [isPending, startTransition] = useTransition()

  const { nodes: initNodes, edges: initEdges } = buildGraph(entries)
  const [nodes,, onNodesChange] = useNodesState(initNodes)
  const [edges,, onEdgesChange] = useEdgesState(initEdges)

  const onNodeClick = useCallback<NodeMouseHandler>((_evt, node) => {
    if (node.id === 'brain') { setSelected(null); return }
    setSelected(prev => prev === node.id ? null : node.id as BrainCategory)
  }, [])

  const visibleEntries = selected ? entries.filter(e => e.category === selected) : entries

  function handleAdd() {
    if (!newTitle.trim() || !newContent.trim()) return
    startTransition(async () => {
      await addBrainEntry(newCategory, newTitle.trim(), newContent.trim())
      setEntries(prev => [{
        id: crypto.randomUUID(),
        category: newCategory,
        title: newTitle.trim(),
        content: newContent.trim(),
        source: 'manual',
        is_active: true,
        created_at: new Date().toISOString(),
      }, ...prev])
      setNewTitle('')
      setNewContent('')
      setShowAdd(false)
    })
  }

  function handleDelete(id: string, title: string) {
    startTransition(async () => {
      await deleteBrainEntry(id, title)
      setEntries(prev => prev.filter(e => e.id !== id))
    })
  }

  function handleToggle(id: string, current: boolean) {
    startTransition(async () => {
      await toggleBrainEntry(id, !current)
      setEntries(prev => prev.map(e => e.id === id ? { ...e, is_active: !current } : e))
    })
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display text-foreground mb-1">Bot Brain</h1>
        <p className="text-muted-foreground text-sm font-medium">
          What the bot has learned. Click a node to filter entries.
        </p>
      </div>

      {/* Graph */}
      <div
        className="bg-[var(--bone-6)] border border-[var(--bone-10)] rounded-xl overflow-hidden"
        style={{ height: 300 }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable
          zoomOnScroll={false}
          panOnScroll={false}
          attributionPosition="bottom-right"
        >
          <Background gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {/* Filter chips + add button */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setSelected(null)}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium transition-all',
            !selected
              ? 'bg-[var(--bone-15)] text-foreground'
              : 'bg-[var(--bone-6)] text-muted-foreground hover:text-foreground'
          )}
        >
          All ({entries.length})
        </button>
        {CATEGORIES.map(cat => {
          const meta = CATEGORY_META[cat]
          const count = entries.filter(e => e.category === cat).length
          return (
            <button
              key={cat}
              onClick={() => setSelected(prev => prev === cat ? null : cat)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-all border',
                selected === cat ? 'text-white' : 'bg-[var(--bone-6)] text-muted-foreground hover:text-foreground'
              )}
              style={
                selected === cat
                  ? { background: meta.color, borderColor: meta.color }
                  : { borderColor: meta.color + '40' }
              }
            >
              {meta.label} ({count})
            </button>
          )
        })}
        <button
          onClick={() => setShowAdd(true)}
          className="ml-auto flex items-center gap-1 px-3 py-1 bg-foreground text-background rounded-full text-xs font-medium hover:opacity-80 transition-opacity"
        >
          <Plus className="w-3 h-3" /> Add Entry
        </button>
      </div>

      {/* Add entry form */}
      {showAdd && (
        <div className="bg-[var(--bone-6)] border border-[var(--bone-10)] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">New Brain Entry</h3>
            <button onClick={() => setShowAdd(false)}>
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
          <div className="flex gap-2">
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value as BrainCategory)}
              className="bg-background border border-[var(--bone-10)] rounded-lg px-3 py-1.5 text-sm text-foreground"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{CATEGORY_META[c].label}</option>
              ))}
            </select>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Short title (e.g. Don't over-use bullets)"
              className="flex-1 bg-background border border-[var(--bone-10)] rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--bone-30)]"
            />
          </div>
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="Detailed content..."
            rows={3}
            className="w-full bg-background border border-[var(--bone-10)] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[var(--bone-30)]"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={isPending || !newTitle.trim() || !newContent.trim()}
              className="px-4 py-1.5 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50"
            >
              {isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Entries list */}
      <div className="flex flex-col gap-2">
        {visibleEntries.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            No entries yet. Add one above.
          </p>
        )}
        {visibleEntries.map(entry => {
          const meta = CATEGORY_META[entry.category]
          return (
            <div
              key={entry.id}
              className={cn(
                'bg-[var(--bone-6)] border border-[var(--bone-10)] rounded-xl p-4 flex gap-3 items-start group transition-opacity',
                !entry.is_active && 'opacity-40'
              )}
            >
              <div
                className="w-1 self-stretch rounded-full flex-shrink-0"
                style={{ background: meta.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-foreground">{entry.title}</span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: meta.color + '20', color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  {!entry.is_active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bone-10)] text-muted-foreground font-medium">
                      disabled
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{entry.content}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                  Source: {entry.source.replace('_', ' ')} · {new Date(entry.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Toggle + delete (visible on hover) */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleToggle(entry.id, entry.is_active)}
                  title={entry.is_active ? 'Disable entry' : 'Enable entry'}
                  className={cn(
                    'p-1 rounded text-xs font-bold transition-colors',
                    entry.is_active
                      ? 'text-green-400 hover:text-[var(--bone-40)]'
                      : 'text-[var(--bone-30)] hover:text-green-400'
                  )}
                >
                  {entry.is_active ? '●' : '○'}
                </button>
                <button
                  onClick={() => handleDelete(entry.id, entry.title)}
                  className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
