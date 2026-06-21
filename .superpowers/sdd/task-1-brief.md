# Task 1: Create TooltipOverlayContext

**Goal:** Create a React context that tracks active overlays so tooltips can suppress when any overlay is active.

**File to create:**
- `src/components/layout/TooltipOverlayContext.tsx`

**Code to write (exact content):**

```tsx
'use client';

import React, { createContext, useContext, useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { useStore } from '@/data/store';

interface TooltipOverlayContextValue {
  isSuppressed: boolean;
  registerOverlay: (id: string) => void;
  unregisterOverlay: (id: string) => void;
}

const TooltipOverlayContext = createContext<TooltipOverlayContextValue>({
  isSuppressed: false,
  registerOverlay: () => {},
  unregisterOverlay: () => {},
});

export function useTooltipOverlay() {
  return useContext(TooltipOverlayContext);
}

/**
 * Register an overlay ID while `active` is true. The overlay is unregistered
 * when `active` becomes false or the component unmounts.
 */
export function useTooltipSuppression(active: boolean) {
  const { registerOverlay, unregisterOverlay } = useTooltipOverlay();
  const idRef = useRef<string>('');

  useEffect(() => {
    if (active) {
      if (!idRef.current) {
        idRef.current = `overlay-${Math.random().toString(36).slice(2, 9)}`;
      }
      registerOverlay(idRef.current);
      return () => unregisterOverlay(idRef.current);
    }
  }, [active, registerOverlay, unregisterOverlay]);
}

export function TooltipOverlayProvider({ children }: { children: React.ReactNode }) {
  const [overlayIds, setOverlayIds] = useState<Set<string>>(new Set());

  // Auto-track global store overlays (modals, context menus)
  const modal = useStore(s => s.modal);
  const contextMenu = useStore(s => s.contextMenu);
  const taskContextMenu = useStore(s => s.taskContextMenu);
  const hasGlobalOverlay = !!(modal || contextMenu || taskContextMenu);

  useEffect(() => {
    if (hasGlobalOverlay) {
      setOverlayIds(prev => new Set(prev).add('__global__'));
      return () => {
        setOverlayIds(prev => {
          const next = new Set(prev);
          next.delete('__global__');
          return next;
        });
      };
    }
  }, [hasGlobalOverlay]);

  const registerOverlay = useCallback((id: string) => {
    setOverlayIds(prev => new Set(prev).add(id));
  }, []);

  const unregisterOverlay = useCallback((id: string) => {
    setOverlayIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo<TooltipOverlayContextValue>(() => ({
    isSuppressed: overlayIds.size > 0,
    registerOverlay,
    unregisterOverlay,
  }), [overlayIds.size, registerOverlay, unregisterOverlay]);

  return (
    <TooltipOverlayContext.Provider value={value}>
      {children}
    </TooltipOverlayContext.Provider>
  );
}
```

**Verification:** Run `npx tsc --noEmit --pretty 2>&1 | head -30` and confirm no type errors.
