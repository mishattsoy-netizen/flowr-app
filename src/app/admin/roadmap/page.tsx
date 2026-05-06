import { supabaseAdmin } from '@/lib/supabase'
import RoadmapClient from '@/components/admin/roadmap/RoadmapClient'

export default async function RoadmapPage() {
  const [{ data: phases }, { data: tasks }, { data: routerChains }] = await Promise.all([
    supabaseAdmin.from('roadmap_phases').select('*').order('sort_order'),
    supabaseAdmin.from('roadmap_tasks').select('*').order('sort_order'),
    supabaseAdmin.from('roadmap_router_chains').select('*').order('category'),
  ])

  return (
    <RoadmapClient
      initialPhases={phases || []}
      initialTasks={tasks || []}
      initialRouterChains={routerChains || []}
    />
  )
}
