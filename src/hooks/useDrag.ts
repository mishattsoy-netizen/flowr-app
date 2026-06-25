import { useRef, useCallback } from 'react';
import { useStore } from '@/data/store';
import type { EditorBlock } from '@/data/store';
import { calculateCatmullRomPath } from '@/lib/geometry/splines';
import { activeDragOffsets } from '@/lib/canvasDragState';
import { focusToPerimeter } from '@/lib/geometry/binding';

interface DragOptions {
  viewportRef: React.MutableRefObject<{ x: number; y: number; scale: number }>;
  blocks: EditorBlock[];
  selectedIds: Set<string>;
  snapWithObjects?: (x: number, y: number, w: number, h: number, excludeId: string) => { x: number; y: number; guides: { type: 'h' | 'v'; coord: number; start: number; end: number }[] };
  updateCanvasBlocks: (batch: { id: string; updates: Partial<EditorBlock> }[]) => void;
  onCommit?: () => void;
  onDragMove?: (dx: number, dy: number, e: PointerEvent) => void;
  onDragEnd?: (dx: number, dy: number, e: PointerEvent) => void;
}

export function getSimpleBezierPath({ sx, sy, tx, ty, sp, tp }: { sx: number; sy: number; tx: number; ty: number; sp: string; tp: string }) {
  const dx = Math.abs(tx - sx);
  const dy = Math.abs(ty - sy);
  const curvature = 0.5;
  
  let c1x = sx, c1y = sy;
  let c2x = tx, c2y = ty;

  if (sp === 'left') c1x -= dx * curvature;
  else if (sp === 'right') c1x += dx * curvature;
  else if (sp === 'top') c1y -= dy * curvature;
  else if (sp === 'bottom') c1y += dy * curvature;

  if (tp === 'left') c2x -= dx * curvature;
  else if (tp === 'right') c2x += dx * curvature;
  else if (tp === 'top') c2y -= dy * curvature;
  else if (tp === 'bottom') c2y += dy * curvature;

  // Shorten the end segment by 12px for the arrowhead gap (avoid regex parsing!)
  const gdx = tx - c2x;
  const gdy = ty - c2y;
  const dist = Math.hypot(gdx, gdy);
  let finalTx = tx;
  let finalTy = ty;
  if (dist > 0) {
    const gap = 12;
    const ratio = Math.max(0, (dist - gap) / dist);
    finalTx = c2x + gdx * ratio;
    finalTy = c2y + gdy * ratio;
  }

  return `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${finalTx} ${finalTy}`;
}

