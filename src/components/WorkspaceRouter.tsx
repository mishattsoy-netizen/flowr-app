"use client";

import { useStore } from '@/data/store';
import { EntityPageRenderer } from '@/components/EntityPageRenderer';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

import { memo } from 'react';

export const WorkspaceRouter = memo(function WorkspaceRouter({ initialEntityId }: { initialEntityId?: string }) {
  const activeEntityId = useStore(state => state.activeEntityId);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      if (activeEntityId === 'tracker' || activeEntityId === 'chat') {
        gsap.set(containerRef.current, { autoAlpha: 1, y: 0, x: 0, clearProps: 'transform' });
      } else {
        gsap.set(containerRef.current, { autoAlpha: 1, y: 0 });
      }
    }
  }, [activeEntityId]);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col min-h-0 relative"
    >
      <EntityPageRenderer entityId={activeEntityId ?? 'dashboard'} />
    </div>
  );
});

