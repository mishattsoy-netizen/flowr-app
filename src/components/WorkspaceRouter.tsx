"use client";

import { useStore } from '@/data/store';
import { EntityPageRenderer } from '@/components/EntityPageRenderer';
import { useAppReady } from '@/hooks/useAppReady';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

import { memo } from 'react';

export const WorkspaceRouter = memo(function WorkspaceRouter({ initialEntityId }: { initialEntityId?: string }) {
  const activeEntityId = useStore(state => state.activeEntityId);
  const { storeHydrated } = useAppReady();
  const containerRef = useRef<HTMLDivElement>(null);

  // Before hydration, activeEntityId is the store's un-hydrated default
  // ('dashboard'), not the user's real last page — trusting it here is what
  // causes every other page to flash a Dashboard route on refresh. Route from
  // the server-provided cookie (the user's actual last page) until the real
  // persisted value is available; storeHydrated flips true right after
  // hydration completes (see useAppReady.ts), matching the same instant the
  // real activeEntityId becomes trustworthy.
  const resolvedEntityId = storeHydrated ? (activeEntityId ?? 'dashboard') : (initialEntityId ?? 'dashboard');

  useEffect(() => {
    if (containerRef.current) {
      if (resolvedEntityId === 'tracker' || resolvedEntityId === 'chat') {
        gsap.set(containerRef.current, { autoAlpha: 1, y: 0, x: 0, clearProps: 'transform' });
      } else {
        gsap.set(containerRef.current, { autoAlpha: 1, y: 0 });
      }
    }
  }, [resolvedEntityId]);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col min-h-0 relative"
    >
      <EntityPageRenderer entityId={resolvedEntityId} />
    </div>
  );
});

