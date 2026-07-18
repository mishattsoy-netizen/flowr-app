import { useEffect, useRef, useState } from 'react';

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
export function useCanvasViewport(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [viewport, setViewport] = useState<CanvasViewport>({ x: 0, y: 0, scale: 1 });
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

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
