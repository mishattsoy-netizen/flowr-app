"use client";
import React, { useRef, useEffect, useMemo } from 'react';
import gsap from 'gsap';
import { useStore, type EditorBlock } from '@/data/store';
import { calculateCatmullRomPath, calculateAdvancedPath } from '@/lib/geometry/splines';
import { resolvePoints } from '@/lib/geometry/resolvePoints';
import { resolveBindingPosition } from '@/lib/geometry/binding';
import { ArrowheadMarker, getMarkerIds } from './arrowheadMarkers';

interface VectorPathProps {
  block: EditorBlock;
  selected: boolean;
  editing: boolean;
  activeTool?: string;
  onSelect: (id: string, addToSelection: boolean) => void;
  onPointDragStart?: (index: number, e: React.PointerEvent) => void;
  onBindingDragStart?: (end: 'start' | 'end', e: React.PointerEvent) => void;
  onPathClickForAdd?: (t: number, x: number, y: number) => void;
  onDoubleClick?: () => void;
  onDragStart?: (e: React.PointerEvent, block: EditorBlock) => void;
}

export function VectorPath({ block, selected, editing, activeTool, onSelect, onPointDragStart, onBindingDragStart, onDoubleClick, onDragStart }: VectorPathProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const allBlocks = useStore(s => s.blocks);
  const canvasBlocks = useMemo(() => allBlocks.filter(b => b.canvasId === block.canvasId), [allBlocks, block.canvasId]);

  const resolvedPts = useMemo(() => resolvePoints(block, canvasBlocks), [block, canvasBlocks]);
  const isAdvanced = block.editMode === 'advanced';
  const radiuses = block.pointRadiuses ?? [];

  const edgePath = useMemo(() => {
    if (resolvedPts.length < 2) return '';
    if (isAdvanced && radiuses.length > 0) return calculateAdvancedPath(resolvedPts, radiuses);
    return calculateCatmullRomPath(resolvedPts);
  }, [resolvedPts, isAdvanced, radiuses]);

  const path = useMemo(() => {
    if (!edgePath) return edgePath;
    const tokens = edgePath.match(/[a-zA-Z]|-?\d+(?:\.\d+)?/g);
    if (!tokens || tokens.length < 4) return edgePath;
    const len = tokens.length;
    const lx = parseFloat(tokens[len-2]), ly = parseFloat(tokens[len-1]);
    const px = parseFloat(tokens[len-4]), py = parseFloat(tokens[len-3]);
    if (isNaN(lx) || isNaN(ly) || isNaN(px) || isNaN(py)) return edgePath;
    const dx = lx - px, dy = ly - py, dist = Math.hypot(dx, dy);
    if (dist === 0) return edgePath;
    const headSize = block.endArrowhead?.size ?? 1;
    const gap = 8 * headSize;
    const ratio = Math.max(0, (dist - gap) / dist);
    tokens[len-2] = (px + dx * ratio).toFixed(1);
    tokens[len-1] = (py + dy * ratio).toFixed(1);
    return tokens.join(' ');
  }, [edgePath]);

  useEffect(() => {
    if (pathRef.current) {
      const len = pathRef.current.getTotalLength();
      gsap.fromTo(pathRef.current, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.5, ease: "power2.out" });
    }
  }, [block.id]);

  const style = block.canvasStyleExt ?? {};
  const strokeColor = selected ? 'var(--brand-blue)' : (style.stroke || 'var(--accent)');
  const strokeWidth = selected ? 3 : (style.strokeWidth || 2);
  const strokeStyle = style.strokeStyle || 'solid';
  const dasharray = strokeStyle === 'dashed' ? '6 4' : strokeStyle === 'dotted' ? '2 3' : undefined;

  const markerIds = getMarkerIds(block.id);
  const sHead = block.startArrowhead ?? (block.shapeKind === 'arrow' ? { type: 'filled-triangle' as const, size: 1 } : { type: 'none' as const });
  const eHead = block.endArrowhead ?? (block.shapeKind === 'arrow' ? { type: 'filled-triangle' as const, size: 1 } : { type: 'none' as const });

  const startPos = block.startBinding ? resolveBindingPosition(block.startBinding, canvasBlocks) : null;
  const endPos = block.endBinding ? resolveBindingPosition(block.endBinding, canvasBlocks) : null;

  const isDrawingTool = activeTool === 'arrow' || activeTool === 'line';

  const bounds = useMemo(() => {
    if (resolvedPts.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of resolvedPts) {
      if (p[0] < minX) minX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] > maxY) maxY = p[1];
    }
    return { x: minX, y: minY, w: Math.max(maxX - minX, 1), h: Math.max(maxY - minY, 1) };
  }, [resolvedPts]);

  return (
    <g id={block.id}>
      <defs>
        <ArrowheadMarker id={markerIds.start} style={sHead} strokeColor={strokeColor} />
        <ArrowheadMarker id={markerIds.end} style={eHead} strokeColor={strokeColor} />
      </defs>
      {/* Selection frame */}
      {selected && bounds && (
        <rect x={bounds.x - 6} y={bounds.y - 6} width={bounds.w + 12} height={bounds.h + 12}
          fill="none" stroke="var(--brand-blue)" strokeWidth={1} strokeDasharray="4 4" rx={4}
          style={{ pointerEvents: 'none' }} />
      )}
      <path
        d={path}
        fill="none" stroke="transparent" strokeWidth={22}
        className="cursor-pointer" style={{ pointerEvents: isDrawingTool ? 'none' : 'auto' }}
        onPointerDown={e => { e.stopPropagation(); onSelect?.(block.id, e.shiftKey); onDragStart?.(e, block); }}
        onDoubleClick={e => { e.stopPropagation(); onDoubleClick?.(); }}
        data-connection-hitbox={block.id}
        data-block-id={block.id}
        data-start-binding={block.startBinding ? JSON.stringify(block.startBinding) : undefined}
        data-end-binding={block.endBinding ? JSON.stringify(block.endBinding) : undefined}
        data-key-points={block.keyPoints ? JSON.stringify(block.keyPoints) : undefined}
      />
      <path
        ref={pathRef} d={path}
        fill="none" stroke={strokeColor} strokeWidth={strokeWidth}
        strokeDasharray={dasharray} opacity={style.opacity ?? 1}
        markerStart={sHead.type !== 'none' ? `url(#${markerIds.start})` : undefined}
        markerEnd={eHead.type !== 'none' ? `url(#${markerIds.end})` : undefined}
        style={{ pointerEvents: 'none', transition: 'stroke 0.2s, stroke-width 0.2s' }}
        data-connection-path={block.id}
        data-block-id={block.id}
        data-start-binding={block.startBinding ? JSON.stringify(block.startBinding) : undefined}
        data-end-binding={block.endBinding ? JSON.stringify(block.endBinding) : undefined}
        data-key-points={block.keyPoints ? JSON.stringify(block.keyPoints) : undefined}
      />
      {editing && (
        <>
          {block.keyPoints?.map((pt, i) => (
            <circle key={`wp-${i}`} cx={pt[0]} cy={pt[1]} r={5}
              fill="white" stroke={strokeColor} strokeWidth={1.5}
              style={{ cursor: 'grab', pointerEvents: 'auto' }}
              onPointerDown={e => { e.stopPropagation(); onPointDragStart?.(i, e); }} />
          ))}
          {startPos && (
            <circle cx={startPos[0]} cy={startPos[1]} r={6}
              fill="#d38f36" stroke="white" strokeWidth={1.5}
              style={{ cursor: 'grab', pointerEvents: 'auto' }}
              onPointerDown={e => { e.stopPropagation(); onBindingDragStart?.('start', e); }} />
          )}
          {endPos && (
            <circle cx={endPos[0]} cy={endPos[1]} r={6}
              fill="#d38f36" stroke="white" strokeWidth={1.5}
              style={{ cursor: 'grab', pointerEvents: 'auto' }}
              onPointerDown={e => { e.stopPropagation(); onBindingDragStart?.('end', e); }} />
          )}
        </>
      )}
      {/* Show binding/waypoint dots when selected (but not editing) */}
      {!editing && selected && (
        <>
          {block.keyPoints?.map((pt, i) => (
            <circle key={`wp-sel-${i}`} cx={pt[0]} cy={pt[1]} r={4}
              fill="white" stroke={strokeColor} strokeWidth={1} opacity={0.6}
              style={{ pointerEvents: 'none' }} />
          ))}
          {startPos && (
            <circle cx={startPos[0]} cy={startPos[1]} r={5}
              fill="#d38f36" stroke="white" strokeWidth={1.5} opacity={0.8}
              style={{ pointerEvents: 'none' }} />
          )}
          {endPos && (
            <circle cx={endPos[0]} cy={endPos[1]} r={5}
              fill="#d38f36" stroke="white" strokeWidth={1.5} opacity={0.8}
              style={{ pointerEvents: 'none' }} />
          )}
        </>
      )}
    </g>
  );
}
