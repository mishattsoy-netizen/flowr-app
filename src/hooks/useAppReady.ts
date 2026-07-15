import { useState, useEffect } from 'react';
import { useStore } from '@/data/store';

/**
 * Readiness = the persisted Zustand store has hydrated from localStorage.
 * Because the persist storage adapter is synchronous localStorage, hasHydrated()
 * is effectively true on the first render, so cached data paints immediately with
 * no artificial delay. The onFinishHydration fallback covers the rare async case.
 */
export function useAppReady() {
  const [storeHydrated, setStoreHydrated] = useState(() => useStore.persist.hasHydrated());

  useEffect(() => {
    if (useStore.persist.hasHydrated()) {
      setStoreHydrated(true);
      return;
    }
    const unsub = useStore.persist.onFinishHydration(() => setStoreHydrated(true));
    return unsub;
  }, []);

  return {
    isReady: storeHydrated,
    storeHydrated,
  };
}
