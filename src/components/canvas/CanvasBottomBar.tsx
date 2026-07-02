"use client";

import { Minus, Undo2, Redo2 } from 'lucide-react';

export interface CanvasBottomBarProps {
  viewportScale: number;
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomIn: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

// Floating Canvas Controls (Zoom and Undo/Redo) in the bottom left.
// Pure props-in JSX extracted verbatim from CanvasPage — no logic changes.
export function CanvasBottomBar({
  viewportScale,
  minZoom,
  maxZoom,
  zoomStep,
  onZoomOut,
  onZoomReset,
  onZoomIn,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: CanvasBottomBarProps) {
  return (
    <div
      className="absolute bottom-6 left-6 z-[1000] flex gap-2 select-none"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >            {/* Zoom Controls */}
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

      {/* Undo / Redo Controls */}
      <div className="flex items-center h-8 bg-panel/98 backdrop-blur-xl border border-[var(--bone-12)] shadow-[0_4px_12px_rgba(0,0,0,0.12)] rounded-[8px] p-[3px] gap-[1px] canvas-floating-panel">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="group w-7 h-[26px] rounded-[6px] flex items-center justify-center text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--bone-70)] cursor-pointer disabled:cursor-not-allowed transition-all duration-150 ease-in-out"
          title="Undo (Ctrl+Z)"
        >
          <span className="opacity-70 group-hover:opacity-100"><Undo2 className="w-3.5 h-3.5 text-[var(--bone-100)]" /></span>
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="group w-7 h-[26px] rounded-[6px] flex items-center justify-center text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--bone-70)] cursor-pointer disabled:cursor-not-allowed transition-all duration-150 ease-in-out"
          title="Redo (Ctrl+Y)"
        >
          <span className="opacity-70 group-hover:opacity-100"><Redo2 className="w-3.5 h-3.5 text-[var(--bone-100)]" /></span>
        </button>
      </div>
    </div>
  );
}
