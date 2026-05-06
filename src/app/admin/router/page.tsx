import { getRouterChains } from './actions'
import { getModels } from '@/app/admin/models/actions'
import RouterManager from '@/components/admin/RouterManager'
import AddCategoryButton from '@/components/admin/AddCategoryButton'
import { Cpu, Command, Share2, Zap, Wand2, Image, Mic, Brain, Camera, Code, Microscope } from 'lucide-react'

const CATEGORY_ICONS: Record<string, any> = {
  TOOL_CALLING: Command,
  WEB_SEARCH: Share2,
  FAST_SIMPLE: Zap,
  MEDIUM_THINKING: Wand2,
  COMPLEX_THINKING: Cpu,
  IMAGE_GEN: Image,
  AUDIO_VOICE: Mic,
  CLASSIFIER: Brain,
  VISION: Camera,
  CODING: Code,
  DEEP_RESEARCH: Microscope
}

export async function RouterPageContent({ platform }: { platform: 'app' | 'telegram' }) {
  const [routers, models] = await Promise.all([getRouterChains(platform), getModels()])

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display text-foreground mb-1">Router Orchestration</h1>
        <p className="text-muted-foreground text-sm font-medium">
          Multi-agent switching matrix — unified chain for all clients.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {routers.map((router: any) => {
          const Icon = CATEGORY_ICONS[router.category] || Cpu
          return (
            <RouterManager
              key={router.id}
              chain={router}
              title={router.category.replace(/_/g, ' ')}
              category={router.category}
              availableModels={models}
            />
          )
        })}
        {!routers.some((r: any) => r.category === 'CLASSIFIER') && (
          <AddCategoryButton platform={platform} category="CLASSIFIER" />
        )}
        {!routers.some((r: any) => r.category === 'VISION') && (
          <AddCategoryButton platform={platform} category="VISION" />
        )}
        {!routers.some((r: any) => r.category === 'CODING') && (
          <AddCategoryButton platform={platform} category="CODING" />
        )}
        {!routers.some((r: any) => r.category === 'DEEP_RESEARCH') && (
          <AddCategoryButton platform={platform} category="DEEP_RESEARCH" />
        )}
      </div>
    </div>
  )
}

export default async function RouterPage() {
  return <RouterPageContent platform="telegram" />
}
