'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RouterManager from './RouterManager'
import { createRouterChain } from '@/app/admin/router/actions'
import type { RegistryModel } from './model-utils'

export default function RouterCategoryCard({
  category,
  mode,
  defaultChain,
  proChain,
  availableModels,
}: {
  category: string
  mode: 'default' | 'pro'
  defaultChain: any
  proChain: any | null
  availableModels?: RegistryModel[]
}) {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const activeChain = mode === 'default' ? defaultChain : proChain

  const handleCreatePro = async () => {
    setIsCreating(true)
    try {
      await createRouterChain(category, 'pro')
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setIsCreating(false)
    }
  }

  if (activeChain) {
    return (
      <RouterManager
        key={activeChain.id}
        chain={activeChain}
        title={`${category.replace(/_/g, ' ')} (${mode === 'default' ? 'Default' : 'Pro'})`}
        category={category}
        availableModels={availableModels}
      />
    )
  }

  return (
    <button
      onClick={handleCreatePro}
      disabled={isCreating}
      className="group flex flex-col items-center justify-center gap-3 p-8 bg-white/[0.02] border border-[var(--bone-6)] rounded-big hover:bg-accent/5 transition-all w-full disabled:opacity-50"
    >
      <div className="text-center">
        <div className="text-[11px] font-ui-label font-bold text-muted-foreground uppercase tracking-widest opacity-40 group-hover:opacity-100">
          {isCreating ? 'Creating…' : `Add Pro override for ${category}`}
        </div>
        <p className="text-[10px] font-medium text-muted-foreground opacity-30 mt-1 max-w-[200px]">
          Create orchestration chain for {category.toLowerCase()} (Pro). Falls back to Default until configured.
        </p>
      </div>
    </button>
  )
}
