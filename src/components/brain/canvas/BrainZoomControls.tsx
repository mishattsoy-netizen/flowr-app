"use client";

import { Minus } from 'lucide-react';

export interface BrainZoomControlsProps {
  viewportScale: number;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomIn: () => void;
}

// Bottom-left zoom control, styled to match the whiteboard's CanvasBottomBar
// zoom box. Undo/redo isn't included — the brain canvas has no undo history.
export function BrainZoomControls({ viewportScale, onZoomOut, onZoomReset, onZoomIn }: BrainZoomControlsProps) {
  return (
    <div
      className="absolute bottom-6 left-6 z-20 select-none"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center h-8 bg-panel/98 backdrop-blur-xl border border-[var(--bone-12)] shadow-[0_4px_12px_rgba(0,0,0,0.12)] rounded-[8px] p-[3px] canvas-floating-panel">
        <button
          onClick={onZoomOut}
          className="group w-7 h-[26px] rounded-[6px] flex items-center justify-center text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] active:bg-[var(--bone-15)] cursor-pointer transition-all duration-150 ease-in-out"
          title="Zoom Out"
        >
          <span className="opacity-70 group-hover:opacity-100"><Minus className="w-3.5 h-3.5 text-[var(--bone-100)]" /></span>
        </button>

        <button
          onClick={onZoomReset}
          className="px-2 h-[26px] flex items-center justify-center text-[11px] font-semibold text-[var(--bone-90)] hover:text-[var(--bone-100)] transition-all duration-150 ease-in-out min-w-[48px] text-center cursor-pointer"
          title="Reset Zoom to 100%"
        >
          {Math.round(viewportScale * 100)}%
        </button>

        <button
          onClick={onZoomIn}
          className="group w-7 h-[26px] rounded-[6px] flex items-center justify-center text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] active:bg-[var(--bone-15)] cursor-pointer transition-all duration-150 ease-in-out"
          title="Zoom In"
        >
          <span className="opacity-70 group-hover:opacity-100"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bone-100)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg></span>
        </button>
      </div>
    </div>
  );
}
