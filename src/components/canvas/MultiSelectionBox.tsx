"use client";

import { useLayoutEffect, useRef } from 'react';
import { HandlePosition, ResizeHandle } from './ResizeHandle';

const HANDLES: HandlePosition[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

interface MultiSelectionBoxProps {
  boundingBox: { x: number; y: number; w: number; h: number } | null;
  selectedCount: number;
  onResizeStart: (handle: HandlePosition, e: React.PointerEvent) => void;
  onRotateStart?: (e: React.PointerEvent) => void;
}

export function MultiSelectionBox({ boundingBox, selectedCount, onResizeStart, onRotateStart }: MultiSelectionBoxProps) {
  const boxRef = useRef<HTMLDivElement>(null);

  // After every React render, clear any stale transform set by the drag subscription.
  // This runs synchronously after DOM commit but before the browser paints,
  // so there's no visible flicker/teleport. During drag there are no React renders,
  // so this doesn't interfere with the direct DOM transform from the subscription.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (el && el.style.transform) {
      el.style.transform = '';
    }
  });

  if (selectedCount < 2 || !boundingBox) return null;

  return (
    <div
      ref={boxRef}
      id="multi-selection-box"
      className="absolute pointer-events-none z-[2999]"
      style={{
        left: boundingBox.x,
        top: boundingBox.y,
        width: boundingBox.w,
        height: boundingBox.h,
      }}
    >
      {/* Rotation handle — centered above the unified bounding box */}
      {onRotateStart && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 flex flex-col items-center pb-[1px] pointer-events-auto z-[200]">
          <div
            className="w-3 h-3 bg-[var(--brand-blue)] rounded-full cursor-grab active:cursor-grabbing"
            onPointerDown={onRotateStart}
          />
          <div className="w-[1px] h-3 bg-[var(--brand-blue)]" />
        </div>
      )}

      {/* Blue border */}
      <div className="absolute inset-0 border-2 border-[var(--brand-blue)] pointer-events-none rounded-[1px]" />

      {/* Resize handles */}
      {HANDLES.map(h => (
        <div key={h} className="pointer-events-auto">
          <ResizeHandle
            position={h}
            isSelected={true}
            onResizeStart={(pos, e) => onResizeStart(pos, e)}
          />
        </div>
      ))}
    </div>
  );
}
