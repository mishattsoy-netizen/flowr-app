import { getVaultData } from './actions'
import VaultProviderWidget from '@/components/admin/VaultProviderWidget'

const KNOWN_PROVIDERS = ['cloudflare', 'gemini', 'groq', 'openrouter', 'tavily', 'huggingface', 'pollinations', 'siliconflow']
export default async function VaultPage() {
  const { accounts, keys } = await getVaultData()

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display text-foreground mb-1">Security Vault</h1>
        <p className="text-muted-foreground text-sm font-medium">Encrypted storage for infrastructure orchestration keys.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
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
