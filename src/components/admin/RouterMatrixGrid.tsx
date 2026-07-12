'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import RouterCategoryCard from './RouterCategoryCard'
import AddCategoryButton from './AddCategoryButton'
import type { RegistryModel } from './model-utils'

const ALL_CATEGORIES = [
  'REGULAR', 'COMPLEX', 'VISION', 'CODING', 'WEB_SEARCH', 'RESEARCH',
  'IMAGE_GEN', 'AUDIO', 'CLASSIFIER', 'THINKING', 'ADVISOR', 'COMPACTION',
  'PRIMARY_SMART', 'PRIMARY_LIGHT',
]

export default function RouterMatrixGrid({
  byCategory,
  models,
}: {
  byCategory: Record<string, { default?: any; pro?: any }>
  models: RegistryModel[]
}) {
  const [mode, setMode] = useState<'default' | 'pro'>('default')

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-medium text-foreground mb-1">Router Matrix</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Chain routing configuration — each chain is a mini-orchestrator with input/output contracts. Pro falls back to Default when unconfigured.
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0 mt-2">
          <button
            onClick={() => setMode('default')}
            className={cn(
              'px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wide transition-all duration-0',
              mode === 'default' ? 'bg-accent/20 text-accent' : 'text-bone-60 hover:text-foreground hover:bg-white/5'
            )}
          >
            Default
          </button>
          <button
            onClick={() => setMode('pro')}
            className={cn(
              'px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wide transition-all duration-0',
              mode === 'pro' ? 'bg-accent/20 text-accent' : 'text-bone-60 hover:text-foreground hover:bg-white/5'
            )}
          >
            Pro
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {ALL_CATEGORIES.map((category) => {
          const entry = byCategory[category]

          if (!entry?.default) {
            return <AddCategoryButton key={category} category={category} mode="default" />
          }

          return (
            <RouterCategoryCard
              key={category}
              category={category}
              mode={mode}
              defaultChain={entry.default}
              proChain={entry.pro ?? null}
              availableModels={models}
            />
          )
        })}
      </div>
    </div>
  )
}
