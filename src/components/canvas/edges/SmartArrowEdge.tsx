"use client";

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

import { calculateCatmullRomPath } from '@/lib/geometry/splines';

interface SmartArrowProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: string;
  targetPosition: string;
  style?: React.CSSProperties;
  pathPoints?: [number, number][];
  source?: string;
  target?: string;
  selected?: boolean;
  onSelect?: (id: string, addToSelection: boolean) => void;
  canvasStyleExt?: any;
}

// Custom micro-helper mimicking ReactFlow's basic bezier behavior to prevent framework dependency crashes
function getSimpleBezierPath({ sx, sy, tx, ty, sp, tp }: { sx:number, sy:number, tx:number, ty:number, sp:string, tp:string }) {
  const dx = Math.abs(tx - sx);
  const dy = Math.abs(ty - sy);
  const curvature = 0.5;
  
  let c1x = sx, c1y = sy;
  let c2x = tx, c2y = ty;

  if (sp === 'left') c1x -= dx * curvature;
  else if (sp === 'right') c1x += dx * curvature;
  else if (sp === 'top') c1y -= dy * curvature;
  else if (sp === 'bottom') c1y += dy * curvature;

  if (tp === 'left') c2x -= dx * curvature;
  else if (tp === 'right') c2x += dx * curvature;
  else if (tp === 'top') c2y -= dy * curvature;
  else if (tp === 'bottom') c2y += dy * curvature;

  return `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;
}

export const SmartArrowEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  pathPoints,
  source,
  target,
  selected,
  onSelect,
  canvasStyleExt,
}: SmartArrowProps) => {
  const pathRef = useRef<SVGPathElement>(null);
  const hitBoxRef = useRef<SVGPathElement>(null);

  let edgePath = "";
  let finalPoints = pathPoints ? pathPoints.map(p => [...p] as [number, number]) : null;
  
  if (finalPoints && finalPoints.length >= 2) {
    // Update dynamic lock coordinates when pinned during drags
    if (sourceX !== undefined && sourceY !== undefined) {
      finalPoints[0] = [sourceX, sourceY];
    }
    if (targetX !== undefined && targetY !== undefined) {
      finalPoints[finalPoints.length - 1] = [targetX, targetY];
    }
    edgePath = calculateCatmullRomPath(finalPoints);
  } else {
    // Fallback to organic pure Bezier if no freehand path exists
    edgePath = getSimpleBezierPath({ 
      sx: sourceX, sy: sourceY, 
      tx: targetX, ty: targetY, 
      sp: sourcePosition, tp: targetPosition 
    });
  }

  const applyPathGap = (pStr: string) => {
    if (!pStr) return pStr;
    const tokens = pStr.match(/[a-zA-Z]|-?\d+(?:\.\d+)?/g);
    if (!tokens || tokens.length < 4) return pStr;
    
    const len = tokens.length;
    const lastX = parseFloat(tokens[len - 2]);
    const lastY = parseFloat(tokens[len - 1]);
    
    const prevX = parseFloat(tokens[len - 4]);
    const prevY = parseFloat(tokens[len - 3]);
    
    if (isNaN(lastX) || isNaN(lastY) || isNaN(prevX) || isNaN(prevY)) {
      return pStr;
    }
    
    const dx = lastX - prevX;
    const dy = lastY - prevY;
    const dist = Math.hypot(dx, dy);
    
    if (dist === 0) return pStr;
    
    const gap = 12; // Gap for arrowhead
    const ratio = Math.max(0, (dist - gap) / dist);
    
    const newX = prevX + dx * ratio;
    const newY = prevY + dy * ratio;
    
    tokens[len - 2] = newX.toFixed(1);
    tokens[len - 1] = newY.toFixed(1);
    
    return tokens.join(' ');
  };

  // Apply path shortening safely on final curves
  const path = applyPathGap(edgePath);

  useEffect(() => {
    if (pathRef.current) {
      const len = pathRef.current.getTotalLength();
      gsap.fromTo(
        pathRef.current,
        { strokeDasharray: len, strokeDashoffset: len },
        { strokeDashoffset: 0, duration: 0.5, ease: "power2.out" }
      );
    }
  }, [id]);

  const strokeColor = selected
    ? 'var(--brand-blue)'
    : (canvasStyleExt?.stroke || 'var(--accent)');

  const strokeWidth = selected ? 3 : (canvasStyleExt?.strokeWidth || 2);
  const strokeStyle = canvasStyleExt?.strokeStyle || 'solid';
  const dasharray = strokeStyle === 'dashed' ? '6 4' : strokeStyle === 'dotted' ? '2 3' : undefined;

  let markerId = "arrowhead";
  if (selected) {
    markerId = "arrowhead-selected";
  } else if (canvasStyleExt?.stroke) {
    const s = canvasStyleExt.stroke;
    if (s === '#d38f36') markerId = "arrowhead-accent";
    else if (s === '#5b9cf6') markerId = "arrowhead-blue";
    else if (s === '#a78bfa') markerId = "arrowhead-purple";
    else if (s === '#4ade80') markerId = "arrowhead-green";
    else if (s === '#f87171') markerId = "arrowhead-red";
    else if (s.toLowerCase().includes('bone')) markerId = "arrowhead-bone";
  }

  const sharedDataAttrs = {
    'data-from-id': source,
    'data-to-id': target,
    'data-from-side': sourcePosition,
    'data-to-side': targetPosition,
    'data-init-sx': sourceX,
    'data-init-sy': sourceY,
    'data-init-tx': targetX,
    'data-init-ty': targetY,
    'data-points': pathPoints ? JSON.stringify(pathPoints) : undefined,
  };

  return (
    <g>
      {/* Hitbox */}
      <path
        ref={hitBoxRef}
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={22}
        className="cursor-pointer"
        style={{ pointerEvents: 'auto' }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onSelect?.(id, e.shiftKey);
        }}
        data-connection-hitbox={id}
        {...sharedDataAttrs}
      />

      {/* Spline Path */}
      <path
        ref={pathRef}
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={dasharray}
        markerEnd={`url(#${markerId})`}
        style={{ pointerEvents: 'none', transition: 'stroke 0.2s, stroke-width 0.2s' }}
        data-connection-path={id}
        {...sharedDataAttrs}
      />
    </g>
  );
};