export function useDrag({
  viewportRef,
  blocks,
  selectedIds,
  snapWithObjects,
  updateCanvasBlocks,
  onCommit,
  onDragMove,
  onDragEnd,
}: DragOptions) {
  const isDraggingRef = useRef(false);

  // Keep latest mutable references to all changing functions & options to prevent stale closures
  const optionsRef = useRef({ selectedIds, snapWithObjects, updateCanvasBlocks, onCommit, onDragMove, onDragEnd });
  optionsRef.current = { selectedIds, snapWithObjects, updateCanvasBlocks, onCommit, onDragMove, onDragEnd };

  const startDrag = useCallback((e: React.PointerEvent, primaryBlock: EditorBlock) => {
    if (e.button !== 0) return;
    
    e.stopPropagation();
    isDraggingRef.current = true;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const scale = viewportRef.current.scale;

    // Retrieve absolute latest, synchronous positions of blocks directly from Zustand store
    const latestBlocks = useStore.getState().blocks;
    const currentPrimaryBlock = latestBlocks.find(x => x.id === primaryBlock.id) || primaryBlock;

    // Identify all elements to drag as a group using the latest selection state
    const { selectedIds: currentSelectedIds } = optionsRef.current;
    const isAlreadySelected = currentSelectedIds.has(currentPrimaryBlock.id);
    const baseDragIds = isAlreadySelected ? Array.from(currentSelectedIds) : [currentPrimaryBlock.id];

    // Add all children of any dragged section block so they drag along live
    const dragIdsSet = new Set<string>(baseDragIds);
    baseDragIds.forEach(id => {
      const b = latestBlocks.find(x => x.id === id);
      if (b && b.type === 'section') {
        latestBlocks.forEach(child => {
          if (child.parentId === b.id) {
            dragIdsSet.add(child.id);
          }
        });
      }
    });
    const dragIds = Array.from(dragIdsSet);

    // Capture initial positions of all dragged elements using the synchronous block state
    const snapshot = new Map<string, { x: number; y: number; w: number; h: number; points?: [number, number][]; keyPoints?: [number, number][] }>();
    dragIds.forEach(id => {
      const b = latestBlocks.find(x => x.id === id);
      if (b) {
        snapshot.set(b.id, {
          x: b.x ?? 0,
          y: b.y ?? 0,
          w: b.width ?? 0,
          h: b.height ?? 0,
          points: b.points ? JSON.parse(JSON.stringify(b.points)) : undefined,
          keyPoints: b.keyPoints ? JSON.parse(JSON.stringify(b.keyPoints)) : undefined,
        });
      }
    });

    const primaryStart = snapshot.get(currentPrimaryBlock.id) || { x: currentPrimaryBlock.x ?? 0, y: currentPrimaryBlock.y ?? 0 };
    const primaryW = currentPrimaryBlock.width ?? 100;
    const primaryH = currentPrimaryBlock.height ?? 40;

    // Live drag state — updated on every pointermove
    let currentDX = 0;
    let currentDY = 0;

    // Cache all DOM nodes for the dragged IDs once at drag start (highly optimized)
    const cachedDomElements: { el: HTMLElement; id: string; rotation: number; flipH: boolean; flipV: boolean }[] = [];
    dragIds.forEach(id => {
      const nodes = document.querySelectorAll(`[id="${id}"]`);
      const b = latestBlocks.find(x => x.id === id);
      const rotation = b?.canvasStyleExt?.rotation ?? 0;
      const flipH = !!b?.canvasStyleExt?.flipH;
      const flipV = !!b?.canvasStyleExt?.flipV;
      nodes.forEach(node => cachedDomElements.push({ el: node as HTMLElement, id, rotation, flipH, flipV }));
    });

    // Apply the current transform to all cached DOM nodes (O(1) style writes, zero query layout thrashing)
    const applyTransform = () => {
      cachedDomElements.forEach(({ el, id, rotation, flipH, flipV }) => {
        const translate = `translate3d(${currentDX}px, ${currentDY}px, 0)`;
        const rot = rotation ? `rotate(${rotation}deg) ` : '';
        const fH = flipH ? 'scaleX(-1) ' : '';
        const fV = flipV ? 'scaleY(-1) ' : '';
        el.style.transform = `${translate} ${rot}${fH}${fV}`;

        // For SVG <g>: transform-origin must stay at the ORIGINAL (fixed) center.
        // If we move it with currentDX/DY, the rotation pivot shifts every frame
        // and the shape orbits instead of translating — that's the rotated shape desync bug.
        if (el instanceof SVGElement) {
          const snap = snapshot.get(id);
          if (snap) {
            const cx = snap.x + snap.w / 2; // fixed original center — no currentDX
            const cy = snap.y + snap.h / 2; // fixed original center — no currentDY
            el.style.transformOrigin = `${cx}px ${cy}px`;
          }
        }
      });
    };


    // Cache related connection paths once at drag start (highly optimized)
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
      startBinding: string | null;
      endBinding: string | null;
      keyPoints: [number, number][] | null;
    }[] = [];

    const allPaths = document.querySelectorAll<SVGPathElement>('path[data-connection-path], path[data-connection-hitbox]');
    allPaths.forEach(pathEl => {
      const fromId = pathEl.getAttribute('data-from-id');
      const toId = pathEl.getAttribute('data-to-id');
      const hasFrom = fromId && dragIds.includes(fromId);
      const hasTo = toId && dragIds.includes(toId);
      
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
          } catch {}
        }

        let keyPoints: [number, number][] | null = null;
        const keyPointsStr = pathEl.getAttribute('data-key-points');
        if (keyPointsStr) {
          try { keyPoints = JSON.parse(keyPointsStr); } catch {}
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
          startBinding: pathEl.getAttribute('data-start-binding') || null,
          endBinding: pathEl.getAttribute('data-end-binding') || null,
          keyPoints,
        });
      }
    });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current) return;

      let deltaX = (moveEvent.clientX - startClientX) / scale;
      let deltaY = (moveEvent.clientY - startClientY) / scale;

      const isShiftPressed = moveEvent.shiftKey;
      if (isShiftPressed) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          deltaY = 0;
        } else {
          deltaX = 0;
        }
      }

      // Apply snapping to the primary element
      const unSnappedX = primaryStart.x + deltaX;
      const unSnappedY = primaryStart.y + deltaY;

      const isAltPressed = moveEvent.altKey;
      const currentOptions = optionsRef.current;
      const snapResult = (currentOptions.snapWithObjects && !isAltPressed)
        ? currentOptions.snapWithObjects(unSnappedX, unSnappedY, primaryW, primaryH, currentPrimaryBlock.id)
        : { x: unSnappedX, y: unSnappedY, guides: [] };

      if (isShiftPressed) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          snapResult.y = primaryStart.y;
          snapResult.guides = snapResult.guides.filter(g => g.type === 'v');
        } else {
          snapResult.x = primaryStart.x;
          snapResult.guides = snapResult.guides.filter(g => g.type === 'h');
        }
      }

      // Calculate the final translation delta
      currentDX = snapResult.x - primaryStart.x;
      currentDY = snapResult.y - primaryStart.y;

      // Render visual guides
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

      // Update active drag offsets for connection lines
      dragIds.forEach(id => {
        const snap = snapshot.get(id);
        activeDragOffsets.set(id, {
          dx: currentDX,
          dy: currentDY,
          startX: snap ? snap.x : undefined,
          startY: snap ? snap.y : undefined,
          startPoints: snap ? snap.points : undefined,
        });
      });

      // Immediate DOM update of cached nodes
      applyTransform();

      // Recalculate connection paths live in DOM using cached path elements (extremely fast!)
      cachedPathElements.forEach(item => {
        let sx = item.initSx;
        let sy = item.initSy;
        let tx = item.initTx;
        let ty = item.initTy;

        if (item.startBinding && item.fromId && dragIds.includes(item.fromId)) {
          try {
            const binding = JSON.parse(item.startBinding);
            const block = latestBlocks.find(b => b.id === binding.blockId);
            if (block) {
              const dx = dragIds.includes(block.id) ? currentDX : 0;
              const dy = dragIds.includes(block.id) ? currentDY : 0;
              const rect = {
                x: (block.x ?? 0) + dx,
                y: (block.y ?? 0) + dy,
                width: block.width ?? 280,
                height: block.height ?? 100,
              };
              const pos = focusToPerimeter(binding.focus ?? 0.5, rect, binding.gap ?? 0);
              sx = pos[0];
              sy = pos[1];
            }
          } catch {}
        } else if (item.fromId && dragIds.includes(item.fromId)) {
          sx += currentDX;
          sy += currentDY;
        }

        if (item.endBinding && item.toId && dragIds.includes(item.toId)) {
          try {
            const binding = JSON.parse(item.endBinding);
            const block = latestBlocks.find(b => b.id === binding.blockId);
            if (block) {
              const dx = dragIds.includes(block.id) ? currentDX : 0;
              const dy = dragIds.includes(block.id) ? currentDY : 0;
              const rect = {
                x: (block.x ?? 0) + dx,
                y: (block.y ?? 0) + dy,
                width: block.width ?? 280,
                height: block.height ?? 100,
              };
              const pos = focusToPerimeter(binding.focus ?? 0.5, rect, binding.gap ?? 0);
              tx = pos[0];
              ty = pos[1];
            }
          } catch {}
        } else if (item.toId && dragIds.includes(item.toId)) {
          tx += currentDX;
          ty += currentDY;
        }

        if (item.points) {
          const pts = [...item.points];
          if (item.fromId && dragIds.includes(item.fromId)) {
            pts[0] = [sx, sy];
          }
          if (item.toId && dragIds.includes(item.toId)) {
            pts[pts.length - 1] = [tx, ty];
          }
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

      if (currentOptions.onDragMove) {
        currentOptions.onDragMove(currentDX, currentDY, moveEvent);
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      isDraggingRef.current = false;
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);

      const guidesContainer = document.getElementById('canvas-snap-guides');
      if (guidesContainer) {
        guidesContainer.innerHTML = '';
      }

      let deltaX = (upEvent.clientX - startClientX) / scale;
      let deltaY = (upEvent.clientY - startClientY) / scale;

      const isShiftPressed = upEvent.shiftKey;
      if (isShiftPressed) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          deltaY = 0;
        } else {
          deltaX = 0;
        }
      }

      const unSnappedX = primaryStart.x + deltaX;
      const unSnappedY = primaryStart.y + deltaY;

      const isAltPressed = upEvent.altKey;
      const currentOptions = optionsRef.current;
      const snappedPos = (currentOptions.snapWithObjects && !isAltPressed)
        ? currentOptions.snapWithObjects(unSnappedX, unSnappedY, primaryW, primaryH, currentPrimaryBlock.id)
        : { x: unSnappedX, y: unSnappedY };

      if (isShiftPressed) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          snappedPos.y = primaryStart.y;
        } else {
          snappedPos.x = primaryStart.x;
        }
      }

      const finalDX = snappedPos.x - primaryStart.x;
      const finalDY = snappedPos.y - primaryStart.y;

      // Build batch updates first
      const batchUpdates: { id: string; updates: Partial<EditorBlock> }[] = [];
      snapshot.forEach((snap, id) => {
        if (snap.keyPoints) {
          batchUpdates.push({
            id,
            updates: { keyPoints: snap.keyPoints.map(p => [p[0] + finalDX, p[1] + finalDY] as [number, number]) },
          });
        } else if (snap.points) {
          batchUpdates.push({
            id,
            updates: { points: snap.points.map(p => [p[0] + finalDX, p[1] + finalDY] as [number, number]) },
          });
        } else {
          batchUpdates.push({
            id,
            updates: { x: snap.x + finalDX, y: snap.y + finalDY },
          });
        }
      });

      // Set final positions directly on DOM BEFORE clearing transforms
      cachedDomElements.forEach(({ el, id, rotation, flipH, flipV }) => {
        const snap = snapshot.get(id);
        const rot = rotation ? `rotate(${rotation}deg)` : '';
        const fH = flipH ? ' scaleX(-1)' : '';
        const fV = flipV ? ' scaleY(-1)' : '';

        if (el instanceof HTMLElement && !(el instanceof SVGElement)) {
          // HTML wrapper (CanvasBlock div): set left/top and clear translate
          if (snap) {
            el.style.left = `${snap.x + finalDX}px`;
            el.style.top = `${snap.y + finalDY}px`;
          }
          el.style.transform = `${rot}${fH}${fV}`;
        } else if (el instanceof SVGElement && snap) {
          // SVG <g> element: update child attributes to final position THEN clear
          // translate so there is zero visual flash (same pattern as resize).
          const newX = snap.x + finalDX;
          const newY = snap.y + finalDY;
          const newW = snap.w;
          const newH = snap.h;

          if (snap.keyPoints) {
            // New arrow/line/freedraw with keyPoints — update keyPoints directly (VectorPath re-renders)
            el.style.transform = `${rot}${fH}${fV}`;
          } else if (snap.points) {
            // Path-based shapes (line, arrow, freedraw): update path d attribute
            const newPts = snap.points.map(p => [p[0] + finalDX, p[1] + finalDY] as [number, number]);
            const pathEl = el.querySelector<SVGPathElement>(':scope > path');
            if (pathEl) {
              const d = newPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
              pathEl.setAttribute('d', d);
            }
          } else {
            // Box shapes (rect, ellipse, diamond): update shape attributes
            const rectEl = el.querySelector<SVGRectElement>('rect');
            if (rectEl) {
              rectEl.setAttribute('x', String(newX));
              rectEl.setAttribute('y', String(newY));
            }
            const ellipseEl = el.querySelector<SVGEllipseElement>('ellipse');
            if (ellipseEl) {
              ellipseEl.setAttribute('cx', String(newX + newW / 2));
              ellipseEl.setAttribute('cy', String(newY + newH / 2));
            }
            const polygonEl = el.querySelector<SVGPolygonElement>('polygon');
            if (polygonEl) {
              polygonEl.setAttribute('points',
                `${newX + newW / 2},${newY} ${newX + newW},${newY + newH / 2} ${newX + newW / 2},${newY + newH} ${newX},${newY + newH / 2}`
              );
            }
          }

          // Clear translate AFTER attribute update — shape stays at correct position
          el.style.transform = `${rot}${fH}${fV}`;
          el.style.transformOrigin = `${newX + newW / 2}px ${newY + newH / 2}px`;
        }
      });


      dragIds.forEach(id => {
        activeDragOffsets.delete(id);
      });

      if (batchUpdates.length > 0) {
        currentOptions.updateCanvasBlocks(batchUpdates);
      }

      if (currentOptions.onDragEnd) {
        currentOptions.onDragEnd(finalDX, finalDY, upEvent);
      }

      currentOptions.onCommit?.();
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [viewportRef]);

  return { startDrag, isDragging: isDraggingRef.current };
}
