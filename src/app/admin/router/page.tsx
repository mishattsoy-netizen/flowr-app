import { getRouterChains } from './actions'
import { getModels } from '@/app/admin/models/actions'
import RouterManager from '@/components/admin/RouterManager'
import AddCategoryButton from '@/components/admin/AddCategoryButton'
import { Cpu, Command, Share2, Zap, Image, Mic, Brain, Camera, Code, Microscope, Sparkles, Maximize2, FileText, MessageSquareMore, GripHorizontal } from 'lucide-react'

const CATEGORY_ICONS: Record<string, any> = {
  REGULAR: MessageSquareMore,
  COMPLEX: Cpu,
  CODING: Code,
  WEB_SEARCH: Share2,
  RESEARCH: Microscope,
  TOOLS: Command,
  IMAGE_GEN: Image,
  VISION: Camera,
  AUDIO: Mic,
  CLASSIFIER: Brain,
  THINKING: Sparkles,
  ADVISOR: Brain,
  COMPACTION: FileText,
  // Legacy  — still displayed with fallback icon
}

export async function RouterPageContent({ platform }: { platform: 'app' | 'telegram' }) {
  const [routers, models] = await Promise.all([getRouterChains(platform), getModels()])

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display font-medium text-foreground mb-1">Router Matrix</h1>
        <p className="text-muted-foreground text-sm font-medium">
          Chain routing configuration — each chain is a mini-orchestrator with input/output contracts.
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
        {!routers.some((r: any) => r.category === 'REGULAR') && (
          <AddCategoryButton platform={platform} category="REGULAR" />
        )}
        {!routers.some((r: any) => r.category === 'COMPLEX') && (
          <AddCategoryButton platform={platform} category="COMPLEX" />
        )}
        {!routers.some((r: any) => r.category === 'VISION') && (
          <AddCategoryButton platform={platform} category="VISION" />
        )}
        {!routers.some((r: any) => r.category === 'CODING') && (
          <AddCategoryButton platform={platform} category="CODING" />
        )}
        {!routers.some((r: any) => r.category === 'WEB_SEARCH') && (
          <AddCategoryButton platform={platform} category="WEB_SEARCH" />
        )}
        {!routers.some((r: any) => r.category === 'RESEARCH') && (
          <AddCategoryButton platform={platform} category="RESEARCH" />
        )}
        {!routers.some((r: any) => r.category === 'TOOLS') && (
          <AddCategoryButton platform={platform} category="TOOLS" />
        )}
        {!routers.some((r: any) => r.category === 'IMAGE_GEN') && (
          <AddCategoryButton platform={platform} category="IMAGE_GEN" />
        )}
        {!routers.some((r: any) => r.category === 'AUDIO') && (
          <AddCategoryButton platform={platform} category="AUDIO" />
        )}
        {!routers.some((r: any) => r.category === 'CLASSIFIER') && (
          <AddCategoryButton platform={platform} category="CLASSIFIER" />
        )}
        {!routers.some((r: any) => r.category === 'THINKING') && (
          <AddCategoryButton platform={platform} category="THINKING" />
        )}
        {!routers.some((r: any) => r.category === 'ADVISOR') && (
          <AddCategoryButton platform={platform} category="ADVISOR" />
        )}

        {!routers.some((r: any) => r.category === 'COMPACTION') && (
          <AddCategoryButton platform={platform} category="COMPACTION" />
        )}
      </div>
    </div>
  )
}

export default async function RouterPage() {
  return <RouterPageContent platform="telegram" />
}
