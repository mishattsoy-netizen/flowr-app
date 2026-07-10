// src/components/DowngradeBanner.tsx
'use client';

import { useStore } from '@/data/store';

export function shouldShowGraceBanner(gracePeriodEndsAt: number | null): boolean {
  return gracePeriodEndsAt !== null && gracePeriodEndsAt > Date.now();
}

export function DowngradeBanner() {
  const gracePeriodEndsAt = useStore(s => s.gracePeriodEndsAt);
  if (!shouldShowGraceBanner(gracePeriodEndsAt)) return null;

  const daysLeft = Math.ceil(((gracePeriodEndsAt as number) - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/30 text-amber-700 dark:text-amber-300 text-sm px-4 py-2 text-center">
      Your cloud sync subscription has expired. Your cloud data will be permanently deleted in {daysLeft} day{daysLeft === 1 ? '' : 's'} unless you renew.
    </div>
  );
}
