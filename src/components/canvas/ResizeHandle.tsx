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
  nw: '-top-[3px] -left-[3px]',
  n:  '-top-[3px] left-1/2 -translate-x-1/2',
  ne: '-top-[3px] -right-[3px]',
  e:  'top-1/2 -right-[3px] -translate-y-1/2',
  se: '-bottom-[3px] -right-[3px]',
  s:  '-bottom-[3px] left-1/2 -translate-x-1/2',
  sw: '-bottom-[3px] -left-[3px]',
  w:  'top-1/2 -left-[3px] -translate-y-1/2',
};

export function ResizeHandle({ position, onResizeStart, isSelected }: ResizeHandleProps) {
  const isCorner = ['nw', 'ne', 'se', 'sw'].includes(position);

  return (
    <div
      className={cn(
        "absolute z-[200] ",
        "w-2.5 h-2.5 bg-background border-2 border-brand-blue rounded-full ",
        isSelected ? "opacity-100 scale-100" : "opacity-0 scale-50",
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

