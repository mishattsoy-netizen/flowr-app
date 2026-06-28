"use client";

import { EditorBlock, useStore } from '@/data/store';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { CanvasTool } from './CanvasToolbar';
import { ResizeHandle, HandlePosition } from './ResizeHandle';
import { useDrag, getSimpleBezierPath } from '@/hooks/useDrag';
import { calculateCatmullRomPath } from '@/lib/geometry/splines';
import { activeDragOffsets } from '@/lib/canvasDragState';

interface CanvasBlockProps {
  block: EditorBlock;
  activeTool?: CanvasTool;
  viewport: { x: number; y: number; scale: number };
  onConnectStart?: (side: string, x: number, y: number) => void;
  isSelected?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (id: string, addToSelection: boolean) => void;
  onCommit?: () => void;
  snapWithObjects?: (x: number, y: number, w: number, h: number, excludeId: string) => { x: number; y: number; guides: { type: 'h' | 'v'; coord: number; start: number; end: number }[] };
  snapForResize?: (x: number, y: number, w: number, h: number, handle: string, excludeId: string) => { x: number; y: number; width: number; height: number; guides: { type: 'h' | 'v'; coord: number; start: number; end: number }[] };
  onContextMenu?: (e: React.MouseEvent, blockId: string) => void;
}

