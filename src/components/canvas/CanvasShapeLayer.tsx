"use client";

import { EditorBlock, CanvasStyleExt } from '@/data/store';
import { useMemo } from 'react';

interface Props {
  blocks: EditorBlock[];
  selectedIds: Set<string>;
  viewport: { x: number; y: number; scale: number };
  updateCanvasBlocks: (updates: { id: string; updates: Partial<EditorBlock> }[]) => void;
  onSelect: (id: string, addToSelection: boolean) => void;
  onCommit?: () => void;
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

function ShapeEl({ block, isSelected, onPointerDown }: {
  block: EditorBlock; isSelected: boolean; onPointerDown: (e: React.PointerEvent) => void;
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
  const selectionStroke = 'var(--brand-blue)';

  const sharedProps = {
    stroke: isSelected ? selectionStroke : stroke,
    strokeWidth: isSelected ? Math.max(sw, 1.5) : sw,
    strokeDasharray: da,
    fill,
    opacity,
    style: { cursor: 'move' },
    onPointerDown,
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
  if (block.shapeKind === 'line' || block.shapeKind === 'arrow') {
    const pts = block.points ?? [[x, y], [x + w, y + h]];
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
    const markerId = `arrow-${block.id}`;
    return (
      <>
        {block.shapeKind === 'arrow' && (
          <defs>
            <marker id={markerId} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L0,8 L8,4 z" fill={isSelected ? selectionStroke : stroke} />
            </marker>
          </defs>
        )}
        <path
          d={d}
          fill="none"
          stroke={isSelected ? selectionStroke : stroke}
          strokeWidth={isSelected ? Math.max(sw, 1.5) : sw}
          strokeDasharray={da}
          opacity={opacity}
          markerEnd={block.shapeKind === 'arrow' ? `url(#${markerId})` : undefined}
          style={{ cursor: 'move' }}
          onPointerDown={onPointerDown}
        />
      </>
    );
  }
  if (block.shapeKind === 'freedraw') {
    const pts = block.points ?? [];
    if (pts.length < 2) return null;
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
    return (
      <path
        d={d} fill="none"
        stroke={isSelected ? selectionStroke : stroke}
        strokeWidth={isSelected ? Math.max(sw, 2) : sw}
        opacity={opacity}
        strokeLinecap="round" strokeLinejoin="round"
        style={{ cursor: 'move' }}
        onPointerDown={onPointerDown}
      />
    );
  }
  return null;
}

export function CanvasShapeLayer({ blocks, selectedIds, viewport, updateCanvasBlocks, onSelect, onCommit }: Props) {
  const shapes = useMemo(() => blocks.filter(b => b.type === 'shape'), [blocks]);

  const handleShapePointerDown = (e: React.PointerEvent, clickedBlock: EditorBlock) => {
    e.stopPropagation();
    const isAlreadySelected = selectedIds.has(clickedBlock.id);
    
    if (!isAlreadySelected) {
      onSelect(clickedBlock.id, e.shiftKey);
    }

    if (e.button !== 0) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;

    const groupIds = isAlreadySelected ? Array.from(selectedIds) : [clickedBlock.id];
    
    // Rigid group capture snapshot
    const snapshot = new Map<string, { x: number; y: number; points?: [number, number][] }>();
    blocks.forEach(b => {
      if (groupIds.includes(b.id)) {
        snapshot.set(b.id, {
          x: b.x ?? 0,
          y: b.y ?? 0,
          points: b.points ? JSON.parse(JSON.stringify(b.points)) : undefined
        });
      }
    });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = (moveEvent.clientX - startClientX) / viewport.scale;
      const deltaY = (moveEvent.clientY - startClientY) / viewport.scale;

      const updates: { id: string; updates: Partial<EditorBlock> }[] = [];
      snapshot.forEach((snap, id) => {
        if (snap.points) {
          updates.push({
            id,
            updates: { points: snap.points.map(p => [p[0] + deltaX, p[1] + deltaY] as [number, number]) }
          });
        } else {
          updates.push({
            id,
            updates: { x: snap.x + deltaX, y: snap.y + deltaY }
          });
        }
      });
      updateCanvasBlocks(updates);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      const movedDist = Math.hypot(upEvent.clientX - startClientX, upEvent.clientY - startClientY);
      
      if (movedDist < 4 && isAlreadySelected && !upEvent.shiftKey) {
        onSelect(clickedBlock.id, false);
      }
      
      onCommit?.();
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <svg
      className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
      style={{ zIndex: 1 }}
    >
      {shapes.map(b => (
        <g key={b.id} style={{ pointerEvents: 'auto' }}>
          <ShapeEl 
            block={b} 
            isSelected={selectedIds.has(b.id)} 
            onPointerDown={(e) => handleShapePointerDown(e, b)} 
          />
        </g>
      ))}
    </svg>
  );
}