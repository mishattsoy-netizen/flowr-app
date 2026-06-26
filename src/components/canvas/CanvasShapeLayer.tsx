"use client";

import { EditorBlock, CanvasStyleExt, useStore } from '@/data/store';
import { useMemo, useRef, useEffect } from 'react';
import { useDrag } from '@/hooks/useDrag';
import { activeDragOffsets } from '@/lib/canvasDragState';


interface Props {
  blocks: EditorBlock[];
  selectedIds: Set<string>;
  viewport: { x: number; y: number; scale: number };
  updateCanvasBlocks: (updates: { id: string; updates: Partial<EditorBlock> }[]) => void;
  onSelect: (id: string, addToSelection: boolean) => void;
  onCommit?: () => void;
  snapWithObjects?: (x: number, y: number, w: number, h: number, excludeId: string) => { x: number; y: number; guides: { type: 'h' | 'v'; coord: number; start: number; end: number }[] };
  onContextMenu?: (e: React.MouseEvent, blockId: string) => void;
  onDoubleClick?: (blockId: string) => void;
}

function shapeStroke(style: CanvasStyleExt): string {
  return style.stroke && style.stroke !== 'transparent' ? style.stroke : 'rgba(233,233,226,0.35)';
}
function shapeFill(style: CanvasStyleExt): string {
  const fill = style.fill ?? 'transparent';
  if (fill === 'transparent') return 'transparent';
  const op = style.fillOpacity ?? 0.15;
  // Convert hex to rgba
  const r = parseInt(fill.slice(1,3), 16);
  const g = parseInt(fill.slice(3,5), 16);
  const b = parseInt(fill.slice(5,7), 16);
  return `rgba(${r},${g},${b},${op})`;
}
function strokeDasharray(style: CanvasStyleExt): string {
  if (style.strokeStyle === 'dashed') return '8 4';
  if (style.strokeStyle === 'dotted') return '2 4';
  return 'none';
}

function ShapeEl({ block, isSelected, onPointerDown, onContextMenu }: {
  block: EditorBlock; isSelected: boolean; onPointerDown: (e: React.PointerEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const style = block.canvasStyleExt ?? {};
  const x = block.x ?? 0, y = block.y ?? 0;
  const w = block.width ?? 100, h = block.height ?? 60;
  const sw = style.strokeWidth ?? 1.5;
  const r = style.cornerRadius ?? 0;
  const stroke = shapeStroke(style);
  const fill = shapeFill(style);
  const da = strokeDasharray(style);
  const opacity = style.opacity ?? 1;
  
  const sharedProps = {
    stroke: stroke,
    strokeWidth: sw,
    strokeDasharray: da,
    strokeOpacity: style.strokeOpacity ?? 1,
    fill,
    opacity,
    style: { cursor: 'move' },
    onPointerDown,
    onContextMenu,
  };

  if (block.shapeKind === 'rect') {
    return <rect x={x} y={y} width={w} height={h} rx={r} ry={r} {...sharedProps} />;
  }
  if (block.shapeKind === 'ellipse') {
    return <ellipse cx={x + w/2} cy={y + h/2} rx={w/2} ry={h/2} {...sharedProps} />;
  }
  if (block.shapeKind === 'diamond') {
    const pts = `${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}`;
    return <polygon points={pts} {...sharedProps} strokeLinejoin={r > 0 ? "round" : "miter"} />;
  }

  return null;
}

export function CanvasShapeLayer({ blocks: initialBlocks, selectedIds, viewport, updateCanvasBlocks, onSelect, onCommit, snapWithObjects, onContextMenu, onDoubleClick }: Props) {
  const liveBlocks = useStore(s => s.blocks);
  const shapes = useMemo(() => {
    const initialIds = new Set(initialBlocks.map(b => b.id));
    return liveBlocks.filter(b => b.type === 'shape' && initialIds.has(b.id));
  }, [liveBlocks, initialBlocks]);

  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const { startDrag } = useDrag({
    viewportRef,
    blocks: initialBlocks,
    selectedIds,
    snapWithObjects,
    updateCanvasBlocks,
    onCommit,
  });

  const handleShapePointerDown = (e: React.PointerEvent, clickedBlock: EditorBlock) => {
    e.stopPropagation();
    const isAlreadySelected = selectedIds.has(clickedBlock.id);
    
    if (!isAlreadySelected) {
      onSelect(clickedBlock.id, e.shiftKey);
    }

    if (e.button !== 0) return;

    startDrag(e, clickedBlock);
  };

  return (
    <svg
      className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
      style={{ zIndex: 1 }}
    >
      {shapes.filter(b => b.shapeKind !== 'arrow' && b.shapeKind !== 'line' && b.shapeKind !== 'freedraw').map(b => {
        return (
          <g 
            key={b.id} 
            id={b.id} 
            style={{ 
              pointerEvents: 'auto',
              transform: (() => {
                // During drag, return undefined so React leaves useDrag's translate3d intact.
                if (activeDragOffsets.has(b.id)) return undefined;
                const rotation = b.canvasStyleExt?.rotation ?? 0;
                const flipH = b.canvasStyleExt?.flipH ? ' scaleX(-1)' : '';
                const flipV = b.canvasStyleExt?.flipV ? ' scaleY(-1)' : '';
                // Return '' (not undefined) so React clears residual translate after drop
                return (rotation || flipH || flipV) ? `rotate(${rotation}deg)${flipH}${flipV}` : '';
              })(),
              transformOrigin: `${(b.x ?? 0) + (b.width ?? 0) / 2}px ${(b.y ?? 0) + (b.height ?? 0) / 2}px`,
            }}
          >
            <ShapeEl 
              block={b} 
              isSelected={selectedIds.has(b.id)} 
              onPointerDown={(e) => handleShapePointerDown(e, b)} 
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onContextMenu?.(e, b.id);
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}
