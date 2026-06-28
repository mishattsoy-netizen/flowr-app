"use client";

import { HandlePosition, ResizeHandle } from './ResizeHandle';

const HANDLES: HandlePosition[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

interface MultiSelectionBoxProps {
  boundingBox: { x: number; y: number; w: number; h: number } | null;
  selectedCount: number;
  onResizeStart: (handle: HandlePosition, e: React.PointerEvent) => void;
}

export function MultiSelectionBox({ boundingBox, selectedCount, onResizeStart }: MultiSelectionBoxProps) {
  if (selectedCount < 2 || !boundingBox) return null;

  return (
    <div
      id="multi-selection-box"
      className="absolute pointer-events-none z-[2999]"
      style={{
        left: boundingBox.x,
        top: boundingBox.y,
        width: boundingBox.w,
        height: boundingBox.h,
      }}
    >
      {/* Blue border */}
      <div className="absolute inset-0 border-2 border-brand-blue pointer-events-none rounded-[1px]" />

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
