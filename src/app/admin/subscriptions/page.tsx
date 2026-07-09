import { getSubscriptions, getTierOptions } from './actions'
import { listPromoCodes } from './promoActions'
import SubscriptionsTable from './SubscriptionsTable'
import PromoCodeSection from './PromoCodeSection'

export default async function SubscriptionsPage() {
  const [rows, tierOptions, promoCodes] = await Promise.all([
    getSubscriptions(),
    getTierOptions(),
    listPromoCodes(),
  ])

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display font-medium text-foreground mb-1">Subscriptions</h1>
        <p className="text-muted-foreground text-sm font-medium">Manage user tiers, subscription periods, bonus credit, and promo codes.</p>
      </div>

      <PromoCodeSection initialCodes={promoCodes} tierOptions={tierOptions} />

      <SubscriptionsTable initialRows={rows} tierOptions={tierOptions} />
    </div>
  )
}
