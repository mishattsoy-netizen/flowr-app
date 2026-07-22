"use client";

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { X, Settings2, Plus } from 'lucide-react';
import { widgetRegistry } from '@/components/bento/registry';
import type { WidgetProps } from './types';

interface GenericStackedWidgetProps extends WidgetProps {
  data?: {
    widgets: string[]; // IDs of widgets from registry
    activeTabIndex?: number;
  };
}

export function GenericStackedWidget({ data, onUpdateData }: GenericStackedWidgetProps) {
  const widgets = data?.widgets || [];
  const [activeTabIndex, setActiveTabIndex] = useState(data?.activeTabIndex || 0);
  const [isDragOver, setIsDragOver] = useState(false);

  const activeWidgetId = widgets[activeTabIndex];

  const handleTabSwitch = (index: number) => {
    setActiveTabIndex(index);
    onUpdateData?.({ ...data, activeTabIndex: index });
  };

  const addWidget = (id: string) => {
    if (widgets.length >= 3) return;
    if (widgets.includes(id)) return; // Don't add duplicates
    const newWidgets = [...widgets, id];
    onUpdateData?.({ ...data, widgets: newWidgets });
    setActiveTabIndex(newWidgets.length - 1);
  };

  const removeWidget = (index: number) => {
    const newWidgets = widgets.filter((_, i) => i !== index);
    const newActiveIndex = activeTabIndex === index ? 0 :
      (activeTabIndex > index ? activeTabIndex - 1 : activeTabIndex);

    setActiveTabIndex(newActiveIndex);
    onUpdateData?.({ ...data, widgets: newWidgets, activeTabIndex: newActiveIndex });
  };

  const dragCounter = React.useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    // Check if we're dragging a widget to prevent showing drop styles for other types of drags (e.g. files)
    if (e.dataTransfer.types.includes('application/flowr-widget-type')) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    const type = e.dataTransfer.getData('application/flowr-widget-type');
    if (type && type !== 'stacked-widgets') {
      addWidget(type);
    }
  };

  const pillStyle = useMemo(() => {
    const count = widgets.length;
    if (count === 0) return {};
    const percent = 100 / count;
    return {
      width: `calc(${percent}% - 4px)`,
      left: `calc(${activeTabIndex * percent}% + ${activeTabIndex === 0 ? '3px' : '1px'})`,
      boxShadow: 'var(--slider-pill-shadow)',
    };
  }, [widgets.length, activeTabIndex]);

  const stableEmptyData = useMemo(() => ({}), []);

  return (
    <section
      className={cn(
        "h-full w-full relative bg-panel widget-shadow flex flex-col p-5 pt-4 transition-all duration-200 generic-stack-container",
        isDragOver && "ring-2 ring-accent ring-inset bg-accent/5"
      )}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Dynamic Header Section */}
      <div className="flex items-center justify-between mb-0.5 h-8 shrink-0">
        {widgets.length > 1 ? (
          /* Multi-widget Switcher */
          <div className="relative flex items-center p-0.5 rounded-[8px] no-drag min-w-[160px]" style={{ background: 'var(--slider-track)' }}>
            <div
              className="absolute top-0.5 bottom-0.5 rounded-[6px] bg-[var(--slider-pill)] transition-all duration-300 ease-out"
              style={pillStyle}
            />
            {widgets.map((id, idx) => (
              <button
                key={id + idx}
                onClick={() => handleTabSwitch(idx)}
                className={cn(
                  "relative z-10 flex-1 flex items-center justify-center py-1 rounded-[6px] group transition-colors duration-200",
                  activeTabIndex === idx ? "text-[var(--bone-100)]" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="text-[11px] font-semibold tracking-normal">
                  {widgetRegistry[id]?.label || 'Widget'}
                </span>

                {/* Remove Button on Hover */}
                <div
                  onClick={(e) => { e.stopPropagation(); removeWidget(idx); }}
                  className="absolute -top-1 -right-1 bg-[var(--bone-10)] text-[var(--bone-70)] hover:bg-red-500 hover:text-[var(--on-accent)] rounded-full p-0.5 opacity-0 group-hover:opacity-100 shadow-sm transition-all duration-200 z-20"
                >
                  <X className="w-2.5 h-2.5" />
                </div>
              </button>
            ))}
          </div>
        ) : widgets.length === 1 ? (
          /* Single Widget Normal Header */
          <div className="flex items-center gap-2 px-1">
            <h3 className="text-[15px] font-bold text-[var(--bone-100)]">
              {widgetRegistry[widgets[0]]?.label || 'Widget'}
            </h3>
            <span className="text-[9px] text-[var(--bone-70)] font-bold bg-[var(--bone-10)] px-1.5 py-0.5 rounded border border-[var(--bone-15)] uppercase tracking-widest">Stack</span>
          </div>
        ) : (
          /* Empty State Header Placeholder */
          <div className="text-[11px] font-bold text-[var(--bone-20)] uppercase tracking-widest px-1">Empty Stack</div>
        )}
      </div>

      <div className="flex-1 overflow-hidden nested-in-stack">
        {activeWidgetId ? (
          <div className="h-full w-full">
            {(() => {
              const entry = widgetRegistry[activeWidgetId];
              if (!entry) return null;
              const WidgetComponent = entry.component;
              return <WidgetComponent data={stableEmptyData} />;
            })()}
          </div>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-[var(--bone-20)] transition-colors">
            <div className={cn(
              "w-12 h-12 rounded-full border-2 border-dashed border-[var(--bone-3)] flex items-center justify-center",
              isDragOver ? "scale-110 border-accent text-accent bg-accent/5" : "scale-100"
            )}>
              <Plus className={cn("w-6 h-6", isDragOver && "rotate-90")} />
            </div>
            <p className="text-[11px] font-medium tracking-wide uppercase">Drop widgets here to stack</p>
            <p className="text-[10px] text-[var(--bone-70)] opacity-40 max-w-[140px] text-center leading-relaxed">Combine up to 3 widgets into a single view</p>
          </div>
        )}
      </div>
    </section>
  );
}
