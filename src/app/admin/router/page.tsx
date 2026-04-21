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
      <div className="flex flex-col gap-1.5 mb-2">
        <h1 className="text-3xl font-bold tracking-tight text-bone-100 font-instrument">Router Orchestration</h1>
        <p className="text-bone-60 text-[11px] font-bold tracking-tight opacity-60">
          {platform === 'app' ? 'Web app' : 'Telegram bot'} — real-time switching matrix for multi-agent model chains.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-[10px]">
        {routers.map((router: any) => {
          const Icon = CATEGORY_ICONS[router.category] || Cpu
          return (
            <div key={router.id} className="space-y-[6px]">
              <div className="flex items-center gap-2.5 px-6 pt-2">
                <Icon className="w-3.5 h-3.5 text-accent" strokeWidth={1.5} />
                <h3 className="text-[10px] font-black text-bone-60 tracking-[0.1em] uppercase opacity-50">
                  {router.category.replace(/_/g, ' ')} Registry
                </h3>
              </div>
              <RouterManager chain={router} />
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
