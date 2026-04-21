import { getRouterChains } from './actions'
import RouterManager from '@/components/admin/RouterManager'
import { Cpu, Command, Share2, Zap, Wand2, Image, Mic } from 'lucide-react'

const CATEGORY_ICONS: Record<string, any> = {
  TOOL_CALLING: Command,
  WEB_SEARCH: Share2,
  FAST_SIMPLE: Zap,
  MEDIUM_THINKING: Wand2,
  COMPLEX_THINKING: Cpu,
  IMAGE_GEN: Image,
  AUDIO_VOICE: Mic
}

export async function RouterPageContent({ platform }: { platform: 'app' | 'telegram' }) {
  const routers = await getRouterChains(platform)

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="flex flex-col gap-0.5 mb-2">
        <h1 className="text-3xl font-black tracking-tight text-bone-100 font-instrument text-chromatic">Router Orchestration</h1>
        <p className="text-bone-60 text-[10px] font-black tracking-[0.05em] opacity-40 uppercase">
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
            />
          )
        })}
      </div>
    </div>
  )
}

export default async function RouterPage() {
  return <RouterPageContent platform="telegram" />
}
