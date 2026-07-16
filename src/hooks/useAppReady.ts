import { useState, useEffect } from 'react';
import { useStore } from '@/data/store';

/**
 * Readiness = the persisted Zustand store has hydrated from localStorage.
 *
 * The store's persist adapter reads localStorage synchronously, and Zustand
 * applies persisted state during store creation (at module load, before any
 * component renders). So hasHydrated() is normally already true on the very
 * first render, and this hook reports ready immediately — no skeleton frame.
 *
 * This previously had to start `false` to match the server's render and avoid
 * a React hydration mismatch (see commit 5048a6c). That is no longer needed:
 * the /app interior is now rendered client-only (see src/app/app/AppClient.tsx),
 * so there is no server render to match.
 *
 * The useEffect below remains as a genuine fallback for the rare case where
 * the store has not hydrated by first render (e.g. if the storage adapter ever
 * becomes async).
 */
export function useAppReady() {
  const [storeHydrated, setStoreHydrated] = useState(() => useStore.persist.hasHydrated());

  useEffect(() => {
    if (storeHydrated) return;
    if (useStore.persist.hasHydrated()) {
      setStoreHydrated(true);
      return;
    }
    const unsub = useStore.persist.onFinishHydration(() => setStoreHydrated(true));
    return unsub;
  }, [storeHydrated]);

  return {
    isReady: storeHydrated,
    storeHydrated,
  };
}
