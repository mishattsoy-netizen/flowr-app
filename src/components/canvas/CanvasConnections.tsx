"use client";
import { useStore, type EditorBlock } from "@/data/store";
import { useMemo } from "react";
import { VectorPath } from "./edges/VectorPath";

interface CanvasConnectionsProps {
  canvasId: string;
  selectedIds: Set<string>;
  onSelect: (id: string, addToSelection: boolean) => void;
  editingBlockId?: string | null;
  selectedPointIndex?: number | null;
  onDoubleClick?: (blockId: string, altKey?: boolean) => void;
  onPointSelect?: (index: number | null) => void;
  onBindingDragStart?: (blockId: string, end: 'start' | 'end', e: React.PointerEvent) => void;
  /** Body-drag of a bound arrow (detaches out-of-set bindings and moves it — see useDrag). */
  onDragStart?: (e: React.PointerEvent, block: EditorBlock) => void;
  activeTool?: string;
  viewportScale?: number;
  viewport?: { x: number; y: number; scale: number };
  /** Eraser tool: ids currently marked for deletion mid-gesture — rendered dimmed. */
  markedIds?: Set<string>;
  /** Drives the shape-outline glow highlight while a free (unbound) endpoint is being dragged
   * toward a bindable shape — same state useBindingDrag uses for rebinding an already-bound
   * endpoint, so both drag paths share one highlight. */
  setHoverBindTargetId?: (id: string | null) => void;
}

export function CanvasConnections({ canvasId, selectedIds, onSelect, editingBlockId, selectedPointIndex, onDoubleClick, onPointSelect, onBindingDragStart, onDragStart, activeTool, viewportScale, viewport, markedIds, setHoverBindTargetId }: CanvasConnectionsProps) {
  const allBlocks = useStore(s => s.blocks);
  const blocks = useMemo(() => allBlocks.filter(b => b.canvasId === canvasId), [allBlocks, canvasId]);

  // ALL linear shapes render here, bound or not. A single render site matters: binding and
  // unbinding (endpoint rebind, drag-detach, freeze-on-delete) must never move an arrow to a
  // different DOM parent, or imperative drag code holding its cached <g> node goes stale
  // mid-gesture and the arrow visually freezes until the next commit.
  const linearShapes = useMemo(() =>
    blocks.filter(b =>
      b.type === 'shape' &&
      (b.shapeKind === 'arrow' || b.shapeKind === 'line' || b.shapeKind === 'freedraw')
    ), [blocks]
  );

  return (
    <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible" style={{ zIndex: 10 }}>
      {linearShapes.map(block => (
        <VectorPath key={block.id} block={block}
          selected={selectedIds.has(block.id)}
          showIndividualSelection={selectedIds.size <= 1}
          editing={editingBlockId === block.id}
          selectedPointIndex={editingBlockId === block.id ? selectedPointIndex : null}
          activeTool={activeTool}
          viewportScale={viewportScale}
          viewport={viewport}
          onSelect={onSelect}
          onDoubleClick={(altKey) => onDoubleClick?.(block.id, altKey)}
          onPointSelect={onPointSelect}
          onDragStart={onDragStart}
          onBindingDragStart={(end, e) => onBindingDragStart?.(block.id, end, e)}
          setHoverBindTargetId={setHoverBindTargetId}
          erasing={markedIds?.has(block.id)} />
      ))}
    </svg>
  );
}
