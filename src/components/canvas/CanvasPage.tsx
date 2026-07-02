"use client";

import { Entity, useStore, generateId, EditorBlock, CanvasStyleExt } from '@/data/store';
import { Copy, ArrowUp, ArrowDown, Trash2, Minus, Undo2, Redo2, PanelRight, Layers, Magnet, Download, Check } from 'lucide-react';
import { computeGroupBounds } from '@/lib/frameLayout';
import { CanvasBlock } from './CanvasBlock';
import { CanvasToolbar, CanvasTool } from './CanvasToolbar';
import { CanvasLayersPanel } from './CanvasLayersPanel';
import { CanvasStylePanel } from './CanvasStylePanel';
import { CanvasConnections } from './CanvasConnections';
import { CanvasShapeLayer } from './CanvasShapeLayer';
import { MultiSelectionBox } from './MultiSelectionBox';
import { VectorPath } from './edges/VectorPath';
import { MediaUploadPopover } from './MediaUploadPopover';
import { useCanvasHistory } from '@/hooks/useCanvasHistory';
import { useCanvasSnap } from '@/hooks/useCanvasSnap';
import { useCanvasMultiSelect } from '@/hooks/useCanvasMultiSelect';
import { useDrag } from '@/hooks/useDrag';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useFlowState } from '@/hooks/useFlowState';
import { useEraser } from '@/hooks/useEraser';
import { FlowPreview } from './FlowPreview';
import { exportCanvasToPng, copyCanvasToClipboard } from '@/lib/canvasExport';
import { resolvePoints } from '@/lib/geometry/resolvePoints';
import { calculateSplineBounds } from '@/lib/geometry/splines';
import { copyShareLinkToClipboard } from '@/lib/canvasShare';
import { loadCanvasBlocks, subscribeCanvasBlocks } from '@/lib/canvasSync';
import { useDragState, activeDragOffsets } from '@/lib/canvasDragState';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { HandlePosition } from './ResizeHandle';
import { classifyBindingAt, findBindableBlockAt, sideCenterBinding } from '@/lib/canvas/classifyBinding';
import { getBoundText } from '@/lib/canvas/boundText';
import type { ArrowBinding } from '@/data/store.types';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.1;

