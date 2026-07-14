import { useState, useEffect, useRef } from 'react';

/**
 * useMinimumLoadingTime Hook
 * 
 * Ensures that if a loading state becomes true, it stays true for at least
 * the specified minimum duration (default 500ms). This prevents fast loading
 * flashes and guarantees the loading skeleton or animation is seen for a smooth
 * transition.
 */
export function useMinimumLoadingTime(isLoading: boolean, minTime: number = 500) {
  const [showLoading, setShowLoading] = useState(isLoading);
  const loadingStartTime = useRef<number | null>(null);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (isLoading) {
      if (loadingStartTime.current === null) {
        loadingStartTime.current = Date.now();
      }
      setShowLoading(true);
    } else {
      if (loadingStartTime.current !== null) {
        const elapsed = Date.now() - loadingStartTime.current;
        if (elapsed < minTime) {
          timeout = setTimeout(() => {
            setShowLoading(false);
            loadingStartTime.current = null;
          }, minTime - elapsed);
        } else {
          setShowLoading(false);
          loadingStartTime.current = null;
        }
      } else {
        setShowLoading(false);
      }
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isLoading, minTime]);

  return showLoading;
}
