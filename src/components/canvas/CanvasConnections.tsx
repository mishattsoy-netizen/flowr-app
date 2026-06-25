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
  onDoubleClick?: (blockId: string) => void;
  onPointSelect?: (index: number | null) => void;
  activeTool?: string;
  viewportScale?: number;
}

export function CanvasConnections({ canvasId, selectedIds, onSelect, editingBlockId, selectedPointIndex, onDoubleClick, onPointSelect, activeTool, viewportScale }: CanvasConnectionsProps) {
  const allBlocks = useStore(s => s.blocks);
  const blocks = useMemo(() => allBlocks.filter(b => b.canvasId === canvasId), [allBlocks, canvasId]);

  const linkedArrows = useMemo(() =>
    blocks.filter(b =>
      (b.type === 'shape' || b.type === 'connection') &&
      (b.shapeKind === 'arrow' || b.shapeKind === 'line') &&
      (b.startBinding || b.endBinding || b.fromId || b.toId)
    ), [blocks]
  );

  return (
    <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-[5]">
      {linkedArrows.map(block => (
        <VectorPath key={block.id} block={block}
          selected={selectedIds.has(block.id)}
          editing={editingBlockId === block.id}
          selectedPointIndex={editingBlockId === block.id ? selectedPointIndex : null}
          activeTool={activeTool}
          viewportScale={viewportScale}
          onSelect={onSelect}
          onDoubleClick={() => onDoubleClick?.(block.id)}
          onPointSelect={onPointSelect} />
      ))}
    </svg>
  );
}
