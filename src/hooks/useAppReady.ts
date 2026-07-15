import { useState, useEffect } from 'react';
import { useStore } from '@/data/store';

/**
 * Readiness = the persisted Zustand store has hydrated from localStorage.
 *
 * SSR-safety: `storeHydrated` MUST start `false` on the first client render so
 * it matches the server-rendered HTML (there is no localStorage on the server,
 * so persist has never hydrated there). Reading `hasHydrated()` in the useState
 * initializer would return `true` on the client's first render but `false` on
 * the server, causing a hydration mismatch (server renders skeletons, client
 * renders real content). Instead we flip to `true` in useEffect — which runs
 * only after hydration — so the first client render matches the server, then
 * real content appears on the next tick. No artificial delay: because persist
 * uses synchronous localStorage, hasHydrated() is already true by the time the
 * effect runs, so the skeleton frame is imperceptible (one render), not 600ms.
 */
export function useAppReady() {
  const [storeHydrated, setStoreHydrated] = useState(false);

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
