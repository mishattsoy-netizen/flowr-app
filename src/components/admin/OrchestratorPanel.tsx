'use client'
import { useState, useTransition } from 'react'
import { Network, Settings2, Info } from 'lucide-react'
import { Toggle } from '@/components/ui/Toggle'
import { savePipelineSetting } from '@/app/admin/router/actions'
import OrchestratorTestTool from './OrchestratorTestTool'

interface Props {
  settings: {
    orchestrator_enabled?: boolean
    max_pipeline_steps?: number
    image_gen_auto_last?: boolean
    history_limit?: number
  }
}

export default function OrchestratorPanel({ settings }: Props) {
  const [orchestratorOn, setOrchestratorOn] = useState(settings.orchestrator_enabled !== false)
  const [maxSteps, setMaxSteps] = useState(settings.max_pipeline_steps ?? 7)
  const [historyLimit, setHistoryLimit] = useState(settings.history_limit ?? 10)
  const [autoLast, setAutoLast] = useState(settings.image_gen_auto_last !== false)
  const [, startTransition] = useTransition()

  const handleUpdate = (key: string, value: any, setter: (v: any) => void) => {
    setter(value)
    startTransition(() => {
      savePipelineSetting(key, value)
    })
  }

  return (
    <section className="flex flex-col gap-4 p-4 rounded-[16px] bg-white/5 border border-white/5">
      <div className="flex items-center gap-3">
        <Network className="w-5 h-5 text-accent" />
        <div>
          <h2 className="text-sm font-bold text-bone-100 uppercase tracking-wider">Multi-Chain Orchestrator</h2>
          <p className="text-[11px] text-bone-60">sequential chain execution & reasoning pipeline</p>
        </div>
        <div className="ml-auto">
          <Toggle checked={orchestratorOn} onChange={v => handleUpdate('orchestrator_enabled', v, setOrchestratorOn)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-bone-80 font-medium">Max Pipeline Steps</span>
                <Info className="w-3 h-3 text-bone-40 cursor-help" />
              </div>
              <p className="text-[10px] text-bone-40 italic">Max steps in a single reasoning loop</p>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="range" min={3} max={12} step={1} value={maxSteps}
                onChange={e => handleUpdate('max_pipeline_steps', parseInt(e.target.value), setMaxSteps)}
                className="w-24 accent-accent" 
              />
              <span className="text-xs font-mono text-accent w-5">{maxSteps}</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/5 pt-4">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-bone-80 font-medium">Conversation History Limit</span>
                <Info className="w-3 h-3 text-bone-40 cursor-help" />
              </div>
              <p className="text-[10px] text-bone-40 italic">Number of past messages to include in context</p>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="range" min={2} max={50} step={2} value={historyLimit}
                onChange={e => handleUpdate('history_limit', parseInt(e.target.value), setHistoryLimit)}
                className="w-24 accent-accent" 
              />
              <span className="text-xs font-mono text-accent w-5">{historyLimit}</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/5 pt-4">
            <span className="text-xs text-bone-80 font-medium">Auto-Last Image Gen</span>
            <Toggle checked={autoLast} onChange={v => handleUpdate('image_gen_auto_last', v, setAutoLast)} />
          </div>
          <p className="text-[10px] text-bone-40 leading-relaxed">
            When enabled, IMAGE_GEN chains are always moved to the final data step of the sequence to ensure they have full context from search or research.
          </p>
        </div>

        <div className="bg-background/40 rounded-[12px] p-3 border border-white/5">
          <p className="text-[10px] font-bold text-bone-60 uppercase tracking-widest mb-2">Diagnostic Tool</p>
          <OrchestratorTestTool />
        </div>
      </div>
    </section>
  )
}
