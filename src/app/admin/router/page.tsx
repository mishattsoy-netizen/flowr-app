import { getRouterChains } from './actions'
import { getModels } from '@/app/admin/models/actions'
import RouterMatrixGrid from '@/components/admin/RouterMatrixGrid'

export async function RouterPageContent() {
  const [routers, models] = await Promise.all([getRouterChains(), getModels()])

  // Group rows by category so the grid can toggle all cards between default/pro at once
  const byCategory: Record<string, { default?: any; pro?: any }> = {}
  for (const router of routers) {
    const entry = byCategory[router.category] ?? {}
    entry[router.mode === 'pro' ? 'pro' : 'default'] = router
    byCategory[router.category] = entry
  }

  return <RouterMatrixGrid byCategory={byCategory} models={models} />
}

export default async function RouterPage() {
  return <RouterPageContent />
}
