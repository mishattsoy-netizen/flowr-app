import { getPresets } from './actions'
import PresetsList from '@/app/admin/presets/PresetsList'
import PresetForm from '@/app/admin/presets/PresetForm'
import { Zap } from 'lucide-react'

export default async function PresetsPage() {
  const presets = await getPresets()

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="flex flex-col gap-1.5 mb-2">
        <h1 className="text-3xl font-bold tracking-tight text-bone-100 font-instrument">Tier Presets</h1>
        <p className="text-bone-60 text-[11px] font-bold tracking-tight opacity-60">Configure usage limits and access levels for your user base.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[10px] items-start">
        <div className="lg:col-span-1">
          <div className="widget p-6 sticky top-10">
            <h2 className="text-[10px] font-black text-bone-60 mb-6 flex items-center gap-2 tracking-[0.05em] uppercase opacity-50">
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
