'use client';

import { useRef, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  staggerIndex?: number;
}

export function BentoWidget({ item, contextId, editMode, isLoading, onRemove, onUpdateData, isSwapTarget, isStackTarget, staggerIndex = 0 }: BentoWidgetProps) {
  const entry = widgetRegistry[item.type];
  const ref = useRef<HTMLDivElement>(null);
  const prevEditMode = useRef(editMode);
  const [borderFlash, setBorderFlash] = useState(false);

  useEffect(() => {
    if (prevEditMode.current === editMode) return;
    prevEditMode.current = editMode;
    const delay = staggerIndex * 30;
    const t1 = setTimeout(() => {
      setBorderFlash(true);
      const t2 = setTimeout(() => setBorderFlash(false), 400);
      return () => clearTimeout(t2);
    }, delay);
    return () => clearTimeout(t1);
  }, [editMode, staggerIndex]);

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
      data-border-flash={borderFlash ? 'true' : undefined}
      className={cn(
        'h-full relative group/bento-widget transition-all duration-300 rounded-[var(--radius-big)] border border-[var(--bone-12)]',
        editMode ? 'overflow-visible' : 'overflow-hidden',
        editMode && 'cursor-grab active:cursor-grabbing select-none',
        isSwapTarget && 'ring-2 ring-[var(--bone-100)] scale-[1.02] shadow-lg',
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
