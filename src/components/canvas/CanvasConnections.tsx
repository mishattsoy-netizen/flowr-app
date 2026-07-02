"use client";
import { useStore } from "@/data/store";
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
  activeTool?: string;
  viewportScale?: number;
  viewport?: { x: number; y: number; scale: number };
  /** Eraser tool: ids currently marked for deletion mid-gesture — rendered dimmed. */
  markedIds?: Set<string>;
}

export function CanvasConnections({ canvasId, selectedIds, onSelect, editingBlockId, selectedPointIndex, onDoubleClick, onPointSelect, onBindingDragStart, activeTool, viewportScale, viewport, markedIds }: CanvasConnectionsProps) {
  const allBlocks = useStore(s => s.blocks);
  const blocks = useMemo(() => allBlocks.filter(b => b.canvasId === canvasId), [allBlocks, canvasId]);

  const linkedArrows = useMemo(() =>
    blocks.filter(b =>
      b.type === 'shape' &&
      (b.shapeKind === 'arrow' || b.shapeKind === 'line') &&
      (b.startBinding || b.endBinding)
    ), [blocks]
  );

  return (
    <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-[5]">
      {linkedArrows.map(block => (
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
          onBindingDragStart={(end, e) => onBindingDragStart?.(block.id, end, e)}
          erasing={markedIds?.has(block.id)} />
      ))}
    </svg>
  );
}
