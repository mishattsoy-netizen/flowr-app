"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useStore } from '@/data/store';
import { useCanvasViewport, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from '@/hooks/useCanvasViewport';
import { cn } from '@/lib/utils';
import { useBrainData, type BrainCanvasNode, type BrainCanvasEdge } from './useBrainData';
import { useBrainDrag } from './useBrainDrag';
import { BrainNodeCard, CARD_W, CARD_H, type NodeDisplayInfo } from './BrainNodeCard';
import { BrainCanvasConnections } from './BrainCanvasConnections';
import { BrainToolbar } from './BrainToolbar';
import { BrainPresetPicker } from './BrainPresetPicker';
import { BrainStatsPanel } from './BrainStatsPanel';
import { BrainZoomControls } from './BrainZoomControls';
import { AddExistingEntityPopover } from './AddExistingEntityPopover';
import { logger } from '@/lib/logger';
import { formatAge } from '@/lib/brain/formatAge';
import { hasEdgeBetween } from '@/lib/bot/services/brainEdgeUtils';
import { closestSides, type ConnectorSide } from './connectorGeometry';
import { blocksToMarkdown } from '@/lib/editor/markdownBlocks';
import type { EditorBlock } from '@/data/store.types';
import { FileText, Folder, Brain, Trash2 } from 'lucide-react';

/** Derive display info for a brain node from brain state + entity store. */
function computeDisplayInfo(
  node: BrainCanvasNode,
  entities: Array<{ id: string; type: string; title?: string; parentId?: string | null; lastModified?: number; content?: EditorBlock[] }>,
  perNodeTokens: Record<string, number>,
): NodeDisplayInfo {
  if (node.type === 'section') {
    return {
      typeIcon: <Folder strokeWidth={2} />,
      typeLabel: 'Section',
      parentLabel: 'Section',
      ageLabel: formatAge(node.created_at),
      title: node.label || 'Untitled Section',
      preview: undefined,
      priority: node.priority,
      tokenCount: undefined,
    };
  }

  const entity = node.ref_id ? entities.find(e => e.id === node.ref_id) : null;
  const parentEntity = entity?.parentId ? entities.find(e => e.id === entity.parentId) : null;

  const typeIcons: Record<string, React.ReactNode> = {
    note: <FileText strokeWidth={2} />,
    workspace: <Folder strokeWidth={2} />,
    memory: <Brain strokeWidth={2} />,
  };

  const typeLabels: Record<string, string> = {
    note: 'Note',
    workspace: 'Workspace',
    memory: 'Memory',
  };

  return {
    typeIcon: entity ? (typeIcons[entity.type] ?? <FileText strokeWidth={2} />) : <Brain strokeWidth={2} />,
    typeLabel: entity ? typeLabels[entity.type] : 'Memory',
    parentLabel: parentEntity?.title || (entity?.type === 'workspace' ? 'Workspace' : 'Unsorted'),
    ageLabel: entity?.lastModified ? formatAge(new Date(entity.lastModified).toISOString()) : formatAge(node.created_at),
    title: node.label || entity?.title || node.content?.slice(0, 60) || 'Untitled',
    preview: node.type === 'memory'
      ? (node.content?.slice(0, 120) ?? undefined)
      : (entity?.type === 'note' && entity.content?.length
        ? blocksToMarkdown(entity.content).slice(0, 120)
        : undefined),
    priority: node.priority,
    tokenCount: perNodeTokens[node.id],
  };
}

// Default positions for nodes that lack them — spread in a cascading grid.
function ensurePosition(
  node: BrainCanvasNode,
  index: number,
  existing: Record<string, { x: number; y: number }>,
): { x: number; y: number } {
  if (existing[node.id]) return existing[node.id];
  if (node.position) return node.position;
  // Cascade: place new nodes in a grid starting from (40, 40)
  const cols = Math.floor((typeof window !== 'undefined' ? window.innerWidth : 1200) / (CARD_W + 40));
  const col = index % Math.max(cols, 3);
  const row = Math.floor(index / Math.max(cols, 3));
  return { x: 40 + col * (CARD_W + 40), y: 40 + row * (CARD_H + 40) };
}

export function BrainCanvasPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { viewport, setViewport, viewportRef } = useCanvasViewport(containerRef);

  // ── Brain data (fetched via hook, synced to store's activeBrainId) ──
  const { state, loading, error, selectedBrainId, setSelectedBrainId, load, mutate, addLocalEdge, removeLocalEdge } = useBrainData();
  const activeBrainId = useStore(s => s.activeBrainId);
  const setActiveBrainId = useStore(s => s.setActiveBrainId);

  // Sync the hook's selectedBrainId with the global activeBrainId.
  // This ensures the canvas re-fetches when the user clicks a different brain
  // in the sidebar (BrainSidebarContent sets activeBrainId store).
  useEffect(() => {
    if (activeBrainId && activeBrainId !== selectedBrainId) {
      setSelectedBrainId(activeBrainId);
    }
  }, [activeBrainId, selectedBrainId, setSelectedBrainId]);

  // Initial load (no brainId yet — loads the default brain)
  useEffect(() => {
    if (!selectedBrainId) load();
  }, [load, selectedBrainId]);

  const entities = useStore(s => s.entities);
  const openBrainNode = useStore(s => s.openBrainNode);
  const addEntity = useStore(s => s.addEntity);
  const setColumnEntity = useStore(s => s.setColumnEntity);

  // When loading a new brain, reset positions
  useEffect(() => {
    setPositions({});
  }, [selectedBrainId]);

  // Optimistic positions (synced on drag commit)
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  // Cards are now content-sized (height varies with preview text), so
  // connector-line geometry needs each card's actual rendered height rather
  // than the CARD_H constant — reported up by BrainNodeCard after it measures
  // itself.
  const [heights, setHeights] = useState<Record<string, number>>({});
  const handleHeightChange = useCallback((nodeId: string, height: number) => {
    setHeights(prev => (prev[nodeId] === height ? prev : { ...prev, [nodeId]: height }));
  }, []);

  // Multi-select: shift/ctrl-click accumulates node ids; dragging any
  // selected card moves the whole set together (delta-based, no bounding
  // box — the dragged card's own delta is applied to every other selected
  // card's own starting position, captured at drag start).
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const groupDragOriginRef = useRef<Record<string, { x: number; y: number }> | null>(null);

  const handleNodeClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      setSelectedNodeIds(prev => {
        const next = new Set(prev);
        if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
        return next;
      });
      return true; // handled as a selection toggle, caller should stop here
    }
    return false;
  }, []);

  // Right-click delete menu — a small local menu rather than the app's
  // global sidebar ContextMenu (that one is entity/sidebar-specific; brain
  // nodes are a different data model with their own delete path).
  const [nodeContextMenu, setNodeContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const handleDeleteNode = useCallback(async (nodeId: string) => {
    setNodeContextMenu(null);
    try {
      await mutate({ action: 'remove_node', node_id: nodeId });
    } catch (e) {
      logger.error('Failed to delete brain node:', e);
    }
  }, [mutate]);

  // Reset positions when data loads (fresh from API)
  useEffect(() => {
    if (state?.nodes) {
      setPositions(prev => {
        const next = { ...prev };
        for (const n of state.nodes) {
          if (!next[n.id] && n.position) next[n.id] = n.position;
        }
        return next;
      });
    }
  }, [state?.nodes]);

  // Node display info derived from entities + brain data
  const nodeInfos = useMemo(() => {
    if (!state) return new Map<string, NodeDisplayInfo>();
    const map = new Map<string, NodeDisplayInfo>();
    for (const node of state.nodes) {
      if (!node.enabled) continue;
      map.set(node.id, computeDisplayInfo(node, entities, state.perNodeTokens ?? {}));
    }
    return map;
  }, [state, entities]);

  // Active nodes (enabled only, positioned)
  const activeNodes = useMemo(() => {
    if (!state) return [];
    return state.nodes.filter(n => n.enabled);
  }, [state]);

  const nodePositions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    for (let i = 0; i < activeNodes.length; i++) {
      map[activeNodes[i].id] = ensurePosition(activeNodes[i], i, positions);
    }
    return map;
  }, [activeNodes, positions]);

  // Which sides already have an edge — same box + closestSides as line geometry
  // so card dots mark the ports the paths actually use.
  const connectedSidesByNode = useMemo(() => {
    const map: Record<string, ConnectorSide[]> = {};
    const add = (nodeId: string, side: ConnectorSide) => {
      const list = map[nodeId] ?? (map[nodeId] = []);
      if (!list.includes(side)) list.push(side);
    };
    if (!state) return map;
    for (const edge of state.edges) {
      const fromPos = nodePositions[edge.from_node];
      const toPos = nodePositions[edge.to_node];
      if (!fromPos || !toPos) continue;
      const fromBox = {
        x: fromPos.x, y: fromPos.y, width: CARD_W,
        height: heights[edge.from_node] ?? CARD_H,
      };
      const toBox = {
        x: toPos.x, y: toPos.y, width: CARD_W,
        height: heights[edge.to_node] ?? CARD_H,
      };
      const [fromSide, toSide] = closestSides(fromBox, toBox);
      add(edge.from_node, fromSide);
      add(edge.to_node, toSide);
    }
    return map;
  }, [state, nodePositions, heights]);

  // Update position for a single node during drag — if it's part of a
  // multi-selection, fan the same delta out to every other selected node.
  const handlePositionChange = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    setDraggingNodeId(nodeId);
    if (selectedNodeIds.has(nodeId) && selectedNodeIds.size > 1) {
      if (!groupDragOriginRef.current) {
        // Snapshot every selected node's position at the start of this drag
        // gesture so deltas compound off a fixed origin, not each other.
        const origin: Record<string, { x: number; y: number }> = {};
        for (const id of selectedNodeIds) origin[id] = nodePositions[id] ?? { x: 0, y: 0 };
        groupDragOriginRef.current = origin;
      }
      const origin = groupDragOriginRef.current;
      const dx = pos.x - origin[nodeId].x;
      const dy = pos.y - origin[nodeId].y;
      setPositions(prev => {
        const next = { ...prev };
        for (const id of selectedNodeIds) {
          next[id] = { x: origin[id].x + dx, y: origin[id].y + dy };
        }
        return next;
      });
    } else {
      setPositions(prev => ({ ...prev, [nodeId]: pos }));
    }
  }, [selectedNodeIds, nodePositions]);

  // Commit position to API (debounced — fires on pointer up)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const commitOnePosition = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    if (debounceTimers.current[nodeId]) clearTimeout(debounceTimers.current[nodeId]);
    debounceTimers.current[nodeId] = setTimeout(async () => {
      try {
        await mutate({ action: 'update_node', node_id: nodeId, updates: { position: pos } });
      } catch (e) {
        logger.error('Failed to save node position:', e);
      }
    }, 300);
  }, [mutate]);

  const handleCommit = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    setDraggingNodeId(null);
    if (groupDragOriginRef.current && selectedNodeIds.has(nodeId)) {
      // Commit every selected node's final position, not just the one the
      // pointer was actually on.
      for (const id of selectedNodeIds) {
        const finalPos = positions[id];
        if (finalPos) commitOnePosition(id, finalPos);
      }
      groupDragOriginRef.current = null;
    } else {
      commitOnePosition(nodeId, pos);
    }
  }, [selectedNodeIds, positions, commitOnePosition]);

  const { onNodePointerDown } = useBrainDrag(viewport, {
    onPositionChange: handlePositionChange,
    onCommit: handleCommit,
  });

  // Tool modes
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState<string | null>(null);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [newNodeMode, setNewNodeMode] = useState(false);

  // Cursor position in canvas space, tracked only while the connect tool is
  // active. Passed to every card so a card can light up its nearest connector
  // dot as the cursor *approaches* it — including from outside the card, which
  // a card-local onMouseMove can't detect (it only fires over the card).
  const [connectCursor, setConnectCursor] = useState<{ x: number; y: number } | null>(null);
  const handleConnectMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setConnectCursor({
      x: (e.clientX - rect.left - viewport.x) / viewport.scale,
      y: (e.clientY - rect.top - viewport.y) / viewport.scale,
    });
  }, [viewport]);

  // Clear pending wire and leave connect tool (Esc / right-click).
  const resetConnectTool = useCallback(() => {
    setConnectSource(null);
    setConnectCursor(null);
    setConnectMode(false);
  }, []);

  // Connect tool: click a node to pick it as the source, click a second node
  // to connect them instantly (closest facing sides, no label required —
  // the connection alone tells the AI the nodes are related; see
  // brainCompiler's fallback line for unlabeled edges).
  const handleNodeConnectClick = useCallback(async (nodeId: string) => {
    if (!connectSource) {
      setConnectSource(nodeId);
      return;
    }
    if (connectSource === nodeId) {
      setConnectSource(null); // clicked the same node again — deselect
      return;
    }
    const from = connectSource;
    // One undirected link per pair — reconnecting must not stack lines.
    if (hasEdgeBetween(state?.edges ?? [], from, nodeId)) {
      setConnectSource(null);
      return;
    }
    setConnectSource(null);
    // Paint the line immediately with a temp id — don't wait on the POST
    // round-trip (SELECT + INSERT + revision log against Supabase, easily
    // half a second+). The backgrounded reload below replaces `edges`
    // wholesale with server truth once it resolves, so the temp id is only
    // ever visible for that one round trip and never persisted or duplicated.
    const tempId = `temp-${from}-${nodeId}-${Date.now()}`;
    addLocalEdge({ id: tempId, from_node: from, to_node: nodeId, label: '' });
    try {
      await mutate({ action: 'connect', from, to: nodeId, label: '' }, { backgroundReload: true });
    } catch (e) {
      logger.error('Failed to create edge:', e);
      removeLocalEdge(tempId);
    }
  }, [connectSource, state?.edges, mutate, addLocalEdge, removeLocalEdge]);

  // New node: click to place on the canvas
  const handleCanvasClick = useCallback(async (e: React.MouseEvent) => {
    // Space-pan must never place nodes or clear selection.
    if (spaceHeldRef.current || didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    if (!newNodeMode) {
      // Plain click on empty canvas clears the multi-selection.
      if (selectedNodeIds.size > 0) setSelectedNodeIds(new Set());
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - viewport.x) / viewport.scale;
    const y = (e.clientY - rect.top - viewport.y) / viewport.scale;

    setNewNodeMode(false);

    // Create a real note entity
    const entityId = addEntity({ type: 'note', title: 'New Note', content: [] });
    if (!entityId) return;

    // Open it immediately in the right column so the click feels instant —
    // don't wait on the brain-node round trip.
    openBrainNode(entityId);

    // addEntity's own Supabase write is debounced (see debouncedPushEntity),
    // so the entity may not exist server-side yet when add_node's
    // assertOwnedEntity check runs. Push it synchronously here first —
    // otherwise add_node 404s silently and the card never appears.
    const entity = useStore.getState().entities.find(en => en.id === entityId);
    if (entity) {
      const { upsertEntity } = await import('@/lib/sync');
      await upsertEntity(entity);
    }

    // Add it as a brain node
    try {
      await mutate({ action: 'add_node', type: 'entity', ref_id: entityId, position: { x, y } });
    } catch (e) {
      logger.error('Failed to add brain node:', e);
    }
  }, [newNodeMode, viewport, addEntity, mutate, openBrainNode, selectedNodeIds]);

  // Add existing entity as brain node
  const handleAddExisting = useCallback(async (refId: string, type: 'entity' | 'workspace') => {
    const x = 40 + (activeNodes.length % 5) * (CARD_W + 40);
    const y = 40 + Math.floor(activeNodes.length / 5) * (CARD_H + 40);
    try {
      await mutate({ action: 'add_node', type, ref_id: refId, position: { x, y } });
    } catch (e) {
      logger.error('Failed to add existing entity:', e);
    }
  }, [activeNodes.length, mutate]);

  // Space / middle-click pan — always navigation, even over nodes and with
  // connect/new-node tools active. State (not only refs) so cursors re-render.
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const spaceHeldRef = useRef(false);
  const didPanRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    const isTypingTarget = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable;
    };
    /** Steal focus from sidebar/chrome so Space doesn't highlight/activate them. */
    const focusCanvas = () => {
      const canvas = containerRef.current;
      if (!canvas) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== canvas && !canvas.contains(active)) {
        active.blur();
      }
      if (document.activeElement !== canvas) {
        canvas.focus({ preventScroll: true });
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.code === 'Escape' && (connectMode || connectSource)) {
        e.preventDefault();
        resetConnectTool();
        return;
      }
      if (e.code !== 'Space') return;
      // Prevent page scroll + button activation; keep held across key-repeat.
      e.preventDefault();
      focusCanvas();
      if (spaceHeldRef.current) return;
      spaceHeldRef.current = true;
      setSpaceHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      // Stop focused <button>s from firing click on Space keyup.
      e.preventDefault();
      spaceHeldRef.current = false;
      setSpaceHeld(false);
    };
    const onBlur = () => {
      spaceHeldRef.current = false;
      setSpaceHeld(false);
      isPanningRef.current = false;
      setIsPanning(false);
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp, { passive: false });
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [connectMode, connectSource, resetConnectTool]);

  const handleBgPointerDown = useCallback((e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    // Don't pan when interacting with floating chrome (toolbar, pickers, etc.).
    if (t.closest?.('.canvas-floating-panel')) return;

    // Own keyboard focus so the next Space doesn't target the sidebar.
    if (containerRef.current && document.activeElement !== containerRef.current) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && !containerRef.current.contains(active)) {
        active.blur();
      }
      containerRef.current.focus({ preventScroll: true });
    }

    // Right-click cancels connect tool (pending wire + mode).
    if (e.button === 2 && (connectMode || connectSource)) {
      e.preventDefault();
      e.stopPropagation();
      resetConnectTool();
      return;
    }

    const onNode = !!t.closest?.('[data-brain-node]');
    // Middle-click: always pan.
    // Space+left: pan anywhere (including over nodes) — tools must not steal it.
    // Select tool (no connect / new-node): left-drag empty canvas pans; nodes stay draggable.
    const emptyCanvasPan =
      e.button === 0
      && !spaceHeldRef.current
      && !connectMode
      && !newNodeMode
      && !onNode;

    if (e.button === 1 || (e.button === 0 && spaceHeldRef.current) || emptyCanvasPan) {
      e.preventDefault();
      e.stopPropagation();
      isPanningRef.current = true;
      didPanRef.current = false;
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y };
    }
  }, [viewport, connectMode, newNodeMode, connectSource, resetConnectTool]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!isPanningRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didPanRef.current = true;
      setViewport(prev => ({
        ...prev,
        x: panStartRef.current.vx + dx,
        y: panStartRef.current.vy + dy,
      }));
    };
    const onUp = () => {
      isPanningRef.current = false;
      setIsPanning(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [setViewport]);

  // Default = system arrow. Hand only while actively panning or holding Space
  // (open hand). Connect stays crosshair for both pick steps — no alias cursor.
  const canvasCursor = isPanning
    ? 'cursor-grabbing'
    : spaceHeld
      ? 'cursor-grab'
      : (connectMode || newNodeMode)
        ? 'cursor-crosshair'
        : undefined;

  if (!state) {
    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          {`Error: ${error}`}
        </div>
      );
    }
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-[var(--app-background)]">
        <div className="w-[200px] h-1.5 bg-[var(--bone-3)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--brand-blue)] rounded-full w-[70px] brain-loading-progress-bar" />
        </div>
        <style dangerouslySetInnerHTML={{
          __html: `
          .brain-loading-progress-bar {
            animation: brain-indeterminate 1.5s infinite ease-in-out;
          }
          @keyframes brain-indeterminate {
            0% { transform: translateX(-70px); }
            100% { transform: translateX(200px); }
          }
        `}} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className={cn(
        "relative flex-1 h-full overflow-hidden bg-[var(--app-background)] select-none outline-none",
        canvasCursor,
        // Force hand over nodes while space / pan (child cursor-* otherwise wins).
        spaceHeld && !isPanning && "[&_*]:!cursor-grab",
        isPanning && "[&_*]:!cursor-grabbing",
      )}
      data-bg="true"
      onPointerDown={handleBgPointerDown}
      onContextMenu={(e) => {
        // Suppress browser menu while connect tool is active; reset is handled
        // on pointerdown button===2 (works over nodes and empty canvas).
        if (connectMode || connectSource) {
          e.preventDefault();
        }
      }}
    >
      {/* ── Top bar: presets + stats ── */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
        <BrainPresetPicker
          brains={state.brains}
          selectedBrainId={selectedBrainId}
          onSelect={(id) => { setSelectedBrainId(id); setActiveBrainId(id); }}
        />
      </div>
      <div className="absolute top-4 right-4 z-20">
        <BrainStatsPanel
          used={state.budget.used}
          limit={state.budget.limit}
          nodeCount={state.nodes.filter(n => n.enabled).length}
          edgeCount={state.edges.length}
        />
      </div>

      {/* ── Transformed layer (viewport) ── */}
      <div
        className="absolute inset-0"
        data-bg="true"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: '0 0',
        }}
        onClick={handleCanvasClick}
        onMouseMove={connectMode ? handleConnectMouseMove : undefined}
        onMouseLeave={connectMode ? () => setConnectCursor(null) : undefined}
      >
        {/* Background grid dots */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: 4000, minHeight: 4000, left: -2000, top: -2000 }}>
          <defs>
            <pattern id="brain-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.5" fill="var(--bone-6)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#brain-grid)" />
        </svg>

        {/* Connections */}
        <BrainCanvasConnections
          nodes={activeNodes}
          edges={state.edges}
          positions={nodePositions}
          heights={heights}
          draggingNodeId={draggingNodeId}
          pendingConnect={connectSource ? { sourceNodeId: connectSource, cursor: connectCursor } : null}
        />

        {/* Nodes */}
        {activeNodes.map((node, index) => {
          const pos = nodePositions[node.id];
          const info = nodeInfos.get(node.id);
          if (!info) return null;

          return (
            <BrainNodeCard
              key={node.id}
              id={node.id}
              display={info}
              position={pos}
              onHeightChange={handleHeightChange}
              connectCursor={connectMode ? connectCursor : null}
              connectedSides={connectedSidesByNode[node.id]}
              dragging={draggingNodeId === node.id}
              connectMode={connectMode}
              connectSelected={connectSource === node.id}
              multiSelected={selectedNodeIds.has(node.id)}
              cursorClassName={
                spaceHeld || isPanning
                  ? undefined // parent forces grab via [&_*]
                  : connectMode
                    ? 'cursor-crosshair'
                    : undefined
              }
              onPointerDown={(e) => {
                // Space/middle-click = pan only (handled on container). Never drag nodes.
                if (spaceHeldRef.current || e.button === 1) return;
                if (!connectMode) onNodePointerDown(e, node.id, pos);
              }}
              onClick={(e) => {
                if (spaceHeldRef.current || didPanRef.current) {
                  didPanRef.current = false;
                  return;
                }
                if (connectMode) {
                  handleNodeConnectClick(node.id);
                  return;
                }
                if (handleNodeClick(node.id, e)) return; // shift/ctrl-click toggled selection
                // Only notes open in the right column — workspaces/folders
                // have no useful single-note editor view here.
                if (node.type === 'entity' && node.ref_id) openBrainNode(node.ref_id);
              }}
              onContextMenu={connectMode ? undefined : (e) => {
                setNodeContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
              }}
            />
          );
        })}
      </div>

      {/* Right-click node menu — delete only, for now. */}
      {nodeContextMenu && (
        <>
          <div className="fixed inset-0 z-[299]" onClick={() => setNodeContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setNodeContextMenu(null); }} />
          <div
            className="fixed z-[300] popup-glass-small min-w-[160px] p-1 flex flex-col gap-[2px]"
            style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
          >
            <button
              onClick={() => handleDeleteNode(nodeContextMenu.nodeId)}
              className="popup-item popup-item-danger w-full flex items-center gap-2 px-3 py-[4px] text-sm"
            >
              <Trash2 strokeWidth={2} className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left font-medium tracking-wide">Delete</span>
            </button>
          </div>
        </>
      )}

      {/* ── Toolbar ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
        <div className="relative">
        <BrainToolbar
          connectMode={connectMode}
          onToggleConnect={() => { setConnectMode(true); setNewNodeMode(false); setAddExistingOpen(false); setConnectSource(null); }}
          onNewNode={() => { setNewNodeMode(true); setConnectMode(false); setAddExistingOpen(false); setConnectSource(null); }}
          newNodeActive={newNodeMode}
          addExistingOpen={addExistingOpen}
          onToggleAddExisting={() => setAddExistingOpen(!addExistingOpen)}
          onSelectTool={() => { setConnectMode(false); setNewNodeMode(false); setAddExistingOpen(false); setConnectSource(null); }}
        />
        {addExistingOpen && (
          <AddExistingEntityPopover
            onAddEntity={handleAddExisting}
            onClose={() => setAddExistingOpen(false)}
          />
        )}
        </div>
      </div>

      {/* ── Zoom controls ── */}
      <BrainZoomControls
        viewportScale={viewport.scale}
        onZoomOut={() => setViewport(p => ({ ...p, scale: Math.max(MIN_ZOOM, p.scale - ZOOM_STEP) }))}
        onZoomReset={() => setViewport(p => ({ ...p, scale: 1.0 }))}
        onZoomIn={() => setViewport(p => ({ ...p, scale: Math.min(MAX_ZOOM, p.scale + ZOOM_STEP) }))}
      />
    </div>
  );
}
