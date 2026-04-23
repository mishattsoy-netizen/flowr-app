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
  onSelect?: (id: string) => void;
}

export function CanvasBlock({ block, activeTool, viewport, onConnectStart, isSelected, onSelect }: CanvasBlockProps) {
  const blocks = useStore(s => s.blocks);
  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);
  const deleteCanvasBlock = useStore(s => s.deleteCanvasBlock);
  const moveCanvasSection = useStore(s => s.moveCanvasSection);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState({ x: block.x || 0, y: block.y || 0 });
  const [size, setSize] = useState({ width: block.width || 280, height: block.height || undefined as number | undefined });
  const [showMenu, setShowMenu] = useState(false);
  const [isOverSection, setIsOverSection] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

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
        if (!isDragging && !isResizing && block.type !== 'connection' && Math.abs(heightRef.current - height) > 1) {
          updateCanvasBlock(block.id, { height });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [block.id, isDragging, isResizing, updateCanvasBlock, block.type]);

  // --- DRAG ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isEditing) return;
    if (isResizing) return;

    const isGrip = (e.target as HTMLElement).closest('.block-grip');
    const isEdge = (e.target as HTMLElement).classList.contains('canvas-block-edge');
    const isInput = (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;
    
    // Always select on pointer down if not clicking an input
    if (!isInput) {
      onSelect?.(block.id);
    }

    const canMove = activeTool === 'move' || activeTool === 'select' || isGrip || isEdge;
    if (!canMove) return;
    if (e.button !== 0) return;

    e.stopPropagation();
    setIsDragging(true);
    setShowMenu(false);

    const startX = e.clientX / viewport.scale - position.x;
    const startY = e.clientY / viewport.scale - position.y;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const newX = moveEvent.clientX / viewport.scale - startX;
      const newY = moveEvent.clientY / viewport.scale - startY;
      setPosition({ x: newX, y: newY });

      // Live update store for connection tracking
      if (block.type !== 'connection' && (blocks.some(b => b.fromId === block.id || b.toId === block.id))) {
        updateCanvasBlock(block.id, { x: newX, y: newY });
      }

      const over = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const sectionEl = over?.closest('[data-block-type="section"]');
      if (sectionEl && sectionEl.id !== block.id) {
        setIsOverSection(sectionEl.id);
      } else {
        setIsOverSection(null);
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      const finalX = upEvent.clientX / viewport.scale - startX;
      const finalY = upEvent.clientY / viewport.scale - startY;

      setIsDragging(false);

      if (block.type === 'section') {
        const dx = finalX - (block.x || 0);
        const dy = finalY - (block.y || 0);
        moveCanvasSection(block.id, dx, dy);
      } else {
        updateCanvasBlock(block.id, {
          x: finalX,
          y: finalY,
          parentId: isOverSection || undefined
        });
      }

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
    onSelect?.(block.id);

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

      setPosition({ x: newX, y: newY });
      setSize({ width: newW, height: newH });
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      // Commit to store
      updateCanvasBlock(block.id, {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
      });
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [block, viewport.scale, updateCanvasBlock, onSelect, position, size]);

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

  const isNoteBlock = block.type !== 'section' && block.type !== 'comment' && block.type !== 'connection';
  const connectionPoints = ['top', 'right', 'bottom', 'left'] as const;
  const HANDLES: HandlePosition[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  return (
    <div
      ref={containerRef}
      id={block.id}
      className={clsx(
        "absolute group",
        !isDragging && !isResizing && "",
        isDragging && "z-[3000] opacity-90 border border-[var(--bone-100)] rounded-2xl",
        isResizing && "z-[3000] border border-[var(--bone-100)] rounded-2xl",
        !isDragging && !isResizing && (block.type === 'section' ? "z-0" : "z-10"),
        isSelected && !isDragging && !isResizing && "border border-[var(--bone-100)] rounded-2xl",
        !isSelected && "hover:border hover:border-[var(--bone-100)]/20 rounded-2xl",
        block.type === 'section' && "border-2 border-dashed border-[var(--bone-100)]/40 bg-[var(--bone-10)]/5 p-4 min-w-[300px] min-h-[200px]",
        (isOverSection === block.id) && "ring-2 ring-accent ring-inset"
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
      {activeTool === 'connect' && connectionPoints.map(side => (
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
          (block.type === 'image' || block.type === 'video') && "overflow-hidden rounded-xl"
        )}>
          <BlockRenderer
            block={block}
            index={0}
            onUpdate={(id, updates) => updateCanvasBlock(id, updates)}
            onDelete={(id) => deleteCanvasBlock(id)}
            onInsertAfter={() => { }}
            onSlash={() => { }}
            onOpenMenu={() => { }}
            onFocus={() => onSelect?.(block.id)}
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
            className="w-full bg-transparent text-sm leading-relaxed outline-none resize-none min-h-[80px] text-foreground/80 placeholder:text-muted-foreground/30"
            value={block.content}
            onChange={(e) => updateCanvasBlock(block.id, { content: e.target.value })}
            placeholder="Discuss or tag @someone..."
            onFocus={() => { setIsEditing(true); onSelect?.(block.id); }}
            onBlur={() => setIsEditing(false)}
          />
        </div>
      )}

      {/* Context Menu */}
      {showMenu && (
        <div className="absolute top-0 right-full mr-2 z-[4000] popup-glass-small p-2 flex flex-col gap-1 w-48">
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

