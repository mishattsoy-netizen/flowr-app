"use client";

import { Entity, useStore, generateId } from '@/data/store';
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

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.1;

export function CanvasPage({ entity }: { entity: Entity }) {
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [showLayers, setShowLayers] = useState(true);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingConnection, setPendingConnection] = useState<{
    fromId: string; fromSide: string; x: number; y: number; x2: number; y2: number;
  } | null>(null);
  const [drawingShape, setDrawingShape] = useState<{
    kind: string; startX: number; startY: number; x: number; y: number; w: number; h: number;
    points: [number, number][];
  } | null>(null);
  const [mediaPopover, setMediaPopover] = useState<{
    x: number; y: number; canvasX: number; canvasY: number;
  } | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
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
    () => blocks.filter(b => b.canvasId === entity.id),
    [blocks, entity.id]
  );

  const history = useCanvasHistory(pageBlocks);
  const { snapWithObjects } = useCanvasSnap(snapEnabled, pageBlocks);
  const multiSelect = useCanvasMultiSelect(pageBlocks);

  const flowState = useFlowState();

  // Proximity snap detector for connections
  const findClosestBlockHandle = useCallback((cx: number, cy: number) => {
    let best = { id: '', side: '', dist: Infinity };
    // Access current block snapshot for realtime resolution during fast click streams
    const liveBlocks = useStore.getState().blocks.filter(b => b.canvasId === entity.id);
    liveBlocks.forEach(b => {
      if (b.type === 'connection' || b.type === 'shape') return;
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
    if (!isDrawing || currentPath.length < 2) {
      clear();
      return;
    }

    const finalPts = [...currentPath];
    const startSnap = findClosestBlockHandle(finalPts[0][0], finalPts[0][1]);
    const endSnap = findClosestBlockHandle(finalPts[finalPts.length - 1][0], finalPts[finalPts.length - 1][1]);

    const tool = activeTool === 'arrow' || activeTool === 'line' ? activeTool : 'arrow';

    // Create dynamic entity based on context
    addCanvasBlock({
      id: generateId(),
      type: (startSnap && endSnap) ? 'connection' : 'shape',
      content: '',
      canvasId: entity.id,
      shapeKind: tool,
      fromId: startSnap?.id,
      fromSide: startSnap?.side as any,
      toId: endSnap?.id,
      toSide: endSnap?.side as any,
      x: 0, y: 0,
      width: 0, height: 0,
      points: finalPts,
      canvasStyleExt: {
        stroke: '#d38f36',
        strokeWidth: 2,
        strokeStyle: 'solid',
        fill: 'transparent',
        fillOpacity: 0,
      },
    });
    
    clear();
    history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
  }, [activeTool, addCanvasBlock, entity.id, findClosestBlockHandle, history]);


  useEffect(() => {
    setShowStylePanel(selectedIds.size > 0);
  }, [selectedIds]);

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
      }

      switch (e.key.toLowerCase()) {
        case 'v': case 'escape':
          setActiveTool('select');
          if (e.key === 'Escape') {
            setSelectedIds(new Set());
            setPendingConnection(null);
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
  }, [viewport, commitFlowConnection]);

  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewport.x) / viewport.scale,
      y: (clientY - rect.top - viewport.y) / viewport.scale,
    };
  }, [viewport]);

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

    if (mediaPopover) { setMediaPopover(null); return; }
    if (pendingConnection) { setPendingConnection(null); return; }

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
      } else {
        // Handle auto snap completion logic if user clicks nearby an existing anchor handle
        const snap = findClosestBlockHandle(x, y);
        if (snap) {
          addPoint([x, y]);
          commitFlowConnection();
          return;
        }
        addPoint([x, y]);
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
          const nx = Math.min(currentShape.startX, cx), ny = Math.min(currentShape.startY, cy);
          currentShape = { ...currentShape, x: nx, y: ny, w: Math.abs(cx - currentShape.startX), h: Math.abs(cy - currentShape.startY) };
        }
        setDrawingShape(currentShape);
      };

      const onUp = (ev: PointerEvent) => {
        const { x: cx, y: cy } = screenToCanvas(ev.clientX, ev.clientY);
        const isPoint = Math.abs(cx - currentShape.startX) < 3 && Math.abs(cy - currentShape.startY) < 3;
        
        if (!isPoint) {
          const isLineish = kind === 'line' || kind === 'arrow' || kind === 'freedraw';
          addCanvasBlock({
            id: generateId(), type: 'shape', content: '', canvasId: entity.id,
            shapeKind: kind as any,
            x: isLineish ? 0 : currentShape.x, y: isLineish ? 0 : currentShape.y,
            width: isLineish ? 0 : Math.max(currentShape.w, 20),
            height: isLineish ? 0 : Math.max(currentShape.h, 20),
            points: isLineish ? currentShape.points : undefined,
            canvasStyleExt: {
              stroke: '#d38f36', strokeWidth: 2, strokeStyle: 'solid',
              fill: isLineish ? 'transparent' : '#d38f36', fillOpacity: isLineish ? 0 : 0.1,
            },
          });
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

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col bg-[#141413]">
      <CanvasToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        showLayers={showLayers}
        setShowLayers={setShowLayers}
        snapEnabled={snapEnabled}
        setSnapEnabled={setSnapEnabled}
        zoom={viewport.scale}
        onZoomIn={() => setViewport(p => ({ ...p, scale: Math.min(MAX_ZOOM, p.scale + ZOOM_STEP) }))}
        onZoomOut={() => setViewport(p => ({ ...p, scale: Math.max(MIN_ZOOM, p.scale - ZOOM_STEP) }))}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={async () => {
          const el = document.getElementById('canvas-viewport-export');
          if (el) await exportCanvasToPng(el as HTMLElement, entity.title);
        }}
        onShare={() => {
          copyShareLinkToClipboard(entity.id);
        }}
        canvasTitle={entity.title}
      />

      <div className="flex flex-1 overflow-hidden" style={{ paddingTop: 40 }}>
        {showLayers && (
          <CanvasLayersPanel
            canvasId={entity.id}
            selectedIds={selectedIds}
            onSelect={selectBlock}
          />
        )}

        <div
          ref={canvasContainerRef}
          className="flex-1 relative overflow-hidden"
          style={{
            cursor: activeTool === 'move' || spaceHeldRef.current ? 'grab' : undefined,
            background: '#141413',
            backgroundImage: `linear-gradient(to right, var(--bone-3) 1px, transparent 1px), linear-gradient(to bottom, var(--bone-3) 1px, transparent 1px)`,
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
                <CanvasConnections canvasId={entity.id} selectedIds={selectedIds} onSelect={selectBlock} />

                <CanvasShapeLayer
                  blocks={pageBlocks}
                  selectedIds={selectedIds}
                  viewport={viewport}
                  updateCanvasBlocks={updateCanvasBlocks}
                  onSelect={selectBlock}
                  onCommit={() => history.push(useStore.getState().blocks.filter(x => x.canvasId === entity.id))}
                />

                <FlowPreview />

                {drawingShape && (
                  <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-[4998]">
                    {(drawingShape.kind === 'rect') && (
                      <rect x={drawingShape.x} y={drawingShape.y} width={drawingShape.w} height={drawingShape.h}
                        fill="rgba(211,143,54,0.08)" stroke="rgba(211,143,54,0.6)" strokeWidth="1.5" strokeDasharray="4 3" />
                    )}
                    {(drawingShape.kind === 'ellipse') && (
                      <ellipse cx={drawingShape.x + drawingShape.w/2} cy={drawingShape.y + drawingShape.h/2}
                        rx={drawingShape.w/2} ry={drawingShape.h/2}
                        fill="rgba(211,143,54,0.08)" stroke="rgba(211,143,54,0.6)" strokeWidth="1.5" strokeDasharray="4 3" />
                    )}
                    {(drawingShape.kind === 'diamond') && (() => {
                      const {x, y, w, h} = drawingShape;
                      return <polygon points={`${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}`}
                        fill="rgba(211,143,54,0.08)" stroke="rgba(211,143,54,0.6)" strokeWidth="1.5" strokeDasharray="4 3" />;
                    })()}
                    {(['line','arrow','freedraw'].includes(drawingShape.kind)) && drawingShape.points.length > 1 && (
                      <path d={drawingShape.points.map((p,i) => `${i===0?'M':'L'}${p[0]},${p[1]}`).join(' ')}
                        fill="none" stroke="rgba(211,143,54,0.6)" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />
                    )}
                  </svg>
                )}

                {pendingConnection && (
                  <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-[5000]">
                    <line
                      x1={pendingConnection.x} y1={pendingConnection.y}
                      x2={pendingConnection.x2} y2={pendingConnection.y2}
                      stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 4"
                    />
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

                {pageBlocks.map(b => (
                  <CanvasBlock
                    key={b.id}
                    block={b}
                    activeTool={activeTool}
                    viewport={viewport}
                    snapWithObjects={snapWithObjects}
                    isSelected={selectedIds.has(b.id)}
                    selectedIds={selectedIds}
                    onSelect={selectBlock}
                    onCommit={() => history.push(useStore.getState().blocks.filter(x => x.canvasId === entity.id))}
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
        </div>

        {showStylePanel && (
          <CanvasStylePanel
            selectedIds={selectedIds}
            canvasId={entity.id}
            onAlignLeft={() => alignBlocks('left')}
            onAlignCenterH={() => alignBlocks('centerH')}
            onAlignRight={() => alignBlocks('right')}
            onAlignTop={() => alignBlocks('top')}
            onAlignCenterV={() => alignBlocks('centerV')}
            onAlignBottom={() => alignBlocks('bottom')}
          />
        )}
      </div>
    </div>
  );
}
