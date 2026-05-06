import { getVaultKeys } from '@/app/admin/vault/actions'
import DiscoverClient from './DiscoverClient'

export default async function DiscoverPage() {
  const vaultKeys = await getVaultKeys()
  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display text-foreground mb-1">Discover</h1>
        <p className="text-muted-foreground text-sm font-medium">
          Fetch available free-tier models from providers and add them to your registry.
        </p>
      </div>
      <DiscoverClient vaultKeys={vaultKeys} />
    </div>
  )
}
