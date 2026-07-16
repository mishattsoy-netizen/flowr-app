export interface BrainRow {
  id: string
  user_id: string
  title: string
  description: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface BrainNodeRow {
  id: string
  user_id: string
  brain_id: string
  type: 'workspace' | 'entity' | 'memory' | 'section'
  ref_id: string | null
  content: string | null
  label: string | null
  section_id: string | null
  priority: number
  pinned: boolean
  enabled: boolean
  created_by: 'user' | 'bot'
  position: { x: number; y: number } | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface BrainEdgeRow {
  id: string
  user_id: string
  brain_id: string
  from_node: string
  to_node: string
  label: string
  created_by: 'user' | 'bot'
  deleted_at: string | null
  created_at: string
}

export interface BrainConfigRow {
  tier: string
  token_limit: number
  per_node_cap: number
}

/** Node ready for the pure compiler: refs resolved (or null = broken). */
export interface CompileNode {
  id: string
  type: BrainNodeRow['type']
  label: string | null
  content: string | null
  section_id: string | null
  priority: number
  pinned: boolean
  enabled: boolean
  created_at: string
  updated_at: string
  resolved: null | {
    title: string
    markdown: string
    description?: string | null
    noteCount?: number
    taskCount?: number
    childTitles?: string[]
  }
}

export interface CompileEdge {
  from_node: string
  to_node: string
  label: string
}

export interface CompiledBrain {
  compiled: string          // '' when the brain is empty — no [BRAIN] block injected
  tokenCount: number
  droppedNodeIds: string[]  // enabled nodes excluded by the budget
  brokenNodeIds: string[]   // ref nodes whose entity is gone/unowned
}
