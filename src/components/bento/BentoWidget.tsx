'use client';

import { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import gsap from 'gsap';
import { widgetRegistry } from './registry';
import type { BentoLayoutItem } from './types';

interface BentoWidgetProps {
  item: BentoLayoutItem;
  contextId: string;
  editMode: boolean;
  isLoading?: boolean;
  onRemove: () => void;
  onUpdateData: (newData: any) => void;
  isSwapTarget?: boolean;
}

export function BentoWidget({ item, contextId, editMode, isLoading, onRemove, onUpdateData, isSwapTarget }: BentoWidgetProps) {
  const entry = widgetRegistry[item.type];
  const ref = useRef<HTMLDivElement>(null);

  // Entrance animation removed to prevent layout shift on load
  useEffect(() => {
    // We could add a more subtle entrance here if needed, but for now we prioritize instant UI
  }, []);

  if (!entry) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground bg-[var(--bone-5)] rounded-xl border border-[var(--bone-10)]">
        Unknown widget
      </div>
    );
  }

  const WidgetComponent = entry.component;

  return (
    <div
      ref={ref}
      className={clsx(
        'h-full relative group/bento-widget transition-all duration-500 rounded-[var(--radius-big)] overflow-hidden',
        editMode && 'cursor-grab active:cursor-grabbing select-none',
        isSwapTarget && 'ring-2 ring-[var(--bone-100)]'
      )}
    >
      <WidgetComponent 
        contextId={contextId} 
        data={item.data} 
        onUpdateData={onUpdateData}
      />
      {editMode && (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="absolute top-2 right-2 z-30 opacity-0 group-hover/bento-widget:opacity-100 transition-opacity p-1.5 bg-background/80 backdrop-blur-sm border border-border rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
