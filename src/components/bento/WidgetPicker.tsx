'use client';

import clsx from 'clsx';
import { widgetRegistry, WidgetRegistryEntry } from './registry';
import { useMemo } from 'react';

interface WidgetPickerProps {
  open: boolean;
  onAdd: (type: string) => void;
  onDragStart: (type: string) => void;
  onDragEnd: () => void;
  contextId: string;
}

export function WidgetPicker({ open, onAdd, onDragStart, onDragEnd, contextId }: WidgetPickerProps) {
  const isDashboard = contextId === 'dashboard';
  
  const groupedRegistry = useMemo(() => {
    const groups: Record<string, [string, WidgetRegistryEntry][]> = {};
    
    Object.entries(widgetRegistry).forEach(([type, entry]) => {
      if (!groups[entry.category]) {
        groups[entry.category] = [];
      }
      groups[entry.category].push([type, entry]);
    });
    
    return groups;
  }, []);

  // Order of categories
  const categories = ['General', 'Organization', 'Life', 'Knowledge'] as const;

  return (
    <div
      className={clsx(
        'h-full bg-sidebar border-l border-border transition-[width] duration-300 overflow-hidden shrink-0',
        open ? 'w-[280px]' : 'w-0'
      )}
    >
      <div className="w-[280px] h-full flex flex-col px-1">
        <div className="p-4 pb-0 mb-6">
          <h3 className="text-lg font-display font-semibold text-foreground">Add Widgets</h3>
          <p className="text-xs text-muted-foreground mt-1">Click to add to your layout</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-8 px-4 pb-5 scrollbar-thin">
          {categories.map(category => {
            const widgets = groupedRegistry[category];
            if (!widgets || widgets.length === 0) return null;

            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent/70">{category}</span>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                
                <div className="space-y-2">
                  {widgets.map(([type, entry]) => (
                    <div
                      key={type}
                      draggable
                       onDragStart={(e) => {
                         e.dataTransfer.setData('application/flowr-widget-type', type);
                         onDragStart(type);
                       }}
                      onDragEnd={onDragEnd}
                      onClick={() => onAdd(type)}
                      className="group w-full text-left p-3 rounded-xl border border-border/40 bg-[var(--bone-2)] hover:border-accent/20 hover:bg-[var(--bone-8)] cursor-grab active:cursor-grabbing select-none"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-semibold text-foreground group-hover:text-accent">{entry.label}</p>
                        <span className="text-[10px] font-medium text-muted-foreground/60 bg-[var(--bone-6)] px-1.5 py-0.5 rounded">
                          {entry.defaultW}×{entry.defaultH}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{entry.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
