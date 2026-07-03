"use client";

import { cn } from '@/lib/utils';

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface ResizeHandleProps {
  position: HandlePosition;
  onResizeStart: (position: HandlePosition, e: React.PointerEvent) => void;
  isSelected?: boolean;
}

const CURSOR_MAP: Record<HandlePosition, string> = {
  nw: 'nw-resize',
  n: 'n-resize',
  ne: 'ne-resize',
  e: 'e-resize',
  se: 'se-resize',
  s: 's-resize',
  sw: 'sw-resize',
  w: 'w-resize',
};

const POSITION_CLASSES: Record<HandlePosition, string> = {
  nw: '-top-[5px] -left-[5px]',
  n:  '-top-[5px] left-1/2 -translate-x-1/2',
  ne: '-top-[5px] -right-[5px]',
  e:  'top-1/2 -right-[5px] -translate-y-1/2',
  se: '-bottom-[5px] -right-[5px]',
  s:  '-bottom-[5px] left-1/2 -translate-x-1/2',
  sw: '-bottom-[5px] -left-[5px]',
  w:  'top-1/2 -left-[5px] -translate-y-1/2',
};

export function ResizeHandle({ position, onResizeStart, isSelected }: ResizeHandleProps) {
  const isCorner = ['nw', 'ne', 'se', 'sw'].includes(position);

  return (
    <div
      className={cn(
        "absolute z-[200]",
        "w-2.5 h-2.5 bg-panel border border-brand-blue rounded-none shadow-sm",
        "transition-none hover:scale-135 hover:bg-brand-blue hover:border-[var(--app-panel)]",
        // pointer-events-auto is explicit (not inherited): frame roots are pointer-events-none,
        // and the handles must stay interactive inside them.
        isSelected ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-50 pointer-events-none",
        POSITION_CLASSES[position],
      )}
      style={{ cursor: CURSOR_MAP[position] }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onResizeStart(position, e);
      }}
    />
  );
}

