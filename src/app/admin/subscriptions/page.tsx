'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getSubscriptions, getTierOptions, type SubscriptionRow } from './actions'
import { listPromoCodes, type PromoCodeRow } from './promoActions'
import SubscriptionsTable from './SubscriptionsTable'
import PromoCodeSection from './PromoCodeSection'

export default function SubscriptionsPage() {
  const [rows, setRows] = useState<SubscriptionRow[] | null>(null)
  const [tierOptions, setTierOptions] = useState<Array<{ id: string; name: string }>>([])
  const [promoCodes, setPromoCodes] = useState<PromoCodeRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        if (!cancelled) setError('Not authenticated')
        return
      }
      try {
        const [subs, tiers, codes] = await Promise.all([
          getSubscriptions(token),
          getTierOptions(token),
          listPromoCodes(token),
        ])
        if (!cancelled) {
          setRows(subs)
          setTierOptions(tiers)
          setPromoCodes(codes)
        }
      } catch (err) {
        console.error('[SubscriptionsPage] Failed to load:', err)
        if (!cancelled) setError('Failed to load subscriptions')
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display font-medium text-foreground mb-1">Subscriptions</h1>
        <p className="text-muted-foreground text-sm font-medium">Manage user tiers, subscription periods, bonus credit, and promo codes.</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {rows !== null && (
        <>
          <PromoCodeSection initialCodes={promoCodes} tierOptions={tierOptions} />
          <SubscriptionsTable initialRows={rows} tierOptions={tierOptions} />
        </>
      )}
    </div>
  )
}
