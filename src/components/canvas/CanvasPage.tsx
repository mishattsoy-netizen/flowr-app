"use client";

import { Entity, useStore, generateId, EditorBlock, CanvasStyleExt } from '@/data/store';
import { Copy, ArrowUp, ArrowDown, Trash2, Minus, Undo2, Redo2, PanelRight, Layers, Magnet, Download } from 'lucide-react';
import { CanvasBlock } from './CanvasBlock';
import { CanvasToolbar, CanvasTool } from './CanvasToolbar';
import { CanvasLayersPanel } from './CanvasLayersPanel';
import { CanvasStylePanel } from './CanvasStylePanel';
import { CanvasConnections } from './CanvasConnections';
import { CanvasShapeLayer } from './CanvasShapeLayer';
import { MediaUploadPopover } from './MediaUploadPopover';
import { useCanvasHistory } from '@/hooks/useCanvasHistory';
import { useCanvasSnap } from '@/hooks/useCanvasSnap';
import { useCanvasMultiSelect } from '@/hooks/useCanvasMultiSelect';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useFlowState } from '@/hooks/useFlowState';
import { FlowPreview } from './FlowPreview';
import { exportCanvasToPng } from '@/lib/canvasExport';
import { copyShareLinkToClipboard } from '@/lib/canvasShare';
import { loadCanvasBlocks, subscribeCanvasBlocks } from '@/lib/canvasSync';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.1;

