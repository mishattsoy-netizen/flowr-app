"use client";

import { useRef, useCallback } from 'react';
import type { CanvasViewport } from '@/hooks/useCanvasViewport';

interface NodePosition {
  x: number;
  y: number;
}

export interface DragCallbacks {
  onPositionChange: (nodeId: string, pos: NodePosition) => void;
  onCommit: (nodeId: string, pos: NodePosition) => void;
}

/**
 * Pointer-based drag handler for brain nodes.
 *
 * Converts screen-space deltas to canvas-space deltas via viewport.scale.
 * Calls onPositionChange on every pointer move (optimistic local state update)
 * and onCommit on pointer up (debounced API save).
 *
 * Usage:
 *   const { onNodePointerDown } = useBrainDrag({ viewport, onPositionChange, onCommit });
 *   <div onPointerDown={(e) => onNodePointerDown(e, nodeId, currentPos)} />
 */
export function useBrainDrag(
  viewport: CanvasViewport,
  callbacks: DragCallbacks,
) {
  const dragRef = useRef<{
    nodeId: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const onNodePointerDown = useCallback((e: React.PointerEvent, nodeId: string, pos: NodePosition) => {
    if (e.button !== 0) return; // left-click only; middle-click is for panning
    if (!(e.target as HTMLElement).closest('[data-drag-handle="true"]')) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { nodeId, startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y };

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.startX) / viewport.scale;
      const dy = (ev.clientY - dragRef.current.startY) / viewport.scale;
      callbacks.onPositionChange(dragRef.current.nodeId, {
        x: dragRef.current.originX + dx,
        y: dragRef.current.originY + dy,
      });
    };

    const onUp = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.startX) / viewport.scale;
      const dy = (ev.clientY - dragRef.current.startY) / viewport.scale;
      const finalPos = { x: dragRef.current.originX + dx, y: dragRef.current.originY + dy };
      callbacks.onCommit(dragRef.current.nodeId, finalPos);
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [viewport.scale, callbacks]);

  return { onNodePointerDown };
}
