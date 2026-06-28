"use client";
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore, type EditorBlock } from '@/data/store';
import { calculateCatmullRomPath, calculateAdvancedPath, calculateSplineBounds } from '@/lib/geometry/splines';
import { resolvePoints } from '@/lib/geometry/resolvePoints';
import { resolveBindingPosition } from '@/lib/geometry/binding';
import { ArrowheadMarker, getMarkerIds } from './arrowheadMarkers';
import { ResizeHandle, HandlePosition } from '../ResizeHandle';
import { activeDragOffsets } from '@/lib/canvasDragState';

interface VectorPathProps {
  block: EditorBlock;
  selected: boolean;
  editing: boolean;
  activeTool?: string;
  viewportScale?: number;
  viewport?: { x: number; y: number; scale: number };
  selectedPointIndex?: number | null;
  onSelect: (id: string, addToSelection: boolean) => void;
  onBindingDragStart?: (end: 'start' | 'end', e: React.PointerEvent) => void;
  onDoubleClick?: () => void;
  onDragStart?: (e: React.PointerEvent, block: EditorBlock) => void;
  onPointSelect?: (index: number | null) => void;
  showIndividualSelection?: boolean;
}

const POSITION_MAP: Record<HandlePosition, number> = {
  nw: 0,
  n: 1,
  ne: 2,
  e: 3,
  se: 4,
  s: 5,
  sw: 6,
  w: 7,
};

