import { useState, useEffect } from 'react';
import { useStore } from '@/data/store';

const MINIMUM_LOADING_TIME = 600; // ms

let globalMinTimePassed = false;
let globalTimerStarted = false;
let globalAppMounted = typeof window !== 'undefined' ? false : false;
const subscribers = new Set<(val: boolean) => void>();

export function useAppReady() {
  const [isMounted, setIsMounted] = useState(globalAppMounted);
  const [storeHydrated, setStoreHydrated] = useState(() => globalAppMounted ? useStore.persist.hasHydrated() : false);
  const [minTimePassed, setMinTimePassed] = useState(globalMinTimePassed);

  useEffect(() => {
    globalAppMounted = true;
    setIsMounted(true);

    if (!globalTimerStarted) {
      globalTimerStarted = true;
      setTimeout(() => {
        globalMinTimePassed = true;
        subscribers.forEach(fn => fn(true));
      }, MINIMUM_LOADING_TIME);
    }

    const onTimePassed = (val: boolean) => setMinTimePassed(val);
    subscribers.add(onTimePassed);

    if (useStore.persist.hasHydrated()) {
      setStoreHydrated(true);
    } else {
      const unsub = useStore.persist.onFinishHydration(() => {
        setStoreHydrated(true);
        unsub();
      });
      return () => {
        unsub();
        subscribers.delete(onTimePassed);
      };
    }

    return () => {
      subscribers.delete(onTimePassed);
    };
  }, []);

  return {
    isReady: isMounted && storeHydrated && minTimePassed,
    storeHydrated: storeHydrated && isMounted,
  };
}
