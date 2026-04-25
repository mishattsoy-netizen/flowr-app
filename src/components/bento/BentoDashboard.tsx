'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Settings2, Check } from 'lucide-react';
import clsx from 'clsx';
import gsap from 'gsap';
import { useBentoLayout } from '@/hooks/useBentoLayout';
import { widgetRegistry } from './registry';
import { BentoWidget } from './BentoWidget';
import { WidgetPicker } from './WidgetPicker';
import type { BentoLayoutItem } from '@/components/bento/types';
import { snapDivider, snapVerticalDivider, computeGridPositions } from '@/lib/bento-engine';

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
    isResizing
  } = useBentoLayout(contextId);

  const [reallyLoading, setReallyLoading] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

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
    handleDragStart(id);
  };

  // ─── Divider Drag Logic ───────────────────────────────────────────────────

  useEffect(() => {
    if (!dividerDrag) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      
      // Calculate fraction of container width
      const totalWidth = rect.width;
      const normalizedX = Math.max(0, Math.min(x, totalWidth));
      const colX = (normalizedX / totalWidth) * 6;
      
      const leftItem = layout.find(it => it.i === dividerDrag.leftId);
      const rightItem = layout.find(it => it.i === dividerDrag.rightId);
      if (!leftItem || !rightItem) return;

      const posL = positions.get(leftItem.i);
      if (!posL) return;

      const totalW = leftItem.w + rightItem.w;
      const startX = posL.x; 
      
      // Relative fraction within the combined span of the two widgets
      const relFraction = (colX - startX) / totalW;
      
      const minL = widgetRegistry[leftItem.type]?.minW ?? 2;
      const minR = widgetRegistry[rightItem.type]?.minW ?? 2;

      const [w0, w1] = snapDivider(relFraction, minL, minR, totalW);
      handleDividerDragPreview(leftItem.i, rightItem.i, w0, w1);
    };

    const onPointerUp = () => {
      handleDividerDragEnd();
      setDividerDrag(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dividerDrag, layout, handleDividerDragPreview, handleDividerDragEnd]);

  useEffect(() => {
    if (!verticalDividerDrag) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      
      const topWidget = layout.find(it => it.i === verticalDividerDrag.topId);
      const bottomWidget = layout.find(it => it.i === verticalDividerDrag.bottomId);
      if (!topWidget || !bottomWidget) return;

      const totalH = topWidget.h + bottomWidget.h;
      
      // Calculate where the mouse is in "row coordinates"
      // We use a fixed percentage based on MAX_ROWS to find which row boundary is closest to 'y'
      let closestRow = topWidget.row;
      let minDist = Infinity;
      for (let r = topWidget.row; r <= topWidget.row + totalH; r++) {
        const offset = (r / MAX_ROWS) * rect.height;
        const dist = Math.abs(y - offset);
        if (dist < minDist) {
          minDist = dist;
          closestRow = r;
        }
      }

      // newH0 is the distance from topWidget.row to closestRow
      const newH0 = Math.max(1, Math.min(totalH - 1, closestRow - topWidget.row));
      const newH1 = totalH - newH0;

      handleVerticalDividerDragPreview(topWidget.i, bottomWidget.i, newH0, newH1);
    };

    const onPointerUp = () => {
      handleVerticalDividerDragEnd();
      setVerticalDividerDrag(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [verticalDividerDrag, layout, handleVerticalDividerDragPreview, handleVerticalDividerDragEnd]);

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

      if (rightNeighbors.length > 0) {
        const rightItem = rightNeighbors.find(it => positions.get(it.i)?.y === posL.y) || rightNeighbors[0];
        const posR = positions.get(rightItem.i);
        if (!posR) return;

        const minL = widgetRegistry[leftItem.type]?.minW ?? 2;
        const maxL = widgetRegistry[leftItem.type]?.maxW ?? 6;
        const minR = widgetRegistry[rightItem.type]?.minW ?? 2;
        const maxR = widgetRegistry[rightItem.type]?.maxW ?? 6;

        // A resize handle is only useful if we can move it in at least one direction
        const canMoveRight = leftItem.w < maxL && rightItem.w > minR;
        const canMoveLeft = leftItem.w > minL && rightItem.w < maxR;

        if (canMoveRight || canMoveLeft) {
          divs.push({
            row: posL.y,
            leftId: leftItem.i,
            rightId: rightItem.i, 
            xFraction: (posL.x + posL.w) / 6,
            yPct: (posL.y / MAX_ROWS) * 100,
            hPct: ((Math.min(posL.y + posL.h, posR.y + posR.h) - Math.max(posL.y, posR.y)) / MAX_ROWS) * 100,
            yOffset: (Math.max(posL.y, posR.y) / MAX_ROWS) * 100
          });
        }
      }
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

      if (bottomNeighbors.length > 0) {
        const bottomItem = bottomNeighbors.find(it => positions.get(it.i)?.x === posT.x) || bottomNeighbors[0];
        const posB = positions.get(bottomItem.i);
        if (!posB) return;

        const minT = widgetRegistry[topItem.type]?.minH ?? 1;
        const maxT = widgetRegistry[topItem.type]?.maxH ?? 4;
        const minB = widgetRegistry[bottomItem.type]?.minH ?? 1;
        const maxB = widgetRegistry[bottomItem.type]?.maxH ?? 4;

        const combinedH = topItem.h + bottomItem.h;
        
        // STRICTURE: Hide handle if the combined height occupies the full grid height.
        // In a fixed 4-row grid, changing height in a full column almost always 
        // triggers a cascade of pushes that breaks the layout.
        if (topItem.row + combinedH >= MAX_ROWS) {
          return;
        }

        const canMoveDown = topItem.h < maxT && bottomItem.h > minB;
        const canMoveUp = topItem.h > minT && bottomItem.h < maxB;

        if (canMoveDown || canMoveUp) {
          divs.push({
            topId: topItem.i,
            bottomId: bottomItem.i,
            yPct: ((posT.y + posT.h) / MAX_ROWS) * 100,
            xPct: (Math.max(posT.x, posB.x) / 6) * 100,
            wPct: ((Math.min(posT.x + posT.w, posB.x + posB.w) - Math.max(posT.x, posB.x)) / 6) * 100,
            xOffset: Math.max(posT.x, posB.x)
          });
        }
      }
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
            {layout.map(item => {
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
                     style={{ ...style, transition: isDragged ? 'none' : 'all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
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
            {dividers.map(div => (
               <div
                 key={`div-${div.row}-${div.leftId}`}
                 className="absolute z-30 cursor-col-resize group"
                 style={{ 
                   left: `calc(${div.xFraction * 100}% - 10px)`, 
                   top: `calc(${div.yOffset}% + ${GAP/2}px)`,
                   height: `calc(${div.hPct}% - ${GAP}px)`,
                   width: 20,
                 }}
                 onPointerDown={(e) => {
                   e.preventDefault();
                   setDividerDrag({ row: div.row, leftId: div.leftId, rightId: div.rightId, startX: e.clientX });
                 }}
               >
                 {/* Visual Line */}
                 <div className={clsx(
                   "absolute inset-y-0 left-1/2 -translate-x-1/2",
                   !dividerDrag && "transition-all duration-800",
                   dividerDrag?.leftId === div.leftId 
                     ? "bg-accent w-[2px] shadow-[0_0_15px_rgba(233,233,226,0.3)]" 
                     : "bg-[var(--bone-20)] w-[1px] group-hover:bg-accent/50 group-hover:w-[2px]"
                 )} />
                 <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-4" />
               </div>
             ))}
            
            {verticalDividers.map((div, idx) => (
              <div
                key={`vdiv-${div.topId}-${div.xPct}`}
                className="absolute z-30 cursor-row-resize group"
                style={{
                  top: `calc(${div.yPct}% - 10px)`,
                  left: `calc(${div.xPct}% + ${GAP/2}px)`,
                  width: `calc(${div.wPct}% - ${GAP}px)`,
                  height: 20,
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setVerticalDividerDrag({ topId: div.topId, bottomId: div.bottomId, startY: e.clientY });
                }}
              >
                {/* Visual Line */}
                <div className={clsx(
                  "absolute inset-x-0 top-1/2 -translate-y-1/2",
                  !verticalDividerDrag && "transition-all duration-800",
                  verticalDividerDrag?.topId === div.topId
                    ? "bg-accent h-[2px] shadow-[0_0_15px_rgba(233,233,226,0.3)]"
                    : "bg-[var(--bone-20)] h-[1px] group-hover:bg-accent/50 group-hover:h-[2px]"
                )} />
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4" />
              </div>
            ))}
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
    </div>
  );
}
