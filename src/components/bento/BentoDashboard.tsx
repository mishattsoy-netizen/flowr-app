'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Settings2, Check } from 'lucide-react';
import clsx from 'clsx';
import gsap from 'gsap';
import { useBentoLayout } from '@/hooks/useBentoLayout';
import { BentoWidget } from './BentoWidget';
import { WidgetPicker } from './WidgetPicker';
import type { BentoLayoutItem } from '@/components/bento/types';
import { computeGridPositions, resizeDivider } from '@/lib/bento-engine';

const MAX_ROWS = 4;
const GAP = 12; // Matches gap-3 (0.75rem)
// Row heights are now percentage-based (1 / MAX_ROWS)


interface BentoDashboardProps {
  contextId: string;
  title?: React.ReactNode;
  actions?: React.ReactNode;
}

// ─── Position Calculation moved to bento-engine.ts ───


// ─── Component ──────────────────────────────────────────────────────────────

export function BentoDashboard({ contextId, title, actions }: BentoDashboardProps) {
  const {
    layout,
    realLayout,
    editMode,
    isLoading,
    draggedId,
    swapTargetId,
    stackTargetId,
    toggleEditMode,
    addWidget,
    removeWidget,
    updateWidgetData,
    resetLayout,
    canUndo,
    canRedo,
    undo,
    redo,
    handleDragStart,
    handleDragOverWidget,
    handleDragOverEmpty,
    handleDragEnd,
    handleDividerDragPreview,
    handleDividerDragEnd,
    handleVerticalDividerDragPreview,
    handleVerticalDividerDragEnd,
    isResizing,
    toastMessage
  } = useBentoLayout(contextId);

  const [reallyLoading, setReallyLoading] = useState(true);
  const [hoveredWidgetId, setHoveredWidgetId] = useState<string | null>(null);
  const hoverClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setHovered = useCallback((id: string | null) => {
    if (hoverClearTimer.current) { clearTimeout(hoverClearTimer.current); hoverClearTimer.current = null; }
    if (id !== null) {
      setHoveredWidgetId(id);
    } else {
      // Small delay before clearing so pointer moving widget→divider doesn't flicker
      hoverClearTimer.current = setTimeout(() => setHoveredWidgetId(null), 80);
    }
  }, []);
  const gridRef = useRef<HTMLDivElement>(null);
  const realLayoutRef = useRef(realLayout);
  realLayoutRef.current = realLayout;
  // Tracks the full display layout (preview ?? real) for divider drag calculations
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  // Stable refs for drag-end callbacks so effects don't re-attach listeners on every preview update
  const dividerDragEndRef = useRef(handleDividerDragEnd);
  dividerDragEndRef.current = handleDividerDragEnd;
  const verticalDividerDragEndRef = useRef(handleVerticalDividerDragEnd);
  verticalDividerDragEndRef.current = handleVerticalDividerDragEnd;

  // Drag State
  const [dragState, setDragState] = useState<{ 
    id: string; 
    startX: number; 
    startY: number; 
    currX: number; 
    currY: number;
    relX: number;
    relY: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);

  // Divider Drag State
  const [dividerDrag, setDividerDrag] = useState<{
    row: number;
    leftId: string;
    rightId: string;
    startX: number;
  } | null>(null);

  const [verticalDividerDrag, setVerticalDividerDrag] = useState<{
    topId: string;
    bottomId: string;
    startY: number;
  } | null>(null);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setReallyLoading(false), 200);
      return () => clearTimeout(timer);
    } else {
      setReallyLoading(true);
    }
  }, [isLoading]);

  const { positions, grid } = useMemo(() => computeGridPositions(layout), [layout]);
  // Hit-test against real layout so the grid doesn't shift under the pointer mid-drag
  const { grid: hitGrid } = useMemo(() => computeGridPositions(realLayout), [realLayout]);
  
  // ─── Keyboard Shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editMode) return;
      
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Ctrl+Z for Undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (canUndo) {
          e.preventDefault();
          undo();
        }
      }
      
      // Ctrl+Y or Ctrl+Shift+Z for Redo
      if ((e.ctrlKey || e.metaKey) && 
          ((e.key.toLowerCase() === 'y') || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        if (canRedo) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editMode, canUndo, canRedo, undo, redo]);


  // ─── Dragging Logic (Widgets) ─────────────────────────────────────────────


  useEffect(() => {
    if (!dragState) return;

    const onPointerMove = (e: PointerEvent) => {
      if (gridRef.current) {
        const rect = gridRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setDragState(prev => prev ? { ...prev, currX: e.clientX, currY: e.clientY, relX: x, relY: y } : null);
        
        const rowHeight = rect.height / MAX_ROWS;
        const row = Math.min(MAX_ROWS - 1, Math.max(0, Math.floor(y / rowHeight)));

        const colWidth = (rect.width - GAP * 5) / 6;
        const col = Math.floor(x / (colWidth + GAP));

        if (row >= 0 && row < MAX_ROWS && col >= 0 && col < 6) {
          const targetId = hitGrid[row][col];
          if (targetId && targetId !== dragState.id) {
            handleDragOverWidget(targetId, row, col);
          } else {
            // Find order based on col using real layout
            const rowItems = realLayout.filter(it => it.row === row).sort((a,b) => a.order - b.order);
            let order = rowItems.length;
            let currentX = 0;
            for (let i = 0; i < rowItems.length; i++) {
              currentX += rowItems[i].w;
              if (col < currentX) {
                order = i;
                break;
              }
            }
            handleDragOverEmpty(row, order, col);
          }
        }
      }
    };

    const onPointerUp = () => {
      setDragState(null);
      handleDragEnd();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragState, hitGrid, realLayout, handleDragOverWidget, handleDragOverEmpty, handleDragEnd]);

  const onWidgetPointerDown = (e: React.PointerEvent, id: string) => {
    if (!editMode) return;
    // Don't drag if interacting with buttons inside widget
    if ((e.target as HTMLElement).closest('button, a, input, textarea, [data-nodrag]')) return;
    
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    
    setDragState({
      id,
      startX: e.clientX,
      startY: e.clientY,
      currX: e.clientX,
      currY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      relX: e.clientX - (gridRef.current?.getBoundingClientRect().left ?? 0),
      relY: e.clientY - (gridRef.current?.getBoundingClientRect().top ?? 0),
      width: rect.width,
      height: rect.height
    });
    setHovered(null);
    handleDragStart(id);
  };

  // ─── Divider Drag Logic ───────────────────────────────────────────────────

  useEffect(() => {
    if (!dividerDrag) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;

      const colX = (x / rect.width) * 6;
      const newBoundary = Math.max(0, Math.min(6, Math.round(colX)));

      handleDividerDragPreview(dividerDrag.leftId, dividerDrag.rightId, newBoundary);
    };

    const onPointerUp = () => {
      dividerDragEndRef.current();
      setDividerDrag(null);
      setHovered(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dividerDrag, handleDividerDragPreview]);

  useEffect(() => {
    if (!verticalDividerDrag) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;

      const displayLayout = layoutRef.current;
      const topWidget    = displayLayout.find(it => it.i === verticalDividerDrag.topId);
      const bottomWidget = displayLayout.find(it => it.i === verticalDividerDrag.bottomId);
      if (!topWidget || !bottomWidget) return;

      const { positions: displayPos } = computeGridPositions(displayLayout);
      const posT = displayPos.get(topWidget.i);
      if (!posT) return;

      const rowY = (y / rect.height) * MAX_ROWS;
      const newBoundary = Math.max(0, Math.min(MAX_ROWS, Math.round(rowY)));
      const oldBoundary = posT.y + posT.h;

      if (newBoundary === oldBoundary) return;

      handleVerticalDividerDragPreview(topWidget.i, bottomWidget.i, newBoundary);
    };

    const onPointerUp = () => {
      verticalDividerDragEndRef.current();
      setVerticalDividerDrag(null);
      setHovered(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [verticalDividerDrag, handleVerticalDividerDragPreview]);

  // ─── Find Dividers ────────────────────────────────────────────────────────

  const dividers = useMemo(() => {
    if (!editMode || dragState) return [];
    const divs: any[] = [];
    
    layout.forEach(leftItem => {
      const posL = positions.get(leftItem.i);
      if (!posL) return;

      const rightNeighbors = layout.filter(it => {
        const posR = positions.get(it.i);
        if (!posR) return false;
        const isAdjacent = posR.x === (posL.x + posL.w);
        const overlapTop = Math.max(posL.y, posR.y);
        const overlapBottom = Math.min(posL.y + posL.h, posR.y + posR.h);
        const hasOverlap = overlapTop < overlapBottom;
        return isAdjacent && hasOverlap;
      });

      // Emit one divider per neighbor if at least one resize direction is valid.
      // Use the engine as the source of truth by probing both drag directions.
      rightNeighbors.forEach(rightItem => {
        const posR = positions.get(rightItem.i);
        if (!posR) return;

        const boundary = posL.x + posL.w;
        // Probe ±1 step and extreme boundaries (Case B requires full-column claim).
        const canRight = !!resizeDivider(layout, leftItem.i,  rightItem.i, boundary + 1, 'horizontal')
                      || !!resizeDivider(layout, leftItem.i,  rightItem.i, posR.x + posR.w, 'horizontal');
        const canLeft  = !!resizeDivider(layout, rightItem.i, leftItem.i,  boundary - 1, 'horizontal')
                      || !!resizeDivider(layout, rightItem.i, leftItem.i,  posL.x, 'horizontal');
        if (!canRight && !canLeft) return;

        const overlapTop = Math.max(posL.y, posR.y);
        const overlapBottom = Math.min(posL.y + posL.h, posR.y + posR.h);

        divs.push({
          row: overlapTop,
          leftId: leftItem.i,
          rightId: rightItem.i,
          xFraction: (posL.x + posL.w) / 6,
          yPct: (overlapTop / MAX_ROWS) * 100,
          hPct: ((overlapBottom - overlapTop) / MAX_ROWS) * 100,
          yOffset: (overlapTop / MAX_ROWS) * 100
        });
      });
    });
    return divs;
  }, [layout, positions, editMode, dragState]);
  
  const verticalDividers = useMemo(() => {
    if (!editMode || dragState) return [];
    const divs: { topId: string; bottomId: string; yPct: number; xPct: number; wPct: number; xOffset: number }[] = [];
    
    layout.forEach(topItem => {
      const posT = positions.get(topItem.i);
      if (!posT) return;

      const bottomNeighbors = layout.filter(it => {
        const posB = positions.get(it.i);
        if (!posB) return false;
        const isAdjacent = posB.y === (posT.y + posT.h);
        const overlapLeft = Math.max(posT.x, posB.x);
        const overlapRight = Math.min(posT.x + posT.w, posB.x + posB.w);
        const hasOverlap = overlapLeft < overlapRight;
        return isAdjacent && hasOverlap;
      });

      // Emit one divider per neighbor — a wide widget can have multiple
      // bottom neighbors (each occupying part of its column range).
      bottomNeighbors.forEach(bottomItem => {
        const posB = positions.get(bottomItem.i);
        if (!posB) return;

        const boundary = posT.y + posT.h;
        // Probe ±1 step and extreme boundaries (Case B requires full-row claim).
        const canUp   = !!resizeDivider(layout, bottomItem.i, topItem.i,    boundary - 1, 'vertical')
                     || !!resizeDivider(layout, bottomItem.i, topItem.i,    posT.y, 'vertical');
        const canDown = !!resizeDivider(layout, topItem.i,    bottomItem.i, boundary + 1, 'vertical')
                     || !!resizeDivider(layout, topItem.i,    bottomItem.i, posB.y + posB.h, 'vertical');
        if (!canUp && !canDown) return;

        const overlapLeft = Math.max(posT.x, posB.x);
        const overlapRight = Math.min(posT.x + posT.w, posB.x + posB.w);

        divs.push({
          topId: topItem.i,
          bottomId: bottomItem.i,
          yPct: ((posT.y + posT.h) / MAX_ROWS) * 100,
          xPct: (overlapLeft / 6) * 100,
          wPct: ((overlapRight - overlapLeft) / 6) * 100,
          xOffset: overlapLeft
        });
      });
    });
    return divs;
  }, [layout, positions, editMode, dragState]);
  
  // ─── Render Helpers ───────────────────────────────────────────────────────

  function getStyle(pos: {x: number, y: number, w: number, h: number}) {
    const x = (pos.x / 6) * 100;
    const w = (pos.w / 6) * 100;
    const y = (pos.y / MAX_ROWS) * 100;
    const h = (pos.h / MAX_ROWS) * 100;

    return {
      left: `calc(${x}% + ${GAP/2}px)`,
      width: `calc(${w}% - ${GAP}px)`,
      top: `calc(${y}% + ${GAP/2}px)`,
      height: `calc(${h}% - ${GAP}px)`,
    };
  }

  return (
    <div className="flex-1 flex flex-row overflow-hidden h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-8 py-5 max-w-6xl mx-auto w-full h-full flex flex-col min-h-0">
          <header className="flex items-end justify-between mb-3">
            <div className="flex-1">{title}</div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 mr-1">
                {editMode && (
                  <>
                    <button onClick={undo} disabled={!canUndo} className="btn-bento disabled:opacity-50">
                      ↶ Undo
                    </button>
                    <button onClick={redo} disabled={!canRedo} className="btn-bento disabled:opacity-50">
                      ↷ Redo
                    </button>
                    <button onClick={resetLayout} className="btn-bento-danger">
                      Reset
                    </button>
                  </>
                )}
                <button
                  onClick={toggleEditMode}
                  className={editMode ? 'btn-bento-active' : 'btn-bento'}
                >
                  {editMode ? <><Check /> Done</> : <><Settings2 /> Edit Layout</>}
                </button>
              </div>

              {actions}
            </div>
          </header>

          {editMode && (
            <div className="mb-4 px-3 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground text-center">
              Drag widgets to rearrange · Divider gaps to resize · Ctrl+Z to undo
            </div>
          )}

          <div
            ref={gridRef}
            className={clsx('relative w-full', reallyLoading && 'bento-no-transitions')}
            style={{ flex: 1, minHeight: 0 }}
          >
            {layout.map((item, idx) => {
              const pos = positions.get(item.i);
              if (!pos || pos.w <= 0) return null; // Defensive: don't render items that don't fit

              const isDragged = item.i === dragState?.id;
              const isSwapTarget = item.i === swapTargetId;
              const isStackTarget = item.i === stackTargetId;

              const style = getStyle(pos);

              return (
                <div key={item.i}>
                  {/* The actual widget */}
                  <div
                    className={clsx(
                      'absolute bento-widget-cell',
                      isDragged && 'opacity-0 pointer-events-none', // hide original while dragging
                      editMode && 'cursor-grab active:cursor-grabbing hover:z-10 overflow-visible',
                      isSwapTarget && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-[var(--radius-big)]',
                      isStackTarget && 'ring-2 ring-accent ring-offset-2 ring-offset-background rounded-[var(--radius-big)] bg-accent/5 z-20 scale-105 transition-all duration-300'
                    )}
                     style={{ ...style, transition: (isDragged || !!verticalDividerDrag || !!dividerDrag) ? 'none' : 'all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
                    onPointerEnter={() => editMode && !dragState && setHovered(item.i)}
                    onPointerLeave={() => setHovered(null)}
                    onPointerDown={(e) => onWidgetPointerDown(e, item.i)}

              >
              <BentoWidget
              item={item}
              contextId={contextId}
              editMode={editMode}
              isLoading={isLoading}
              onUpdateData={(newData) => updateWidgetData(item.i, newData)}
              onRemove={() => removeWidget(item.i)}
              isSwapTarget={isSwapTarget}
              isStackTarget={isStackTarget}
              staggerIndex={idx}
              /></div>

                    {/* Placeholder shows where it will drop */}
                    {isDragged && dragState && (
                      <div
                        className="absolute rounded-[var(--radius-big)] bg-muted/50 border-2 border-dashed border-primary/30 z-0"
                        style={{ 
                          left: `calc(${(pos.x / 6) * 100}% + ${GAP/2}px)`,
                          top: `calc(${(pos.y / MAX_ROWS) * 100}% + ${GAP/2}px)`,
                          width: `calc(${(pos.w / 6) * 100}% - ${GAP}px)`,
                          height: `calc(${(pos.h / MAX_ROWS) * 100}% - ${GAP}px)`,
                          transition: 'all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)' 
                        }}
                      />
                    )}
                  </div>
                );
              })}

            {/* Ghost follows the pointer - Rendered outside the map to avoid cell layout interference */}
            {/* Ghost follows the pointer */}
            {dragState && (
              <div
                className="absolute z-50 pointer-events-none shadow-2xl opacity-90 bento-drag-ghost"
                style={{
                  left: dragState.relX - dragState.offsetX,
                  top: dragState.relY - dragState.offsetY,
                  width: dragState.width,
                  height: dragState.height,
                  transform: 'scale(1.02)'
                }}
              >
                {(() => {
                  const item = layout.find(it => it.i === dragState.id);
                  if (!item) return null;
                  return (
                    <BentoWidget
                      item={item}
                      contextId={contextId}
                      editMode={false} // render static clone
                      isLoading={false}
                      onUpdateData={() => {}}
                      onRemove={() => {}}
                      isSwapTarget={false}
                    />
                  );
                })()}
              </div>
            )}

            {/* Dividers */}
            {dividers.map(div => {
              const isDragging = dividerDrag?.leftId === div.leftId && dividerDrag?.rightId === div.rightId;
              const isVisible = isDragging || div.leftId === hoveredWidgetId || div.rightId === hoveredWidgetId;

              return (
               <div
                 key={`div-${div.row}-${div.leftId}-${div.rightId}`}
                 className="absolute z-30 cursor-col-resize group"
                 style={{
                   left: `calc(${div.xFraction * 100}% - 12px)`,
                   top: `calc(${div.yOffset}% + ${GAP/2}px)`,
                   height: `calc(${div.hPct}% - ${GAP}px)`,
                   width: 24,
                   opacity: isVisible ? 1 : 0,
                   pointerEvents: isVisible ? 'auto' : 'none',
                   transition: 'opacity 150ms ease',
                 }}
                 onPointerEnter={() => setHovered(div.leftId)}
                 onPointerLeave={() => setHovered(null)}
                 onPointerDown={(e) => {
                   e.preventDefault();
                   setDividerDrag({ row: div.row, leftId: div.leftId, rightId: div.rightId, startX: e.clientX });
                 }}
               >
                 <div className={clsx(
                   "absolute inset-y-2 -left-4 -right-4 rounded-sm",
                   "transition-colors duration-150",
                   isDragging ? "bg-accent/10" : "group-hover:bg-[var(--bone-5)]"
                 )} />
                 {/* Visible line */}
                 <div className={clsx(
                   "absolute inset-y-0 left-1/2 -translate-x-1/2 w-px",
                   isDragging
                     ? "bg-accent"
                     : "bg-border/60 group-hover:bg-accent/70"
                 )} />
                 {/* Gripper pill */}
                 <div className={clsx(
                   "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                   "flex flex-col gap-[3px] items-center justify-center",
                   "w-4 h-8 rounded-full",
                   isDragging
                     ? "bg-accent"
                     : "bg-border group-hover:bg-accent/80",
                   "transition-colors duration-150"
                 )}>
                   <div className="w-0.5 h-0.5 rounded-full bg-background/70" />
                   <div className="w-0.5 h-0.5 rounded-full bg-background/70" />
                   <div className="w-0.5 h-0.5 rounded-full bg-background/70" />
                 </div>
               </div>
              );
             })}
            
            {verticalDividers.map((div) => {
              const isDragging = verticalDividerDrag?.topId === div.topId && verticalDividerDrag?.bottomId === div.bottomId;
              const isVisible = isDragging || div.topId === hoveredWidgetId || div.bottomId === hoveredWidgetId;

              return (
              <div
                key={`vdiv-${div.topId}-${div.bottomId}`}
                className="absolute z-30 cursor-row-resize group"
                style={{
                  top: `calc(${div.yPct}% - 12px)`,
                  left: `calc(${div.xPct}% + ${GAP/2}px)`,
                  width: `calc(${div.wPct}% - ${GAP}px)`,
                  height: 24,
                  opacity: isVisible ? 1 : 0,
                  pointerEvents: isVisible ? 'auto' : 'none',
                  transition: 'opacity 150ms ease',
                }}
                onPointerEnter={() => setHovered(div.topId)}
                onPointerLeave={() => setHovered(null)}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setVerticalDividerDrag({ topId: div.topId, bottomId: div.bottomId, startY: e.clientY });
                }}
              >
                <div className={clsx(
                  "absolute inset-x-2 -top-4 -bottom-4 rounded-sm",
                  "transition-colors duration-150",
                  isDragging ? "bg-accent/10" : "group-hover:bg-[var(--bone-5)]"
                )} />
                {/* Visible line */}
                <div className={clsx(
                  "absolute inset-x-0 top-1/2 -translate-y-1/2 h-px",
                  isDragging
                    ? "bg-accent"
                    : "bg-border/60 group-hover:bg-accent/70"
                )} />
                {/* Gripper pill */}
                <div className={clsx(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                  "flex flex-row gap-[3px] items-center justify-center",
                  "h-4 w-8 rounded-full",
                  isDragging
                    ? "bg-accent"
                    : "bg-border group-hover:bg-accent/80",
                  "transition-colors duration-150"
                )}>
                  <div className="h-0.5 w-0.5 rounded-full bg-background/70" />
                  <div className="h-0.5 w-0.5 rounded-full bg-background/70" />
                  <div className="h-0.5 w-0.5 rounded-full bg-background/70" />
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>

<WidgetPicker
  open={editMode}
  onAdd={addWidget}
  onDragStart={() => {}}
  onDragEnd={() => {}}
  contextId={contextId}
  layout={layout}
/>
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
          <div className="px-4 py-2 rounded-lg bg-foreground/90 text-background text-sm shadow-lg backdrop-blur-sm">
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}
