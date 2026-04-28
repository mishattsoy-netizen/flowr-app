import { getPresets } from './actions'
import PresetsList from '@/app/admin/presets/PresetsList'
import PresetForm from '@/app/admin/presets/PresetForm'
import { Zap } from 'lucide-react'

export default async function PresetsPage() {
  const presets = await getPresets()

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display text-foreground mb-1">Tier Presets</h1>
        <p className="text-muted-foreground text-sm font-medium">Configure usage limits and access levels for your user base.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[10px] items-start">
        <div className="lg:col-span-1">
           <div className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col sticky top-10 transition-all duration-200 hover:bg-white/[0.02] hover:-translate-y-0.5">
            <h2 className="text-[10px] font-bold text-bone-60 mb-6 flex items-center gap-2 tracking-[0.05em] uppercase opacity-50">
              <Zap className="w-3.5 h-3.5 text-accent" />
              Register new tier
            </h2>
            <PresetForm />
          </div>
        </div>

        <div className="lg:col-span-2">
           <PresetsList initialPresets={presets} />
        </div>
      </div>
    </div>
  )
}
