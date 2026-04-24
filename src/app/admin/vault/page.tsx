import { getVaultKeys } from './actions'
import VaultProviderWidget from '@/components/admin/VaultProviderWidget'
import CloudflareVaultWidget from '@/components/admin/CloudflareVaultWidget'

const CLOUDFLARE_KEY_IDS = ['CLOUDFLARE_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']
const KNOWN_PROVIDERS = ['gemini', 'groq', 'openrouter']

function detectProvider(keyId: string): string {
  const id = keyId.toLowerCase()
  if (id.includes('openrouter')) return 'openrouter'
  if (id.includes('gemini'))     return 'gemini'
  if (id.includes('groq'))       return 'groq'
  return 'general'
}

export default async function VaultPage() {
  const keys = await getVaultKeys()

  const cloudflareKeys = keys.filter(k => CLOUDFLARE_KEY_IDS.includes(k.key_id))
  const otherKeys = keys.filter(k => !CLOUDFLARE_KEY_IDS.includes(k.key_id))

  const grouped: Record<string, { key_id: string }[]> = {}
  for (const provider of KNOWN_PROVIDERS) {
    grouped[provider] = []
  }
  for (const key of otherKeys) {
    const provider = detectProvider(key.key_id)
    if (!grouped[provider]) grouped[provider] = []
    grouped[provider].push(key)
  }

  const providers = Object.entries(grouped)

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display text-foreground mb-1">Security Vault</h1>
        <p className="text-muted-foreground text-sm font-medium">Encrypted storage for infrastructure orchestration keys.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CloudflareVaultWidget initialKeys={cloudflareKeys} />
        {providers.map(([provider, providerKeys]) => (
          <VaultProviderWidget
            key={provider}
            provider={provider}
            initialKeys={providerKeys}
          />
        ))}
      </div>
    </div>
  )
}
