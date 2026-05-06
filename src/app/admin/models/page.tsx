import { getModels } from './actions'
import ModelsTable from '@/components/admin/ModelsTable'
import { Cpu } from 'lucide-react'

export default async function ModelsPage() {
  const models = await getModels()

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display text-foreground mb-1">Models</h1>
        <p className="text-muted-foreground text-sm font-medium">
          Global model catalog — usage tracking, modalities, RPD limits.
        </p>
      </div>
      <ModelsTable initialModels={models} />
    </div>
  )
}
