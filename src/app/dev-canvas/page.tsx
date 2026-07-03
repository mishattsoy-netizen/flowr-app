"use client";
// TEMPORARY dev-only harness for driving CanvasPage in a browser without auth.
// Used for canvas bug reproduction/QA. Renders nothing in production builds.
import { useEffect, useState } from 'react';
import { CanvasPage } from '@/components/canvas/CanvasPage';
import { useStore } from '@/data/store';
import type { Entity } from '@/data/store.types';

const DEV_ENTITY: Entity = {
  id: 'dev-canvas-fixture',
  title: 'Dev Canvas',
  type: 'canvas',
  parentId: null,
  lastModified: 0,
  syncMode: 'local-only',
};

export default function DevCanvasPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (window as any).__store = useStore; // debug access for the driver
    setReady(true);
  }, []);
  if (process.env.NODE_ENV === 'production') return null;
  if (!ready) return null;
  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--app-background)]">
      <CanvasPage entity={DEV_ENTITY} />
    </div>
  );
}
