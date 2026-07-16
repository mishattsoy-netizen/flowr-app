export interface LogEntryLight {
  level: string
  message: string
  timestamp: string
}

export interface TranscriptData {
  prompt: string
  history?: any[]
  context?: any
  category?: string
  classificationTrace?: any[]
  routingTrace?: any[]
  systemPrompt?: string
  globalPrompt?: string
  internalPrompt?: string
  routerPrompt?: string
  dateContext?: string
  currentSummary?: string | null
  visionNotes?: string
  replyContext?: any
  thinkingEnabled?: boolean
  advisorEnabled?: boolean
  mode?: string
  stepTraces?: any[]
  pipelineSteps?: any[]
  finalContent?: string
  finalModel?: string
  citations?: string[]
  tokensUsed?: number
  providerUsage?: any
  providerReasoning?: string
  chainDuration?: number
  usageType?: string
  modelChain?: string
  capturedLogs?: LogEntryLight[]
  capturedToolCalls?: any[]
}

import { getCapturedLogs } from '../logger'

export function buildTranscript(d: TranscriptData): string {
  const rawLogs = (d.capturedLogs && d.capturedLogs.length > 0) ? d.capturedLogs : getCapturedLogs()
  const logs = rawLogs
    .filter((l: LogEntryLight) => {
      if (l.message.includes('PAYLOAD') || l.message.includes('[DEBUG]')) return false
      return true
    })
    .map((l: LogEntryLight) => l.message.length > 2000
      ? { ...l, message: l.message.slice(0, 2000) + ` … [truncated ${l.message.length - 2000} chars]` }
      : l)
  const lines: string[] = []
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const dateFile = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  lines.push(`# AI Transcript — ${ts}`)
  lines.push('')

  // ── Request ──
  lines.push('## Request')
  lines.push('')
  lines.push(d.prompt || '(empty)')
  lines.push('')

  // ── Settings & Context ──
  lines.push('## Settings & Context')
  lines.push('')
  if (d.mode) lines.push(`- **Mode:** ${d.mode}`)
  if (d.thinkingEnabled !== undefined) lines.push(`- **Thinking:** ${d.thinkingEnabled}`)
  if (d.advisorEnabled !== undefined) lines.push(`- **Advisor:** ${d.advisorEnabled}`)
  if (d.category) lines.push(`- **Category:** ${d.category}`)
  if (d.usageType) lines.push(`- **Usage Type:** ${d.usageType}`)
  if (d.finalModel) lines.push(`- **Final Model:** ${d.finalModel}`)
  if (d.tokensUsed) lines.push(`- **Tokens Used:** ${d.tokensUsed}`)
  if (d.chainDuration) lines.push(`- **Duration:** ${d.chainDuration}ms`)
  if (d.modelChain) lines.push(`- **Model Chain:** ${d.modelChain}`)
  lines.push('')

  // ── Failed Models (early summary, before verbose sections) ──
  if (d.routingTrace) {
    const failures = d.routingTrace.filter((r: any) => !r.success)
    if (failures.length > 0) {
      lines.push('## Failed Models')
      lines.push('')
      lines.push('| Model | Category | Error |')
      lines.push('|-------|----------|-------|')
      for (const r of failures) {
        const model = r.model || '?'
        const cat = r.category || '—'
        const err = r.error || (r.status === 'empty' ? 'Empty response' : r.status || 'Unknown error')
        lines.push(`| ${model} | ${cat} | ${err} |`)
      }
      lines.push('')
    }
  }

  // ── Live Logs (captured runtime logs, excluding long payload dumps) ──
  if (logs.length > 0) {
    lines.push('## Live Logs')
    lines.push('')
    for (const log of logs) {
      const time = log.timestamp.slice(11, 19)
      lines.push(`[${time}] ${log.level} → ${log.message}`)
    }
    lines.push('')
  }

  // ── Context / State ──
  if (d.replyContext) {
    lines.push('### Reply Context')
    lines.push('')
    lines.push('```json')
    lines.push(JSON.stringify(d.replyContext, null, 2))
    lines.push('```')
    lines.push('')
  }

  if (d.currentSummary) {
    lines.push('### Session Summary')
    lines.push('')
    lines.push(d.currentSummary)
    lines.push('')
  }

  if (d.visionNotes) {
    lines.push('### Vision Notes')
    lines.push('')
    lines.push(d.visionNotes)
    lines.push('')
  }

  if (d.context) {
    const ctx = { ...d.context }
    delete ctx.onStatus
    delete ctx.onChunk
    delete ctx.aiApiKey
    delete ctx.clientHistory
    delete ctx.history
    if (Object.keys(ctx).length > 0) {
      lines.push('### Full Context')
      lines.push('')
      lines.push('```json')
      lines.push(JSON.stringify(ctx, null, 2))
      lines.push('```')
      lines.push('')
    }
  }

  // ── History ──
  if (d.history && d.history.length > 0) {
    lines.push('## History')
    lines.push('')
    for (const msg of d.history) {
      const role = msg.role || 'unknown'
      const content = msg.parts?.[0]?.text ?? (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))
      lines.push(`### ${role}`)
      lines.push('')
      lines.push(content || '(empty)')
      lines.push('')
    }
  }

  // ── System Prompt ──
  if (d.systemPrompt || d.globalPrompt || d.internalPrompt || d.routerPrompt || d.dateContext) {
    lines.push('## System Prompts')
    lines.push('')
    if (d.dateContext) {
      lines.push('### Date Context')
      lines.push('')
      lines.push('```')
      lines.push(d.dateContext)
      lines.push('```')
      lines.push('')
    }
    if (d.globalPrompt) {
      lines.push('### Global Prompt (Persona/Rules)')
      lines.push('')
      lines.push('```')
      lines.push(d.globalPrompt)
      lines.push('```')
      lines.push('')
    }
    if (d.internalPrompt) {
      lines.push('### Internal Pipeline Prompt')
      lines.push('')
      lines.push('```')
      lines.push(d.internalPrompt)
      lines.push('```')
      lines.push('')
    }
    if (d.routerPrompt) {
      lines.push('### Router Override Prompt')
      lines.push('')
      lines.push('```')
      lines.push(d.routerPrompt)
      lines.push('```')
      lines.push('')
    }
  }

  // ── Classification ──
  if (d.classificationTrace && d.classificationTrace.length > 0) {
    lines.push('## Classification')
    lines.push('')
    lines.push('```json')
    lines.push(JSON.stringify(d.classificationTrace, null, 2))
    lines.push('```')
    lines.push('')
  }

  // ── Pipeline Steps (think chain, orchestrator) ──
  if (d.pipelineSteps && d.pipelineSteps.length > 0) {
    lines.push('## Pipeline Steps')
    lines.push('')
    for (const step of d.pipelineSteps) {
      lines.push(`### ${step.chain} — ${step.status}`)
      if (step.goal) lines.push(`- **Goal:** ${step.goal}`)
      if (step.label) lines.push(`- **Label:** ${step.label}`)
      if (step.output) lines.push(`- **Output:** ${step.output}`)
      lines.push('')
    }
  }

  // ── Chain Traces (every model attempt) ──
  if (d.stepTraces && d.stepTraces.length > 0) {
    lines.push('## Chain Execution Traces')
    lines.push('')
    for (const t of d.stepTraces) {
      lines.push(`### ${t.chain} → ${t.model} (${t.provider}) — ${t.success ? '✅' : '❌'} ${t.duration_ms}ms`)
      if (t.input_system) {
        lines.push('')
        lines.push('**System Input:**')
        lines.push('```')
        lines.push(t.input_system)
        lines.push('```')
      }
      if (t.input_user) {
        lines.push('')
        lines.push('**User Input:**')
        lines.push('```')
        lines.push(t.input_user)
        lines.push('```')
      }
      if (t.reasoning) {
        lines.push('')
        lines.push('**Reasoning:**')
        lines.push('```')
        lines.push(t.reasoning)
        lines.push('```')
      }
      if (t.output) {
        lines.push('')
        lines.push('**Output:**')
        lines.push('```')
        lines.push(t.output)
        lines.push('```')
      }
      if (t.error) {
        lines.push('')
        lines.push('**Error:**')
        lines.push('```')
        lines.push(t.error)
        lines.push('```')
      }
      if (t.prompt_tokens !== undefined || t.completion_tokens !== undefined || t.total_tokens !== undefined) {
        lines.push('')
        lines.push(`**Tokens:** ${t.prompt_tokens ?? '?'} in / ${t.completion_tokens ?? '?'} out / ${t.total_tokens ?? '?'} total`)
      }
      if (t.cost !== undefined) {
        lines.push(`**Cost:** \$${t.cost.toFixed(6)}`)
      }
      lines.push('')
    }
  }

  // ── Routing Trace ──
  if (d.routingTrace && d.routingTrace.length > 0) {
    lines.push('## Routing Trace')
    lines.push('')
    lines.push('```json')
    lines.push(JSON.stringify(d.routingTrace, null, 2))
    lines.push('```')
    lines.push('')
  }

  // ── Reasoning ──
  if (d.providerReasoning) {
    lines.push('## Reasoning / Chain of Thought')
    lines.push('')
    lines.push('```')
    lines.push(d.providerReasoning)
    lines.push('```')
    lines.push('')
  }

  // ── Tool Calls ──
  if (d.capturedToolCalls && d.capturedToolCalls.length > 0) {
    lines.push('## Tool Calls')
    lines.push('')
    lines.push('```json')
    lines.push(JSON.stringify(d.capturedToolCalls, null, 2))
    lines.push('```')
    lines.push('')
  }

  // ── Final Response ──
  lines.push('## Response')
  lines.push('')
  if (d.citations && d.citations.length > 0) {
    lines.push('### Citations')
    for (const c of d.citations) {
      lines.push(`- ${c}`)
    }
    lines.push('')
  }
  lines.push('```')
  lines.push(d.finalContent || '(empty)')
  lines.push('```')
  lines.push('')

  return lines.join('\n')
}
