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
  isStackTarget?: boolean;
}

export function BentoWidget({ item, contextId, editMode, isLoading, onRemove, onUpdateData, isSwapTarget, isStackTarget }: BentoWidgetProps) {
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
        'h-full relative group/bento-widget transition-all duration-500 rounded-[var(--radius-big)]',
        editMode ? 'overflow-visible' : 'overflow-hidden',
        editMode && 'cursor-grab active:cursor-grabbing select-none',
        isSwapTarget && 'ring-2 ring-[var(--bone-100)]',
        isStackTarget && 'ring-2 ring-accent bg-accent/5 scale-105 z-20'
      )}
    >
      <div className="h-full rounded-[var(--radius-big)] overflow-hidden">
        <WidgetComponent
          contextId={contextId}
          data={item.data}
          onUpdateData={onUpdateData}
          isEditing={editMode}
        />
      </div>
      {editMode && (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onRemove(); }}
           className="absolute -top-1 left-0 z-50 w-5 h-5 flex items-center justify-center rounded-full bg-background border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/50 hover:bg-red-400/10 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