export function VectorPath({ block, selected, editing, activeTool, viewportScale, viewport, selectedPointIndex, onSelect, onBindingDragStart, onDoubleClick, onDragStart, onPointSelect, showIndividualSelection = true }: VectorPathProps) {
  const allBlocks = useStore(s => s.blocks);
  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);
  const canvasBlocks = useMemo(() => allBlocks.filter(b => b.canvasId === block.canvasId), [allBlocks, block.canvasId]);

  const [viewportContent, setViewportContent] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setViewportContent(document.getElementById('canvas-viewport-content'));
  }, []);

  const resolvedPts = useMemo(() => resolvePoints(block, canvasBlocks), [block, canvasBlocks]);
  const isAdvanced = block.editMode === 'advanced';
  const radiuses = block.pointRadiuses ?? [];
  const style = block.canvasStyleExt ?? {};
  const strokeWidth = style.strokeWidth || 2;
  const strokeStyle = style.strokeStyle || 'solid';
  const dasharray = strokeStyle === 'dashed' ? '6 4' : strokeStyle === 'dotted' ? '2 3' : undefined;

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
  }, [edgePath, block.endArrowhead?.size]);

  const strokeColor = selected ? 'var(--brand-blue)' : (style.stroke || 'var(--accent)');
  const markerIds = getMarkerIds(block.id);
  const sHead = block.startArrowhead ?? (block.shapeKind === 'arrow' ? { type: 'filled-triangle' as const, size: 1 } : { type: 'none' as const });
  const eHead = block.endArrowhead ?? (block.shapeKind === 'arrow' ? { type: 'filled-triangle' as const, size: 1 } : { type: 'none' as const });

  const startPos = block.startBinding ? resolveBindingPosition(block.startBinding, canvasBlocks) : null;
  const endPos = block.endBinding ? resolveBindingPosition(block.endBinding, canvasBlocks) : null;

  const isDrawingTool = activeTool === 'arrow' || activeTool === 'line';

  const bounds = useMemo(() => {
    if (resolvedPts.length === 0) return null;
    const { minX, minY, maxX, maxY } = calculateSplineBounds(resolvedPts, block.editMode, block.pointRadiuses);
    const pad = 6;
    return { x: minX - pad, y: minY - pad, w: Math.max(maxX - minX + pad * 2, 1), h: Math.max(maxY - minY + pad * 2, 1) };
  }, [resolvedPts, block.editMode, block.pointRadiuses]);

  const waypoints = block.points ?? [];

  // Waypoint drag
  const [draggingPt, setDraggingPt] = useState<number | null>(null);
  const scale = viewportScale ?? 1;
  const lastClickRef = useRef(0);

  const handleWaypointDown = (index: number, e: React.PointerEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = waypoints[index];
    if (!orig) return;

    setDraggingPt(index);

    // Initialize rotation center if not set
    if (!style.pivot && bounds) {
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;
      updateCanvasBlock(block.id, { canvasStyleExt: { ...style, pivot: [cx, cy] } });
    }

    const gEl = document.getElementById(block.id) as SVGGElement | null;
    const isAdvanced = block.editMode === 'advanced';
    const radiuses = block.pointRadiuses ?? [];
    const currentDragPts = [...waypoints];

    const computePathD = (pts: [number, number][]) => {
      if (pts.length < 2) return '';
      const edge = (isAdvanced && radiuses.length > 0)
        ? calculateAdvancedPath(pts, radiuses)
        : calculateCatmullRomPath(pts);
        
      if (!edge) return '';
      const tokens = edge.match(/[a-zA-Z]|-?\d+(?:\.\d+)?/g);
      if (!tokens || tokens.length < 4) return edge;
      const len = tokens.length;
      const lx = parseFloat(tokens[len-2]), ly = parseFloat(tokens[len-1]);
      const px = parseFloat(tokens[len-4]), py = parseFloat(tokens[len-3]);
      if (isNaN(lx) || isNaN(ly) || isNaN(px) || isNaN(py)) return edge;
      const dx = lx - px, dy = ly - py, dist = Math.hypot(dx, dy);
      if (dist === 0) return edge;
      const headSize = block.endArrowhead?.size ?? 1;
      const gap = 8 * headSize;
      const ratio = Math.max(0, (dist - gap) / dist);
      tokens[len-2] = (px + dx * ratio).toFixed(1);
      tokens[len-1] = (py + dy * ratio).toFixed(1);
      return tokens.join(' ');
    };

    const handleMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      
      const angle = style.rotation ?? 0;
      const rad = -angle * Math.PI / 180;
      const localDX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localDY = dx * Math.sin(rad) + dy * Math.cos(rad);

      const localPt = [orig[0] + localDX, orig[1] + localDY] as [number, number];
      currentDragPts[index] = localPt;

      if (gEl) {
        // 1. Update waypoints circles
        const circleEls = gEl.querySelectorAll('circle');
        if (circleEls[index]) {
          circleEls[index].setAttribute('cx', String(localPt[0]));
          circleEls[index].setAttribute('cy', String(localPt[1]));
        }

        // 2. Update path d attributes
        const hasStart = !!(block.startBinding || block.fromId);
        const resolvedPtsCopy = [...resolvedPts];
        const resolvedIndex = hasStart ? index + 1 : index;
        resolvedPtsCopy[resolvedIndex] = localPt;

        const newD = computePathD(resolvedPtsCopy);
        const hitboxPath = gEl.querySelector(`path[data-connection-hitbox="${block.id}"]`);
        if (hitboxPath) hitboxPath.setAttribute('d', newD);
        const visiblePath = gEl.querySelector(`path[data-connection-path="${block.id}"]`);
        if (visiblePath) visiblePath.setAttribute('d', newD);
      }
    };

    const handleUp = (ev: PointerEvent) => {
      setDraggingPt(null);
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);

      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      
      const angle = style.rotation ?? 0;
      const rad = -angle * Math.PI / 180;
      const localDX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localDY = dx * Math.sin(rad) + dy * Math.cos(rad);

      const finalPt = [orig[0] + localDX, orig[1] + localDY] as [number, number];
      const finalPts = [...waypoints];
      finalPts[index] = finalPt;

      updateCanvasBlock(block.id, { points: finalPts as [number, number][] });
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  };

  // Resize
  const resizeRef = useRef<{ handle: number; initBounds: { x: number; y: number; w: number; h: number }; initPts: [number, number][] } | null>(null);

  const handleResizeStart = (handle: number, e: React.PointerEvent, b: { x: number; y: number; w: number; h: number }) => {
    e.stopPropagation();
    const initPts = JSON.parse(JSON.stringify(waypoints)) as [number, number][];
    resizeRef.current = { handle, initBounds: { ...b }, initPts };
    const startX = e.clientX, startY = e.clientY;

    const handleMove = (ev: PointerEvent) => {
      const snap = resizeRef.current;
      if (!snap) return;
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      let nw = snap.initBounds.w, nh = snap.initBounds.h;
      switch (snap.handle) {
        case 0: nw -= dx; nh -= dy; break;
        case 1: nh -= dy; break;
        case 2: nw += dx; nh -= dy; break;
        case 3: nw += dx; break;
        case 4: nw += dx; nh += dy; break;
        case 5: nh += dy; break;
        case 6: nw -= dx; nh += dy; break;
        case 7: nw -= dx; break;
      }
      nw = Math.max(10, nw);
      nh = Math.max(10, nh);
      const anchors: Record<number, { ax: number; ay: number }> = {
        0: { ax: snap.initBounds.x + snap.initBounds.w, ay: snap.initBounds.y + snap.initBounds.h },
        1: { ax: snap.initBounds.x, ay: snap.initBounds.y + snap.initBounds.h },
        2: { ax: snap.initBounds.x, ay: snap.initBounds.y + snap.initBounds.h },
        3: { ax: snap.initBounds.x, ay: snap.initBounds.y },
        4: { ax: snap.initBounds.x, ay: snap.initBounds.y },
        5: { ax: snap.initBounds.x, ay: snap.initBounds.y },
        6: { ax: snap.initBounds.x + snap.initBounds.w, ay: snap.initBounds.y },
        7: { ax: snap.initBounds.x + snap.initBounds.w, ay: snap.initBounds.y },
      };
      const a = anchors[snap.handle];
      const sx = nw / snap.initBounds.w, sy = nh / snap.initBounds.h;
      const useSx = snap.handle !== 1 && snap.handle !== 5;
      const useSy = snap.handle !== 3 && snap.handle !== 7;
      const newPts = snap.initPts.map(p => [
        a.ax + (p[0] - a.ax) * (useSx ? sx : 1),
        a.ay + (p[1] - a.ay) * (useSy ? sy : 1),
      ] as [number, number]);
      updateCanvasBlock(block.id, { points: newPts });
    };

    const handleUp = () => {
      resizeRef.current = null;
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  };

  const CURSORS: Record<number, string> = { 0: 'nw-resize', 1: 'n-resize', 2: 'ne-resize', 3: 'e-resize', 4: 'se-resize', 5: 's-resize', 6: 'sw-resize', 7: 'w-resize' };

  // Helper: convert screen coords to canvas coords
  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = document.getElementById('canvas-bg')?.getBoundingClientRect();
    if (!rect || !viewport) return { x: clientX / scale, y: clientY / scale };
    return {
      x: (clientX - rect.left - viewport.x) / viewport.scale,
      y: (clientY - rect.top - viewport.y) / viewport.scale,
    };
  }, [viewport, scale]);

  // Rotation
  const rotateRef = useRef<{ cx: number; cy: number; initAngle: number } | null>(null);

  const handleRotateStart = (e: React.PointerEvent, b: { x: number; y: number; w: number; h: number }) => {
    e.stopPropagation();
    const cx = style.pivot ? style.pivot[0] : (b.x + b.w / 2);
    const cy = style.pivot ? style.pivot[1] : (b.y + b.h / 2);
    const existingRotation = style.rotation ?? 0;
    const initPos = screenToCanvas(e.clientX, e.clientY);
    const initAngle = Math.atan2(initPos.y - cy, initPos.x - cx);
    const gEl = document.querySelector<SVGGElement>(`g[id="${block.id}"]`);
    const overlayEl = document.getElementById(`arrow-overlay-${block.id}`);
    // Match CanvasBlock: query existing rotation-label inside the overlay
    const labelEl = overlayEl?.querySelector<HTMLElement>('.rotation-label');

    rotateRef.current = { cx, cy, initAngle };

    const handleMove = (ev: PointerEvent) => {
      if (!rotateRef.current) return;
      const { cx, cy, initAngle } = rotateRef.current;
      const curPos = screenToCanvas(ev.clientX, ev.clientY);
      const angle = Math.atan2(curPos.y - cy, curPos.x - cx);
      let deg = (angle - initAngle) * 180 / Math.PI;

      // Shift-45° snap
      if (ev.shiftKey) deg = Math.round(deg / 45) * 45;

      const totalDeg = existingRotation + deg;
      const transform = `rotate(${totalDeg}deg)`;
      const overlayOrigin = `${cx - b.x}px ${cy - b.y}px`;

      if (gEl) {
        gEl.setAttribute('transform', `rotate(${totalDeg}, ${cx}, ${cy})`);
      }
      if (overlayEl) {
        overlayEl.style.transform = transform;
        overlayEl.style.transformOrigin = overlayOrigin;
      }

      // Match CanvasBlock: update existing rotation-label textContent live
      if (labelEl) {
        labelEl.textContent = `${Math.round(totalDeg)}°`;
      }
    };

    const handleUp = () => {
      if (rotateRef.current && gEl) {
        const transformAttr = gEl.getAttribute('transform');
        const match = transformAttr ? transformAttr.match(/rotate\(([-\d.]+)/) : null;
        if (match) {
          const totalDeg = parseFloat(match[1]);
          // Normalize to [-180, 180]
          let d = ((totalDeg % 360) + 360) % 360;
          if (d > 180) d -= 360;
          updateCanvasBlock(block.id, { canvasStyleExt: { ...style, rotation: d, pivot: [cx, cy] } });
        }
        gEl.removeAttribute('transform');
        if (overlayEl) {
          overlayEl.style.transform = '';
          overlayEl.style.transformOrigin = '';
        }
      }
      rotateRef.current = null;
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  };

  const handleResizeStartStr = (pos: HandlePosition, e: React.PointerEvent) => {
    if (!bounds) return;
    handleResizeStart(POSITION_MAP[pos], e, bounds);
  };

  const renderRotation = style.rotation ?? 0;
  const pivotX = style.pivot ? style.pivot[0] : (bounds ? bounds.x + bounds.w / 2 : 0);
  const pivotY = style.pivot ? style.pivot[1] : (bounds ? bounds.y + bounds.h / 2 : 0);
  const gTransform = renderRotation && bounds ? `rotate(${renderRotation}, ${pivotX}, ${pivotY})` : undefined;

  return (
    <g id={block.id} transform={gTransform}>
      <defs>
        <ArrowheadMarker id={markerIds.start} style={sHead} strokeColor={strokeColor} />
        <ArrowheadMarker id={markerIds.end} style={eHead} strokeColor={strokeColor} />
      </defs>

      {/* HTML Selection frame via portal */}
      {selected && showIndividualSelection && !editing && bounds && viewportContent && createPortal(
        <div
          id={`arrow-overlay-${block.id}`}
          className="absolute pointer-events-auto select-none z-[190] cursor-move"
          style={{
            left: bounds.x,
            top: bounds.y,
            width: bounds.w,
            height: bounds.h,
            pointerEvents: (isDrawingTool || editing) ? 'none' : 'auto',
            transform: activeDragOffsets.has(block.id)
              ? undefined
              : (renderRotation ? `rotate(${renderRotation}deg)` : undefined),
            transformOrigin: renderRotation ? `${pivotX - bounds.x}px ${pivotY - bounds.y}px` : undefined,
          }}
          onPointerDown={e => {
            if (isDrawingTool || editing) return;
            e.stopPropagation();
            onSelect?.(block.id, e.shiftKey);
            onDragStart?.(e, block);
            const now = Date.now();
            if (now - lastClickRef.current < 300) {
              lastClickRef.current = 0;
              onDoubleClick?.();
            } else {
              lastClickRef.current = now;
            }
          }}
        >
          {/* Sharp-corner selection outline */}
          <div className="absolute -top-[1px] -left-[1px] -right-[1px] -bottom-[1px] border border-brand-blue pointer-events-none rounded-none z-[190]" />

          {/* Dimension & Rotation Labels */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 z-[4000] pointer-events-none">
            <div className="dimension-label bg-[var(--app-dark)] text-[var(--bone-90)] border border-[var(--bone-12)] shadow-md text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--radius-tiny)] whitespace-nowrap">
              {Math.round(bounds.w - 12)} × {Math.round(bounds.h - 12)}
            </div>
            <div className="rotation-label bg-[var(--app-dark)] text-[var(--bone-90)] border border-[var(--bone-12)] shadow-md text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--radius-tiny)] whitespace-nowrap">
              {Math.round(renderRotation)}°
            </div>
          </div>

          {/* Rotation handle */}
          {!isDrawingTool && !editing && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 flex flex-col items-center pb-[1px] pointer-events-auto z-[200]">
              <div
                className="w-3 h-3 bg-brand-blue rounded-full cursor-grab active:cursor-grabbing"
                onPointerDown={e => {
                  e.stopPropagation();
                  handleRotateStart(e, bounds);
                }}
              />
              <div className="w-[1px] h-3 bg-brand-blue" />
            </div>
          )}

          {/* 8 resize handles */}
          {!editing && (['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as HandlePosition[]).map(h => (
            <ResizeHandle
              key={h}
              position={h}
              isSelected={true}
              onResizeStart={(pos, ev) => handleResizeStartStr(pos, ev)}
            />
          ))}
        </div>,
        viewportContent
      )}

      <path
        d={path}
        fill="none" stroke="transparent" strokeWidth={22 / (viewportScale ?? 1)}
        className="cursor-pointer" style={{ pointerEvents: 'stroke' }}
        onPointerDown={e => {
          e.stopPropagation();
          onSelect?.(block.id, e.shiftKey);
          if (!isDrawingTool) onDragStart?.(e, block);
          const now = Date.now();
          if (now - lastClickRef.current < 300) {
            lastClickRef.current = 0;
            onDoubleClick?.();
          } else {
            lastClickRef.current = now;
          }
        }}
        data-connection-hitbox={block.id}
        data-block-id={block.id}
        data-start-binding={block.startBinding ? JSON.stringify(block.startBinding) : undefined}
        data-end-binding={block.endBinding ? JSON.stringify(block.endBinding) : undefined}
        data-points={block.points ? JSON.stringify(block.points) : undefined}
      />
      <path
        d={path}
        fill="none" stroke={strokeColor} strokeWidth={strokeWidth}
        strokeDasharray={dasharray} strokeOpacity={selected ? 1 : (style.strokeOpacity ?? 1)} opacity={style.opacity ?? 1}
        markerStart={sHead.type !== 'none' ? `url(#${markerIds.start})` : undefined}
        markerEnd={eHead.type !== 'none' ? `url(#${markerIds.end})` : undefined}
        style={{ pointerEvents: 'none', transition: 'stroke 0.2s, stroke-width 0.2s' }}
        data-connection-path={block.id}
        data-block-id={block.id}
        data-start-binding={block.startBinding ? JSON.stringify(block.startBinding) : undefined}
        data-end-binding={block.endBinding ? JSON.stringify(block.endBinding) : undefined}
        data-points={block.points ? JSON.stringify(block.points) : undefined}
      />

      {/* Edit mode: draggable waypoint dots */}
      {editing && (
        <>
          {waypoints.map((pt, i) => {
            const isSelected = selectedPointIndex === i;
            return (
              <circle key={`wp-${i}`} cx={pt[0]} cy={pt[1]} r={isSelected ? 8 : 5}
                fill="white" stroke={isSelected ? 'var(--brand-blue)' : strokeColor} strokeWidth={isSelected ? 2 : 1.5}
                style={{ cursor: draggingPt === i ? 'grabbing' : 'grab', pointerEvents: 'auto' }}
                onPointerDown={e => {
                  if (draggingPt !== null) return;
                  if (isSelected) {
                    onPointSelect?.(null);
                  } else {
                    onPointSelect?.(i);
                  }
                  handleWaypointDown(i, e);
                }} />
            );
          })}
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

      {/* Show waypoint/binding dots when selected */}
      {!editing && selected && (
        <>
          {waypoints.map((pt, i) => (
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
