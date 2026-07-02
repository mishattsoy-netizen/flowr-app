"use client";

import { EditorBlock, useStore, generateId } from '@/data/store';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type { CanvasTool } from './CanvasToolbar';
import { ResizeHandle, HandlePosition } from './ResizeHandle';
import { useDrag, getSimpleBezierPath } from '@/hooks/useDrag';
import { calculateCatmullRomPath } from '@/lib/geometry/splines';
import { activeDragOffsets } from '@/lib/canvasDragState';
import { CanvasTextElement } from './CanvasTextElement';
import { getBoundText, layoutLabelInShape, pathMidpoint } from '@/lib/canvas/boundText';
import { resolvePoints } from '@/lib/geometry/resolvePoints';

interface CanvasBlockProps {
  block: EditorBlock;
  activeTool?: CanvasTool;
  viewport: { x: number; y: number; scale: number };
  isSelected?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (id: string, addToSelection: boolean) => void;
  onCommit?: () => void;
  snapWithObjects?: (x: number, y: number, w: number, h: number, excludeId: string) => { x: number; y: number; guides: { type: 'h' | 'v'; coord: number; start: number; end: number }[] };
  snapForResize?: (x: number, y: number, w: number, h: number, handle: string, excludeId: string) => { x: number; y: number; width: number; height: number; guides: { type: 'h' | 'v'; coord: number; start: number; end: number }[] };
  onContextMenu?: (e: React.MouseEvent, blockId: string) => void;
  hoveredFrameId?: string | null;
  onDragMove?: (dx: number, dy: number, e: PointerEvent) => void;
  bindHighlight?: boolean;
  onSideDotDown?: (side: 'top' | 'right' | 'bottom' | 'left', x: number, y: number) => void;
  forceEditing?: boolean;
  onEditingEnded?: () => void;
  onRequestLabelEdit?: (textBlockId: string) => void;
  /** Eraser tool: this block is currently marked for deletion mid-gesture — render dimmed. */
  erasing?: boolean;
}

