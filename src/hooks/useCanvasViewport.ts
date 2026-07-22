import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/data/store';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4.0;
export const ZOOM_STEP = 0.1;

export interface CanvasViewport {
  x: number;
  y: number;
  scale: number;
}

// Owns pan/zoom viewport state plus the ctrl/cmd+wheel zoom-at-cursor handler.
// Panning itself (space-drag / middle-click / move-tool drag) is driven from
// CanvasPage's handleBgPointerDown via setViewport — it is not moved here,
// since it's entangled with tool state, selection clearing, and other
// pointer-down branches that don't belong in a viewport-only hook.
//
// `brainId` keys the persisted-in-store viewport so pan/zoom survives
// BrainCanvasPage remounting when the split-view editor column opens/closes
// (the same remount that would otherwise reset scale to 1 and pan to origin).
export function useCanvasViewport(
  containerRef: React.RefObject<HTMLDivElement | null>,
  brainId?: string | null,
  // Called when the user zooms via ctrl/cmd+wheel, so the caller can cancel
  // any in-progress programmatic pan animation (keeps zoom instant).
  onUserGesture?: () => void,
) {
  const onUserGestureRef = useRef(onUserGesture);
  onUserGestureRef.current = onUserGesture;
  const setBrainViewport = useStore(s => s.setBrainViewport);
  // Seed from the store so a remount restores the last pan/zoom instead of
  // snapping to origin + 100%.
  const [viewport, setViewport] = useState<CanvasViewport>(
    () => (brainId ? useStore.getState().brainViewportByBrain[brainId] ?? { x: 0, y: 0, scale: 1 } : { x: 0, y: 0, scale: 1 }),
  );
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  // Mirror viewport into the store (keyed by brain) so it survives the next
  // remount. Done in an effect, not inside the setViewport updater, to keep
  // the updater pure (StrictMode double-invokes updaters).
  useEffect(() => {
    if (brainId) setBrainViewport(brainId, viewport);
  }, [viewport, brainId, setBrainViewport]);

  // Re-seed when the brain changes (switching brains) so each brain keeps its
  // own pan/zoom rather than carrying over the previous brain's. Skips the
  // very first run (initial state already seeded above) via a ref guard, so it
  // doesn't clobber the seeded value on mount.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    setViewport(brainId ? useStore.getState().brainViewportByBrain[brainId] ?? { x: 0, y: 0, scale: 1 } : { x: 0, y: 0, scale: 1 });
  }, [brainId]);

  useEffect(() => {
    // Window capture + contains(): (1) runs before the browser's ctrl/cmd+wheel
    // page zoom so preventDefault actually works; (2) still works when the
    // container mounts late (brain canvas after loading) — reading
    // containerRef.current on each event, not only once at effect setup.
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const container = containerRef.current;
      if (!container) return;
      const target = e.target;
      if (!(target instanceof Node) || !container.contains(target)) return;
      e.preventDefault();
      e.stopPropagation();
      onUserGestureRef.current?.();
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setViewport(prev => {
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.scale + delta));
        if (newScale === prev.scale) return prev;
        const ratio = newScale / prev.scale;
        return {
          x: mx - ratio * (mx - prev.x),
          y: my - ratio * (my - prev.y),
          scale: newScale,
        };
      });
    };
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => window.removeEventListener('wheel', onWheel, { capture: true });
  }, [containerRef]);

  return { viewport, setViewport, viewportRef };
}
