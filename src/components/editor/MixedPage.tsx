"use client";

import { Entity, useStore } from '@/data/store';
import { NoteEditor } from './NoteEditor';
import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function MixedPage({ entity }: { entity: Entity }) {
  const mixedLayoutSplit = useStore(state => state.mixedLayoutSplit);
  const setMixedLayoutSplit = useStore(state => state.setMixedLayoutSplit);
  const [isResizing, setIsResizing] = useState(false);


  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      // Calculate split relative to total window width
      const split = (e.clientX / window.innerWidth) * 100;
      // Constraints: Prevent panels from becoming too small
      if (split > 20 && split < 80) {
        setMixedLayoutSplit(split);
      }
    }
  }, [isResizing, setMixedLayoutSplit]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  return (
    <div className={cn(
      "flex-1 flex overflow-hidden relative", 
      isResizing && "cursor-col-resize select-none"
    )}>
      {/* Left: Note editor panel */}
      <div 
        className="flex flex-col overflow-hidden border-r border-border"
        style={{ width: `${mixedLayoutSplit}%` }}
      >
        <NoteEditor entity={entity} isMixed={true} />
      </div>

      {/* Resize Splitter Handle */}
      <div
        onMouseDown={startResizing}
        className={cn(
          "w-1.5 -mx-0.75 relative z-50 cursor-col-resize group shrink-0",
          isResizing ? "bg-accent/20" : "bg-transparent hover:bg-accent/10"
        )}
      >
        {/* Visual Line */}
        <div className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 ",
          isResizing ? "bg-accent" : "bg-border group-hover:bg-accent/50"
        )} />
        
        {/* Hit Area Expansion */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-4 h-full" />
      </div>

      {/* Right: Canvas panel */}
      <div
        className="relative bg-panel overflow-hidden flex-1"
        style={{ 
          backgroundImage: 'linear-gradient(to right, var(--bone-3) 1px, transparent 1px), linear-gradient(to bottom, var(--bone-3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      >
        <div className="absolute top-6 left-6 popup-glass-small px-3 py-2 text-xs text-muted-foreground ">
          Canvas area — drag to add blocks
        </div>
      </div>
    </div>
  );
}