export function CanvasBlock({ block, activeTool, viewport, isSelected, selectedIds, onSelect, onCommit, snapWithObjects, snapForResize, onContextMenu, hoveredFrameId, onDragMove, bindHighlight, onSideDotDown, forceEditing, onEditingEnded, onRequestLabelEdit, erasing }: CanvasBlockProps) {

  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);
  const updateCanvasBlocks = useStore(s => s.updateCanvasBlocks);
  const deleteCanvasBlock = useStore(s => s.deleteCanvasBlock);


  const [isDraggingLocal, setIsDraggingLocal] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [size, setSize] = useState(() => ({ width: block?.width || 280, height: block?.height || undefined as number | undefined }));
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');
  const labelInputRef = useRef<HTMLInputElement>(null);

  const isNoteBlock = block?.type !== 'frame' && block?.type !== 'shape' && block?.type !== 'text';

  const containerRef = useRef<HTMLDivElement>(null);
  const finalPosRef = useRef({ x: block?.x || 0, y: block?.y || 0 });
  const finalSizeRef = useRef({ w: block?.width || 280, h: block?.height || 150 });

  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useLayoutEffect(() => {
    if (!isSelected) {
      // Deselecting while editing a text block unmounts CanvasTextElement's textarea
      // directly (no blur event fires), so replicate its empty-text-deletes-on-exit
      // behavior here rather than relying on onBlur.
      if (isEditing && block?.type === 'text' && !(block.content ?? '').trim()) {
        deleteCanvasBlock(block.id);
      }
      setIsEditing(false);
      setShowMenu(false);
    }
  }, [isSelected]);

  useEffect(() => {
    if (forceEditing) setIsEditing(true);
  }, [forceEditing]);

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
    onCommit: () => {
      setIsDraggingLocal(false);
      onCommit?.();
    },
    onDragMove,
  });

  // --- BOUND LABEL LAYOUT ---
  // A bound label is a text block whose containerId points at a shape or arrow; its
  // position/size are derived from the container every render rather than stored on
  // itself, so moving/resizing the container automatically carries the label along.
  const allBlocksForLabel = useStore(s => s.blocks);
  const isBoundLabel = block?.type === 'text' && !!block?.containerId;
  const labelContainer = isBoundLabel ? allBlocksForLabel.find(b => b.id === block.containerId) : undefined;
  const isArrowContainer = !!labelContainer?.points && ['arrow', 'line'].includes(labelContainer?.shapeKind || '');

  let labelLayout: { x: number; y: number; width: number; height: number; wrapped: string; containerGrowsTo?: number } | null = null;
  if (isBoundLabel && labelContainer && block) {
    if (isArrowContainer) {
      const resolved = resolvePoints(labelContainer, allBlocksForLabel);
      const [mx, my] = pathMidpoint(resolved);
      const fontSize = block.fontSize ?? 16;
      const w = Math.max(20, block.width ?? 20);
      const h = Math.max(fontSize * 1.25, block.height ?? 26);
      labelLayout = { x: mx - w / 2, y: my - h / 2, width: w, height: h, wrapped: block.content ?? '' };
    } else {
      labelLayout = layoutLabelInShape(labelContainer, block.fontSize ?? 20, block.content ?? '');
    }
  }

  // Grow the container vertically when the wrapped label no longer fits — one-directional
  // (never shrinks) so it converges: once height === containerGrowsTo, neededH > ch is false.
  useLayoutEffect(() => {
    if (labelLayout?.containerGrowsTo != null && labelContainer && Math.abs((labelContainer.height ?? 0) - labelLayout.containerGrowsTo) > 0.5) {
      updateCanvasBlock(labelContainer.id, { height: labelLayout.containerGrowsTo });
    }
  }, [labelLayout?.containerGrowsTo, labelContainer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!block) return null;

  // --- DRAG ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isEditing) return;
    if (isResizing) return;
    // Bound labels aren't independently draggable — pointer events pass through to the
    // container underneath (handled by not stopping propagation / bailing before drag start).
    if (isBoundLabel) return;

    const isInput = (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;

    const canMove = activeTool === 'move' || activeTool === 'select';
    const isAlreadySelected = selectedIds?.has(block.id) ?? false;
    if (!isInput && canMove && (!isAlreadySelected || block.groupId)) {
      onSelect?.(block.id, e.shiftKey);
    }

    if (!canMove) return;
    if (e.button !== 0) return;

    e.stopPropagation();
    setIsDraggingLocal(true);
    setShowMenu(false);

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

      // Clamp minimums (text auto-sizes via fontSize, so it gets a much smaller floor)
      const isTextBlock = block.type === 'text';
      const minW = isTextBlock ? 10 : 60;
      const minH = isTextBlock ? 10 : 40;
      if (newW < minW) { newW = minW; newX = startPos.x + startSize.w - minW; }
      if (newH < minH) { newH = minH; newY = startPos.y + startSize.h - minH; }

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
        if (targetW < minW) {
          targetW = minW;
          targetH = targetW / ratio;
        }
        if (targetH < minH) {
          targetH = minH;
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

      if (block.type === 'text') {
        // Text auto-sizes from fontSize/content, so corner-resize scales the font instead
        // of committing raw width/height (which CanvasTextElement's measure effect would
        // immediately overwrite anyway).
        const oldW = startSize.w || 1;
        const scaleFactor = finalSizeRef.current.w / oldW;
        const newFontSize = Math.max(8, Math.round((block.fontSize ?? 20) * scaleFactor));
        updateCanvasBlock(block.id, {
          x: finalPosRef.current.x,
          y: finalPosRef.current.y,
          fontSize: newFontSize,
        });
      } else {
        // Commit to store using refs to avoid stale closure
        updateCanvasBlock(block.id, {
          x: finalPosRef.current.x,
          y: finalPosRef.current.y,
          width: finalSizeRef.current.w,
          height: finalSizeRef.current.h,
        });
      }
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
    // When block is in a group and part of a multi-selection, double-click should
    // select individual (already handled by pointerdown) instead of entering text edit
    if (block.groupId && selectedIds && selectedIds.has(block.id) && selectedIds.size > 1) {
      e.stopPropagation();
      return;
    }
    if (block.type === 'text') {
      e.stopPropagation();
      setIsEditing(true);
      return;
    }
    if (block.type === 'shape' && !['line', 'arrow', 'freedraw'].includes(block.shapeKind || '')) {
      // Double-clicking a shape creates-or-edits its bound (centered, wrapping) label,
      // exactly like Excalidraw — replaces the old plain in-shape textarea.
      e.stopPropagation();
      const blocks = useStore.getState().blocks;
      const existing = getBoundText(block.id, blocks);
      if (existing) { onRequestLabelEdit?.(existing.id); return; }
      const id = generateId();
      useStore.getState().addCanvasBlock({
        id, type: 'text', content: '', canvasId: block.canvasId, containerId: block.id,
        x: (block.x ?? 0) + (block.width ?? 0) / 2, y: (block.y ?? 0) + (block.height ?? 0) / 2,
        width: 20, height: 26, fontSize: 20, textAlign: 'center',
        canvasStyleExt: { stroke: 'var(--bone-100)' },
      });
      onRequestLabelEdit?.(id);
    }
  };

  const HANDLES: HandlePosition[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];



  return (
    <div
      ref={containerRef}
      id={block.id}
      data-block-type={block.type}
      className={cn(
        "absolute group",
        isDraggingLocal && "z-[3000] opacity-90",
        isResizing && "z-[3000]",
        !isDraggingLocal && !isResizing && (block.type === 'frame' ? "z-0" : "z-10"),
        false && "", // reserved for hover indicator
        block.type === 'frame' && cn(
          "min-w-[120px] min-h-[80px]",
          "overflow-visible"
        ),
        false && "" // reserved for context menu ring
      )}
      style={{
        left: labelLayout ? labelLayout.x : (block.x || 0),
        top: labelLayout ? labelLayout.y : (block.y || 0),
        width: labelLayout ? labelLayout.width : size.width,
        height: labelLayout ? labelLayout.height : size.height,
        zIndex: (block.zIndex ?? 0) + ((isSelected || isDraggingLocal || isResizing) ? 1000 : (block.type === 'frame' ? 2 : 10)),
        opacity: erasing ? 0.3 : undefined,
        // Bound labels pass pointer events through to the container underneath, except
        // while actively editing (so the caret/textarea remains interactive).
        pointerEvents: isBoundLabel && !isEditing ? 'none' : undefined,
        transform: (() => {
          // During drag, return undefined so React leaves useDrag's translate3d intact.
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
      {/* Rotation handle — hidden during multi-selection, shown on unified bounding box instead;
          also hidden for bound labels, which aren't independently transformable. */}
      {!isBoundLabel && isSelected && (!selectedIds || selectedIds.size <= 1) && !(block.type === 'shape' && ['line', 'arrow', 'freedraw'].includes(block.shapeKind || '')) && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 flex flex-col items-center pb-[1px] pointer-events-auto z-[200]">
          <div
            className="w-3 h-3 bg-brand-blue rounded-full cursor-grab active:cursor-grabbing"
            onPointerDown={handleRotateStart}
          />
          <div className="w-[1px] h-3 bg-brand-blue" />
        </div>
      )}

      {/* Sharp-corner selection outline sitting exactly 1px outside of the block/shape boundary */}
      {!isBoundLabel && ((isSelected && (!selectedIds || selectedIds.size <= 1)) || isDraggingLocal || isResizing) && (
        <div className="absolute -top-[1px] -left-[1px] -right-[1px] -bottom-[1px] border border-brand-blue pointer-events-none rounded-none z-[190]" />
      )}

      {/* Edge drag trigger — for frames this must NOT be a full-area overlay: sections select
          via their border/label only, so clicks over the interior reach members underneath.
          Render four thin edge strips instead of one full -inset-1 fill. */}
      {!isEditing && !isBoundLabel && block.type !== 'frame' && (
        <div className={`canvas-block-edge absolute -inset-1 ${activeTool === 'select' || activeTool === 'move' ? 'cursor-move' : 'cursor-crosshair'}`} />
      )}
      {!isEditing && !isBoundLabel && block.type === 'frame' && (() => {
        const stripCursor = activeTool === 'select' || activeTool === 'move' ? 'cursor-move' : 'cursor-crosshair';
        const stripCls = `canvas-block-edge absolute ${stripCursor}`;
        return (
          <>
            <div className={`${stripCls} -top-1 left-0 right-0 h-2`} />
            <div className={`${stripCls} -bottom-1 left-0 right-0 h-2`} />
            <div className={`${stripCls} -left-1 top-0 bottom-0 w-2`} />
            <div className={`${stripCls} -right-1 top-0 bottom-0 w-2`} />
          </>
        );
      })()}

      {/* Resize handles (hidden during multi-selection, visible when single-selected/hovered/resizing).
          Text blocks auto-size, so only corner handles are shown (scaling fontSize on drag);
          edge handles (n/e/s/w) don't make sense for them and are hidden. Bound labels are
          never independently resizable — they size themselves from the container + content. */}
      {!isBoundLabel && !isEditing && (isResizing || !isSelected || !selectedIds || selectedIds.size <= 1) && HANDLES
        .filter(h => block.type !== 'text' || h.length === 2)
        .map(h => (
        <ResizeHandle key={h} position={h} onResizeStart={handleResizeStart} isSelected={isSelected} />
      ))}

      {/* Dimension & Rotation Labels — hidden for text (auto-sized, dimensions aren't meaningful) and while editing */}
      {!isBoundLabel && isSelected && !isEditing && block.type !== 'text' && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 z-[4000] pointer-events-none">
          <div className="dimension-label bg-[var(--app-dark)] text-[var(--bone-90)] border border-[var(--bone-12)] shadow-md text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--radius-tiny)] whitespace-nowrap">
            {Math.round(size.width)} × {Math.round(size.height || containerRef.current?.offsetHeight || 0)}
          </div>
          <div className="rotation-label bg-[var(--app-dark)] text-[var(--bone-90)] border border-[var(--bone-12)] shadow-md text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--radius-tiny)] whitespace-nowrap">
            {Math.round(block.canvasStyleExt?.rotation ?? 0)}°
          </div>
        </div>
      )}

      {/* Bind highlight + side-center dots (only on the hovered bindable element while
          the arrow/line tool is active). Replaces the old always-on 8-dot grid with
          Excalidraw-style hover affordance for the 3 binding modes. */}
      {bindHighlight && (
        <>
          <div className="absolute -inset-[2px] border-2 border-[var(--accent)] rounded-[inherit] pointer-events-none z-[95] opacity-70" />
          {(['top', 'right', 'bottom', 'left'] as const).map(side => (
            <div
              key={side}
              className={cn(
                "absolute w-3 h-3 rounded-full bg-[var(--accent)] border-2 border-background z-[100] cursor-crosshair",
                side === 'top' && "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",
                side === 'right' && "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
                side === 'bottom' && "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
                side === 'left' && "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
              )}
              onPointerDown={(e) => {
                // stopPropagation: this app's flow-drawing is click-to-add-point (not
                // drag-to-create), so the dot must fully drive start/commit itself via
                // onSideDotDown, exactly like the connection points it replaces —
                // letting the event bubble would double-fire the canvas-bg click handler.
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const canvasRect = document.getElementById('canvas-bg')?.getBoundingClientRect();
                if (canvasRect && onSideDotDown) {
                  onSideDotDown(
                    side,
                    (rect.left - canvasRect.left + rect.width / 2 - viewport.x) / viewport.scale,
                    (rect.top - canvasRect.top + rect.height / 2 - viewport.y) / viewport.scale
                  );
                }
              }}
            />
          ))}
        </>
      )}

      {/* CONTENT */}
      {isBoundLabel ? (
        <BoundTextLabel
          block={block}
          isEditing={isEditing}
          isChip={isArrowContainer}
          onStartEdit={() => { setIsEditing(true); onSelect?.(block.id, false); }}
          onEndEdit={() => { setIsEditing(false); onEditingEnded?.(); }}
        />
      ) : block.type === 'text' ? (
        <CanvasTextElement
          block={block}
          isEditing={isEditing}
          onStartEdit={() => { setIsEditing(true); onSelect?.(block.id, false); }}
          onEndEdit={() => { setIsEditing(false); onEditingEnded?.(); }}
        />
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
      ) : block.type === 'frame' ? (
        <>
          {/* Section label — rendered above the block, outside its bounds. Double-click to
              rename inline; the label (not the body) is part of the frame's clickable
              selection surface. */}
          <div
            className="absolute select-none flex items-center gap-1.5 pointer-events-auto"
            style={{ top: -22, left: 0 }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setLabelDraft(block.content ?? '');
              setEditingLabel(true);
            }}
          >
            {editingLabel ? (
              <input
                ref={labelInputRef}
                autoFocus
                className="text-[11px] font-medium bg-transparent outline-none border-b border-[var(--brand-blue)] max-w-[180px]"
                style={{ color: 'var(--bone-90)', lineHeight: '1' }}
                value={labelDraft}
                placeholder="Section"
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={() => {
                  updateCanvasBlock(block.id, { content: labelDraft });
                  setEditingLabel(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                  if (e.key === 'Escape') { e.stopPropagation(); setEditingLabel(false); }
                }}
                onPointerDown={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="text-[11px] font-medium truncate max-w-[180px] block cursor-default"
                style={{ color: 'var(--bone-60)', lineHeight: '1' }}
                onPointerDown={(e) => {
                  // Clicking the label selects the frame itself.
                  e.stopPropagation();
                  onSelect?.(block.id, e.shiftKey);
                }}
              >
                {block.content || 'Section'}
              </span>
            )}
          </div>
          {/* Frame body — fill + border, always clipped (Excalidraw-style). Ignores pointer
              events so clicks over the interior pass through to members underneath; only the
              border strips + label (above) are part of the frame's click surface. */}
          {(() => {
            const hasFill = block.canvasStyleExt?.fill && block.canvasStyleExt.fill !== 'transparent';
            const fillColor = hasFill
              ? `${block.canvasStyleExt!.fill}${Math.round((block.canvasStyleExt!.fillOpacity ?? 1) * 255).toString(16).padStart(2, '0')}`
              : 'transparent';
            const isFrameHovered = hoveredFrameId === block.id;
            const strokeStyle = block.canvasStyleExt?.strokeStyle === 'dashed' ? 'dashed' : 'solid';
            let borderStyle: string;
            if (block.canvasStyleExt?.stroke) {
              borderStyle = `${block.canvasStyleExt.strokeWidth ?? 1.5}px ${strokeStyle} ${block.canvasStyleExt.stroke}`;
            } else if (isFrameHovered) {
              borderStyle = `2px solid rgba(255,255,255,0.5)`; // highlighted drag-over indicator
            } else {
              borderStyle = 'none';
            }
            return (
              <div
                className="w-full h-full overflow-hidden pointer-events-none"
                style={{
                  background: fillColor,
                  border: borderStyle,
                  borderRadius: block.canvasStyleExt?.cornerRadius ? `${block.canvasStyleExt.cornerRadius}px` : 0,
                  transition: isFrameHovered ? 'border-color 0.15s ease' : undefined,
                }}
              />
            );
          })()}
        </>
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

/**
 * A bound label (text with containerId) rendered inside a shape (centered, wrapping) or as a
 * chip at an arrow's midpoint. Unlike CanvasTextElement it never writes its own width/height —
 * the wrapper div's size/position always comes from CanvasBlock's layoutLabelInShape/pathMidpoint
 * computation, so this only owns the editable text content.
 */
function BoundTextLabel({ block, isEditing, isChip, onStartEdit, onEndEdit }: {
  block: EditorBlock;
  isEditing: boolean;
  isChip: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
}) {
  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);
  const deleteCanvasBlock = useStore(s => s.deleteCanvasBlock);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fontSize = block.fontSize ?? (isChip ? 16 : 20);
  const color = block.canvasStyleExt?.stroke || 'var(--bone-100)';

  useLayoutEffect(() => {
    if (isEditing) {
      taRef.current?.focus();
      taRef.current?.setSelectionRange(taRef.current.value.length, taRef.current.value.length);
    }
  }, [isEditing]);

  const textStyle: React.CSSProperties = {
    fontSize, lineHeight: 1.25, color, textAlign: 'center',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word', width: '100%', height: '100%',
  };

  const content = isEditing ? (
    <textarea
      ref={taRef}
      className="bg-transparent outline-none resize-none overflow-hidden block caret-[var(--brand-blue)] p-0 m-0 border-0 box-border pointer-events-auto"
      style={textStyle}
      value={block.content}
      onChange={e => updateCanvasBlock(block.id, { content: e.target.value })}
      onBlur={() => {
        if (!(block.content ?? '').trim()) deleteCanvasBlock(block.id);
        onEndEdit();
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') { e.stopPropagation(); (e.target as HTMLTextAreaElement).blur(); }
      }}
      onPointerDown={e => e.stopPropagation()}
    />
  ) : (
    <div className="select-none" style={textStyle} onDoubleClick={onStartEdit}>
      {block.content}
    </div>
  );

  if (!isChip) return content;

  return (
    <div
      className="bg-[var(--app-dark)] px-1.5 py-0.5 rounded-[var(--radius-tiny)]"
      style={{ pointerEvents: isEditing ? 'auto' : 'none' }}
    >
      {content}
    </div>
  );
}

