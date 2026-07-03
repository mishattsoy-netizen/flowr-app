import { useRef, useCallback } from 'react';
import { useStore } from '@/data/store';
import type { EditorBlock } from '@/data/store';
import { calculateSplineBounds } from '@/lib/geometry/splines';
import { resolvePoints } from '@/lib/geometry/resolvePoints';
import { buildArrowPathD } from '@/lib/geometry/arrowPath';
import { activeDragOffsets } from '@/lib/canvasDragState';

interface DragOptions {
  viewportRef: React.MutableRefObject<{ x: number; y: number; scale: number }>;
  blocks: EditorBlock[];
  selectedIds: Set<string>;
  snapWithObjects?: (x: number, y: number, w: number, h: number, excludeId: string) => { x: number; y: number; guides: { type: 'h' | 'v'; coord: number; start: number; end: number }[] };
  updateCanvasBlocks: (batch: { id: string; updates: Partial<EditorBlock> }[]) => void;
  onCommit?: () => void;
  onDragMove?: (dx: number, dy: number, e: PointerEvent) => void;
  onDragEnd?: (dx: number, dy: number, e: PointerEvent) => void;
  /**
   * Alt+drag duplicate: called once at drag start when Alt is held. Leaves a copy of the
   * dragged ids behind (at the same position) and returns nothing — the drag itself
   * continues to move the ORIGINAL blocks (their DOM nodes already exist, unlike the
   * clones', which haven't been rendered by React yet), so visually the originals slide
   * away from the newly-created stationary copies. Caller is responsible for creating the
   * clones (store.duplicateBlocks) with zero offset.
   */
  onAltDuplicate?: (ids: string[]) => void;
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
  onAltDuplicate,
}: DragOptions) {
  const isDraggingRef = useRef(false);

  // Keep latest mutable references to all changing functions & options to prevent stale closures
  const optionsRef = useRef({ selectedIds, snapWithObjects, updateCanvasBlocks, onCommit, onDragMove, onDragEnd, onAltDuplicate });
  optionsRef.current = { selectedIds, snapWithObjects, updateCanvasBlocks, onCommit, onDragMove, onDragEnd, onAltDuplicate };

  const startDrag = useCallback((e: React.PointerEvent, primaryBlock: EditorBlock) => {
    if (e.button !== 0) return;
    
    e.stopPropagation();
    isDraggingRef.current = true;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const scale = viewportRef.current.scale;

    // Retrieve absolute latest, synchronous positions of blocks directly from Zustand store
    let latestBlocks = useStore.getState().blocks;
    const currentPrimaryBlock = latestBlocks.find(x => x.id === primaryBlock.id) || primaryBlock;

    // Identify all elements to drag as a group using the latest selection state
    const { selectedIds: currentSelectedIds } = optionsRef.current;
    const isAlreadySelected = currentSelectedIds.has(currentPrimaryBlock.id);
    const baseDragIds = isAlreadySelected
      ? Array.from(currentSelectedIds)
      : currentPrimaryBlock.groupId
        ? latestBlocks.filter(b => b.groupId === currentPrimaryBlock.groupId).map(b => b.id)
        : [currentPrimaryBlock.id];

    // Add all children of any dragged frame block so they drag along live
    const dragIdsSet = new Set<string>(baseDragIds);
    baseDragIds.forEach(id => {
      const b = latestBlocks.find(x => x.id === id);
      if (b && (b.type === 'frame' || b.type === 'section')) {
        latestBlocks.forEach(child => {
          if (child.parentId === b.id) {
            dragIdsSet.add(child.id);
          }
        });
      }
    });
    const dragIds = Array.from(dragIdsSet);

    // Alt+drag duplicate: leave a stationary copy of the dragged blocks behind, then continue
    // dragging the ORIGINALS (their DOM nodes already exist for the cached-node transform
    // trick below; freshly-cloned blocks wouldn't have rendered yet, so dragging them would
    // be a no-op visually until the next React commit).
    if (e.altKey && optionsRef.current.onAltDuplicate) {
      optionsRef.current.onAltDuplicate(dragIds);
    }

    // Excalidraw-style detach: dragging an arrow/line whose binding targets are NOT being
    // dragged along freezes those endpoints at their current resolved positions and drops
    // the bindings — otherwise the bound ends stay glued to the shapes and the "drag" is a
    // dead interaction (empty points array + fixed endpoints = nothing moves). Bindings to
    // co-dragged blocks are kept so a selected shape+arrow pair moves as one.
    // The batch is COMPUTED here but only WRITTEN on the first real pointer movement
    // (see handlePointerMove): a plain click on a bound arrow must select it, not
    // silently detach its bindings.
    const freezeBatch: { id: string; updates: Partial<EditorBlock> }[] = [];
    const freezeIds = new Set<string>();
    dragIds.forEach(id => {
      const b = latestBlocks.find(x => x.id === id);
      if (!b || (b.shapeKind !== 'arrow' && b.shapeKind !== 'line')) return;
      const startOut = !!b.startBinding && !dragIdsSet.has(b.startBinding.blockId);
      const endOut = !!b.endBinding && !dragIdsSet.has(b.endBinding.blockId);
      if (!startOut && !endOut) return;
      const resolved = resolvePoints(b, latestBlocks);
      const upd: Partial<EditorBlock> = {};
      let pts = [...(b.points ?? [])] as [number, number][];
      if (startOut && resolved.length > 0) { upd.startBinding = undefined; pts = [resolved[0], ...pts]; }
      if (endOut && resolved.length > 1) { upd.endBinding = undefined; pts = [...pts, resolved[resolved.length - 1]]; }
      upd.points = pts;
      freezeBatch.push({ id, updates: upd });
      freezeIds.add(id);
    });
    let freezeApplied = false;
    const applyFreezeOnce = () => {
      if (freezeApplied || freezeBatch.length === 0) return;
      freezeApplied = true;
      optionsRef.current.updateCanvasBlocks(freezeBatch);
    };

    // Capture initial positions of all dragged elements using the synchronous block state
    const snapshot = new Map<string, { x: number; y: number; w: number; h: number; pivot?: [number, number]; points?: [number, number][] }>();
    dragIds.forEach(id => {
      const b = latestBlocks.find(x => x.id === id);
      if (b) {
        const isArrow = b.shapeKind === 'arrow' || b.shapeKind === 'line' || b.shapeKind === 'freedraw';
        if (isArrow) {
          const resolved = resolvePoints(b, latestBlocks);
          const { minX, minY, maxX, maxY } = calculateSplineBounds(resolved, b.editMode, b.pointRadiuses);
          const pad = 6;
          // For arrows about to be detached, snapshot the FROZEN point set (endpoints
          // materialized from bindings) — the commit shifts snapshot points by the drag
          // delta, and the pre-freeze points array is missing the bound endpoints.
          const frozen = freezeIds.has(b.id)
            ? (freezeBatch.find(f => f.id === b.id)!.updates.points as [number, number][])
            : undefined;
          snapshot.set(b.id, {
            x: minX - pad,
            y: minY - pad,
            w: Math.max(maxX - minX + pad * 2, 1),
            h: Math.max(maxY - minY + pad * 2, 1),
            pivot: b.canvasStyleExt?.pivot ? [...b.canvasStyleExt.pivot] : undefined,
            points: frozen ? JSON.parse(JSON.stringify(frozen)) : (b.points ? JSON.parse(JSON.stringify(b.points)) : undefined),
          });
        } else {
          snapshot.set(b.id, {
            x: b.x ?? 0,
            y: b.y ?? 0,
            w: b.width ?? 0,
            h: b.height ?? 0,
            points: b.points ? JSON.parse(JSON.stringify(b.points)) : undefined,
          });
        }
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

        // Also translate+rotate the portal-ed HTML overlay in sync with the SVG group!
        const overlayEl = document.getElementById(`arrow-overlay-${id}`);
        if (overlayEl) {
          overlayEl.style.transform = `${translate} ${rot}${fH}${fV}`;
        }

        // For SVG <g>: transform-origin must stay at the ORIGINAL (fixed) center.
        // If we move it with currentDX/DY, the rotation pivot shifts every frame
        // and the shape orbits instead of translating — that's the rotated shape desync bug.
        if (el instanceof SVGElement) {
          const snap = snapshot.get(id);
          if (snap) {
            const cx = snap.pivot ? snap.pivot[0] : (snap.x + snap.w / 2); // fixed original center — no currentDX
            const cy = snap.pivot ? snap.pivot[1] : (snap.y + snap.h / 2); // fixed original center — no currentDY
            el.style.transformOrigin = `${cx}px ${cy}px`;
          }
        }
      });
    };


    // Cache arrows BOUND to any dragged block (their endpoints must re-resolve against the
    // moving shape every frame). Arrows that are themselves in the drag set are excluded:
    // their <g> gets the translate3d transform above, and any binding they still carry
    // points at a co-dragged shape moving by the same delta — so the translated path is
    // already correct without recomputation.
    const boundArrowBlocks = latestBlocks.filter(b =>
      (b.shapeKind === 'arrow' || b.shapeKind === 'line') &&
      !dragIdsSet.has(b.id) &&
      ((b.startBinding && dragIdsSet.has(b.startBinding.blockId)) ||
       (b.endBinding && dragIdsSet.has(b.endBinding.blockId)))
    );
    const cachedBoundArrowPaths = boundArrowBlocks.map(arrow => ({
      block: arrow,
      els: Array.from(document.querySelectorAll<SVGPathElement>(`path[data-block-id="${arrow.id}"]`)),
    }));

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current) return;

      let deltaX = (moveEvent.clientX - startClientX) / scale;
      let deltaY = (moveEvent.clientY - startClientY) / scale;

      // Detach bound arrows only once the gesture is a real drag (past a small jitter
      // threshold) — a plain click must select, not unbind.
      if (!freezeApplied && freezeBatch.length > 0 && Math.hypot(deltaX, deltaY) > 3 / scale) {
        applyFreezeOnce();
      }

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

      // Live-update arrows bound to the dragged shape(s): re-resolve their endpoints
      // against the moved geometry every frame using the SAME resolution + path code the
      // React renderer uses, so mid-drag and post-commit visuals are identical.
      if (cachedBoundArrowPaths.length > 0) {
        const movedBlocks = latestBlocks.map(b =>
          dragIdsSet.has(b.id)
            ? { ...b, x: (b.x ?? 0) + currentDX, y: (b.y ?? 0) + currentDY }
            : b
        );
        cachedBoundArrowPaths.forEach(({ block, els }) => {
          const pts = resolvePoints(block, movedBlocks);
          const d = buildArrowPathD(block, pts);
          if (d) els.forEach(el => el.setAttribute('d', d));
        });
      }

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
        // A bound arrow whose detach never fired (click, no real movement) must not be
        // committed: its snapshot points are the would-be-frozen set, and writing them
        // while the bindings are still live would duplicate the endpoints.
        if (freezeIds.has(id) && !freezeApplied) return;
        if (snap.points) {
          const b = latestBlocks.find(x => x.id === id);
          const updates: Partial<EditorBlock> = {
            points: snap.points.map(p => [p[0] + finalDX, p[1] + finalDY] as [number, number]),
          };
          if (b?.canvasStyleExt?.pivot) {
            updates.canvasStyleExt = {
              ...b.canvasStyleExt,
              pivot: [b.canvasStyleExt.pivot[0] + finalDX, b.canvasStyleExt.pivot[1] + finalDY],
            };
          }
          batchUpdates.push({
            id,
            updates,
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

        // Clear arrow overlay translation, keep rotation/flip
        const overlayEl = document.getElementById(`arrow-overlay-${id}`);
        if (overlayEl) {
          overlayEl.style.transform = `${rot}${fH}${fV}`;
        }

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

          if (snap.points) {
            // Path-based shapes (line, arrow, freedraw): clear inline style transform and transform-origin
            // completely so the native SVG transform attribute takes over.
            el.style.transform = '';
            el.style.transformOrigin = '';
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

            // Clear translate AFTER attribute update — shape stays at correct position
            el.style.transform = `${rot}${fH}${fV}`;
            el.style.transformOrigin = `${newX + newW / 2}px ${newY + newH / 2}px`;
          }
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

    // Defer transform application to a microtask so it runs after React's
    // DOM commit (from setIsDraggingLocal/onSelect state updates).
    // Without this, React overwrites el.style.transform to '' between here
    // and the first pointermove, causing the block to briefly lose rotation.
    queueMicrotask(() => {
      // Skip if drag already ended before the microtask runs
      if (!isDraggingRef.current) return;
      applyTransform();
    });
  }, [viewportRef]);

  return { startDrag, isDragging: isDraggingRef.current };
}
