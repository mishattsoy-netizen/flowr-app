import { getVaultKeys } from './actions'
import VaultItem from '@/components/admin/VaultItem'
import { Plus, ShieldCheck } from 'lucide-react'
import VaultRegisterForm from './VaultRegisterForm'

export default async function VaultPage() {
  const keys = await getVaultKeys()

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="flex flex-col gap-1.5 mb-2">
        <h1 className="text-3xl font-bold tracking-tight text-bone-100 font-instrument">Security Vault</h1>
        <p className="text-bone-60 text-[11px] font-bold tracking-tight opacity-60">Encrypted storage for infrastructure orchestration keys.</p>
      </div>

      <div className="widget p-8">
        <div className="flex items-center gap-3 mb-8">
            <Plus className="w-4 h-4 text-accent" strokeWidth={1.5} />
          <h2 className="text-[10px] font-black text-bone-60 tracking-[0.1em] uppercase opacity-50">Register new credential</h2>
        </div>
        <VaultRegisterForm />
      </div>

      <div className="widget overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--bone-15)]/50 flex items-center justify-between bg-sidebar/20">
          <h2 className="text-[10px] font-black text-bone-60 tracking-[0.1em] uppercase opacity-50 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent/50 animate-pulse" />
            Active Credentials
          </h2>
          <span className="text-[10px] font-bold text-bone-60/40 uppercase tracking-tight">{keys.length} Nodes</span>
        </div>
        <div className="divide-y divide-[var(--bone-15)]/30">
          {keys.map((item: any) => (
            <VaultItem key={item.key_id} item={item} />
          ))}
        </div>
      </div>

      {keys.length === 0 && (
        <div className="widget p-20 flex flex-col items-center justify-center text-center">
          <ShieldCheck className="w-12 h-12 text-bone-60 opacity-10 mb-6" strokeWidth={1} />
          <p className="text-bone-60 text-sm font-bold tracking-tight mb-2">Internal vault is secured and empty.</p>
          <p className="text-[10px] text-bone-60 opacity-30 font-bold tracking-[0.05em] uppercase">Initialize infrastructure to proceed</p>
        </div>
      )}
    </div>
  )
}
