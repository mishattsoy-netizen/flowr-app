import React from 'react';
import { useFlowState } from '@/hooks/useFlowState';
import { calculateCatmullRomPath } from '@/lib/geometry/splines';

export const FlowPreview = () => {
  const { isDrawing, currentPath, mousePosition } = useFlowState();
  if (!isDrawing) return null;

  const points = [...currentPath, [mousePosition.x, mousePosition.y] as [number, number]];
  const d = calculateCatmullRomPath(points);

  return (
    <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-[100]">
      <defs>
        <marker id="arrowhead-preview" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L0,8 L8,4 z" fill="var(--accent)" />
        </marker>
      </defs>
      <path 
        d={d} 
        fill="none" 
        stroke="var(--accent)" 
        strokeWidth={2} 
        markerEnd="url(#arrowhead-preview)" 
      />
    </svg>
  );
};
