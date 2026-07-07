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

const ALL_CATEGORIES = [
  'REGULAR', 'COMPLEX', 'VISION', 'CODING', 'WEB_SEARCH', 'RESEARCH',
  'IMAGE_GEN', 'AUDIO', 'CLASSIFIER', 'THINKING', 'ADVISOR', 'COMPACTION',
]

export async function RouterPageContent({ platform }: { platform: 'app' | 'telegram' }) {
  const [routers, models] = await Promise.all([getRouterChains(platform), getModels()])

  // Group rows by category so each category can show its default + pro chain side by side
  const byCategory = new Map<string, { default?: any; pro?: any }>()
  for (const router of routers) {
    const entry = byCategory.get(router.category) ?? {}
    entry[router.mode === 'pro' ? 'pro' : 'default'] = router
    byCategory.set(router.category, entry)
  }

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display font-medium text-foreground mb-1">Router Matrix</h1>
        <p className="text-muted-foreground text-sm font-medium">
          Chain routing configuration — each chain is a mini-orchestrator with input/output contracts. Default and Pro modes route independently; Pro falls back to Default when unconfigured.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {ALL_CATEGORIES.map((category) => {
          const entry = byCategory.get(category)
          const Icon = CATEGORY_ICONS[category] || Cpu

          if (!entry?.default) {
            return <AddCategoryButton key={category} platform={platform} category={category} mode="default" />
          }

          return (
            <div key={category} className="space-y-2">
              <RouterManager
                chain={entry.default}
                title={`${category.replace(/_/g, ' ')} (Default)`}
                category={category}
                availableModels={models}
              />
              {entry.pro ? (
                <RouterManager
                  chain={entry.pro}
                  title={`${category.replace(/_/g, ' ')} (Pro)`}
                  category={category}
                  availableModels={models}
                />
              ) : (
                <AddCategoryButton platform={platform} category={category} mode="pro" label={`Add Pro override for ${category}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default async function RouterPage() {
  return <RouterPageContent platform="telegram" />
}
