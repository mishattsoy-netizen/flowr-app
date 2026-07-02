import { useCallback } from 'react';
import { useStore, EditorBlock } from '@/data/store';
import { classifyBindingAt, findBindableBlockAt } from '@/lib/canvas/classifyBinding';

export interface UseBindingDragArgs {
  entityId: string;
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  viewportRef: React.RefObject<{ x: number; y: number; scale: number }>;
  history: { push: (blocks: EditorBlock[]) => void };
  setHoverBindTargetId: (id: string | null) => void;
}

// Task 5's endpoint-rebind drag: pointer-down on an arrow/line endpoint dot, drag to a new
// bindable target (or free point), release to commit. Drives Task 4's hover-highlight state
// (owned by the caller — this hook only calls the setter) while dragging. Extracted verbatim
// from CanvasPage; reads live store state via useStore.getState() throughout, so it has no
// closure-staleness risk despite living outside the component.
export function useBindingDrag({
  entityId,
  canvasContainerRef,
  viewportRef,
  history,
  setHoverBindTargetId,
}: UseBindingDragArgs) {
  const handleBindingDrag = useCallback((blockId: string, end: 'start' | 'end', e: React.PointerEvent) => {
    e.stopPropagation();
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const toCanvas = (ev: PointerEvent | React.PointerEvent): [number, number] => {
      const vp = viewportRef.current;
      return [(ev.clientX - rect.left - vp.x) / vp.scale, (ev.clientY - rect.top - vp.y) / vp.scale];
    };
    const move = (ev: PointerEvent) => {
      const p = toCanvas(ev);
      const live = useStore.getState().blocks.filter(b => b.canvasId === entityId && b.id !== blockId);
      const target = findBindableBlockAt(p, live);
      setHoverBindTargetId(target?.id ?? null);
      // live preview: temporarily write the endpoint as a free point
      const block = useStore.getState().blocks.find(b => b.id === blockId);
      if (!block) return;
      if (end === 'start') {
        useStore.getState().updateCanvasBlock(blockId, { startBinding: undefined, points: [p, ...(block.startBinding ? (block.points ?? []) : (block.points ?? []).slice(1))] });
      } else {
        const pts = block.endBinding ? (block.points ?? []) : (block.points ?? []).slice(0, -1);
        useStore.getState().updateCanvasBlock(blockId, { endBinding: undefined, points: [...pts, p] });
      }
    };
    const up = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      setHoverBindTargetId(null);
      const p = toCanvas(ev);
      const live = useStore.getState().blocks.filter(b => b.canvasId === entityId && b.id !== blockId);
      const target = findBindableBlockAt(p, live);
      if (target) {
        const binding = classifyBindingAt(p, target);
        const block = useStore.getState().blocks.find(b => b.id === blockId);
        if (binding && block) {
          // remove the temporary free endpoint added during preview
          const pts = end === 'start' ? (block.points ?? []).slice(1) : (block.points ?? []).slice(0, -1);
          useStore.getState().updateCanvasBlock(blockId, end === 'start' ? { startBinding: binding, points: pts } : { endBinding: binding, points: pts });
        }
      }
      history.push(useStore.getState().blocks.filter(b => b.canvasId === entityId));
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }, [entityId, history]);

  return { handleBindingDrag };
}