export function CanvasBlock({ block, activeTool, viewport, onConnectStart, isSelected, selectedIds, onSelect, onCommit, snapWithObjects, snapForResize, onContextMenu }: CanvasBlockProps) {

  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);
  const updateCanvasBlocks = useStore(s => s.updateCanvasBlocks);
  const deleteCanvasBlock = useStore(s => s.deleteCanvasBlock);
  const moveCanvasSection = useStore(s => s.moveCanvasSection);

  const [isDraggingLocal, setIsDraggingLocal] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [size, setSize] = useState(() => ({ width: block?.width || 280, height: block?.height || undefined as number | undefined }));
  const [showMenu, setShowMenu] = useState(false);
  const [isOverSection, setIsOverSection] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const isNoteBlock = block?.type !== 'section' && block?.type !== 'comment' && block?.type !== 'connection' && block?.type !== 'shape';

  const containerRef = useRef<HTMLDivElement>(null);
  const finalPosRef = useRef({ x: block?.x || 0, y: block?.y || 0 });
  const finalSizeRef = useRef({ w: block?.width || 280, h: block?.height || 150 });
  const lastSectionCheckRef = useRef(0);

  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    if (!isSelected) setIsEditing(false);
  }, [isSelected]);

  // Sync from store when not interacting
  useEffect(() => {
    if (!isDraggingLocal && !isResizing && block) {
      setSize({ width: block.width || 280, height: block.height || undefined });
    }
  }, [block?.width, block?.height, isDraggingLocal, isResizing]);

  // Report actual height for connections
  const heightRef = useRef(block?.height || 0);
  useEffect(() => {
    heightRef.current = block?.height || 0;
  }, [block?.height]);

  useEffect(() => {
    if (!containerRef.current || !isNoteBlock || !block) return;
    let timeoutId: NodeJS.Timeout;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const height = entry.contentRect.height;
        // Only update store if it significantly differs, we are not dragging, resizing, or editing
        if (Math.abs(heightRef.current - height) > 4) {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            if (!isDraggingLocal && !isResizing && !isEditing) {
              updateCanvasBlock(block.id, { height });
            }
          }, 150);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, [block?.id, isDraggingLocal, isResizing, isEditing, updateCanvasBlock, isNoteBlock]);

  const { startDrag } = useDrag({
    viewportRef,
    blocks: [],
    selectedIds: selectedIds || new Set(),
    snapWithObjects,
    updateCanvasBlocks,
    onCommit,
    onDragMove: (dx, dy, moveEvent) => {
      if (!block) return;
      const now = Date.now();
      if (now - lastSectionCheckRef.current < 150) return;
      lastSectionCheckRef.current = now;

      const over = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const sectionEl = over?.closest('[data-block-type="section"]');
      const isAlreadySelected = selectedIds?.has(block.id) ?? false;
      const groupIds = isAlreadySelected && selectedIds ? Array.from(selectedIds) : [block.id];
      if (sectionEl && sectionEl.id !== block.id && !groupIds.includes(sectionEl.id)) {
        setIsOverSection(sectionEl.id);
      } else {
        setIsOverSection(null);
      }
    },
    onDragEnd: (dx, dy, upEvent) => {
      setIsDraggingLocal(false);
      if (!block) return;
      const movedDist = Math.hypot(dx, dy);

      const isAlreadySelected = selectedIds?.has(block.id) ?? false;
      const groupIds = isAlreadySelected && selectedIds ? Array.from(selectedIds) : [block.id];

      // useDrag handles updating section and children coordinate records in the store, avoiding double-shift bugs

      if (isOverSection) {
        updateCanvasBlocks(groupIds.filter(id => id !== isOverSection).map(id => ({
          id, updates: { parentId: isOverSection }
        })));
      }
      setIsOverSection(null);
    }
  });

  if (!block) return null;

  // --- DRAG ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isEditing) return;
    if (isResizing) return;

    const isInput = (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;

    const canMove = activeTool === 'move' || activeTool === 'select';
    const isAlreadySelected = selectedIds?.has(block.id) ?? false;
    if (!isInput && !isAlreadySelected && canMove) {
      onSelect?.(block.id, e.shiftKey);
    }

    if (!canMove) return;
    if (e.button !== 0) return;

    e.stopPropagation();
    setIsDraggingLocal(true);
    setShowMenu(false);
    lastSectionCheckRef.current = Date.now();

    // If was selected and clicked without distinct drag movement, handlePointerUp inside useDrag checks it,
    // but we can also trigger select here.
    startDrag(e, block);
  };

  // --- RESIZE ---
  const handleResizeStart = useCallback((handle: HandlePosition, e: React.PointerEvent) => {
    setIsResizing(true);
    onSelect?.(block.id, false);

    let lastUpdate = 0;
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { x: block.x || 0, y: block.y || 0 };
    const startSize = { w: block.width || 280, h: block.height || 150 };

    // Cache related connection paths once at resize start (highly optimized)
    const labelEl = containerRef.current?.querySelector('.dimension-label');
    const gEl = document.getElementById(block.id);
    const rectEl = gEl?.querySelector('rect');
    const ellipseEl = gEl?.querySelector('ellipse');
    const polygonEl = gEl?.querySelector('polygon');
    const shapePathEl = gEl?.querySelector('path');

    const cachedPathElements: {
      el: SVGPathElement;
      fromId: string | null;
      toId: string | null;
      fromSide: string;
      toSide: string;
      initSx: number;
      initSy: number;
      initTx: number;
      initTy: number;
      points: [number, number][] | null;
    }[] = [];

    const allPaths = document.querySelectorAll<SVGPathElement>('path[data-connection-path], path[data-connection-hitbox]');
    allPaths.forEach(pathEl => {
      const fromId = pathEl.getAttribute('data-from-id');
      const toId = pathEl.getAttribute('data-to-id');
      const hasFrom = fromId === block.id;
      const hasTo = toId === block.id;

      if (hasFrom || hasTo) {
        const fromSide = pathEl.getAttribute('data-from-side') || 'bottom';
        const toSide = pathEl.getAttribute('data-to-side') || 'top';
        const initSx = parseFloat(pathEl.getAttribute('data-init-sx') || '0');
        const initSy = parseFloat(pathEl.getAttribute('data-init-sy') || '0');
        const initTx = parseFloat(pathEl.getAttribute('data-init-tx') || '0');
        const initTy = parseFloat(pathEl.getAttribute('data-init-ty') || '0');

        let points: [number, number][] | null = null;
        const pointsStr = pathEl.getAttribute('data-points');
        if (pointsStr) {
          try {
            points = JSON.parse(pointsStr);
          } catch { }
        }

        cachedPathElements.push({
          el: pathEl,
          fromId,
          toId,
          fromSide,
          toSide,
          initSx,
          initSy,
          initTx,
          initTy,
          points,
        });
      }
    });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      let dx = (moveEvent.clientX - startX) / viewport.scale;
      let dy = (moveEvent.clientY - startY) / viewport.scale;

      const isCorner = handle.length === 2;
      const isShiftPressed = moveEvent.shiftKey;

      let newX = startPos.x;
      let yNew = startPos.y; // using local temp to avoid duplicate name collision if necessary
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

      // Snapping during resize
      const isAltPressed = moveEvent.altKey;
      let snapResult = { x: newX, y: newY, width: newW, height: newH, guides: [] as any[] };
      if (snapForResize && !isAltPressed) {
        snapResult = snapForResize(newX, newY, newW, newH, handle, block.id);
        newX = snapResult.x;
        newY = snapResult.y;
        newW = snapResult.width;
        newH = snapResult.height;
      }

      // Enforce aspect ratio lock (Shift-key corner resize or persistent lock)
      const aspectRatioLocked = block.canvasStyleExt?.aspectRatioLocked ?? false;
      if ((isShiftPressed && isCorner) || aspectRatioLocked) {
        const ratio = startSize.w / startSize.h;
        const rawDw = newW - startSize.w;
        const rawDh = newH - startSize.h;

        let targetW = newW;
        let targetH = newH;

        if (Math.abs(rawDw) > Math.abs(rawDh * ratio)) {
          targetW = newW;
          targetH = targetW / ratio;
        } else {
          targetH = newH;
          targetW = targetH * ratio;
        }

        // Clamp minimum size and enforce aspect ratio
        if (targetW < 60) {
          targetW = 60;
          targetH = targetW / ratio;
        }
        if (targetH < 40) {
          targetH = 40;
          targetW = targetH * ratio;
        }

        if (handle === 'se' || handle === 'e' || handle === 's') {
          newW = targetW;
          newH = targetH;
        } else if (handle === 'sw' || handle === 'w') {
          newW = targetW;
          newH = targetH;
          newX = (startPos.x + startSize.w) - newW;
        } else if (handle === 'ne' || handle === 'n') {
          newW = targetW;
          newH = targetH;
          newY = (startPos.y + startSize.h) - newH;
        } else if (handle === 'nw') {
          newW = targetW;
          newH = targetH;
          newX = (startPos.x + startSize.w) - newW;
          newY = (startPos.y + startSize.h) - newH;
        }
      }

      finalPosRef.current = { x: newX, y: newY };
      finalSizeRef.current = { w: newW, h: newH };

      // Update DOM directly for buttery smoothness (no react renders)
      const container = containerRef.current;
      if (container) {
        container.style.left = `${newX}px`;
        container.style.top = `${newY}px`;
        container.style.width = `${newW}px`;
        container.style.height = `${newH}px`;
      }

      // Update the dimension label text directly in DOM
      if (labelEl) {
        labelEl.textContent = `${Math.round(newW)} × ${Math.round(newH)}`;
      }

      // Update SVG shape element directly in DOM
      if (rectEl) {
        rectEl.setAttribute('x', String(newX));
        rectEl.setAttribute('y', String(newY));
        rectEl.setAttribute('width', String(newW));
        rectEl.setAttribute('height', String(newH));
      }
      if (ellipseEl) {
        ellipseEl.setAttribute('cx', String(newX + newW / 2));
        ellipseEl.setAttribute('cy', String(newY + newH / 2));
        ellipseEl.setAttribute('rx', String(newW / 2));
        ellipseEl.setAttribute('ry', String(newH / 2));
      }
      if (polygonEl) {
        polygonEl.setAttribute('points', `${newX + newW / 2},${newY} ${newX + newW},${newY + newH / 2} ${newX + newW / 2},${newY + newH} ${newX},${newY + newH / 2}`);
      }
      if (shapePathEl) {
        shapePathEl.setAttribute('d', `M ${newX} ${newY} L ${newX + newW} ${newY + newH}`);
      }

      // Render guides
      const guidesContainer = document.getElementById('canvas-snap-guides');
      if (guidesContainer) {
        if (snapResult.guides && snapResult.guides.length > 0) {
          guidesContainer.innerHTML = snapResult.guides.map(g => {
            if (g.type === 'v') {
              return `<line x1="${g.coord}" y1="${g.start}" x2="${g.coord}" y2="${g.end}" class="snap-guide-line" stroke="#ec4899" stroke-width="1.5" opacity="0.8" />`;
            } else {
              return `<line x1="${g.start}" y1="${g.coord}" x2="${g.end}" y2="${g.coord}" class="snap-guide-line" stroke="#ec4899" stroke-width="1.5" opacity="0.8" />`;
            }
          }).join('');
        } else {
          guidesContainer.innerHTML = '';
        }
      }

      // Update active drag offsets for connection lines so they track resizing anchor points
      const currentDX = newX - startPos.x;
      const currentDY = newY - startPos.y;
      activeDragOffsets.set(block.id, {
        dx: currentDX,
        dy: currentDY,
        startX: startPos.x,
        startY: startPos.y,
        resizeX: newX,
        resizeY: newY,
        resizeW: newW,
        resizeH: newH,
      });

      // Live update path elements
      cachedPathElements.forEach(item => {
        let sx = item.initSx;
        let sy = item.initSy;
        let tx = item.initTx;
        let ty = item.initTy;

        if (item.fromId === block.id) {
          if (item.fromSide === 'top') { sx = newX + newW / 2; sy = newY; }
          else if (item.fromSide === 'bottom') { sx = newX + newW / 2; sy = newY + newH; }
          else if (item.fromSide === 'left') { sx = newX; sy = newY + newH / 2; }
          else if (item.fromSide === 'right') { sx = newX + newW; sy = newY + newH / 2; }
        }
        if (item.toId === block.id) {
          if (item.toSide === 'top') { tx = newX + newW / 2; ty = newY; }
          else if (item.toSide === 'bottom') { tx = newX + newW / 2; ty = newY + newH; }
          else if (item.toSide === 'left') { tx = newX; ty = newY + newH / 2; }
          else if (item.toSide === 'right') { tx = newX + newW; ty = newY + newH / 2; }
        }

        if (item.points) {
          const pts = [...item.points];
          if (item.fromId === block.id) pts[0] = [sx, sy];
          if (item.toId === block.id) pts[pts.length - 1] = [tx, ty];
          // Shorten the last segment mathematically to create the gap
          const n = pts.length;
          if (n >= 2) {
            const last = pts[n - 1];
            const prev = pts[n - 2];
            const dx = last[0] - prev[0];
            const dy = last[1] - prev[1];
            const dist = Math.hypot(dx, dy);
            if (dist > 0) {
              const gap = 12;
              const ratio = Math.max(0, (dist - gap) / dist);
              pts[n - 1] = [prev[0] + dx * ratio, prev[1] + dy * ratio];
            }
          }
          const rawPath = calculateCatmullRomPath(pts);
          item.el.setAttribute('d', rawPath);
        } else {
          const rawPath = getSimpleBezierPath({ sx, sy, tx, ty, sp: item.fromSide, tp: item.toSide });
          item.el.setAttribute('d', rawPath);
        }
      });
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      activeDragOffsets.delete(block.id);

      const guidesContainer = document.getElementById('canvas-snap-guides');
      if (guidesContainer) {
        guidesContainer.innerHTML = '';
      }

      // Update local state size too to match
      setSize({ width: finalSizeRef.current.w, height: finalSizeRef.current.h });

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

  const handleRotateStart = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    setIsRotating(true);
    let lastUpdate = 0;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const initialStyle = block.canvasStyleExt ?? {};
    let currentDeg = initialStyle.rotation ?? 0;

    requestAnimationFrame(() => {
      const labelEl = containerRef.current?.querySelector('.rotation-label');

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const vx = moveEvent.clientX - centerX;
        const vy = moveEvent.clientY - centerY;
        const rad = Math.atan2(vy, vx) + Math.PI / 2;
        let deg = (rad * 180) / Math.PI;
        deg = (deg % 360 + 360) % 360;

        if (moveEvent.shiftKey) {
          deg = Math.round(deg / 45) * 45;
        }
        deg = (deg % 360 + 360) % 360;
        if (deg > 180) deg -= 360;
        const roundedDeg = Math.round(deg);
        currentDeg = roundedDeg;

        const nodes = document.querySelectorAll(`[id="${block.id}"]`);
        nodes.forEach(node => {
          if (node instanceof HTMLElement || node instanceof SVGElement) {
            node.style.transform = `rotate(${roundedDeg}deg)`;
          }
        });

        if (labelEl) {
          labelEl.textContent = `${roundedDeg}°`;
        }

        activeDragOffsets.set(block.id, {
          dx: 0,
          dy: 0,
          rotation: roundedDeg
        });

      };

      const handlePointerUp = () => {
        setIsRotating(false);
        activeDragOffsets.delete(block.id);
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);

        updateCanvasBlock(block.id, {
          canvasStyleExt: {
            ...initialStyle,
            rotation: currentDeg,
          },
        });
        if (onCommit) onCommit();
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContextMenu) {
      onContextMenu(e, block.id);
    } else {
      setShowMenu(true);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (
      block.type === 'text' ||
      block.type === 'comment' ||
      (block.type === 'shape' && !['line', 'arrow', 'freedraw'].includes(block.shapeKind || ''))
    ) {
      e.stopPropagation();
      setIsEditing(true);
    }
  };

  const allConnectionPoints = [
    { key: 'top',        type: 'edge',   css: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2' },
    { key: 'right',      type: 'edge',   css: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2' },
    { key: 'bottom',     type: 'edge',   css: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2' },
    { key: 'left',       type: 'edge',   css: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2' },
    { key: 'top-left',   type: 'corner', css: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2' },
    { key: 'top-right',  type: 'corner', css: 'top-0 right-0 translate-x-1/2 -translate-y-1/2' },
    { key: 'bottom-right', type: 'corner', css: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2' },
    { key: 'bottom-left',  type: 'corner', css: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2' },
  ];
  const HANDLES: HandlePosition[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];



  return (
    <div
      ref={containerRef}
      id={block.id}
      className={cn(
        "absolute group",
        isDraggingLocal && "z-[3000] opacity-90",
        isResizing && "z-[3000]",
        !isDraggingLocal && !isResizing && (block.type === 'section' ? "z-0" : "z-10"),
        !isSelected && !isDraggingLocal && !isResizing && "hover:outline hover:outline-brand-blue/30 hover:outline-1 hover:outline-offset-[1px]",
        block.type === 'section' && "border-2 border-dashed border-[var(--bone-100)]/40 bg-[var(--bone-10)]/5 p-4 min-w-[300px] min-h-[200px]",
        (isOverSection === block.id) && "ring-2 ring-accent ring-inset",
        showMenu && "ring-2 ring-accent/20"
      )}
      style={{
        left: block.x || 0,
        top: block.y || 0,
        width: size.width,
        height: size.height,
        zIndex: (block.zIndex ?? 0) + ((isSelected || isDraggingLocal || isResizing) ? 1000 : (block.type === 'section' ? 2 : 10)),
        transform: (() => {
          // During drag, return undefined so React leaves useDrag's translate3d intact.
          // During re-renders triggered by state changes (setIsOverSection etc.) this prevents the translate from being wiped.
          if (isDraggingLocal) return undefined;
          const rotation = block.canvasStyleExt?.rotation ?? 0;
          const flipH = block.canvasStyleExt?.flipH ? ' scaleX(-1)' : '';
          const flipV = block.canvasStyleExt?.flipV ? ' scaleY(-1)' : '';
          // Return '' (not undefined) so React explicitly clears any residual translate after drop
          return (rotation || flipH || flipV) ? `rotate(${rotation}deg)${flipH}${flipV}` : '';
        })(),
        transformOrigin: 'center',
      }}
      onPointerDown={handlePointerDown}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
    >
      {/* Rotation handle */}
      {isSelected && block.type !== 'connection' && !(block.type === 'shape' && ['line', 'arrow', 'freedraw'].includes(block.shapeKind || '')) && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 flex flex-col items-center pb-[1px] pointer-events-auto z-[200]">
          <div
            className="w-3 h-3 bg-brand-blue rounded-full cursor-grab active:cursor-grabbing"
            onPointerDown={handleRotateStart}
          />
          <div className="w-[1px] h-3 bg-brand-blue" />
        </div>
      )}

      {/* Sharp-corner selection outline sitting exactly 1px outside of the block/shape boundary */}
      {(isSelected || isDraggingLocal || isResizing || showMenu) && (
        <div className="absolute -top-[1px] -left-[1px] -right-[1px] -bottom-[1px] border border-brand-blue pointer-events-none rounded-none z-[190]" />
      )}

      {/* Edge drag trigger */}
      {!isEditing && <div className="canvas-block-edge absolute -inset-1 cursor-move" />}

      {/* Resize handles (visible on hover/selection) */}
      {block.type !== 'connection' && HANDLES.map(h => (
        <ResizeHandle key={h} position={h} onResizeStart={handleResizeStart} isSelected={isSelected} />
      ))}

      {/* Dimension & Rotation Labels */}
      {isSelected && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 z-[4000] pointer-events-none">
          <div className="dimension-label bg-[var(--app-dark)] text-[var(--bone-90)] border border-[var(--bone-12)] shadow-md text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--radius-tiny)] whitespace-nowrap">
            {Math.round(size.width)} × {Math.round(size.height || containerRef.current?.offsetHeight || 0)}
          </div>
          <div className="rotation-label bg-[var(--app-dark)] text-[var(--bone-90)] border border-[var(--bone-12)] shadow-md text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--radius-tiny)] whitespace-nowrap">
            {Math.round(block.canvasStyleExt?.rotation ?? 0)}°
          </div>
        </div>
      )}

      {/* Connection Points */}
      {(activeTool === 'arrow' || activeTool === 'line') && allConnectionPoints.map(pt => (
        <div
          key={pt.key}
          className={cn(
            "absolute rounded-full border-2 border-background z-[100] cursor-crosshair",
            pt.type === 'corner' ? "w-2.5 h-2.5 bg-[#ec4899]" : "w-3 h-3 bg-accent",
            pt.css
          )}
          onPointerDown={(e) => {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const canvasRect = document.getElementById('canvas-bg')?.getBoundingClientRect();
            if (canvasRect && onConnectStart) {
              onConnectStart(
                pt.key,
                (rect.left - canvasRect.left + rect.width / 2 - viewport.x) / viewport.scale,
                (rect.top - canvasRect.top + rect.height / 2 - viewport.y) / viewport.scale
              );
            }
          }}
        />
      ))}

      {/* CONTENT */}
      {block.type === 'text' ? (
        <div className="w-full h-full bg-background border border-border rounded-xl p-2 flex items-center justify-center">
          <textarea
            className={cn(
              "w-full h-full bg-transparent text-sm leading-relaxed outline-none resize-none text-foreground/85 placeholder:text-muted-foreground/30 text-center flex items-center justify-center",
              !isEditing && "pointer-events-none select-none"
            )}
            value={block.content}
            onChange={(e) => updateCanvasBlock(block.id, { content: e.target.value })}
            placeholder="Double click to edit..."
            onFocus={() => { setIsEditing(true); onSelect?.(block.id, false); }}
            onBlur={() => setIsEditing(false)}
          />
        </div>
      ) : block.type === 'image' ? (
        <div className="w-full h-full overflow-hidden rounded-xl bg-muted/20 border border-border/50">
          {block.mediaUrl ? (
            <img src={block.mediaUrl} className="w-full h-full object-cover pointer-events-none select-none" alt="" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Empty Image</div>
          )}
        </div>
      ) : block.type === 'video' ? (
        <div className="w-full h-full overflow-hidden rounded-xl bg-muted/20 border border-border/50">
          {block.mediaUrl ? (
            <video src={block.mediaUrl} className="w-full h-full object-cover" controls />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Empty Video</div>
          )}
        </div>
      ) : block.type === 'section' ? (
        <div className="w-full h-full relative">
          <div className="absolute -top-7 left-0 flex items-center gap-1.5 px-2 py-0.5 bg-sidebar rounded-t-lg border border-b-0 border-border">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">Frame</span>
            <span className="text-xs font-bold truncate max-w-[150px]">{block.content || 'Untitled'}</span>
          </div>
        </div>
      ) : block.type === 'comment' ? (
        <div className="bg-[var(--bone-10)]/80 backdrop-blur-xl border border-[var(--bone-20)] rounded-2xl p-4 w-full h-full">
          <div className="flex items-center gap-2 mb-3 text-accent">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Comment</span>
          </div>
          <textarea
            className={cn(
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
      ) : block.type === 'shape' && !['line', 'arrow', 'freedraw'].includes(block.shapeKind || '') ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-3 text-center">
          {isEditing ? (
            <textarea
              className="w-full h-full bg-transparent text-sm leading-relaxed outline-none resize-none text-foreground/85 placeholder:text-muted-foreground/30 text-center flex items-center justify-center pointer-events-auto"
              value={block.content || ''}
              onChange={(e) => updateCanvasBlock(block.id, { content: e.target.value })}
              placeholder="Type to add text..."
              autoFocus
              onBlur={() => setIsEditing(false)}
            />
          ) : (
            <span className="text-sm font-semibold select-none text-[var(--bone-100)] break-words w-full px-1">
              {block.content}
            </span>
          )}
        </div>
      ) : null}

      {showMenu && (
        <div className="absolute top-0 right-full mr-2 z-[4000] bg-[var(--color-panel)] border border-[var(--bone-12)] rounded-[var(--radius-regular)] shadow-[0_4px_12px_rgba(0,0,0,0.3)] p-1.5 flex flex-col gap-[3px] w-48">
          <button
            onClick={() => deleteCanvasBlock(block.id)}
            className="flex items-center gap-3 w-full px-3 py-1.5 text-[13.5px] cursor-pointer whitespace-nowrap text-danger hover:text-danger hover:bg-danger/10 rounded-[var(--radius-medium)] transition-none text-left"
          >
            Delete Layer
          </button>
        </div>
      )}
    </div>
  );
}