export function CanvasPage({ entity }: { entity: Entity }) {
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [showLayers, setShowLayers] = useState(true);
  const [showStylePanel, setShowStylePanel] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false);
  const [canvasBgColor, setCanvasBgColor] = useState('default');
  const [canvasPattern, setCanvasPattern] = useState<'none' | 'grid' | 'dots'>('grid');
  const [canvasPatternOpacity, setCanvasPatternOpacity] = useState(0.03);
  const [canvasPatternColor, setCanvasPatternColor] = useState('default');
  const [drawingShape, setDrawingShape] = useState<{
    kind: string; startX: number; startY: number; x: number; y: number; w: number; h: number;
    points: [number, number][];
  } | null>(null);
  const [activeStyle, setActiveStyle] = useState<CanvasStyleExt>({
    stroke: '#ffffff',
    strokeWidth: 2,
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

  const cloudSyncEnabled = !!entity.cloudSyncEnabled;

  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const spaceHeldRef = useRef(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const lastCursorBroadcastRef = useRef(0);

  const blocks = useStore(s => s.blocks);
  const addCanvasBlock = useStore(s => s.addCanvasBlock);
  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);
  const updateCanvasBlocks = useStore(s => s.updateCanvasBlocks);
  const deleteCanvasBlock = useStore(s => s.deleteCanvasBlock);

  const pageBlocks = useMemo(
    () => blocks.filter(b => b.canvasId === entity.id).sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
    [blocks, entity.id]
  );

  const history = useCanvasHistory(pageBlocks);
  const { snapWithObjects, snapForResize } = useCanvasSnap(snapEnabled, pageBlocks, viewport.scale);
  const multiSelect = useCanvasMultiSelect(pageBlocks);

  const flowState = useFlowState();

  // Proximity snap detector for connections
  const findClosestBlockHandle = useCallback((cx: number, cy: number) => {
    let best = { id: '', side: '', dist: Infinity };
    // Access current block snapshot for realtime resolution during fast click streams
    const liveBlocks = useStore.getState().blocks.filter(b => b.canvasId === entity.id);
    liveBlocks.forEach(b => {
      if (b.type === 'connection' || (b.type === 'shape' && (b.shapeKind === 'arrow' || b.shapeKind === 'line' || b.shapeKind === 'freedraw'))) return;
      const bx = b.x || 0, by = b.y || 0;
      const bw = b.width || 280, bh = b.height || 100;
      
      const points = [
        { side: 'top', x: bx + bw / 2, y: by },
        { side: 'bottom', x: bx + bw / 2, y: by + bh },
        { side: 'left', x: bx, y: by + bh / 2 },
        { side: 'right', x: bx + bw, y: by + bh / 2 },
      ];
      
      points.forEach(p => {
        const d = Math.hypot(p.x - cx, p.y - cy);
        if (d < best.dist) {
          best = { id: b.id, side: p.side, dist: d };
        }
      });
    });
    return best.dist < 120 ? { id: best.id, side: best.side } : null;
  }, [entity.id]);

  const commitFlowConnection = useCallback(() => {
    const { currentPath, isDrawing, clear } = useFlowState.getState();
    if (!isDrawing || currentPath.length < 2) { clear(); return; }

    const tool = activeTool === 'arrow' || activeTool === 'line' ? activeTool : 'arrow';
    const first = currentPath[0], last = currentPath[currentPath.length - 1];
    const startSnap = findClosestBlockHandle(first[0], first[1]);
    const endSnap = findClosestBlockHandle(last[0], last[1]);
    const hasStart = !!startSnap;
    const hasEnd = !!endSnap;

    const mkBinding = (snap: { id: string; side: string }) => ({
      blockId: snap.id,
    });

    addCanvasBlock({
      id: generateId(), type: 'shape', content: '', canvasId: entity.id,
      shapeKind: tool,
      startBinding: hasStart ? mkBinding(startSnap!) : undefined,
      endBinding: hasEnd ? mkBinding(endSnap!) : undefined,
      keyPoints: currentPath.slice(hasStart ? 1 : 0, currentPath.length - (hasEnd ? 1 : 0)),
      x: 0, y: 0, width: 0, height: 0,
      editMode: 'simple',
      startArrowhead: tool === 'arrow' ? { type: 'filled-triangle', size: 1 } : { type: 'none' },
      endArrowhead: tool === 'arrow' ? { type: 'filled-triangle', size: 1 } : { type: 'none' },
      canvasStyleExt: { stroke: '#d38f36', strokeWidth: 2, strokeStyle: 'solid', fill: 'transparent', fillOpacity: 0 },
    });
    clear();
    history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
  }, [activeTool, addCanvasBlock, entity.id, findClosestBlockHandle, history]);

  const handleDoubleClickBlock = useCallback((blockId: string) => {
    const block = useStore.getState().blocks.find(b => b.id === blockId);
    if (block && (block.shapeKind === 'arrow' || block.shapeKind === 'line' || block.shapeKind === 'freedraw')) {
      setEditingBlockId(blockId);
      setActiveTool('select');
    }
  }, []);

  const selectedBlocks = useMemo(
    () => pageBlocks.filter(b => selectedIds.has(b.id) && b.type !== 'connection'),
    [pageBlocks, selectedIds]
  );

  const selectionBoundingBox = useMemo(() => {
    if (selectedBlocks.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedBlocks.forEach(b => {
      const bx = b.x ?? 0, by = b.y ?? 0, bw = b.width ?? 0, bh = b.height ?? 0;
      if (bx < minX) minX = bx;
      if (by < minY) minY = by;
      if (bx + bw > maxX) maxX = bx + bw;
      if (by + bh > maxY) maxY = by + bh;
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [selectedBlocks]);

  const handleDuplicateSelection = useCallback(() => {
    if (selectedBlocks.length === 0) return;
    const duplicateMap = new Map<string, string>();
    const duplicatedList: typeof selectedBlocks = [];

    selectedBlocks.forEach(b => {
      const newId = generateId();
      duplicateMap.set(b.id, newId);
      const copy: any = {
        ...b,
        id: newId,
        x: (b.x ?? 0) + 20,
        y: (b.y ?? 0) + 20,
      };
      if (b.points) {
        copy.points = b.points.map(p => [p[0] + 20, p[1] + 20]);
      }
      duplicatedList.push(copy);
    });

    duplicatedList.forEach(copy => {
      if (copy.parentId && duplicateMap.has(copy.parentId)) {
        copy.parentId = duplicateMap.get(copy.parentId);
      }
      addCanvasBlock(copy);
    });

    setSelectedIds(new Set(duplicatedList.map(b => b.id)));
    history.push(useStore.getState().blocks.filter(x => x.canvasId === entity.id));
  }, [selectedBlocks, addCanvasBlock, entity.id, history]);

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

      switch (e.key.toLowerCase()) {
        case 'v': case 'escape':
          setActiveTool('select');
          if (e.key === 'Escape') {
            setSelectedIds(new Set());
            setEditingBlockId(null);
          }
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
        case 'c': setActiveTool('comment'); break;
        case 'f': setActiveTool('section'); break;
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
  }, [selectedIds]); // eslint-disable-line react-hooks/exhaustive-deps

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
    }

    if (mediaPopover) { setMediaPopover(null); return; }

    setShowFloatingToolbar(false);

    // Ignore background click handler if clicking a block, shape, resize handle, or button
    if (
      target.closest('.ResizeHandle') || 
      (target.closest('[id]') && pageBlocks.some(b => b.id === target.closest('[id]')?.id))
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
        setDrawing(true);
        addPoint([x, y]);
        useFlowState.getState().updateMouse({ x, y });
      } else {
        // Handle auto snap completion logic if user clicks nearby an existing anchor handle
        const snap = findClosestBlockHandle(x, y);
        if (snap) {
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

    const SHAPE_TOOLS = ['rect', 'ellipse', 'diamond', 'freedraw'];
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
        
        if (!isPoint) {
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
      addCanvasBlock({ id: generateId(), type: 'text', content: 'Text', x, y, canvasId: entity.id });
      setActiveTool('select');
      history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
    } else if (activeTool === 'image') {
      setMediaPopover({ x: e.clientX, y: e.clientY, canvasX: x, canvasY: y });
    } else if (activeTool === 'section') {
      addCanvasBlock({ id: generateId(), type: 'section', content: 'Frame', x, y, width: 300, height: 200, canvasId: entity.id });
      setActiveTool('select');
      history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
    } else if (activeTool === 'comment') {
      addCanvasBlock({ id: generateId(), type: 'comment', content: '', x, y, canvasId: entity.id });
      setActiveTool('select');
      history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
    }
  };

  function selectBlock(id: string, addToSelection: boolean) {
    setShowFloatingToolbar(false);
    if (addToSelection) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
  }

  const handleBlockContextMenu = useCallback((e: React.MouseEvent, blockId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedIds.has(blockId)) {
      setSelectedIds(new Set([blockId]));
    }
    setShowFloatingToolbar(true);
  }, [selectedIds]);

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col bg-[var(--app-background)]">
      <CanvasToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        canvasTitle={entity.title}
      />

      <div className="flex-1 relative overflow-hidden" style={{ paddingTop: 40 }}>
        {showLayers && (
          <div
            className="absolute left-4 top-[52px] z-[1500] flex flex-col select-none"
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
            cursor: activeTool === 'move' || spaceHeldRef.current ? 'grab' : undefined,
            backgroundColor: canvasBgColor === 'default' ? 'var(--app-background)' : canvasBgColor,
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
            onPointerMove={(e) => {
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
              <div style={{ pointerEvents: 'auto' }}>
                <CanvasConnections canvasId={entity.id} selectedIds={selectedIds} onSelect={selectBlock} editingBlockId={editingBlockId} onDoubleClick={handleDoubleClickBlock} activeTool={activeTool} />

                <CanvasShapeLayer
                  blocks={pageBlocks}
                  selectedIds={selectedIds}
                  viewport={viewport}
                  snapWithObjects={snapWithObjects}
                  updateCanvasBlocks={updateCanvasBlocks}
                  onSelect={selectBlock}
                  onCommit={() => history.push(useStore.getState().blocks.filter(x => x.canvasId === entity.id))}
                  onContextMenu={handleBlockContextMenu}
                  onDoubleClick={handleDoubleClickBlock}
                  activeTool={activeTool}
                />

                {/* Snap Guides Overlay */}
                <svg
                  id="canvas-snap-guides"
                  className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-[5000]"
                />

                <FlowPreview />

                {drawingShape && (
                  <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-[4998]">
                    {(drawingShape.kind === 'rect') && (
                      <rect x={drawingShape.x} y={drawingShape.y} width={drawingShape.w} height={drawingShape.h}
                        fill={activeStyle.fill || '#ffffff'} fillOpacity={activeStyle.fillOpacity ?? 1}
                        stroke={activeStyle.stroke || '#ffffff'} strokeWidth={activeStyle.strokeWidth ?? 2}
                        strokeDasharray={activeStyle.strokeStyle === 'dashed' ? '4 3' : activeStyle.strokeStyle === 'dotted' ? '1 2' : undefined}
                        rx={activeStyle.cornerRadius ?? 0} />
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

                {pageBlocks.filter(b => b.shapeKind !== 'arrow' && b.shapeKind !== 'line' && b.shapeKind !== 'freedraw' && b.type !== 'connection').map(b => (
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
                    onCommit={() => history.push(useStore.getState().blocks.filter(x => x.canvasId === entity.id))}
                    onContextMenu={handleBlockContextMenu}
                    onConnectStart={(side, x, y) => {
                      if (activeTool !== 'arrow' && activeTool !== 'line') return;
                      
                      const { isDrawing, addPoint, setDrawing } = useFlowState.getState();
                      // Immediate initialization directly tied into the clicked coordinate
                      if (!isDrawing) {
                        setDrawing(true);
                        addPoint([x, y]);
                      } else {
                        addPoint([x, y]);
                        commitFlowConnection();
                      }
                    }}
                  />
                ))}

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
          >
            {/* Zoom Controls */}
            <div className="flex items-center h-8 bg-sidebar/98 backdrop-blur-xl border border-[var(--bone-12)] shadow-[0_4px_20px_rgba(0,0,0,0.18)] rounded-[8px] p-[3px]">
              <button
                onClick={() => setViewport(p => ({ ...p, scale: Math.max(MIN_ZOOM, p.scale - ZOOM_STEP) }))}
                className="group w-7 h-[26px] rounded-[6px] flex items-center justify-center text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] active:bg-[var(--bone-15)] cursor-pointer transition-none"
                title="Zoom Out"
              >
                <span className="opacity-70 group-hover:opacity-100"><Minus className="w-3.5 h-3.5 text-[var(--bone-100)]" /></span>
              </button>
              
              <button
                onClick={() => setViewport(p => ({ ...p, scale: 1.0 }))}
                className="px-2 h-[26px] flex items-center justify-center text-[11px] font-semibold text-[var(--bone-90)] hover:text-[var(--bone-100)] transition-none min-w-[48px] text-center cursor-pointer"
                title="Reset Zoom to 100%"
              >
                {Math.round(viewport.scale * 100)}%
              </button>

              <button
                onClick={() => setViewport(p => ({ ...p, scale: Math.min(MAX_ZOOM, p.scale + ZOOM_STEP) }))}
                className="group w-7 h-[26px] rounded-[6px] flex items-center justify-center text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] active:bg-[var(--bone-15)] cursor-pointer transition-none"
                title="Zoom In"
              >
                <span className="opacity-70 group-hover:opacity-100"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bone-100)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg></span>
              </button>
            </div>

            {/* Undo / Redo Controls */}
            <div className="flex items-center h-8 bg-sidebar/98 backdrop-blur-xl border border-[var(--bone-12)] shadow-[0_4px_20px_rgba(0,0,0,0.18)] rounded-[8px] p-[3px] gap-[1px]">
              <button
                onClick={handleUndo}
                disabled={!history.canUndo}
                className="group w-7 h-[26px] rounded-[6px] flex items-center justify-center text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--bone-70)] cursor-pointer disabled:cursor-not-allowed transition-none"
                title="Undo (Ctrl+Z)"
              >
                <span className="opacity-70 group-hover:opacity-100"><Undo2 className="w-3.5 h-3.5 text-[var(--bone-100)]" /></span>
              </button>
              <button
                onClick={handleRedo}
                disabled={!history.canRedo}
                className="group w-7 h-[26px] rounded-[6px] flex items-center justify-center text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--bone-70)] cursor-pointer disabled:cursor-not-allowed transition-none"
                title="Redo (Ctrl+Y)"
              >
                <span className="opacity-70 group-hover:opacity-100"><Redo2 className="w-3.5 h-3.5 text-[var(--bone-100)]" /></span>
              </button>
            </div>
          </div>
        </div>

        {/* Floating Toolbar above the Right Sidebar */}
        <div 
          className="absolute right-4 top-[52px] z-[1500] w-[250px] h-[40px] flex items-center bg-sidebar/95 backdrop-blur-xl border border-[var(--bone-12)] shadow-[0_4px_20px_rgba(0,0,0,0.18)] rounded-[11px] p-[5px] gap-[4px] select-none"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-[4px] flex-1">
            {/* Toggle Right Sidebar */}
            <button
              onClick={() => setShowStylePanel(!showStylePanel)}
              className={cn(
                "group w-[34px] h-[30px] rounded-[var(--radius-small)] flex items-center justify-center transition-none cursor-pointer",
                showStylePanel
                  ? "bg-[var(--bone-15)] text-[var(--bone-100)] font-semibold"
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
                "group w-[34px] h-[30px] rounded-[var(--radius-small)] flex items-center justify-center transition-none cursor-pointer",
                showLayers
                  ? "bg-[var(--bone-15)] text-[var(--bone-100)] font-semibold"
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
                "group w-[34px] h-[30px] rounded-[var(--radius-small)] flex items-center justify-center transition-none cursor-pointer",
                snapEnabled
                  ? "bg-[var(--bone-15)] text-[var(--bone-100)] font-semibold"
                  : "bg-transparent text-[var(--bone-60)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
              )}
              title={snapEnabled ? "Snapping is ON (aligns blocks to each other)" : "Snapping is OFF (smooth movement)"}
            >
              <span className={snapEnabled ? "" : "opacity-60 group-hover:opacity-100"}><Magnet className="w-4 h-4 text-[var(--bone-100)]" /></span>
            </button>

            {/* Export PNG */}
            <button
              onClick={async () => {
                const el = document.getElementById('canvas-viewport-export');
                if (el) await exportCanvasToPng(el as HTMLElement, entity.title);
              }}
              className="group w-[34px] h-[30px] rounded-[var(--radius-small)] flex items-center justify-center text-[var(--bone-60)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)] transition-none cursor-pointer"
              title="Export PNG"
            >
              <span className="opacity-60 group-hover:opacity-100"><Download className="w-4 h-4 text-[var(--bone-100)]" /></span>
            </button>
          </div>

          {/* Share Button */}
          <button
            onClick={() => copyShareLinkToClipboard(entity.id)}
            className="h-[30px] px-3 rounded-[var(--radius-small)] bg-[var(--bone-15)] text-[var(--bone-100)] hover:bg-[var(--bone-25)] hover:text-[var(--bone-100)] text-[11px] font-bold tracking-wide transition-none active:bg-[var(--bone-30)] cursor-pointer"
          >
            Share
          </button>
        </div>

        {showStylePanel && (
          <div
            className="absolute right-4 top-[98px] z-[1500] flex flex-col select-none"
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
              canvasPattern={canvasPattern}
              onCanvasPatternChange={setCanvasPattern}
              canvasPatternOpacity={canvasPatternOpacity}
              onCanvasPatternOpacityChange={setCanvasPatternOpacity}
              canvasPatternColor={canvasPatternColor}
              onCanvasPatternColorChange={setCanvasPatternColor}
              activeTool={activeTool}
            />
          </div>
        )}
      </div>
    </div>
  );
}
