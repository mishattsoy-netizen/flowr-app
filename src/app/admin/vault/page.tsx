import { getVaultData } from './actions'
import VaultProviderWidget from '@/components/admin/VaultProviderWidget'
import CloudflareVaultWidget from '@/components/admin/CloudflareVaultWidget'

const CLOUDFLARE_KEY_IDS = ['CLOUDFLARE_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']
const KNOWN_PROVIDERS = ['gemini', 'groq', 'openrouter', 'tavily', 'huggingface', 'pollinations', 'siliconflow']

export default async function VaultPage() {
  const { accounts, keys } = await getVaultData()

  const cloudflareKeys = keys.filter((k: { key_id: string }) => CLOUDFLARE_KEY_IDS.includes(k.key_id))

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display text-foreground mb-1">Security Vault</h1>
        <p className="text-muted-foreground text-sm font-medium">Encrypted storage for infrastructure orchestration keys.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <CloudflareVaultWidget initialKeys={cloudflareKeys} />
        {KNOWN_PROVIDERS.map(provider => {
          const providerAccounts = accounts.filter((a: any) => a.provider === provider)
          const providerKeys = keys.filter((k: any) => providerAccounts.some((a: any) => a.id === k.account_id))
          return (
            <VaultProviderWidget
              key={provider}
              provider={provider}
              initialAccounts={providerAccounts}
              initialKeys={providerKeys}
            />
          )
        })}
      </div>
    </div>
  )
}