export function CanvasPage({ entity }: { entity: Entity }) {
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [showLayers, setShowLayers] = useState(true);
  const [showStylePanel, setShowStylePanel] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoveredFrameId, setHoveredFrameId] = useState<string | null>(null);
  const hoveredFrameRef = useRef<string | null>(null);
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false);
  const [canvasBgColor, setCanvasBgColor] = useState('default');
  const [canvasBgOpacity, setCanvasBgOpacity] = useState(1);
  const [captureBg, setCaptureBg] = useState(true);
  const [captureRatio, setCaptureRatio] = useState<'screen' | '16:9' | '4:3' | '1:1'>('screen');
  const [captureOrientation, setCaptureOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [captureScale, setCaptureScale] = useState(2);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpg' | 'svg'>('png');
  const [exportFileName, setExportFileName] = useState('canvas-export');
  const [exportSuccess, setExportSuccess] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [hoverBindTargetId, setHoverBindTargetId] = useState<string | null>(null);
  const pendingStartBindingRef = useRef<ArrowBinding | null>(null);
  const pendingEndBindingRef = useRef<ArrowBinding | null>(null);

  // Clear the bind-hover highlight the instant the tool changes away from arrow/line,
  // rather than waiting for the next pointermove to catch up.
  useEffect(() => {
    if (activeTool !== 'arrow' && activeTool !== 'line') setHoverBindTargetId(null);
  }, [activeTool]);

  const resolvedBgColor = useMemo(() => {
    if (canvasBgColor === 'default') return 'var(--app-background)';
    if (canvasBgColor.startsWith('#')) {
      const r = parseInt(canvasBgColor.slice(1, 3), 16);
      const g = parseInt(canvasBgColor.slice(3, 5), 16);
      const b = parseInt(canvasBgColor.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${canvasBgOpacity})`;
    }
    return canvasBgColor;
  }, [canvasBgColor, canvasBgOpacity]);

  const [canvasPattern, setCanvasPattern] = useState<'none' | 'grid' | 'dots'>('grid');
  const [canvasPatternOpacity, setCanvasPatternOpacity] = useState(0.03);
  const [canvasPatternColor, setCanvasPatternColor] = useState('default');
  const [drawingShape, setDrawingShape] = useState<{
    kind: string; startX: number; startY: number; x: number; y: number; w: number; h: number;
    points: [number, number][];
  } | null>(null);
  const [activeStyle, setActiveStyle] = useState<CanvasStyleExt>({
    stroke: '#ffffff',
    strokeWidth: 1,
    strokeStyle: 'solid',
    fill: '#ffffff',
    fillOpacity: 1.0,
    opacity: 1.0,
    locked: false,
    cornerRadius: 20,
  });
  const [mediaPopover, setMediaPopover] = useState<{
    x: number; y: number; canvasX: number; canvasY: number;
  } | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const [remoteCursors, setRemoteCursors] = useState<{ userId: string; name: string; x: number; y: number; color: string }[]>([]);

  const cloudSyncEnabled = entity.syncMode !== 'local-only';

  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const spaceHeldRef = useRef(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const lastCursorBroadcastRef = useRef(0);

  // Group resize state
  interface GroupResizeSnapshot {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    points: [number, number][] | null;
  }
  const groupResizeRef = useRef<{
    initBox: { x: number; y: number; w: number; h: number };
    snapshots: GroupResizeSnapshot[];
    handle: HandlePosition;
  } | null>(null);

  const blocks = useStore(s => s.blocks);
  const addCanvasBlock = useStore(s => s.addCanvasBlock);
  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);
  const updateCanvasBlocks = useStore(s => s.updateCanvasBlocks);
  const deleteCanvasBlock = useStore(s => s.deleteCanvasBlock);
  const duplicateBlocks = useStore(s => s.duplicateBlocks);

  const pageBlocks = useMemo(
    () => blocks.filter(b => b.canvasId === entity.id).sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
    [blocks, entity.id]
  );

  // Compute groups from pageBlocks for group overlay hit areas
  const groupOverlays = useMemo(() => {
    const groupMap = new Map<string, EditorBlock[]>();
    for (const b of pageBlocks) {
      if (b.groupId) {
        if (!groupMap.has(b.groupId)) groupMap.set(b.groupId, []);
        groupMap.get(b.groupId)!.push(b);
      }
    }
    const overlays: { groupId: string; members: EditorBlock[]; bounds: { x: number; y: number; width: number; height: number } }[] = [];
    for (const [groupId, members] of groupMap) {
      if (members.length > 0) {
        overlays.push({ groupId, members, bounds: computeGroupBounds(members) });
      }
    }
    return overlays;
  }, [pageBlocks]);

  const history = useCanvasHistory(pageBlocks);

  // Arrow-key nudge: many keydowns move the selection by 1-10px each, but they should collapse
  // into a single undo step per "burst" rather than one step per keypress. Debounce the history
  // push 500ms after the last nudge in the burst.
  const nudgeHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleNudgeHistoryPush = useCallback(() => {
    if (nudgeHistoryTimerRef.current) clearTimeout(nudgeHistoryTimerRef.current);
    nudgeHistoryTimerRef.current = setTimeout(() => {
      nudgeHistoryTimerRef.current = null;
      history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
    }, 500);
  }, [history, entity.id]);
  useEffect(() => () => {
    if (nudgeHistoryTimerRef.current) clearTimeout(nudgeHistoryTimerRef.current);
  }, []);

  const { snapWithObjects, snapForResize } = useCanvasSnap(snapEnabled, pageBlocks, viewport.scale);
  const multiSelect = useCanvasMultiSelect(pageBlocks);
  const { markedIds: eraserMarkedIds, handleEraserDown } = useEraser({
    canvasId: entity.id,
    onCommit: () => history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id)),
  });

  // Sections (frames), used to render each one's members inside a clipped wrapper layer.
  const frameBlocks = useMemo(() => pageBlocks.filter(b => b.type === 'frame'), [pageBlocks]);

  // Reactively track which frame-member ids are currently mid-drag, so they can escape the
  // clipped layer into the unclipped top-level layer and stay visible while being dragged out.
  // Scoped to member ids only (not all drag offsets) to avoid re-rendering this list on every
  // unrelated drag (e.g. dragging a non-member shape around the canvas).
  const [draggingMemberIds, setDraggingMemberIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const memberIds = new Set(pageBlocks.filter(b => b.parentId).map(b => b.id));
    const unsub = useDragState.subscribe((state) => {
      const active = new Set<string>();
      for (const id of Object.keys(state.offsets)) {
        if (memberIds.has(id)) active.add(id);
      }
      setDraggingMemberIds(prev => {
        if (prev.size === active.size && [...prev].every(id => active.has(id))) return prev;
        return active;
      });
    });
    return unsub;
  }, [pageBlocks]);

  const handleDragCommit = useCallback(() => {
    // Reset frame drag-over highlight
    hoveredFrameRef.current = null;
    setHoveredFrameId(null);

    const currentBlocks = useStore.getState().blocks;
    const canvasBlocks = currentBlocks.filter(x => x.canvasId === entity.id);

    // Drop-into-frame: fully-inside containment test, no nesting (frames can't join frames).
    const batch: { id: string; updates: Partial<EditorBlock> }[] = [];
    const frames = canvasBlocks.filter(b => b.type === 'frame');
    for (const id of selectedIds) {
      const block = canvasBlocks.find(b => b.id === id);
      if (!block) continue;
      if (block.type === 'frame') continue; // no nesting

      const bx = block.x ?? 0, by = block.y ?? 0, bw = block.width ?? 0, bh = block.height ?? 0;
      let containedBy: string | undefined;
      for (const f of frames) {
        const fx = f.x ?? 0, fy = f.y ?? 0, fw = f.width ?? 0, fh = f.height ?? 0;
        if (bx >= fx && by >= fy && bx + bw <= fx + fw && by + bh <= fy + fh) {
          containedBy = f.id;
          break;
        }
      }

      if (containedBy !== block.parentId) {
        batch.push({ id: block.id, updates: { parentId: containedBy } });
      }
    }

    if (batch.length > 0) {
      useStore.getState().updateCanvasBlocks(batch);
    }

    const updatedBlocks = useStore.getState().blocks;
    history.push(updatedBlocks.filter(x => x.canvasId === entity.id));
  }, [selectedIds, entity.id, history]);

  // Drag-over detection for frame drop target highlighting — fully-inside test on the
  // dragged block's live (in-progress) bounds, mirroring handleDragCommit's containment rule.
  // No nesting, so first match wins (no innermost-area scan needed).
  const handleDragMove = useCallback((dx: number, dy: number, _e: PointerEvent) => {
    const currentHovered = hoveredFrameRef.current;
    const allBlocks = useStore.getState().blocks;
    const frames = allBlocks.filter(b => b.canvasId === entity.id && b.type === 'frame');

    let found: string | null = null;
    for (const id of selectedIds) {
      const block = allBlocks.find(b => b.id === id);
      if (!block || block.type === 'frame') continue;
      const bx = (block.x ?? 0) + dx, by = (block.y ?? 0) + dy;
      const bw = block.width ?? 0, bh = block.height ?? 0;
      for (const f of frames) {
        const fx = f.x ?? 0, fy = f.y ?? 0, fw = f.width ?? 0, fh = f.height ?? 0;
        if (bx >= fx && by >= fy && bx + bw <= fx + fw && by + bh <= fy + fh) {
          found = f.id;
          break;
        }
      }
      if (found) break;
    }

    if (found !== currentHovered) {
      hoveredFrameRef.current = found;
      setHoveredFrameId(found);
    }
  }, [entity.id, selectedIds]);

  // Alt+drag duplicate: leave a stationary copy of the dragged blocks behind (offset 0 —
  // it sits exactly under the originals) and keep selection + the actual drag on the
  // originals, which is what useDrag's cached-DOM-node transform trick requires (see its
  // onAltDuplicate doc comment). Net visual effect matches "drag creates a copy": one set
  // stays put, the other moves under the pointer.
  //
  // Duplicates the IDS USE DRAG IS ACTUALLY DRAGGING (its `dragIds`), not the component's
  // `selectedIds` state — those can diverge: (1) the group-overlay path calls
  // `setSelectedIds(...)` then `startDrag(e, ...)` synchronously in the same handler, so this
  // callback's closed-over `selectedIds` would still be the PREVIOUS selection until React
  // re-renders; (2) dragging an unselected arrow via `handleArrowDrag` doesn't touch selection
  // at all, so `selectedIds` could be unrelated to what's being dragged.
  const handleAltDuplicate = useCallback((draggedIds: string[]) => {
    if (draggedIds.length === 0) return;
    duplicateBlocks(draggedIds, { dx: 0, dy: 0 });
  }, [duplicateBlocks]);

  const { startDrag } = useDrag({
    viewportRef,
    blocks: pageBlocks,
    selectedIds,
    snapWithObjects,
    updateCanvasBlocks,
    onCommit: handleDragCommit,
    onDragMove: handleDragMove,
    onDragEnd: () => {
      hoveredFrameRef.current = null;
      setHoveredFrameId(null);
    },
    onAltDuplicate: handleAltDuplicate,
  });

  const handleArrowDrag = useCallback((e: React.PointerEvent, block: EditorBlock) => {
    if (e.button !== 0) return;
    startDrag(e, block);
  }, [startDrag]);

  const flowState = useFlowState();

  const commitFlowConnection = useCallback(() => {
    const { currentPath, isDrawing, clear } = useFlowState.getState();
    if (!isDrawing || currentPath.length < 2) { clear(); return; }

    const tool = activeTool === 'arrow' || activeTool === 'line' ? activeTool : 'arrow';
    const first = currentPath[0], last = currentPath[currentPath.length - 1];
    const liveBlocks = useStore.getState().blocks.filter(b => b.canvasId === entity.id);

    // Pending side-dot bindings (mode 1) captured on dot click win over free-point classification.
    const pendingStart = pendingStartBindingRef.current;
    const pendingEnd = pendingEndBindingRef.current;
    pendingStartBindingRef.current = null;
    pendingEndBindingRef.current = null;

    const startTarget = pendingStart ?? (() => {
      const b = findBindableBlockAt(first, liveBlocks);
      return b ? classifyBindingAt(first, b) : null;
    })();
    const endTarget = pendingEnd ?? (() => {
      const b = findBindableBlockAt(last, liveBlocks);
      return b ? classifyBindingAt(last, b) : null;
    })();

    addCanvasBlock({
      id: generateId(), type: 'shape', content: '', canvasId: entity.id,
      shapeKind: tool,
      startBinding: startTarget ?? undefined,
      endBinding: endTarget ?? undefined,
      points: currentPath.slice(startTarget ? 1 : 0, currentPath.length - (endTarget ? 1 : 0)),
      x: 0, y: 0, width: 0, height: 0,
      editMode: 'simple',
      startArrowhead: { type: 'none' },
      endArrowhead: tool === 'arrow' ? { type: 'filled-triangle', size: 1 } : { type: 'none' },
      canvasStyleExt: { stroke: '#d38f36', strokeWidth: 1, strokeStyle: 'solid', fill: 'transparent', fillOpacity: 0 },
    });
    clear();
    history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
  }, [activeTool, addCanvasBlock, entity.id, history]);

  const handleBindingDrag = useCallback((blockId: string, end: 'start' | 'end', e: React.PointerEvent) => {
    e.stopPropagation();
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const toCanvas = (ev: PointerEvent | React.PointerEvent): [number, number] => {
      const vp = viewportRef.current;
      return [(ev.clientX - rect.left - vp.x) / vp.scale, (ev.clientY - rect.top - vp.y) / vp.scale];
    };
    const move = (ev: PointerEvent) => {
      const p = toCanvas(ev);
      const live = useStore.getState().blocks.filter(b => b.canvasId === entity.id && b.id !== blockId);
      const target = findBindableBlockAt(p, live);
      setHoverBindTargetId(target?.id ?? null);
      // live preview: temporarily write the endpoint as a free point
      const block = useStore.getState().blocks.find(b => b.id === blockId);
      if (!block) return;
      if (end === 'start') {
        useStore.getState().updateCanvasBlock(blockId, { startBinding: undefined, points: [p, ...(block.startBinding ? (block.points ?? []) : (block.points ?? []).slice(1))] });
      } else {
        const pts = block.endBinding ? (block.points ?? []) : (block.points ?? []).slice(0, -1);
        useStore.getState().updateCanvasBlock(blockId, { endBinding: undefined, points: [...pts, p] });
      }
    };
    const up = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      setHoverBindTargetId(null);
      const p = toCanvas(ev);
      const live = useStore.getState().blocks.filter(b => b.canvasId === entity.id && b.id !== blockId);
      const target = findBindableBlockAt(p, live);
      if (target) {
        const binding = classifyBindingAt(p, target);
        const block = useStore.getState().blocks.find(b => b.id === blockId);
        if (binding && block) {
          // remove the temporary free endpoint added during preview
          const pts = end === 'start' ? (block.points ?? []).slice(1) : (block.points ?? []).slice(0, -1);
          useStore.getState().updateCanvasBlock(blockId, end === 'start' ? { startBinding: binding, points: pts } : { endBinding: binding, points: pts });
        }
      }
      history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }, [entity.id, history]);

  const handleDoubleClickBlock = useCallback((blockId: string, altKey?: boolean) => {
    const block = useStore.getState().blocks.find(b => b.id === blockId);
    if (!block) return;
    if (block.shapeKind === 'arrow' || block.shapeKind === 'line' || block.shapeKind === 'freedraw') {
      // Alt+double-click (or freedraw, which has no meaningful label position) is the
      // power-user path into waypoint editing; a plain double-click labels the arrow —
      // matches Excalidraw's double-click-to-label convention for connectors.
      if (altKey || block.shapeKind === 'freedraw') {
        useFlowState.getState().clear();
        setSelectedPointIndex(null);
        setEditingBlockId(blockId);
        setActiveTool('select');
        return;
      }
      const existing = getBoundText(blockId, useStore.getState().blocks);
      if (existing) { setEditingTextId(existing.id); return; }
      const id = generateId();
      addCanvasBlock({
        id, type: 'text', content: '', canvasId: block.canvasId, containerId: blockId,
        x: 0, y: 0, width: 20, height: 26, fontSize: 16, textAlign: 'center',
        canvasStyleExt: { stroke: 'var(--bone-100)' },
      });
      setEditingTextId(id);
      history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
    }
  }, [addCanvasBlock, entity.id, history]);

  // Shared by text-tool click and double-click-on-empty-canvas: create a transparent,
  // auto-sizing (Excalidraw-style) text block at the given canvas coords and immediately
  // enter edit mode so the caret is ready for typing.
  const createTextAt = useCallback((x: number, y: number) => {
    const id = generateId();
    addCanvasBlock({
      id, type: 'text', content: '', canvasId: entity.id,
      x, y: y - 12, width: 20, height: 26,
      fontSize: 20, textAlign: 'left',
      canvasStyleExt: { stroke: 'var(--bone-90)' },
    });
    setSelectedIds(new Set([id]));
    setEditingTextId(id);
    setActiveTool('select');
    history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
  }, [addCanvasBlock, entity.id, history]);

  const selectedBlocks = useMemo(
    () => pageBlocks.filter(b => selectedIds.has(b.id)),
    [pageBlocks, selectedIds]
  );

  const selectionBoundingBox = useMemo(() => {
    if (selectedBlocks.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedBlocks.forEach(b => {
      const isArrow = b.shapeKind === 'arrow' || b.shapeKind === 'line' || b.shapeKind === 'freedraw';
      if (isArrow && b.points?.length) {
        const resolved = resolvePoints(b, pageBlocks);
        const { minX: sMinX, minY: sMinY, maxX: sMaxX, maxY: sMaxY } = calculateSplineBounds(resolved, b.editMode, b.pointRadiuses);
        if (sMinX < minX) minX = sMinX;
        if (sMinY < minY) minY = sMinY;
        if (sMaxX > maxX) maxX = sMaxX;
        if (sMaxY > maxY) maxY = sMaxY;
      } else {
        const bx = b.x ?? 0, by = b.y ?? 0, bw = b.width ?? 0, bh = b.height ?? 0;
        const style = b.canvasStyleExt ?? {};
        const sw = (style.strokeWidth ?? 1.5) / 2;
        const rotation = style.rotation ?? 0;

        // Start with stroke-padded bounds (stroke renders half-outside geometry)
        let left = bx - sw;
        let top = by - sw;
        let right = bx + bw + sw;
        let bottom = by + bh + sw;

        // Account for rotation — compute axis-aligned bounding box of rotated rectangle
        if (rotation !== 0) {
          const cx = (left + right) / 2;
          const cy = (top + bottom) / 2;
          const hw = (right - left) / 2;
          const hh = (bottom - top) / 2;
          const rad = (rotation * Math.PI) / 180;
          const cos = Math.abs(Math.cos(rad));
          const sin = Math.abs(Math.sin(rad));
          const vhw = hw * cos + hh * sin;
          const vhh = hw * sin + hh * cos;
          left = cx - vhw;
          right = cx + vhw;
          top = cy - vhh;
          bottom = cy + vhh;
        }

        if (left < minX) minX = left;
        if (top < minY) minY = top;
        if (right > maxX) maxX = right;
        if (bottom > maxY) maxY = bottom;
      }
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [selectedBlocks, pageBlocks]);

  const handleDuplicateSelection = useCallback(() => {
    if (selectedBlocks.length === 0) return;
    const newIds = duplicateBlocks(selectedBlocks.map(b => b.id), { dx: 20, dy: 20 });
    setSelectedIds(new Set(newIds));
    history.push(useStore.getState().blocks.filter(x => x.canvasId === entity.id));
  }, [selectedBlocks, duplicateBlocks, entity.id, history]);

  const handleLayerOrder = useCallback((direction: 'front' | 'back') => {
    if (selectedBlocks.length === 0) return;
    const canvasBlocks = pageBlocks;
    const zIndexes = canvasBlocks.map(b => b.zIndex ?? 0);
    const maxZ = Math.max(...zIndexes, 0);
    const minZ = Math.min(...zIndexes, 0);

    const batchUpdates: { id: string; updates: Partial<EditorBlock> }[] = [];
    selectedBlocks.forEach((b, idx) => {
      const newZ = direction === 'front' ? maxZ + 1 + idx : minZ - 1 - (selectedBlocks.length - 1 - idx);
      batchUpdates.push({ id: b.id, updates: { zIndex: newZ } });
    });

    updateCanvasBlocks(batchUpdates);
    history.push(useStore.getState().blocks.filter(x => x.canvasId === entity.id));
  }, [selectedBlocks, pageBlocks, updateCanvasBlocks, entity.id, history]);

  const handleQuickColor = useCallback((fillColor: string, opacity: number) => {
    if (selectedBlocks.length === 0) return;
    const batchUpdates: { id: string; updates: Partial<EditorBlock> }[] = [];
    selectedBlocks.forEach(b => {
      batchUpdates.push({
        id: b.id,
        updates: {
          canvasStyleExt: {
            ...(b.canvasStyleExt ?? {}),
            fill: fillColor,
            fillOpacity: opacity,
          }
        }
      });
    });
    updateCanvasBlocks(batchUpdates);
    history.push(useStore.getState().blocks.filter(x => x.canvasId === entity.id));
  }, [selectedBlocks, updateCanvasBlocks, entity.id, history]);

  const handleDeleteSelection = useCallback(() => {
    if (selectedIds.size === 0) return;
    selectedIds.forEach(id => deleteCanvasBlock(id));
    setSelectedIds(new Set());
    history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
  }, [selectedIds, deleteCanvasBlock, entity.id, history]);

  // Template literal for history push reused in group resize
  const commitHistory = useCallback(() => {
    history.push(useStore.getState().blocks.filter(x => x.canvasId === entity.id));
  }, [history, entity.id]);

  const handleGroupResizeStart = useCallback((handle: HandlePosition, e: React.PointerEvent) => {
    if (selectedBlocks.length < 2 || !selectionBoundingBox) return;
    e.stopPropagation();
    e.preventDefault();

    const box = selectionBoundingBox;
    const scale = viewport.scale;

    // Capture initial state of all selected blocks
    const snapshots: GroupResizeSnapshot[] = selectedBlocks.map(b => ({
      id: b.id,
      x: b.x ?? 0,
      y: b.y ?? 0,
      w: b.width ?? 0,
      h: b.height ?? 0,
      points: b.points ? JSON.parse(JSON.stringify(b.points)) : null,
    }));

    groupResizeRef.current = { initBox: { ...box }, snapshots, handle };

    const startX = e.clientX;
    const startY = e.clientY;

    // Cache DOM elements for direct manipulation during move
    const domCache: { id: string; el: HTMLElement | SVGElement }[] = [];
    selectedBlocks.forEach(b => {
      const el = document.getElementById(b.id);
      if (el) domCache.push({ id: b.id, el });
    });

    // RAF throttle for smooth updates
    let rafId: number | null = null;

    const handleMove = (moveEvent: PointerEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;

        const snap = groupResizeRef.current;
        if (!snap) return;

        const dx = (moveEvent.clientX - startX) / scale;
        const dy = (moveEvent.clientY - startY) / scale;
        const { initBox, snapshots: snaps } = snap;

        // Compute new bounding box
        let newX = initBox.x, newY = initBox.y;
        let newW = initBox.w, newH = initBox.h;

        if (handle.includes('w')) { newX = initBox.x + dx; newW = initBox.w - dx; }
        if (handle.includes('e')) { newW = initBox.w + dx; }
        if (handle.includes('n')) { newY = initBox.y + dy; newH = initBox.h - dy; }
        if (handle.includes('s')) { newH = initBox.h + dy; }

        if (newW < 60) { newW = 60; }
        if (newH < 40) { newH = 40; }

        const scaleX = newW / initBox.w;
        const scaleY = newH / initBox.h;

        // Update multi-selection box border in DOM
        const boxEl = document.getElementById('multi-selection-box');
        if (boxEl) {
          boxEl.style.left = `${newX}px`;
          boxEl.style.top = `${newY}px`;
          boxEl.style.width = `${newW}px`;
          boxEl.style.height = `${newH}px`;
        }

        // Update each block's DOM directly
        domCache.forEach(({ id, el }) => {
          const s = snaps.find(x => x.id === id);
          if (!s) return;

          if (s.points) {
            // Arrows: scale points relative to box — just store active offset for VectorPath to pick up
            activeDragOffsets.set(id, { dx: 0, dy: 0, startPoints: s.points });
            // SVG path elements get updated in real-time by the VectorPath component reading activeDragOffsets
          } else {
            // Regular blocks: scale position and size
            const bx = newX + (s.x - initBox.x) * scaleX;
            const by = newY + (s.y - initBox.y) * scaleY;
            const bw = Math.max(s.w * scaleX, 10);
            const bh = Math.max(s.h * scaleY, 10);

            if (el instanceof HTMLElement && !(el instanceof SVGElement)) {
              el.style.left = `${bx}px`;
              el.style.top = `${by}px`;
              el.style.width = `${bw}px`;
              el.style.height = `${bh}px`;
            } else if (el instanceof SVGElement) {
              // SVG shapes: update child element attributes
              const rectEl = el.querySelector('rect');
              if (rectEl) {
                rectEl.setAttribute('x', String(bx));
                rectEl.setAttribute('y', String(by));
                rectEl.setAttribute('width', String(bw));
                rectEl.setAttribute('height', String(bh));
              }
              const ellipseEl = el.querySelector('ellipse');
              if (ellipseEl) {
                ellipseEl.setAttribute('cx', String(bx + bw / 2));
                ellipseEl.setAttribute('cy', String(by + bh / 2));
                ellipseEl.setAttribute('rx', String(bw / 2));
                ellipseEl.setAttribute('ry', String(bh / 2));
              }
              const polygonEl = el.querySelector('polygon');
              if (polygonEl) {
                polygonEl.setAttribute('points',
                  `${bx + bw / 2},${by} ${bx + bw},${by + bh / 2} ${bx + bw / 2},${by + bh} ${bx},${by + bh / 2}`
                );
              }
            }
          }
        });
      });
    };

    const handleUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;

      const snap = groupResizeRef.current;
      if (!snap) return;
      groupResizeRef.current = null;

      // Read final bounding box position from DOM
      const boxEl = document.getElementById('multi-selection-box');
      if (!boxEl) return;

      const finalLeft = parseFloat(boxEl.style.left);
      const finalTop = parseFloat(boxEl.style.top);
      const finalW = parseFloat(boxEl.style.width);
      const finalH = parseFloat(boxEl.style.height);
      if (isNaN(finalLeft) || isNaN(finalTop) || isNaN(finalW) || isNaN(finalH) || finalW === 0 || finalH === 0) return;

      // Clear active drag offsets for arrows
      snap.snapshots.forEach(s => {
        if (s.points) activeDragOffsets.delete(s.id);
      });

      const { initBox, snapshots: snaps } = snap;
      const scaleX = finalW / initBox.w;
      const scaleY = finalH / initBox.h;

      // Build batch commit from final DOM state
      const batch: { id: string; updates: Partial<EditorBlock> }[] = [];
      snaps.forEach(s => {
        if (s.points) {
          const newPoints = s.points.map(p => [
            finalLeft + (p[0] - initBox.x) * scaleX,
            finalTop + (p[1] - initBox.y) * scaleY,
          ] as [number, number]);
          batch.push({ id: s.id, updates: { points: newPoints } });
        } else {
          const bx = finalLeft + (s.x - initBox.x) * scaleX;
          const by = finalTop + (s.y - initBox.y) * scaleY;
          const bw = Math.max(s.w * scaleX, 10);
          const bh = Math.max(s.h * scaleY, 10);
          batch.push({ id: s.id, updates: { x: bx, y: by, width: bw, height: bh } });
        }
      });

      if (batch.length > 0) {
        updateCanvasBlocks(batch);
      }

      commitHistory();
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }, [selectedBlocks, selectionBoundingBox, viewport, updateCanvasBlocks, commitHistory]);

  const handleGroupRotateStart = useCallback((e: React.PointerEvent) => {
    if (selectedBlocks.length < 2 || !selectionBoundingBox) return;
    e.stopPropagation();
    e.preventDefault();

    const box = selectionBoundingBox;
    const scale = viewport.scale;
    const vx = viewport.x;
    const vy = viewport.y;

    // Group center in canvas space
    const groupCx = box.x + box.w / 2;
    const groupCy = box.y + box.h / 2;

    // Capture each block's initial state and its offset from group center
    const snapshots: {
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      rotation: number;
      relCx: number; // center X relative to group center
      relCy: number; // center Y relative to group center
    }[] = selectedBlocks.map(b => {
      const bx = b.x ?? 0, by = b.y ?? 0;
      const bw = b.width ?? 0, bh = b.height ?? 0;
      return {
        id: b.id,
        x: bx, y: by, w: bw, h: bh,
        rotation: b.canvasStyleExt?.rotation ?? 0,
        relCx: bx + bw / 2 - groupCx,
        relCy: by + bh / 2 - groupCy,
      };
    });

    // Screen-space center of group for angle calculation
    const screenCx = groupCx * scale + vx;
    const screenCy = groupCy * scale + vy;
    const startAngle = Math.atan2(e.clientY - screenCy, e.clientX - screenCx) + Math.PI / 2;

    // Cache DOM elements for direct manipulation — SVG <g> (shape) AND HTML <div> (tooltips/content)
    const domCache: { id: string; el: HTMLElement | SVGElement }[] = [];
    selectedBlocks.forEach(b => {
      const all = document.querySelectorAll(`[id="${b.id}"]`);
      all.forEach(el => {
        if (el instanceof HTMLElement || el instanceof SVGElement) {
          domCache.push({ id: b.id, el });
        }
      });
    });

    let rafId: number | null = null;
    const finalDeltaRef = { deg: 0 };

    const handleMove = (moveEvent: PointerEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;

        const currentAngle = Math.atan2(moveEvent.clientY - screenCy, moveEvent.clientX - screenCx) + Math.PI / 2;
        let deltaDeg = ((currentAngle - startAngle) * 180) / Math.PI;
        if (moveEvent.shiftKey) deltaDeg = Math.round(deltaDeg / 45) * 45;
        finalDeltaRef.deg = deltaDeg;

        // Pre-compute trig once per frame (not per block)
        const rad = (deltaDeg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // Update each block's DOM element — use single transform to avoid layout thrashing
        domCache.forEach(({ id, el }) => {
          const snap = snapshots.find(s => s.id === id);
          if (!snap) return;

          // Rotate block center around group center
          const newRelCx = snap.relCx * cos - snap.relCy * sin;
          const newRelCy = snap.relCx * sin + snap.relCy * cos;

          // New position and rotation for this block
          const newX = groupCx + newRelCx - snap.w / 2;
          const newY = groupCy + newRelCy - snap.h / 2;
          let newRotation = (snap.rotation + deltaDeg) % 360;

          // Combine translation and rotation in one transform (avoids layout thrashing)
          const dx = newX - snap.x;
          const dy = newY - snap.y;
          el.style.transform = `translate(${dx}px, ${dy}px) rotate(${newRotation}deg)`;

          // Update activeDragOffsets so the style panel shows live rotation
          if (el instanceof HTMLElement) {
            activeDragOffsets.set(id, { dx: 0, dy: 0, rotation: newRotation });
          }
        });

        // Update rotation label tooltips and multi-selection box transform
        const boxEl = document.getElementById('multi-selection-box');
        if (boxEl) {
          boxEl.style.transform = `rotate(${deltaDeg}deg)`;
        }

        // Update rotation labels in the HTML block containers
        domCache.forEach(({ id, el }) => {
          const snap = snapshots.find(s => s.id === id);
          if (!snap) return;
          if (el instanceof HTMLElement && el.tagName === 'DIV') {
            const label = el.querySelector('.rotation-label');
            if (label) {
              const newRotation = (snap.rotation + deltaDeg) % 360;
              label.textContent = `${Math.round(((newRotation % 360) + 360) % 360)}°`;
            }
          }
        });
      });
    };

    const handleUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;

      // Pre-compute trig once
      const rad = (finalDeltaRef.deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      // Build batch commit with both position and rotation
      const batch: { id: string; updates: Partial<EditorBlock> }[] = [];
      snapshots.forEach(s => {
        const newRelCx = s.relCx * cos - s.relCy * sin;
        const newRelCy = s.relCx * sin + s.relCy * cos;
        const newX = groupCx + newRelCx - s.w / 2;
        const newY = groupCy + newRelCy - s.h / 2;
        let newRotation = ((s.rotation + finalDeltaRef.deg) % 360 + 360) % 360;
        if (newRotation > 180) newRotation -= 360;

        const block = selectedBlocks.find(b => b.id === s.id);
        batch.push({
          id: s.id,
          updates: {
            x: newX,
            y: newY,
            canvasStyleExt: {
              ...(block?.canvasStyleExt ?? {}),
              rotation: newRotation,
            },
          },
        });
      });

      if (batch.length > 0) updateCanvasBlocks(batch);
      commitHistory();

      // Clean up activeDragOffsets set during move
      snapshots.forEach(s => activeDragOffsets.delete(s.id));

      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }, [selectedBlocks, selectionBoundingBox, viewport, updateCanvasBlocks, commitHistory]);

  useEffect(() => {
    const isShapeTool = ['rect', 'ellipse', 'diamond', 'freedraw', 'line', 'arrow'].includes(activeTool);
    if (selectedIds.size > 0 || isShapeTool) {
      setShowStylePanel(true);
    }
  }, [selectedIds, activeTool]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); handleUndo(); return; }
        if (e.key === 'y' || (e.shiftKey && e.key === 'z')) { e.preventDefault(); handleRedo(); return; }
        if (e.key === 'g') {
          e.preventDefault();
          e.shiftKey ? handleUngroup() : handleGroup();
          return;
        }
        if (e.key === 'd') {
          e.preventDefault();
          handleDuplicateSelection();
          return;
        }
      }

      // Escape chain: text/label editing is handled at the input level (CanvasTextElement /
      // the label <input> both stopPropagation on Escape and blur themselves), so by the time
      // Escape reaches this window-level handler, editing is never text/label. Remaining steps,
      // in priority order: exit waypoint-edit → back to select tool → clear selection.
      if (e.key === 'Escape') {
        e.preventDefault();
        if (editingBlockId) {
          setEditingBlockId(null);
          setSelectedPointIndex(null);
        } else if (activeTool !== 'select' && activeTool !== 'move') {
          setActiveTool('select');
        } else if (selectedIds.size > 0) {
          setSelectedIds(new Set());
        }
        return;
      }

      // Arrow-key nudge: 1px, or 10px with Shift. Skipped entirely if nothing is selected.
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.size > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const updates = useStore.getState().blocks
          .filter(b => selectedIds.has(b.id))
          .map(b => {
            const isLinear = b.type === 'shape' && ['arrow', 'line', 'freedraw'].includes(b.shapeKind ?? '');
            return isLinear
              ? { id: b.id, updates: { points: (b.points ?? []).map(([px, py]) => [px + dx, py + dy] as [number, number]) } }
              : { id: b.id, updates: { x: (b.x ?? 0) + dx, y: (b.y ?? 0) + dy } };
          });
        updateCanvasBlocks(updates);
        scheduleNudgeHistoryPush();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select');
          break;
        case 'h': setActiveTool('move'); break;
        case 'r': setActiveTool('rect'); break;
        case 'o': setActiveTool('ellipse'); break;
        case 'd': setActiveTool('diamond'); break;
        case 'a': setActiveTool('arrow'); break;
        case 'l': setActiveTool('line'); break;
        case 'p': setActiveTool('freedraw'); break;
        case 't': setActiveTool('text'); break;
        case 'i': setActiveTool('image'); break;
        case 'f': setActiveTool('frame'); break;
        case 'e': setActiveTool('eraser'); break;
        case ' ':
          spaceHeldRef.current = true;
          e.preventDefault();
          break;
        case 'delete': case 'backspace':
          selectedIds.forEach(id => deleteCanvasBlock(id));
          setSelectedIds(new Set());
          history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
          break;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ') spaceHeldRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [selectedIds, activeTool, editingBlockId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setViewport(prev => {
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.scale + delta));
        const ratio = newScale / prev.scale;
        return { x: mx - ratio * (mx - prev.x), y: my - ratio * (my - prev.y), scale: newScale };
      });
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // Active Click-and-Flow dynamic path engine tracker
  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
      if (!useFlowState.getState().isDrawing) return;
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      useFlowState.getState().updateMouse({ x, y });
    };

    const handleGlobalKey = (e: KeyboardEvent) => {
      if (!useFlowState.getState().isDrawing) return;
      if (e.key === 'Enter') {
        commitFlowConnection();
      } else if (e.key === 'Escape') {
        useFlowState.getState().clear();
      }
    };

    const handleGlobalContextMenu = (e: MouseEvent) => {
      if (useFlowState.getState().isDrawing) {
        e.preventDefault();
        e.stopPropagation();
        commitFlowConnection();
      }
    };

    document.addEventListener('mousemove', handleGlobalMove);
    document.addEventListener('keydown', handleGlobalKey);
    document.addEventListener('contextmenu', handleGlobalContextMenu, true);
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMove);
      document.removeEventListener('keydown', handleGlobalKey);
      document.removeEventListener('contextmenu', handleGlobalContextMenu, true);
    };
  }, [commitFlowConnection]);

  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewportRef.current.x) / viewportRef.current.scale,
      y: (clientY - rect.top - viewportRef.current.y) / viewportRef.current.scale,
    };
  }, []);

  // Cloud sync: load remote blocks and subscribe to realtime updates
  useEffect(() => {
    if (!cloudSyncEnabled) return;
    let isMounted = true;

    loadCanvasBlocks(entity.id).then(remoteBlocks => {
      if (!isMounted || remoteBlocks.length === 0) return;
      const others = useStore.getState().blocks.filter(b => b.canvasId !== entity.id);
      useStore.setState({ blocks: [...others, ...remoteBlocks] });
    });

    const unsub = subscribeCanvasBlocks(
      entity.id,
      () => useStore.getState().blocks.filter(b => b.canvasId === entity.id),
      (updated) => {
        const others = useStore.getState().blocks.filter(b => b.canvasId !== entity.id);
        useStore.setState({ blocks: [...others, ...updated] });
      }
    );

    return () => {
      isMounted = false;
      unsub();
    };
  }, [entity.id, cloudSyncEnabled]);

  // Live cursors: subscribe to broadcast cursor events from other users
  useEffect(() => {
    if (!cloudSyncEnabled || !supabase) return;

    const COLORS = ['#5b9cf6', '#a78bfa', '#4ade80', '#f87171', '#f59e0b', '#ec4899'];
    const colorMap = new Map<string, string>();

    const channel = supabase.channel(`cursors:${entity.id}`, {
      config: { presence: { key: 'me' } },
    })
      .on('broadcast', { event: 'cursor' }, ({ payload }: { payload: { userId?: string; name?: string; x: number; y: number } }) => {
        const uid = payload.userId ?? 'unknown';
        if (!colorMap.has(uid)) colorMap.set(uid, COLORS[colorMap.size % COLORS.length]);
        setRemoteCursors(prev => {
          const filtered = prev.filter(c => c.userId !== uid);
          return [...filtered, { userId: uid, name: payload.name ?? 'User', x: payload.x, y: payload.y, color: colorMap.get(uid)! }];
        });
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [entity.id, cloudSyncEnabled]);

  // Subscribe to activeDragOffsets for live multi-selection bounding box movement during drag
  // Uses direct DOM manipulation (no React state updates) matching the existing drag pattern
  // On drag end, NEVER clear transform here — React's re-render will fire, and
  // MultiSelectionBox's useLayoutEffect cleans up the stale transform before paint.
  // This avoids a teleport flicker from clearing the transform before the re-render.
  useEffect(() => {
    const unsub = useDragState.subscribe((state) => {
      const keys = Object.keys(state.offsets);
      const boxEl = document.getElementById('multi-selection-box');
      if (!boxEl || keys.length === 0) return;

      // All dragged items share the same dx/dy — read from the first one
      const offset = state.offsets[keys[0]];
      const dx = offset.dx || 0;
      const dy = offset.dy || 0;
      boxEl.style.transform = (dx || dy) ? `translate(${dx}px, ${dy}px)` : '';
    });
    return unsub;
  }, []);

  function handleUndo() {
    const prev = history.undo();
    if (prev) {
      const currentBlocks = useStore.getState().blocks;
      const others = currentBlocks.filter(b => b.canvasId !== entity.id);
      useStore.setState({ blocks: [...others, ...prev] });
    }
  }

  function handleRedo() {
    const next = history.redo();
    if (next) {
      const currentBlocks = useStore.getState().blocks;
      const others = currentBlocks.filter(b => b.canvasId !== entity.id);
      useStore.setState({ blocks: [...others, ...next] });
    }
  }

  function handleGroup() {
    if (selectedIds.size < 2) return;
    const groupId = generateId();
    selectedIds.forEach(id => updateCanvasBlock(id, { groupId }));
    history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
  }

  function handleUngroup() {
    selectedIds.forEach(id => {
      const b = blocks.find(x => x.id === id);
      if (b?.groupId) updateCanvasBlock(id, { groupId: undefined });
    });
    history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
  }

  function alignBlocks(axis: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom') {
    const sel = pageBlocks.filter(b => selectedIds.has(b.id));
    if (sel.length < 2) return;
    const xs = sel.map(b => b.x ?? 0), ys = sel.map(b => b.y ?? 0);
    const rights = sel.map(b => (b.x ?? 0) + (b.width ?? 0));
    const bottoms = sel.map(b => (b.y ?? 0) + (b.height ?? 0));
    const minX = Math.min(...xs), maxRight = Math.max(...rights);
    const minY = Math.min(...ys), maxBottom = Math.max(...bottoms);
    sel.forEach(b => {
      switch (axis) {
        case 'left':    updateCanvasBlock(b.id, { x: minX }); break;
        case 'centerH': updateCanvasBlock(b.id, { x: (minX + maxRight) / 2 - (b.width ?? 0) / 2 }); break;
        case 'right':   updateCanvasBlock(b.id, { x: maxRight - (b.width ?? 0) }); break;
        case 'top':     updateCanvasBlock(b.id, { y: minY }); break;
        case 'centerV': updateCanvasBlock(b.id, { y: (minY + maxBottom) / 2 - (b.height ?? 0) / 2 }); break;
        case 'bottom':  updateCanvasBlock(b.id, { y: maxBottom - (b.height ?? 0) }); break;
      }
    });
    history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
  }

  const handleBgPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.id !== 'canvas-bg' && !target.closest('#canvas-bg')) return;

    if (editingBlockId && e.target === e.currentTarget) {
      setEditingBlockId(null);
      setSelectedPointIndex(null);
    }

    if (mediaPopover) { setMediaPopover(null); return; }

    setShowFloatingToolbar(false);

    // Ignore background click handler if clicking a block (only in selection/move mode)
    const isSelectionTool = activeTool === 'select' || activeTool === 'move';
    if (
      target.closest('.ResizeHandle') ||
      (isSelectionTool && target.closest('[id]') && pageBlocks.some(b => b.id === target.closest('[id]')?.id))
    ) {
      return;
    }

    const shouldPan = spaceHeldRef.current || activeTool === 'move' || e.button === 1;
    if (shouldPan) {
      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y };
      const onMove = (ev: PointerEvent) => {
        if (!isPanningRef.current) return;
        setViewport(prev => ({
          ...prev,
          x: panStartRef.current.vx + (ev.clientX - panStartRef.current.x),
          y: panStartRef.current.vy + (ev.clientY - panStartRef.current.y),
        }));
      };
      const onUp = () => {
        isPanningRef.current = false;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      return;
    }

    if (activeTool === 'eraser' && e.button === 0) {
      const toCanvas = (ev: PointerEvent): [number, number] => {
        const { x, y } = screenToCanvas(ev.clientX, ev.clientY);
        return [x, y];
      };
      handleEraserDown(toCanvas, e.nativeEvent);
      return;
    }

    if (activeTool === 'select' && e.button === 0) {
      setSelectedIds(new Set());
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      multiSelect.startSelection(x, y);

      const onMove = (ev: PointerEvent) => {
        const { x: cx, y: cy } = screenToCanvas(ev.clientX, ev.clientY);
        multiSelect.updateSelection(cx, cy);
        // LIVE SYNC: Realtime visual feedback during drag selection
        setSelectedIds(new Set(multiSelect.getLatestSelectedIds()));
      };
      const onUp = () => {
        setSelectedIds(new Set(multiSelect.getLatestSelectedIds()));
        multiSelect.endSelection();
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      return;
    }

    // CLICK AND FLOW SYSTEM: Sequential Multi-segment Spline Drawing
    if ((activeTool === 'arrow' || activeTool === 'line') && e.button === 0) {
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      const { isDrawing, addPoint, setDrawing } = useFlowState.getState();
      
      if (!isDrawing) {
        // Fresh stroke started from empty canvas — clear any stale pending binding left
        // over from a previous stroke that was abandoned (Escape / double-click-to-edit)
        // without going through commitFlowConnection's own reset.
        pendingStartBindingRef.current = null;
        pendingEndBindingRef.current = null;
        setDrawing(true);
        addPoint([x, y]);
        useFlowState.getState().updateMouse({ x, y });
      } else {
        // Auto-finish: clicking inside a bindable block's bind zone (inside or near its
        // outline) ends the stroke there, classified via the same 3-mode logic as any
        // other free-point release.
        const liveBlocks = useStore.getState().blocks.filter(b => b.canvasId === entity.id);
        const target = findBindableBlockAt([x, y], liveBlocks);
        if (target) {
          addPoint([x, y]);
          useFlowState.getState().updateMouse({ x, y });
          commitFlowConnection();
          return;
        }
        addPoint([x, y]);
        useFlowState.getState().updateMouse({ x, y });
      }
      return;
    }

    const SHAPE_TOOLS = ['rect', 'ellipse', 'diamond', 'freedraw', 'frame'];
    if (SHAPE_TOOLS.includes(activeTool) && e.button === 0) {
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      const kind = activeTool;
      let currentShape = { kind, startX: x, startY: y, x, y, w: 0, h: 0, points: [[x, y]] as [number, number][] };
      setDrawingShape(currentShape);

      const onMove = (ev: PointerEvent) => {
        const { x: cx, y: cy } = screenToCanvas(ev.clientX, ev.clientY);
        if (kind === 'freedraw' || kind === 'line' || kind === 'arrow') {
          currentShape = { ...currentShape, points: [...currentShape.points, [cx, cy]], w: cx - currentShape.startX, h: cy - currentShape.startY };
        } else {
          let dx = cx - currentShape.startX;
          let dy = cy - currentShape.startY;
          if (ev.shiftKey) {
            const size = Math.max(Math.abs(dx), Math.abs(dy));
            dx = Math.sign(dx) * size;
            dy = Math.sign(dy) * size;
          }
          const nx = dx < 0 ? currentShape.startX + dx : currentShape.startX;
          const ny = dy < 0 ? currentShape.startY + dy : currentShape.startY;
          currentShape = { ...currentShape, x: nx, y: ny, w: Math.abs(dx), h: Math.abs(dy) };
        }
        setDrawingShape(currentShape);
      };

      const onUp = (ev: PointerEvent) => {
        const { x: cx, y: cy } = screenToCanvas(ev.clientX, ev.clientY);
        
        let finalW = currentShape.w;
        let finalH = currentShape.h;
        let finalX = currentShape.x;
        let finalY = currentShape.y;

        const isLineish = kind === 'line' || kind === 'arrow' || kind === 'freedraw';
        
        if (!isLineish && ev.shiftKey) {
          let dx = cx - currentShape.startX;
          let dy = cy - currentShape.startY;
          const size = Math.max(Math.abs(dx), Math.abs(dy));
          dx = Math.sign(dx) * size;
          dy = Math.sign(dy) * size;
          finalX = dx < 0 ? currentShape.startX + dx : currentShape.startX;
          finalY = dy < 0 ? currentShape.startY + dy : currentShape.startY;
          finalW = Math.abs(dx);
          finalH = Math.abs(dy);
        }

        const isPoint = Math.abs(cx - currentShape.startX) < 3 && Math.abs(cy - currentShape.startY) < 3;

        if (kind === 'frame') {
          // Frame: drag to set size, or click for default
          const newBlockId = generateId();
          addCanvasBlock({
            id: newBlockId, type: 'frame', content: '', canvasId: entity.id,
            x: isPoint ? currentShape.startX : finalX,
            y: isPoint ? currentShape.startY : finalY,
            width: isPoint ? 300 : Math.max(finalW, 60),
            height: isPoint ? 200 : Math.max(finalH, 40),
            canvasStyleExt: {
              fill: undefined,
              fillOpacity: 0,
              stroke: undefined,
              strokeWidth: 1,
              cornerRadius: 0,
            },
          });
          setSelectedIds(new Set([newBlockId]));
          history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
        } else if (!isPoint) {
          const newBlockId = generateId();
          addCanvasBlock({
            id: newBlockId, type: 'shape', content: '', canvasId: entity.id,
            shapeKind: kind as any,
            x: isLineish ? 0 : finalX, y: isLineish ? 0 : finalY,
            width: isLineish ? 0 : Math.max(finalW, 20),
            height: isLineish ? 0 : Math.max(finalH, 20),
            points: isLineish ? currentShape.points : undefined,
            canvasStyleExt: {
              ...activeStyle,
              fill: isLineish ? 'transparent' : activeStyle.fill,
              fillOpacity: isLineish ? 0 : activeStyle.fillOpacity,
            },
          });
          setSelectedIds(new Set([newBlockId]));
          history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
        }
        
        setDrawingShape(null);
        setActiveTool('select');
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      return;
    }

    const { x, y } = screenToCanvas(e.clientX, e.clientY);

    if (activeTool === 'text') {
      createTextAt(x, y);
    } else if (activeTool === 'image') {
      setMediaPopover({ x: e.clientX, y: e.clientY, canvasX: x, canvasY: y });
    }
  };

  // Double-click on truly empty canvas (not on a block) drops a text caret, Excalidraw-style.
  // Blocks that don't already stopPropagation their own double-click (image/video/frame) would
  // otherwise bubble here, so explicitly ignore double-clicks landing on any known block element.
  const handleBgDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.id !== 'canvas-bg' && !target.closest('#canvas-bg')) return;
    if (target.closest('.ResizeHandle')) return;
    if (target.closest('[id]') && pageBlocks.some(b => b.id === target.closest('[id]')?.id)) return;
    // By the time a dblclick fires, a preceding text-tool click has already flipped
    // activeTool to 'select' (see createTextAt), so only 'select'/'move' are relevant here.
    if (activeTool !== 'select' && activeTool !== 'move') return;
    // Guard against the text-tool-click + dblclick combo: the first click of the double-click
    // already created+entered-edit a text block via createTextAt. Without this, the second
    // click of the same dblclick deselects (deleting that still-empty block) and then the
    // dblclick handler creates a fresh one — net a no-op but it churns two extra history pushes.
    if (editingTextId) return;

    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    createTextAt(x, y);
  };

  function selectBlock(id: string, addToSelection: boolean) {
    setShowFloatingToolbar(false);
    const block = blocks.find(b => b.id === id);
    if (addToSelection) {
      // When shift-clicking a group member, add/toggle the entire group
      if (block?.groupId) {
        const groupMembers = blocks.filter(b => b.groupId === block.groupId);
        setSelectedIds(prev => {
          const next = new Set(prev);
          const allSelected = groupMembers.every(m => next.has(m.id));
          groupMembers.forEach(m => allSelected ? next.delete(m.id) : next.add(m.id));
          // Also toggle the clicked block
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        });
      } else {
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.has(id) ? next.delete(id) : next.add(id);
          return next;
        });
      }
    } else {
      if (block?.groupId) {
        const groupMembers = blocks.filter(b => b.groupId === block.groupId);
        const allSelected = selectedIds.size > 0 && groupMembers.every(m => selectedIds.has(m.id));
        if (allSelected) {
          // Group is fully selected → clicking an individual selects just that item
          setSelectedIds(new Set([id]));
        } else {
          // Select all group members
          setSelectedIds(new Set(groupMembers.map(m => m.id)));
        }
      } else {
        setSelectedIds(new Set([id]));
      }
    }
  }

  // Group overlay: click anywhere in the group bounding box to select & drag all members
  const handleGroupOverlayPointerDown = useCallback((e: React.PointerEvent, members: EditorBlock[]) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    // Select all group members immediately
    setSelectedIds(new Set(members.map(m => m.id)));
    // Start drag on the first member; fix #12 in useDrag ensures all group members are included
    startDrag(e, members[0]);
  }, [startDrag]);

  const handleBlockContextMenu = useCallback((e: React.MouseEvent, blockId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedIds.has(blockId)) {
      setSelectedIds(new Set([blockId]));
    }
    setShowFloatingToolbar(true);
  }, [selectedIds]);

  // Shared render path for a single CanvasBlock — used both by the top-level layer and by
  // each section's clipped-children layer, so bound labels, selection, and drag all resolve
  // identically regardless of which DOM layer a block currently renders in.
  const renderBlock = useCallback((b: EditorBlock) => (
    <CanvasBlock
      key={b.id}
      block={b}
      activeTool={activeTool}
      viewport={viewport}
      snapWithObjects={snapWithObjects}
      snapForResize={snapForResize}
      isSelected={selectedIds.has(b.id)}
      selectedIds={selectedIds}
      onSelect={selectBlock}
      onCommit={handleDragCommit}
      onContextMenu={handleBlockContextMenu}
      hoveredFrameId={hoveredFrameId}
      onDragMove={handleDragMove}
      bindHighlight={hoverBindTargetId === b.id && (activeTool === 'arrow' || activeTool === 'line')}
      erasing={eraserMarkedIds.has(b.id)}
      forceEditing={editingTextId === b.id}
      onEditingEnded={() => setEditingTextId(null)}
      onRequestLabelEdit={(textBlockId) => setEditingTextId(textBlockId)}
      onSideDotDown={(side, x, y) => {
        if (activeTool !== 'arrow' && activeTool !== 'line') return;

        const binding = sideCenterBinding(b, side);
        const { isDrawing, addPoint, setDrawing } = useFlowState.getState();
        // Immediate initialization directly tied into the clicked coordinate
        if (!isDrawing) {
          pendingStartBindingRef.current = binding;
          setDrawing(true);
          addPoint([x, y]);
        } else {
          pendingEndBindingRef.current = binding;
          addPoint([x, y]);
          commitFlowConnection();
        }
      }}
    />
  ), [activeTool, viewport, snapWithObjects, snapForResize, selectedIds, handleDragCommit, handleBlockContextMenu, hoveredFrameId, handleDragMove, hoverBindTargetId, editingTextId, commitFlowConnection, eraserMarkedIds]);

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col bg-[var(--app-background)]">
      <CanvasToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
      />

      <div className="flex-1 relative overflow-hidden">
        {showLayers && (
          <div
            className="absolute left-4 top-3 z-[1500] flex flex-col select-none"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <CanvasLayersPanel
              canvasId={entity.id}
              selectedIds={selectedIds}
              onSelect={selectBlock}
            />
          </div>
        )}

        <div
          ref={canvasContainerRef}
          className="absolute inset-0 overflow-hidden"
          style={{
            cursor: activeTool === 'move' || spaceHeldRef.current
              ? 'grab'
              : activeTool === 'eraser'
                ? 'cell'
                : ['rect', 'ellipse', 'diamond', 'arrow', 'line', 'freedraw', 'text', 'frame'].includes(activeTool)
                  ? 'crosshair'
                  : undefined,
            backgroundColor: resolvedBgColor,
            backgroundImage: canvasPattern === 'grid'
              ? `linear-gradient(to right, color-mix(in srgb, ${canvasPatternColor === 'default' ? 'var(--bone-100)' : canvasPatternColor} ${canvasPatternOpacity * 100}%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, ${canvasPatternColor === 'default' ? 'var(--bone-100)' : canvasPatternColor} ${canvasPatternOpacity * 100}%, transparent) 1px, transparent 1px)`
              : canvasPattern === 'dots'
              ? `radial-gradient(circle, color-mix(in srgb, ${canvasPatternColor === 'default' ? 'var(--bone-100)' : canvasPatternColor} ${canvasPatternOpacity * 100}%, transparent) 1.2px, transparent 1.2px)`
              : 'none',
            backgroundSize: `${20 * viewport.scale}px ${20 * viewport.scale}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          }}
        >
          <div
            id="canvas-bg"
            onPointerDown={handleBgPointerDown}
            onDoubleClick={handleBgDoubleClick}
            onPointerMove={(e) => {
              if (activeTool === 'arrow' || activeTool === 'line') {
                const { x, y } = screenToCanvas(e.clientX, e.clientY);
                const liveBlocks = useStore.getState().blocks.filter(b => b.canvasId === entity.id);
                const target = findBindableBlockAt([x, y], liveBlocks);
                setHoverBindTargetId(prev => (target?.id ?? null) === prev ? prev : (target?.id ?? null));
              } else if (hoverBindTargetId !== null) {
                setHoverBindTargetId(null);
              }

              if (!cloudSyncEnabled || !supabase) return;
              const now = Date.now();
              if (now - lastCursorBroadcastRef.current < 33) return;
              lastCursorBroadcastRef.current = now;
              const { x, y } = screenToCanvas(e.clientX, e.clientY);
              supabase.channel(`cursors:${entity.id}`).send({
                type: 'broadcast',
                event: 'cursor',
                payload: { x, y },
              }).catch((err: unknown) => console.warn('[cursor broadcast]', err));
            }}
            className="w-full h-full relative"
          >
            <div
              id="canvas-viewport-export"
              style={{
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
                transformOrigin: '0 0',
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '100%',
                pointerEvents: 'none',
              }}
            >
              <div id="canvas-viewport-content" style={{ pointerEvents: 'auto' }}>
                <CanvasConnections canvasId={entity.id} selectedIds={selectedIds} onSelect={selectBlock} editingBlockId={editingBlockId} selectedPointIndex={selectedPointIndex} onDoubleClick={handleDoubleClickBlock} onPointSelect={setSelectedPointIndex} onBindingDragStart={handleBindingDrag} activeTool={activeTool} viewportScale={viewport.scale} viewport={viewport} markedIds={eraserMarkedIds} />

                <CanvasShapeLayer
                  blocks={pageBlocks}
                  selectedIds={selectedIds}
                  viewport={viewport}
                  activeTool={activeTool}
                  snapWithObjects={snapWithObjects}
                  updateCanvasBlocks={updateCanvasBlocks}
                  onSelect={selectBlock}
                  onCommit={() => history.push(useStore.getState().blocks.filter(x => x.canvasId === entity.id))}
                  onContextMenu={handleBlockContextMenu}
                  onDoubleClick={handleDoubleClickBlock}
                  markedIds={eraserMarkedIds}
                />

                {/* Snap Guides Overlay */}
                <svg
                  id="canvas-snap-guides"
                  className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-[5000]"
                />

                <FlowPreview />

                {drawingShape && (
                  <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-[4998]">
                    {(['rect', 'frame'].includes(drawingShape.kind)) && (
                      <rect x={drawingShape.x} y={drawingShape.y} width={drawingShape.w} height={drawingShape.h}
                        fill={activeStyle.fill || '#ffffff'} fillOpacity={activeStyle.fillOpacity ?? 1}
                        stroke={activeStyle.stroke || '#ffffff'} strokeWidth={activeStyle.strokeWidth ?? 2}
                        strokeDasharray={activeStyle.strokeStyle === 'dashed' ? '4 3' : activeStyle.strokeStyle === 'dotted' ? '1 2' : undefined}
                        rx={drawingShape.kind === 'frame' ? 0 : (activeStyle.cornerRadius ?? 0)} />
                    )}
                    {(drawingShape.kind === 'ellipse') && (
                      <ellipse cx={drawingShape.x + drawingShape.w/2} cy={drawingShape.y + drawingShape.h/2}
                        rx={drawingShape.w/2} ry={drawingShape.h/2}
                        fill={activeStyle.fill || '#ffffff'} fillOpacity={activeStyle.fillOpacity ?? 1}
                        stroke={activeStyle.stroke || '#ffffff'} strokeWidth={activeStyle.strokeWidth ?? 2}
                        strokeDasharray={activeStyle.strokeStyle === 'dashed' ? '4 3' : activeStyle.strokeStyle === 'dotted' ? '1 2' : undefined} />
                    )}
                    {(drawingShape.kind === 'diamond') && (() => {
                      const {x, y, w, h} = drawingShape;
                      return <polygon points={`${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}`}
                        fill={activeStyle.fill || '#ffffff'} fillOpacity={activeStyle.fillOpacity ?? 1}
                        stroke={activeStyle.stroke || '#ffffff'} strokeWidth={activeStyle.strokeWidth ?? 2}
                        strokeDasharray={activeStyle.strokeStyle === 'dashed' ? '4 3' : activeStyle.strokeStyle === 'dotted' ? '1 2' : undefined} />;
                    })()}
                    {(['line','arrow','freedraw'].includes(drawingShape.kind)) && drawingShape.points.length > 1 && (
                      <path d={drawingShape.points.map((p,i) => `${i===0?'M':'L'}${p[0]},${p[1]}`).join(' ')}
                        fill="none" stroke={activeStyle.stroke || '#ffffff'} strokeWidth={activeStyle.strokeWidth ?? 2}
                        strokeDasharray={activeStyle.strokeStyle === 'dashed' ? '4 3' : activeStyle.strokeStyle === 'dotted' ? '1 2' : undefined} strokeLinecap="round" />
                    )}
                  </svg>
                )}



                {multiSelect.selectionRect && (
                  <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-[4999]">
                    <rect
                      x={multiSelect.selectionRect.x} y={multiSelect.selectionRect.y}
                      width={multiSelect.selectionRect.width} height={multiSelect.selectionRect.height}
                      fill="rgba(42,120,214,0.08)" stroke="var(--brand-blue)"
                      strokeWidth="2"
                    />
                  </svg>
                )}

                {remoteCursors.map(c => (
                  <div
                    key={c.userId}
                    className="absolute pointer-events-none flex items-start gap-1 z-[6000]"
                    style={{ left: c.x, top: c.y }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 2L6 12L7.5 8L11 6.5L2 2Z" fill={c.color} />
                    </svg>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-[4px] whitespace-nowrap"
                      style={{ background: `${c.color}20`, color: c.color, border: `1px solid ${c.color}40` }}
                    >
                      {c.name}
                    </span>
                  </div>
                ))}

                {/* Standalone arrows layer — outside viewport-export so z-index competes with HTML blocks */}
                <svg
                  className="absolute inset-0 pointer-events-none overflow-visible"
                  style={{ zIndex: 10 }}
                >
                  {pageBlocks.filter(b =>
                    (b.shapeKind === 'arrow' || b.shapeKind === 'line' || b.shapeKind === 'freedraw') &&
                    !(b.startBinding || b.endBinding)
                  ).map(b => (
                    <VectorPath key={b.id} block={b}
                      selected={selectedIds.has(b.id)}
                      showIndividualSelection={selectedIds.size <= 1}
                      editing={editingBlockId === b.id}
                      selectedPointIndex={editingBlockId === b.id ? selectedPointIndex : null}
                      activeTool={activeTool}
                      viewportScale={viewport.scale}
                      viewport={{ x: viewport.x, y: viewport.y, scale: viewport.scale }}
                      onSelect={selectBlock}
                      onDoubleClick={(altKey) => handleDoubleClickBlock(b.id, altKey)}
                      onDragStart={(e) => handleArrowDrag(e, b)}
                      onPointSelect={setSelectedPointIndex}
                      erasing={eraserMarkedIds.has(b.id)} />
                  ))}
                </svg>

                {/* Sections render their members inside a clipped wrapper, positioned via a
                    negative-offset inner div so members keep their normal absolute canvas
                    coordinates (no coordinate rewriting needed). Members ALWAYS render here
                    (never move to a different DOM parent) so useDrag's cached drag nodes never
                    go stale mid-drag. Instead, while a member is being dragged, the wrapper's
                    overflow toggles to visible so the dragged member can paint past the
                    section border and stay visible while being dragged out; other (stationary)
                    members are unaffected since they're fully inside by definition. */}
                {frameBlocks.map(f => {
                  const members = pageBlocks.filter(b => b.parentId === f.id);
                  if (members.length === 0) return null;
                  const fx = f.x ?? 0, fy = f.y ?? 0, fw = f.width ?? 0, fh = f.height ?? 0;
                  const hasDraggingMember = members.some(m => draggingMemberIds.has(m.id));
                  return (
                    <div
                      key={`clip-${f.id}`}
                      className={cn("absolute pointer-events-none", hasDraggingMember ? "overflow-visible" : "overflow-hidden")}
                      style={{ left: fx, top: fy, width: fw, height: fh, zIndex: (f.zIndex ?? 0) + 2 }}
                    >
                      <div className="absolute" style={{ left: -fx, top: -fy, pointerEvents: 'auto' }}>
                        {members.map(renderBlock)}
                      </div>
                    </div>
                  );
                })}

                {pageBlocks
                  .filter(b => b.shapeKind !== 'arrow' && b.shapeKind !== 'line' && b.shapeKind !== 'freedraw')
                  .filter(b => !b.parentId || b.type === 'frame')
                  .map(renderBlock)}

                {/* Group bounding box drag overlays — transparent hit areas to drag groups by empty space */}
                {groupOverlays.map(({ groupId, members, bounds }) => (
                  <div
                    key={groupId}
                    className="absolute cursor-move"
                    style={{
                      left: bounds.x,
                      top: bounds.y,
                      width: bounds.width,
                      height: bounds.height,
                      zIndex: 1,
                      pointerEvents: 'auto',
                      touchAction: 'none',
                    }}
                    onPointerDown={(e) => handleGroupOverlayPointerDown(e, members)}
                  />
                ))}

                {/* Multi-selection unified bounding box */}
                <MultiSelectionBox
                  boundingBox={selectionBoundingBox}
                  selectedCount={selectedBlocks.length}
                  onResizeStart={handleGroupResizeStart}
                  onRotateStart={handleGroupRotateStart}
                />

                 {selectionBoundingBox && activeTool === 'select' && showFloatingToolbar && (
                  <div
                    className="absolute pointer-events-none z-[5001] flex justify-center"
                    style={{
                      left: selectionBoundingBox.x + selectionBoundingBox.w / 2,
                      top: selectionBoundingBox.y - 12,
                      transform: `translate(-50%, -100%) scale(${1 / viewport.scale})`,
                      transformOrigin: 'bottom center',
                    }}
                  >
                    <div 
                      className="flex items-center gap-1.5 bg-panel/95 backdrop-blur-xl border border-[var(--bone-12)] shadow-[0_4px_12px_rgba(0,0,0,0.3)] rounded-full px-2.5 py-1.5 pointer-events-auto select-none"
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {/* Quick Colors */}
                      <div className="flex items-center gap-1 pr-1.5 border-r border-border/30">
                        {[
                          { label: 'None', value: 'transparent', opacity: 0 },
                          { label: 'Accent', value: '#d38f36', opacity: 0.15 },
                          { label: 'Blue', value: '#5b9cf6', opacity: 0.15 },
                          { label: 'Purple', value: '#a78bfa', opacity: 0.15 },
                          { label: 'Green', value: '#4ade80', opacity: 0.15 },
                          { label: 'Red', value: '#f87171', opacity: 0.15 },
                        ].map(col => (
                          <button
                            key={col.value}
                            title={col.label}
                            onClick={() => handleQuickColor(col.value, col.opacity)}
                            className="w-4 h-4 rounded-full border border-[var(--bone-15)] hover:border-[var(--bone-60)] transition-none"
                            style={{
                              background: col.value === 'transparent' ? 'transparent' : col.value,
                              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)',
                            }}
                          />
                        ))}
                      </div>

                      {/* Duplicate */}
                      <button
                        title="Duplicate (Ctrl+D)"
                        onClick={handleDuplicateSelection}
                        className="group w-6 h-6 flex items-center justify-center rounded-full text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] active:bg-[var(--bone-15)] transition-none"
                      >
                        <span className="opacity-60 group-hover:opacity-100"><Copy className="w-3.5 h-3.5 text-[var(--bone-100)]" /></span>
                      </button>

                      {/* Bring to Front */}
                      <button
                        title="Bring to Front"
                        onClick={() => handleLayerOrder('front')}
                        className="group w-6 h-6 flex items-center justify-center rounded-full text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] active:bg-[var(--bone-15)] transition-none"
                      >
                        <span className="opacity-60 group-hover:opacity-100"><ArrowUp className="w-3.5 h-3.5 text-[var(--bone-100)]" /></span>
                      </button>

                      {/* Send to Back */}
                      <button
                        title="Send to Back"
                        onClick={() => handleLayerOrder('back')}
                        className="group w-6 h-6 flex items-center justify-center rounded-full text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] active:bg-[var(--bone-15)] transition-none"
                      >
                        <span className="opacity-60 group-hover:opacity-100"><ArrowDown className="w-3.5 h-3.5 text-[var(--bone-100)]" /></span>
                      </button>

                      <div className="w-px h-3.5 bg-border/30 mx-0.5" />

                      {/* Delete */}
                      <button
                        title="Delete (Delete/Backspace)"
                        onClick={handleDeleteSelection}
                        className="group w-6 h-6 flex items-center justify-center rounded-full text-danger/70 hover:text-danger hover:bg-danger/10 transition-none"
                      >
                        <span className="opacity-70 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5 text-[var(--color-danger)]" /></span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {mediaPopover && (
            <MediaUploadPopover
              position={{ x: mediaPopover.x, y: mediaPopover.y }}
              onConfirm={(url) => {
                addCanvasBlock({
                  id: generateId(), type: 'image', content: '',
                  mediaUrl: url,
                  x: mediaPopover.canvasX, y: mediaPopover.canvasY,
                  width: 300, height: 200,
                  canvasId: entity.id,
                });
                setMediaPopover(null);
                setActiveTool('select');
                history.push(useStore.getState().blocks.filter(x => x.canvasId === entity.id));
              }}
              onClose={() => setMediaPopover(null)}
            />
          )}

          {/* Floating Canvas Controls (Zoom and Undo/Redo) in the bottom left */}
          <div 
            className="absolute bottom-6 left-6 z-[1000] flex gap-2 select-none"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >            {/* Zoom Controls */}
            <div className="flex items-center h-8 bg-panel/98 backdrop-blur-xl border border-[var(--bone-12)] shadow-[0_4px_12px_rgba(0,0,0,0.12)] rounded-[8px] p-[3px] canvas-floating-panel">
              <button
                onClick={() => setViewport(p => ({ ...p, scale: Math.max(MIN_ZOOM, p.scale - ZOOM_STEP) }))}
                className="group w-7 h-[26px] rounded-[6px] flex items-center justify-center text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] active:bg-[var(--bone-15)] cursor-pointer transition-all duration-150 ease-in-out"
                title="Zoom Out"
              >
                <span className="opacity-70 group-hover:opacity-100"><Minus className="w-3.5 h-3.5 text-[var(--bone-100)]" /></span>
              </button>
              
              <button
                onClick={() => setViewport(p => ({ ...p, scale: 1.0 }))}
                className="px-2 h-[26px] flex items-center justify-center text-[11px] font-semibold text-[var(--bone-90)] hover:text-[var(--bone-100)] transition-all duration-150 ease-in-out min-w-[48px] text-center cursor-pointer"
                title="Reset Zoom to 100%"
              >
                {Math.round(viewport.scale * 100)}%
              </button>
              
              <button
                onClick={() => setViewport(p => ({ ...p, scale: Math.min(MAX_ZOOM, p.scale + ZOOM_STEP) }))}
                className="group w-7 h-[26px] rounded-[6px] flex items-center justify-center text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] active:bg-[var(--bone-15)] cursor-pointer transition-all duration-150 ease-in-out"
                title="Zoom In"
              >
                <span className="opacity-70 group-hover:opacity-100"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bone-100)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg></span>
              </button>
            </div>

            {/* Undo / Redo Controls */}
            <div className="flex items-center h-8 bg-panel/98 backdrop-blur-xl border border-[var(--bone-12)] shadow-[0_4px_12px_rgba(0,0,0,0.12)] rounded-[8px] p-[3px] gap-[1px] canvas-floating-panel">
              <button
                onClick={handleUndo}
                disabled={!history.canUndo}
                className="group w-7 h-[26px] rounded-[6px] flex items-center justify-center text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--bone-70)] cursor-pointer disabled:cursor-not-allowed transition-all duration-150 ease-in-out"
                title="Undo (Ctrl+Z)"
              >
                <span className="opacity-70 group-hover:opacity-100"><Undo2 className="w-3.5 h-3.5 text-[var(--bone-100)]" /></span>
              </button>
              <button
                onClick={handleRedo}
                disabled={!history.canRedo}
                className="group w-7 h-[26px] rounded-[6px] flex items-center justify-center text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--bone-70)] cursor-pointer disabled:cursor-not-allowed transition-all duration-150 ease-in-out"
                title="Redo (Ctrl+Y)"
              >
                <span className="opacity-70 group-hover:opacity-100"><Redo2 className="w-3.5 h-3.5 text-[var(--bone-100)]" /></span>
              </button>
            </div>
          </div>
        </div>

        {/* Floating Toolbar above the Right Sidebar */}
        <div 
          className="absolute right-4 top-3 z-[1500] w-[250px] h-[40px] flex items-center bg-panel border border-[var(--bone-12)] shadow-[0_4px_12px_rgba(0,0,0,0.12)] rounded-[11px] p-[5px] gap-[4px] select-none canvas-floating-panel"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-[4px] flex-1">
            {/* Toggle Right Sidebar */}
            <button
              onClick={() => setShowStylePanel(!showStylePanel)}
              className={cn(
                "group w-[32px] h-[30px] rounded-[var(--radius-small)] flex items-center justify-center transition-all duration-150 ease-in-out cursor-pointer",
                showStylePanel
                  ? "bg-[var(--bone-6)] text-[var(--bone-100)] font-semibold"
                  : "bg-transparent text-[var(--bone-60)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
              )}
              title="Toggle style sidebar"
            >
              <span className={showStylePanel ? "" : "opacity-60 group-hover:opacity-100"}><PanelRight className="w-4 h-4 text-[var(--bone-100)]" /></span>
            </button>

            {/* Toggle Left Sidebar (Layers) */}
            <button
              onClick={() => setShowLayers(!showLayers)}
              className={cn(
                "group w-[32px] h-[30px] rounded-[var(--radius-small)] flex items-center justify-center transition-all duration-150 ease-in-out cursor-pointer",
                showLayers
                  ? "bg-[var(--bone-6)] text-[var(--bone-100)] font-semibold"
                  : "bg-transparent text-[var(--bone-60)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
              )}
              title="Layers panel"
            >
              <span className={showLayers ? "" : "opacity-60 group-hover:opacity-100"}><Layers className="w-4 h-4 text-[var(--bone-100)]" /></span>
            </button>

            {/* Toggle Snapping */}
            <button
              onClick={() => setSnapEnabled(!snapEnabled)}
              className={cn(
                "group w-[32px] h-[30px] rounded-[var(--radius-small)] flex items-center justify-center transition-all duration-150 ease-in-out cursor-pointer",
                snapEnabled
                  ? "bg-[var(--bone-6)] text-[var(--bone-100)] font-semibold"
                  : "bg-transparent text-[var(--bone-60)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
              )}
              title={snapEnabled ? "Snapping is ON (aligns blocks to each other)" : "Snapping is OFF (smooth movement)"}
            >
              <span className={snapEnabled ? "" : "opacity-60 group-hover:opacity-100"}><Magnet className="w-4 h-4 text-[var(--bone-100)]" /></span>
            </button>

            {/* Export PNG */}
            <button
              onClick={async () => {
                if (exportSuccess) return;
                const el = document.getElementById('canvas-viewport-export');
                if (el) {
                  const bg = resolvedBgColor.startsWith('var(')
                    ? getComputedStyle(document.documentElement).getPropertyValue('--app-background').trim()
                    : resolvedBgColor;
                  await exportCanvasToPng(el as HTMLElement, entity.title, {
                    pixelRatio: 2,
                    backgroundColor: bg,
                    format: 'png',
                    ratio: 'screen',
                    orientation: 'horizontal',
                  });
                  setExportSuccess(true);
                  setTimeout(() => setExportSuccess(false), 1500);
                }
              }}
              className={cn(
                "group w-[32px] h-[30px] rounded-[var(--radius-small)] flex items-center justify-center transition-all duration-150 ease-in-out cursor-pointer",
                exportSuccess
                  ? "bg-[#22c55e1a] text-[#22c55e]"
                  : "bg-transparent text-[var(--bone-60)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
              )}
              title={exportSuccess ? "Exported!" : "Export PNG (2x)"}
            >
              <span>{exportSuccess ? <Check className="w-4 h-4 text-[#22c55e]" /> : <Download className="w-4 h-4 text-[var(--bone-100)]" />}</span>
            </button>

            {/* Copy to Clipboard */}
            <button
              onClick={async () => {
                if (copySuccess) return;
                const el = document.getElementById('canvas-viewport-export');
                if (el) {
                  const bg = resolvedBgColor.startsWith('var(')
                    ? getComputedStyle(document.documentElement).getPropertyValue('--app-background').trim()
                    : resolvedBgColor;
                  await copyCanvasToClipboard(el as HTMLElement, {
                    pixelRatio: 2,
                    backgroundColor: bg,
                    format: 'png',
                    ratio: 'screen',
                    orientation: 'horizontal',
                  });
                  setCopySuccess(true);
                  setTimeout(() => setCopySuccess(false), 1500);
                }
              }}
              className={cn(
                "group w-[32px] h-[30px] rounded-[var(--radius-small)] flex items-center justify-center transition-all duration-150 ease-in-out cursor-pointer",
                copySuccess
                  ? "bg-[#22c55e1a] text-[#22c55e]"
                  : "bg-transparent text-[var(--bone-60)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
              )}
              title={copySuccess ? "Copied!" : "Copy to clipboard (2x)"}
            >
              <span>{copySuccess ? <Check className="w-4 h-4 text-[#22c55e]" /> : <Copy className="w-4 h-4 text-[var(--bone-100)]" />}</span>
            </button>
          </div>

          {/* Share Button */}
          <button
            onClick={() => copyShareLinkToClipboard(entity.id)}
            className="h-[30px] px-3 rounded-[var(--radius-small)] bg-[var(--bone-15)] text-[var(--bone-100)] hover:bg-[var(--bone-25)] hover:text-[var(--bone-100)] text-[11px] font-bold tracking-wide transition-all duration-150 ease-in-out active:bg-[var(--bone-30)] cursor-pointer"
          >
            Share
          </button>
        </div>

        {showStylePanel && (
          <div
            className="absolute right-4 top-[64px] z-[1500] flex flex-col select-none"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <CanvasStylePanel
              selectedIds={selectedIds}
              canvasId={entity.id}
              activeStyle={activeStyle}
              onChangeActiveStyle={setActiveStyle}
              onAlignLeft={() => alignBlocks('left')}
              onAlignCenterH={() => alignBlocks('centerH')}
              onAlignRight={() => alignBlocks('right')}
              onAlignTop={() => alignBlocks('top')}
              onAlignCenterV={() => alignBlocks('centerV')}
              onAlignBottom={() => alignBlocks('bottom')}
              canvasBgColor={canvasBgColor}
              onCanvasBgColorChange={setCanvasBgColor}
              canvasBgOpacity={canvasBgOpacity}
              onCanvasBgOpacityChange={setCanvasBgOpacity}
              canvasPattern={canvasPattern}
              onCanvasPatternChange={setCanvasPattern}
              canvasPatternOpacity={canvasPatternOpacity}
              onCanvasPatternOpacityChange={setCanvasPatternOpacity}
              canvasPatternColor={canvasPatternColor}
              onCanvasPatternColorChange={setCanvasPatternColor}
              activeTool={activeTool}
              selectedPointIndex={selectedPointIndex}
              captureBg={captureBg}
              onCaptureBgChange={setCaptureBg}
              captureRatio={captureRatio}
              onCaptureRatioChange={setCaptureRatio}
              captureOrientation={captureOrientation}
              onCaptureOrientationChange={setCaptureOrientation}
              captureScale={captureScale}
              onCaptureScaleChange={setCaptureScale}
              exportFormat={exportFormat}
              onExportFormatChange={setExportFormat}
              fileName={exportFileName}
              onFileNameChange={setExportFileName}
            />
          </div>
        )}
      </div>
    </div>
  );
}
