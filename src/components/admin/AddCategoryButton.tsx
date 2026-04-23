'use client'

import { Plus } from 'lucide-react'
import { createRouterChain } from '@/app/admin/router/actions'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export default function AddCategoryButton({ platform, category }: { platform: 'app' | 'telegram', category: string }) {
  const [isPending, setIsPending] = useState(false)

  const handleCreate = async () => {
    setIsPending(true)
    try {
      await createRouterChain(platform, category)
    } catch (e) {
      console.error(e)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <button 
      onClick={handleCreate}
      disabled={isPending}
      className="group flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-white/5 rounded-big hover:border-accent/20 hover:bg-accent/5 transition-all w-full"
    >
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-accent/10 transition-all border border-transparent group-hover:border-accent/20">
        <Plus className={cn("w-5 h-5 transition-all", isPending ? "animate-spin opacity-40" : "text-muted-foreground group-hover:text-accent")} />
      </div>
      <div className="text-center">
        <div className="text-[11px] font-ui-label font-bold text-muted-foreground uppercase tracking-widest opacity-40 group-hover:opacity-100">
          Initialize {category}
        </div>
        <p className="text-[10px] font-medium text-muted-foreground opacity-30 mt-1 max-w-[200px]">
          Create orchestration registry for {category.toLowerCase()}
        </p>
      </div>
    </button>
  )
}
