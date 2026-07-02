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
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setViewport(prev => {
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.scale + delta));
        const ratio = newScale / prev.scale;
        return { x: mx - ratio * (mx - prev.x), y: my - ratio * (my - prev.y), scale: newScale };
      });
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [containerRef]);

  return { viewport, setViewport, viewportRef };
}
