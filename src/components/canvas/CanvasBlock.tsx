"use client";

import { EditorBlock, useStore } from '@/data/store';
import clsx from 'clsx';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { CanvasTool } from './CanvasToolbar';
import { ResizeHandle, HandlePosition } from './ResizeHandle';
import { BlockRenderer } from '../editor/BlockRenderer';

interface CanvasBlockProps {
  block: EditorBlock;
  activeTool?: CanvasTool;
  viewport: { x: number; y: number; scale: number };
  onConnectStart?: (side: string, x: number, y: number) => void;
  isSelected?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (id: string, addToSelection: boolean) => void;
  onCommit?: () => void;
  snapWithObjects?: (x: number, y: number, w: number, h: number, excludeId: string) => { x: number; y: number };
}

export function CanvasBlock({ block, activeTool, viewport, onConnectStart, isSelected, selectedIds, onSelect, onCommit, snapWithObjects }: CanvasBlockProps) {
  const blocks = useStore(s => s.blocks);
  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);
  const updateCanvasBlocks = useStore(s => s.updateCanvasBlocks);
  const deleteCanvasBlock = useStore(s => s.deleteCanvasBlock);
  const moveCanvasSection = useStore(s => s.moveCanvasSection);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState({ x: block.x || 0, y: block.y || 0 });
  const [size, setSize] = useState({ width: block.width || 280, height: block.height || undefined as number | undefined });
  const [showMenu, setShowMenu] = useState(false);
  const [isOverSection, setIsOverSection] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const isNoteBlock = block.type !== 'section' && block.type !== 'comment' && block.type !== 'connection' && block.type !== 'shape';

  const containerRef = useRef<HTMLDivElement>(null);
  const finalPosRef = useRef({ x: block.x || 0, y: block.y || 0 });
  const finalSizeRef = useRef({ w: block.width || 280, h: block.height || 150 });

  useEffect(() => {
    if (!isSelected) setIsEditing(false);
  }, [isSelected]);

  // Sync from store when not interacting
  useEffect(() => {
    if (!isDragging && !isResizing) {
      setPosition({ x: block.x || 0, y: block.y || 0 });
      setSize({ width: block.width || 280, height: block.height || undefined });
    }
  }, [block.x, block.y, block.width, block.height, isDragging, isResizing]);

  // Report actual height for connections
  const heightRef = useRef(block.height || 0);
  useEffect(() => {
    heightRef.current = block.height || 0;
  }, [block.height]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const height = entry.contentRect.height;
        // Only update store if it significantly differs and we are not dragging
        if (!isDragging && !isResizing && isNoteBlock && Math.abs(heightRef.current - height) > 1) {
          updateCanvasBlock(block.id, { height });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [block.id, isDragging, isResizing, updateCanvasBlock, isNoteBlock]);

  // --- DRAG ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isEditing) return;
    if (isResizing) return;

    const isGrip = (e.target as HTMLElement).closest('.block-grip');
    const isEdge = (e.target as HTMLElement).classList.contains('canvas-block-edge');
    const isInput = (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;
    
    const isAlreadySelected = selectedIds?.has(block.id) ?? false;
    if (!isInput && !isAlreadySelected) {
      onSelect?.(block.id, e.shiftKey);
    }

    const canMove = activeTool === 'move' || activeTool === 'select' || isGrip || isEdge;
    if (!canMove) return;
    if (e.button !== 0) return;

    e.stopPropagation();
    setIsDragging(true);
    setShowMenu(false);

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    
    const groupIds = isAlreadySelected && selectedIds ? Array.from(selectedIds) : [block.id];
    
    // Capture rigid snapshot of entire selection
    const groupSnapshot = new Map<string, { x: number; y: number; points?: [number, number][] }>();
    blocks.forEach(b => {
      if (groupIds.includes(b.id)) {
        groupSnapshot.set(b.id, {
          x: b.x ?? 0,
          y: b.y ?? 0,
          points: b.points ? JSON.parse(JSON.stringify(b.points)) : undefined
        });
      }
    });

    const primaryStart = groupSnapshot.get(block.id) || { x: block.x ?? 0, y: block.y ?? 0 };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = (moveEvent.clientX - startClientX) / viewport.scale;
      const deltaY = (moveEvent.clientY - startClientY) / viewport.scale;

      const unSnappedX = primaryStart.x + deltaX;
      const unSnappedY = primaryStart.y + deltaY;
      
      const snappedPos = snapWithObjects
        ? snapWithObjects(unSnappedX, unSnappedY, block.width ?? 100, block.height ?? 40, block.id)
        : { x: unSnappedX, y: unSnappedY };

      const finalDX = snappedPos.x - primaryStart.x;
      const finalDY = snappedPos.y - primaryStart.y;

      // Push local render state instantly for primary block for immediate feedback
      setPosition({ x: snappedPos.x, y: snappedPos.y });

      const batchUpdates: { id: string; updates: Partial<EditorBlock> }[] = [];
      groupSnapshot.forEach((snap, id) => {
        if (snap.points) {
          batchUpdates.push({
            id, 
            updates: { points: snap.points.map(p => [p[0] + finalDX, p[1] + finalDY] as [number, number]) }
          });
        } else {
          batchUpdates.push({
            id,
            updates: { x: snap.x + finalDX, y: snap.y + finalDY }
          });
        }
      });
      
      updateCanvasBlocks(batchUpdates);

      const over = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const sectionEl = over?.closest('[data-block-type="section"]');
      if (sectionEl && sectionEl.id !== block.id && !groupIds.includes(sectionEl.id)) {
        setIsOverSection(sectionEl.id);
      } else {
        setIsOverSection(null);
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      setIsDragging(false);
      const movedDist = Math.hypot(upEvent.clientX - startClientX, upEvent.clientY - startClientY);

      // If was selected and clicked without distinct drag movement, revert to only selecting this
      if (movedDist < 4 && isAlreadySelected && !upEvent.shiftKey) {
        onSelect?.(block.id, false);
      }

      // Commit final positions and section grouping containment
      if (block.type === 'section' && movedDist >= 4) {
         // Calculate actual cumulative offset done by primary for accurate group move triggers
         const finalX = (upEvent.clientX - startClientX) / viewport.scale + primaryStart.x;
         const finalY = (upEvent.clientY - startClientY) / viewport.scale + primaryStart.y;
         const commitDX = finalX - (block.x || 0);
         const commitDY = finalY - (block.y || 0);
         // Standard section behavior carries all its children
         moveCanvasSection(block.id, commitDX, commitDY);
      }

      if (isOverSection) {
        updateCanvasBlocks(groupIds.filter(id => id !== isOverSection).map(id => ({
          id, updates: { parentId: isOverSection }
        })));
      }

      onCommit?.();
      setIsOverSection(null);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  // --- RESIZE ---
  const handleResizeStart = useCallback((handle: HandlePosition, e: React.PointerEvent) => {
    setIsResizing(true);
    onSelect?.(block.id, false);

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { x: block.x || 0, y: block.y || 0 };
    const startSize = { w: block.width || 280, h: block.height || 150 };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / viewport.scale;
      const dy = (moveEvent.clientY - startY) / viewport.scale;

      let newX = startPos.x;
      let newY = startPos.y;
      let newW = startSize.w;
      let newH = startSize.h;

      // Horizontal
      if (handle.includes('w')) { newX = startPos.x + dx; newW = startSize.w - dx; }
      if (handle.includes('e') || handle === 'e') { newW = startSize.w + dx; }

      // Vertical
      if (handle.includes('n') && handle !== 'ne' && handle !== 'nw') { newY = startPos.y + dy; newH = startSize.h - dy; }
      if (handle === 'nw' || handle === 'ne' || handle === 'n') { newY = startPos.y + dy; newH = startSize.h - dy; }
      if (handle.includes('s') || handle === 's') { newH = startSize.h + dy; }

      // Clamp minimums
      if (newW < 60) { newW = 60; newX = startPos.x + startSize.w - 60; }
      if (newH < 40) { newH = 40; newY = startPos.y + startSize.h - 40; }

      finalPosRef.current = { x: newX, y: newY };
      finalSizeRef.current = { w: newW, h: newH };
      setPosition({ x: newX, y: newY });
      setSize({ width: newW, height: newH });

      // Live update store so shapes visually resize during drag
      updateCanvasBlock(block.id, {
        x: newX,
        y: newY,
        width: newW,
        height: newH,
      });
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      // Commit to store using refs to avoid stale closure
      updateCanvasBlock(block.id, {
        x: finalPosRef.current.x,
        y: finalPosRef.current.y,
        width: finalSizeRef.current.w,
        height: finalSizeRef.current.h,
      });
      onCommit?.();
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [block.id, block.x, block.y, block.width, block.height, viewport.scale, updateCanvasBlock, onSelect, onCommit]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(true);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (block.type === 'text' || block.type === 'comment') {
      e.stopPropagation();
      setIsEditing(true);
    }
  };

  const connectionPoints = ['top', 'right', 'bottom', 'left'] as const;
  const HANDLES: HandlePosition[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  return (
    <div
      ref={containerRef}
      id={block.id}
      className={clsx(
        "absolute group",
        !isDragging && !isResizing && "",
        isDragging && "z-[3000] opacity-90 border border-brand-blue rounded-2xl",
        isResizing && "z-[3000] border border-brand-blue rounded-2xl",
        !isDragging && !isResizing && (block.type === 'section' ? "z-0" : "z-10"),
        isSelected && !isDragging && !isResizing && "border border-brand-blue rounded-2xl",
        !isSelected && "hover:border hover:border-brand-blue/30 rounded-2xl",
        block.type === 'section' && "border-2 border-dashed border-[var(--bone-100)]/40 bg-[var(--bone-10)]/5 p-4 min-w-[300px] min-h-[200px]",
        (isOverSection === block.id) && "ring-2 ring-accent ring-inset",
        showMenu && "border border-brand-blue ring-2 ring-accent/20 rounded-2xl"
      )}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex: block.zIndex,
      }}
      onPointerDown={handlePointerDown}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
    >
      {/* Edge drag trigger */}
      {!isEditing && <div className="canvas-block-edge absolute -inset-1 cursor-move" />}

      {/* Resize handles (visible on hover/selection) */}
      {block.type !== 'connection' && HANDLES.map(h => (
        <ResizeHandle key={h} position={h} onResizeStart={handleResizeStart} isSelected={isSelected} />
      ))}

      {/* Dimension Label */}
      {(isResizing || isDragging) && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-[var(--bone-100)] text-background text-[10px] font-bold px-1.5 py-0.5 rounded-sm z-[4000] whitespace-nowrap pointer-events-none ">
          {Math.round(size.width)} × {Math.round(size.height || containerRef.current?.offsetHeight || 0)}
        </div>
      )}

      {/* Connection Points */}
      {(activeTool === 'arrow' || activeTool === 'line') && connectionPoints.map(side => (
        <div
          key={side}
          className={clsx(
            "absolute w-3 h-3 bg-accent rounded-full border-2 border-background z-[100] cursor-crosshair",
            side === 'top' && "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",
            side === 'right' && "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
            side === 'bottom' && "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
            side === 'left' && "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
          )}
          onPointerDown={(e) => {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const canvasRect = document.getElementById('canvas-bg')?.getBoundingClientRect();
            if (canvasRect && onConnectStart) {
              onConnectStart(
                side,
                (rect.left - canvasRect.left + rect.width / 2 - viewport.x) / viewport.scale,
                (rect.top - canvasRect.top + rect.height / 2 - viewport.y) / viewport.scale
              );
            }
          }}
        />
      ))}

      {/* CONTENT */}
      {isNoteBlock ? (
        <div className={clsx(
          "w-full h-full min-w-[120px]",
          block.type === 'text' && "bg-background border border-border rounded-xl p-2",
          (block.type === 'image' || block.type === 'video') && "overflow-hidden rounded-xl",
          !isEditing && block.type === 'text' && "pointer-events-none select-none"
        )}>
          <BlockRenderer
            block={block}
            index={0}
            onUpdate={(id: string, updates: any) => updateCanvasBlock(id, updates)}
            onDelete={(id: string) => deleteCanvasBlock(id)}
            onInsertAfter={() => { }}
            onSlash={() => { }}
            onOpenMenu={() => { }}
            onFocus={() => onSelect?.(block.id, false)}
          />
        </div>
      ) : block.type === 'section' ? (
        <div className="w-full h-full relative">
          <div className="absolute -top-7 left-0 flex items-center gap-1.5 px-2 py-0.5 bg-sidebar rounded-t-lg border border-b-0 border-border">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">Frame</span>
            <span className="text-xs font-bold truncate max-w-[150px]">{block.content || 'Untitled'}</span>
          </div>
        </div>
      ) : block.type === 'comment' && (
        <div className="bg-[var(--bone-10)]/80 backdrop-blur-xl border border-[var(--bone-20)] rounded-2xl p-4 w-full h-full">
          <div className="flex items-center gap-2 mb-3 text-accent">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Comment</span>
          </div>
          <textarea
            className={clsx(
              "w-full bg-transparent text-sm leading-relaxed outline-none resize-none min-h-[80px] text-foreground/80 placeholder:text-muted-foreground/30",
              !isEditing && "pointer-events-none select-none"
            )}
            value={block.content}
            onChange={(e) => updateCanvasBlock(block.id, { content: e.target.value })}
            placeholder="Discuss or tag @someone..."
            onFocus={() => { setIsEditing(true); onSelect?.(block.id, false); }}
            onBlur={() => setIsEditing(false)}
          />
        </div>
      )}

      {/* Context Menu */}
      {showMenu && (
        <div className="absolute top-0 right-full mr-2 z-[4000] popup-glass-small p-1.5 flex flex-col gap-[3px] w-48">
          <button
            onClick={() => deleteCanvasBlock(block.id)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-danger hover:bg-danger/10 rounded-lg text-left"
          >
            Delete Layer
          </button>
        </div>
      )}
    </div>
  );
}

