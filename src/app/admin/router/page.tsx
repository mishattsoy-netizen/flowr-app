import { getRouterChains } from './actions'
import { getModels } from '@/app/admin/models/actions'
import RouterManager from '@/components/admin/RouterManager'
import AddCategoryButton from '@/components/admin/AddCategoryButton'
import { Cpu, Command, Share2, Zap, Wand2, Image, Mic, Brain, Camera } from 'lucide-react'

const CATEGORY_ICONS: Record<string, any> = {
  TOOL_CALLING: Command,
  WEB_SEARCH: Share2,
  FAST_SIMPLE: Zap,
  MEDIUM_THINKING: Wand2,
  COMPLEX_THINKING: Cpu,
  IMAGE_GEN: Image,
  AUDIO_VOICE: Mic,
  CLASSIFIER: Brain,
  VISION: Camera
}

export async function RouterPageContent({ platform }: { platform: 'app' | 'telegram' }) {
  const [routers, models] = await Promise.all([getRouterChains(platform), getModels()])

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display text-foreground mb-1">Router Orchestration</h1>
        <p className="text-muted-foreground text-sm font-medium">
          {platform === 'app' ? 'Web app' : 'Telegram bot'} — multi-agent switching matrix.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {routers.map((router: any) => {
          const Icon = CATEGORY_ICONS[router.category] || Cpu
          return (
            <RouterManager
              key={router.id}
              chain={router}
              title={`${router.category.replace(/_/g, ' ')} Registry`}
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
      </div>
    </div>
  )
}

export default async function RouterPage() {
  return <RouterPageContent platform="telegram" />
}
